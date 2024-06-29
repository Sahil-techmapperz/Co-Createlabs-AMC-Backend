const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const chatApp = express();
const chatServer = http.createServer(chatApp);
const ChatMessage = require('./models/ChatMessage');
const User = require('./models/User'); // Ensure the User model is imported
const mongoose = require('mongoose');

const JWT_SECRET = process.env.JWT_SECRET || 'ghgsdgjashgdadtqdjcasgd';

const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth.token;
  console.log('Received token:', token); // Debugging statement

  if (!token) {
    console.log('No token provided');
    return next(new Error('No token provided'));
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log('Authentication error:', err);
      return next(new Error('Authentication error'));
    }

    socket.user = decoded; // Attach user info to socket
    next();
  });
};

const io = new Server(chatServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.use(authenticateSocket);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://cocreatelabs1:oioSfhcOZ6xtZn4c@cocreatelab.rswa0ic.mongodb.net/Cocreatelabs_AMC_backend_New')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

chatApp.get("/", (req, res) => {
  res.status(200).send({ message: 'Hello from the Cocreatedlab AMC Chat backend' });
});

const userSocketMap = {};

const updateOnlineUsers = () => {
  const onlineUsers = Object.keys(userSocketMap);
  io.emit('onlineUsers', onlineUsers);
};

io.on('connection', (socket) => {
  console.log("User connected:", socket.id);

  const userId = socket.user.userId; // Get userId from the authenticated user
  if (!userSocketMap[userId]) {
    userSocketMap[userId] = new Set();
  }
  userSocketMap[userId].add(socket.id);
  console.log(`User ${userId} mapped to socket ${socket.id}`);
  updateOnlineUsers();

  socket.on('typing', ({ userId, isTyping, receiverId }) => {
    if (receiverId && userSocketMap[receiverId]) {
      const receiverSocketIds = Array.from(userSocketMap[receiverId]);
      receiverSocketIds.forEach(receiverSocketId => {
        io.to(receiverSocketId).emit('typing', { userId, isTyping });
      });
    }
  });

  socket.on('fetchMessages', async ({ groupId, senderId, receiverId, page = 1, limit = 50 }) => {
    try {
      let query = {};
      const options = {
        sort: { createdAt: 1 },
        limit: limit,
        skip: (page - 1) * limit
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

      console.log(JSON.stringify(messages));

      socket.emit('messages', messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      socket.emit('error', 'Could not fetch messages');
    }
  });

  socket.on('newMessage', async ({ senderId, content, receiverId, groupId }, callback) => {
    console.log(senderId, content, receiverId, groupId);
    if (!content || !senderId || (!receiverId && !groupId)) {
      socket.emit('error', 'Missing required message fields.');
      return;
    }

    try {
      const messageData = { content, senderId, receiverId: receiverId || undefined, groupId: groupId || undefined };
      const savedMessage = await new ChatMessage(messageData).save();

      if (groupId) {
        io.in(groupId).emit('message', savedMessage);
      } else if (receiverId && userSocketMap[receiverId]) {
        const receiverSocketIds = Array.from(userSocketMap[receiverId]);
        receiverSocketIds.forEach(receiverSocketId => {
          io.to(receiverSocketId).emit('message', savedMessage);
        });
      } else {
        console.log(`No active socket for user ${receiverId}`);
      }

      socket.emit('messageSent', savedMessage);
      socket.emit('fetchMessages', { senderId, receiverId }); // Fetch messages after sending a new one
      if (callback) callback('Message delivered');
    } catch (error) {
      console.error('Error saving message:', error);
      socket.emit('error', 'Error saving message.');
      if (callback) callback('Error saving message');
    }
  });

  socket.on('editMessage', async ({ messageId, newContent, userId }, callback) => {
    if (!messageId || typeof newContent !== 'string') {
      socket.emit('error', 'Invalid message ID or content.');
      return;
    }
  
    try {
      const message = await ChatMessage.findById(messageId);
  
      if (!message) {
        socket.emit('error', 'Message not found.');
        return;
      }
  
      if (message.senderId.toString() !== userId) {
        socket.emit('error', 'User does not have permission to edit this message.');
        return;
      }
  
      const updatedMessage = await ChatMessage.findByIdAndUpdate(
        messageId,
        { $set: { content: newContent, isEdited: true, editedAt: new Date() } },
        { new: true }
      );
  
      if (updatedMessage.receiverId && userSocketMap[updatedMessage.receiverId]) {
        const receiverSocketIds = Array.from(userSocketMap[updatedMessage.receiverId]);
        receiverSocketIds.forEach(receiverSocketId => {
          io.to(receiverSocketId).emit('messageUpdated', updatedMessage);
        });
      } else if (updatedMessage.groupId) {
        io.in(updatedMessage.groupId).emit('messageUpdated', updatedMessage);
      }
  
      socket.emit('messageUpdated', updatedMessage);
      if (callback) callback('Message edited');
    } catch (error) {
      console.error('Error updating message:', error);
      socket.emit('error', 'Error updating message');
      if (callback) callback('Error updating message');
    }
  });
  
  

  socket.on('joinRoom', async ({ groupId, page = 1, limit = 50 }) => {
    if (!groupId) {
      socket.emit('error', 'Missing or invalid groupId.');
      return;
    }

    try {
      socket.join(groupId);
      console.log(`Socket ${socket.id} joined room ${groupId}`);

      const messages = await ChatMessage.find({ groupId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit);

      const historicalMessages = messages.reverse();

      socket.emit('historicalMessages', historicalMessages);
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
      ).populate('groupId');
  
      if (!updatedMessage) {
        socket.emit('error', 'Message not found or could not be updated');
        return;
      }
  
      if (!updatedMessage.groupId && updatedMessage.senderId.toString() !== userId.toString()) {
        const senderSocketIds = Array.from(userSocketMap[updatedMessage.senderId] || []);
        senderSocketIds.forEach(senderSocketId => {
          io.to(senderSocketId).emit('messageUpdated', updatedMessage);
        });
      } else if (updatedMessage.groupId) {
        updatedMessage.groupId.members.forEach(memberId => {
          if (memberId.toString() !== userId.toString() && userSocketMap[memberId]) {
            const memberSocketIds = Array.from(userSocketMap[memberId]);
            memberSocketIds.forEach(memberSocketId => {
              io.to(memberSocketId).emit('messageUpdated', updatedMessage);
            });
          }
        });
      }
  
      console.log(`Message ${messageId} read by userId: ${userId}`);
    } catch (error) {
      console.error('Error updating message read status:', error);
      socket.emit('error', 'Error updating message read status');
    }
  });
  

  socket.on('deleteMessage', async ({ messageId, userId }, callback) => {
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
  
      if (message.senderId.toString() !== userId /* and user is not an admin */) {
        socket.emit('error', 'User does not have permission to delete this message.');
        return;
      }
  
      await ChatMessage.findByIdAndDelete(messageId);
  
      if (message.receiverId && userSocketMap[message.receiverId]) {
        const receiverSocketIds = Array.from(userSocketMap[message.receiverId]);
        receiverSocketIds.forEach(receiverSocketId => {
          io.to(receiverSocketId).emit('messageDeleted', messageId);
        });
      } else if (message.groupId) {
        io.in(message.groupId).emit('messageDeleted', messageId);
      }
  
      socket.emit('messageDeleted', messageId);
      if (callback) callback('Message deleted');
    } catch (error) {
      console.error('Error deleting message:', error);
      socket.emit('error', 'Error deleting message.');
      if (callback) callback('Error deleting message');
    }
  });
  
  

  socket.on('disconnect', () => {
    Object.keys(userSocketMap).forEach(userId => {
      userSocketMap[userId].delete(socket.id);
      if (userSocketMap[userId].size === 0) {
        delete userSocketMap[userId];
      }
    });
    console.log(`Socket ${socket.id} disconnected`);
    updateOnlineUsers();
  });
});

const chatPort = 8000;
chatServer.listen(chatPort, () => {
  console.log(`Chat server listening at http://localhost:${chatPort}`);
});
