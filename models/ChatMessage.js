const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true,
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
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true }); // Mongoose automatically handles `createdAt` and `updatedAt`

// Indexes
chatMessageSchema.index({ senderId: 1, receiverId: 1, groupId: 1 }); // Optimize queries by indexing common fields

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

module.exports = ChatMessage;
