const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    content: {
        type: String,
        default: null,
        trim: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User' // Assuming you have a User model
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Optional, for direct messages
        default: null
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group', // Optional, for group messages
        default: null
    },
    isRead: {
        type: Boolean,
        default: false
    },
    isUpdate: {
        type: Boolean,
        default: false
    },
    fileUrl: {
        type: String,
        trim: true,
        default: null // Optional, stores the URL of the uploaded file if the message includes a file
    },
    fileType: {
        type: String,
        trim: true,
        default: null // Optional, stores the MIME type of the uploaded file if the message includes a file
    },
    readBy: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        readAt: {
            type: Date,
            default: Date.now
        },
    }],
    // Mongoose automatically handles `createdAt` and `updatedAt` with `{ timestamps: true }`
}, { timestamps: true });

// Optimize queries by indexing common fields
chatMessageSchema.index({ senderId: 1, receiverId: 1, groupId: 1 });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

module.exports = ChatMessage;
