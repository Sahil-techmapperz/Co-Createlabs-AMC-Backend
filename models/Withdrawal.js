const mongoose = require('mongoose');
const { Schema } = mongoose;

const withdrawalSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: Number,
    requestedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['pending', 'success', 'declined'],
        default: 'pending'
    },
    method: {
        type: String,
        enum: ['bank_transfer', 'paypal', 'stripe', 'crypto']
    },
    fee: {
        type: Number,
        default: 0
    },
    notes: String,
    completedAt: Date,
    transactionId: {
        type: String,
        unique: true, // Assuming you want to enforce uniqueness here
        sparse: true, // This makes the unique index only consider documents where transactionId is not null
    }
});

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

module.exports = Withdrawal;
