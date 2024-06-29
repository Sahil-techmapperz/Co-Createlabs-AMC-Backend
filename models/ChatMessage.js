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
        ref: 'User'
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        default: null
    },
    readBy: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, readAt: { type: Date } }],
    isEdited: {
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
    }]
}, { timestamps: true }); // Mongoose automatically handles `createdAt` and `updatedAt`

// Indexes
chatMessageSchema.index({ senderId: 1, receiverId: 1, groupId: 1 });
chatMessageSchema.index({ groupId: 1, createdAt: 1 }); // For group messages by time

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

module.exports = ChatMessage;