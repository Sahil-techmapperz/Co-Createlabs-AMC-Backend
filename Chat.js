const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const chatApp = express();
const chatServer = http.createServer(chatApp);
const ChatMessage = require('./models/ChatMessage');
const { authenticateSocket } = require('./Middleware');

// Configure Socket.IO to allow all origins
const io = new Server(chatServer, {
  cors: {
    origin: "*", // Allow all origins
    methods: ["GET", "POST"], // Specify methods to allow
    credentials: true // Required for cookies, authorization headers with HTTPS
  }
});




io.use(authenticateSocket);

chatApp.get("/", (req, res) => {
  res.status(200).send({ message: 'Hello from the Cocreatedlab AMC Chat backend' });
});

// User ID to Socket ID mapping
const userSocketMap = {};

io.on('connection', (socket) => {
console.log("Connect");

// Example approach for handling multiple devices per user
socket.on('register', ({ userId }) => {
    if (!userSocketMap[userId]) {
      userSocketMap[userId] = new Set();
    }
    userSocketMap[userId].add(socket.id);
    console.log(`User ${userId} mapped to socket ${socket.id}`);
  });



  socket.on('typing', ({ userId, isTyping, groupId }) => {
    // Check if groupId is provided and is not null or empty
    if (groupId && groupId.trim() !== '') {
      // If groupId is available, emit the typing event to the group
      socket.to(groupId).emit('typing', { userId, isTyping });
    } else {
      // If groupId is not provided, find the receiver's socket ID using userId
      // and emit the typing event directly to that user
      const receiverSocketId = userSocketMap[userId];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('typing', { userId, isTyping });
      }
    }
  });
  


  socket.on('fetchMessages', async ({ groupId, senderId, receiverId, page = 1, limit = 50 }) => {
    try {
      let query = {};
      const options = {
        sort: { createdAt: 1 },
        limit: limit,
        skip: (page - 1) * limit, // For pagination
      };
  
      if (groupId) {
        query.groupId = groupId;
      } else if (senderId && receiverId) {
        query = {
          $or: [
            { $and: [{ senderId }, { receiverId }] },
            { $and: [{ senderId: receiverId }, { receiverId: senderId }] }
          ]
        };
      }
  
      const messages = await ChatMessage.find(query, null, options)
        .populate('senderId', 'username')
        .populate('receiverId', 'username');
  
      // Assuming the client can handle the message objects directly
      socket.emit('messages', messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      socket.emit('error', 'Could not fetch messages');
    }
  });
  

  socket.on('newMessage', async ({ senderId, content, receiverId, groupId }) => {
    if (!content || !senderId || (!receiverId && !groupId)) {
      socket.emit('error', 'Missing required message fields.');
      return;
    }
  
    try {
      const messageData = { content, senderId, receiverId: receiverId || undefined, groupId: groupId || undefined };
      const savedMessage = await new ChatMessage(messageData).save();
  
      // For group messages
      if (groupId) {
        // Emit to everyone in the group, including the sender for simplicity
        io.in(groupId).emit('message', savedMessage);
      } 
      // For direct messages
      else if (receiverId && userSocketMap[receiverId]) {
        // Emit only to the receiver
        io.to(userSocketMap[receiverId]).emit('message', savedMessage);
        // Optionally, confirm to the sender that the message was sent (not shown)
      } 
      else {
        console.log(`No active socket for user ${receiverId}`);
        // Optionally, inform the sender that the receiver is not connected (not shown)
      }
  
      // If the sender needs confirmation or additional data (e.g., message ID), send it here
      // socket.emit('messageSent', { status: 'delivered', messageId: savedMessage._id, ... });
    } catch (error) {
      console.error('Error saving message:', error);
      socket.emit('error', 'Error saving message.');
    }
  });
  

  socket.on('joinRoom', async ({ groupId, page = 1, limit = 50 }) => {
    if (!groupId) {
      socket.emit('error', 'Missing or invalid groupId.');
      return;
    }
  
    try {
      // The user joins the specified room
      socket.join(groupId);
      console.log(`Socket ${socket.id} joined room ${groupId}`);
  
      // Fetch historical messages with pagination
      const messages = await ChatMessage.find({ groupId })
        .sort({ createdAt: -1 }) // Fetch the most recent messages first
        .limit(limit)
        .skip((page - 1) * limit);
  
      // Reverse the messages to display oldest to newest on the client
      const historicalMessages = messages.reverse();
  
      // Emitting the historical messages back to the user who joined the room
      socket.emit('historicalMessages', historicalMessages);
  
      // Optionally, confirm to the user that they have joined the room
      socket.emit('joinedRoom', { groupId, messageCount: historicalMessages.length });
    } catch (error) {
      console.error(`Error fetching historical messages for room ${groupId}:`, error);
      socket.emit('error', `Could not fetch historical messages for room ${groupId}.`);
    }
  });
  

  socket.on('messageRead', async ({ messageId, userId }) => {
    if (!messageId || !userId) {
      socket.emit('error', 'Missing messageId or userId.');
      return;
    }
  
    try {
      const updatedMessage = await ChatMessage.findByIdAndUpdate(
        messageId,
        { $addToSet: { readBy: { userId, readAt: new Date() } } },
        { new: true }
      ).populate('groupId'); // Assuming you want to handle group messages
  
      if (!updatedMessage) {
        socket.emit('error', 'Message not found or could not be updated');
        return;
      }
  
      // Handling for direct messages
      if (!updatedMessage.groupId && updatedMessage.senderId !== userId) {
        const target = userSocketMap[updatedMessage.senderId];
        if (target) {
          io.to(target).emit('messageUpdated', updatedMessage);
        }
      }
      // Handling for group messages
      else if (updatedMessage.groupId) {
        updatedMessage.groupId.members.forEach(memberId => {
          if (memberId !== userId && userSocketMap[memberId]) {
            io.to(userSocketMap[memberId]).emit('messageUpdated', updatedMessage);
          }
        });
      }
  
      console.log(`Message ${messageId} read by userId: ${userId}`);
    } catch (error) {
      console.error('Error updating message read status:', error);
      socket.emit('error', 'Error updating message read status');
    }
  });
  



  socket.on('editMessage', async ({ messageId, newContent, userId }) => {
    console.log("Editing message:", messageId);
  
    if (!messageId || typeof newContent !== 'string') {
      socket.emit('error', 'Invalid message ID or content.');
      return;
    }
  
    try {
      // Fetch the message first to check permissions
      const message = await ChatMessage.findById(messageId);
  
      if (!message) {
        socket.emit('error', 'Message not found.');
        return;
      }
  
      // Verify the user has permission to edit the message
      if (message.senderId.toString() !== userId) {
        socket.emit('error', 'User does not have permission to edit this message.');
        return;
      }
  
      // Proceed with updating the message
      const updatedMessage = await ChatMessage.findByIdAndUpdate(
        messageId,
        { $set: { content: newContent, isUpdate: true } },
        { new: true }
      );
  
      // For direct messages
      if (updatedMessage.receiverId && userSocketMap[updatedMessage.receiverId]) {
        io.to(userSocketMap[updatedMessage.receiverId]).emit('messageUpdated', updatedMessage);
      }
      // For group messages
      else if (updatedMessage.groupId) {
        io.in(updatedMessage.groupId).emit('messageUpdated', updatedMessage);
      }
  
      // Confirm to the sender that the message was updated
      socket.emit('messageUpdated', updatedMessage);
    } catch (error) {
      console.error('Error updating message:', error);
      socket.emit('error', 'Error updating message');
    }
  });
  


  socket.on('deleteMessage', async ({ messageId, userId }) => {
    if (!messageId || !userId) {
      socket.emit('error', 'Invalid request: missing messageId or userId.');
      return;
    }
  
    try {
      const message = await ChatMessage.findById(messageId);
  
      if (!message) {
        socket.emit('error', 'Message not found.');
        return;
      }
  
      // Verify the user has permission to delete the message
      // This might involve checking if the userId matches the message's senderId or if the user is an admin
      if (message.senderId.toString() !== userId /* and user is not an admin */) {
        socket.emit('error', 'User does not have permission to delete this message.');
        return;
      }
  
      // Proceed with deleting the message
      await message.remove();
  
      // For direct messages, notify the receiver
      if (message.receiverId && userSocketMap[message.receiverId]) {
        io.to(userSocketMap[message.receiverId]).emit('messageDeleted', messageId);
      }
      // For group messages, broadcast to the group
      else if (message.groupId) {
        io.in(message.groupId).emit('messageDeleted', messageId);
      }
  
      // Confirm to the sender that the message was deleted
      socket.emit('messageDeleted', messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
      socket.emit('error', 'Error deleting message');
    }
  });
  


// On disconnect, remove the socket ID from the user's set
socket.on('disconnect', () => {
    Object.keys(userSocketMap).forEach(userId => {
      userSocketMap[userId].delete(socket.id);
      if (userSocketMap[userId].size === 0) {
        delete userSocketMap[userId];
      }
    });
    console.log(`Socket ${socket.id} disconnected`);
  });

});




const chatPort = 8000;
chatServer.listen(chatPort, () => {
  console.log(`Chat server listening at http://localhost:${chatPort}`);
});
