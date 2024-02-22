const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mongoose = require('mongoose');
const passport = require('passport');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const User = require('./routes/User');
const MentorSession = require('./routes/Sessions');
const ChatMessage = require('./models/ChatMessage');
const ChatMessageRoute = require('./routes/ChatMessage');
const app = express();
const server = http.createServer(app);
const UserModel= require('./models/User');


// Configure Socket.IO to allow all origins
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins
    methods: ["GET", "POST"], // Specify methods to allow
    credentials: true // Required for cookies, authorization headers with HTTPS
  }
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      return callback(null, true);
    },
    credentials: true,
  }));

app.use(express.json());
app.use(passport.initialize());
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Adjust based on your app's needs
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiter to specific routes
app.use('/api/user/login', limiter); // Example: Apply only to login

app.use('/api/user', User);
app.use('/api/mentorsession', MentorSession);
app.use('/api/chatmessage',ChatMessageRoute);

app.get("/", (req, res) => {
  res.status(200).send({ message: 'Hello from the Co-createlabsAMC backend' });
});



// User ID to Socket ID mapping
const userSocketMap = {};



io.on('connection', (socket) => {

// Handle user registration to map user ID to socket ID
socket.on('register', ({ userId }) => {
  userSocketMap[userId] = socket.id;
  console.log(`User ${userId} mapped to socket ${socket.id}`);
});


socket.on('getUserDataWithMessages', async ({ userId }) => {
  try {

    const users = await UserModel.find({}).lean(); // Fetch all users efficiently

    const userData = await Promise.all(users.map(async (user) => {
      // Fetch the last message where the current user is the sender and the specified userId is the receiver
      const messages = await ChatMessage.find({
        senderId: user._id, // Corrected: from current user to specified userId
        receiverId: userId, // This ensures we are fetching messages sent to the specified userId
      }).sort({ createdAt: -1 }).limit(1).lean();

      const lastMessage = messages.length > 0 ? messages[0] : 'empty';

      // Count unread messages where the current user is the sender and the specified userId is the receiver
      const unreadCount = await ChatMessage.countDocuments({
        senderId: user._id, // Corrected: Count messages from this user
        receiverId: userId, // To the specified userId
        isRead: false,
      });

      return {
        ...user, // Spread the user data
        lastMessage, // Simplified: Provide the last message or 'empty' if none
        unreadCount, // Provide the unread count
      };
    }));

    const receiverSocketId = userSocketMap[userId];
    // console.log(userData);
    io.to(receiverSocketId).emit('userDataWithMessages', userData);
    // socket.emit('userDataWithMessages', userData);
  } catch (error) {
    console.error('Error fetching user data with messages:', error);
    socket.emit('error', 'Could not fetch user data with messages');
  }
});


  // Handler for "fetchMessages" event
socket.on('fetchMessages', async ({ groupId, senderId, receiverId }) => {
  try {
    let query = {};

    // Determine the query based on whether it's a group chat or direct message
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

    const messages = await ChatMessage.find(query)
      .sort({ createdAt: 1 }) // Sort messages by creation time
      // Optionally populate only specific fields for sender and receiver
      .populate('senderId', 'username') // Assuming 'username' is the field you want
      .populate('receiverId', 'username'); // Adjust field as per your schema

    // Transform the messages to only include senderId and receiverId as IDs, not objects
    const transformedMessages = messages.map(message => ({
      ...message.toObject(),
      senderId: message.senderId._id,
      receiverId: message.receiverId._id,
      // If you included usernames in the population step, keep them
      senderUsername: message.senderId.username,
      receiverUsername: message.receiverId.username,
    }));

    // Emit the fetched messages back to the requester
    socket.emit('messages', transformedMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    // Optionally, emit back an error to the client
    socket.emit('error', 'Could not fetch messages');
  }
});

  socket.on('newMessage', async ({ senderId, content, receiverId, groupId }) => {
    console.log(senderId, content, receiverId, groupId);
    try {
      const message = new ChatMessage({
        content,
        senderId,
        receiverId,
        groupId,
      });
      const savedMessage = await message.save();

      if (groupId) {
        socket.to(groupId).emit('message', savedMessage);
      } else if (receiverId) {
        const receiverSocketId = userSocketMap[receiverId];
        console.log(receiverSocketId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('message', savedMessage);
        } else {
          console.log(`No active socket for user ${receiverId}`);
        }
      }

      socket.emit('message', savedMessage);
    } catch (error) {
      console.error('Error saving message:', error);
      socket.emit('error', 'Message could not be saved');
    }
  });


  socket.on('newfile', async ({ senderId , fileUrl , receiverId,fileType }) => {
    // console.log(senderId, fileUrl, receiverId,type);
    try {
      const message = new ChatMessage({
        fileUrl,
        senderId,
        receiverId,
        fileType
      });
      const savedMessage = await message.save();

      if (receiverId) {
        const receiverSocketId = userSocketMap[receiverId];
        console.log("send to this socket",receiverSocketId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('message', savedMessage);
        } else {
          console.log(`No active socket for user ${receiverId}`);
        }
      }

      socket.emit('message', savedMessage);
    } catch (error) {
      console.error('Error saving message:', error);
      socket.emit('error', 'Message could not be saved');
    }
  });

  // Handling a user joining a chat room
  socket.on('joinRoom', async ({ groupId }) => {
    // The user joins the specified room
    socket.join(groupId);
    console.log(`Socket ${socket.id} joined room ${groupId}`);

    // Fetch historical messages for the room
    try {
      const messages = await ChatMessage.find({ groupId }).sort({ createdAt: 1 });
      // Emitting the historical messages back to the user who joined the room
      socket.emit('historicalMessages', messages);
    } catch (error) {
      console.error('Error fetching historical messages:', error);
      // Optionally, emit back an error to the user
      socket.emit('error', 'Could not fetch historical messages');
    }
  });

 // Handler for "messageRead" event
socket.on('messageRead', async ({ messageId, userId }) => {
  try {
    // Update the message to mark it as read and include the user in the "readBy" array
    const updatedMessage = await ChatMessage.findByIdAndUpdate(
      messageId,
      { 
        $set: { isRead: true }, // Set isRead to true
        $addToSet: { readBy: { userId, readAt: new Date() } } // Add the user to the readBy array
      },
      { new: true } 
    );

    // Check if the message was successfully updated
    if (!updatedMessage) {
      console.error('Message not found or could not be updated:', messageId);
      socket.emit('error', 'Message not found or could not be updated');
      return;
    }

    // Determine the target for emitting the update
    // This example assumes direct messaging. Adjust based on your application's logic.
    const target = updatedMessage.senderId ? userSocketMap[updatedMessage.senderId] : null;

    // Emit an event to update the message status for the relevant clients
    io.to(target).emit('messageUpdated', updatedMessage);

    console.log('Message read by userId:', userId, 'MessageId:', messageId);
    // console.log('Message read by userId:',updatedMessage );
  } catch (error) {
    console.error('Error updating message read status:', error);
    socket.emit('error', 'Error updating message read status');
  }
});



// Handler for editing a message
socket.on('editMessage', async ({ messageId, newContent }) => {
  console.log("update");
  try {
    const updatedMessage = await ChatMessage.findByIdAndUpdate(
      messageId,
      { 
        $set: { 
          content: newContent, 
          isUpdate: true 
        }
      },
      { new: true }
    );
    
    if (!updatedMessage) {
      console.error('Message not found or could not be updated:', messageId);
      socket.emit('error', 'Message not found or could not be updated');
      return;
    }
    // Assuming direct messaging, you might need to adjust based on your application's logic
    const target = updatedMessage.receiverId ? userSocketMap[updatedMessage.receiverId] : null;
    if (target) {
      io.to(target).emit('messageUpdated', updatedMessage);
    }
    socket.emit('messageUpdated', updatedMessage); // Also update the sender about the edit
  } catch (error) {
    console.error('Error updating message:', error);
    socket.emit('error', 'Error updating message');
  }
});

// Handler for deleting a message
socket.on('deleteMessage', async ({ messageId }) => {
  try {
    const deletedMessage = await ChatMessage.findByIdAndDelete(messageId);
    if (!deletedMessage) {
      console.error('Message not found or could not be deleted:', messageId);
      socket.emit('error', 'Message not found or could not be deleted');
      return;
    }
    // Assuming direct messaging, you might need to adjust based on your application's logic
    const target = deletedMessage.receiverId ? userSocketMap[deletedMessage.receiverId] : null;
    if (target) {
      io.to(target).emit('messageDeleted', messageId);
    }
    socket.emit('messageDeleted', messageId); // Also update the sender about the deletion
  } catch (error) {
    console.error('Error deleting message:', error);
    socket.emit('error', 'Error deleting message');
  }
});


  socket.on('disconnect', () => {
    const userIds = Object.keys(userSocketMap).filter(key => userSocketMap[key] === socket.id);
    userIds.forEach(userId => {
      delete userSocketMap[userId];
      console.log(`Removed user ${userId} from map`);
    });
  });

});










const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`));
