const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model for the sender
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model for the receiver
        required: true
    },
    content: {
        type: String,
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    },
    // Remove the manual createdAt field as it's redundant with the timestamps option
    readBy: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User', // Reference to the User model for tracking who read the message
        },
        readAt: {
            type: Date,
            default: Date.now // Automatically sets the readAt time when a user is added to the array
        }
    }]
}, { timestamps: true }); // Enables createdAt and updatedAt fields automatically

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
