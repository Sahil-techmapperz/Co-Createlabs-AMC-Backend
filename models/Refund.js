const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Schema for Refund
const RefundSchema = new Schema({
  clientId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User', // Reference to User model
  },
  sessionId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Sessions', // Reference to Sessions model
  },
  refundAmount: {
    type: Number,
    required: true,
    min: 0, // Refund amount should be non-negative
  },
  refundDate: {
    type: Date,
    default: Date.now, // Default to current date and time
  },
  refundStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'], // Define possible statuses
    default: 'pending', // Default status for a new refund
  },
  reason: {
    type: String,
    default: 'Session cancelled', // Optional reason for refund
  },
  processedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Optional, the person who processed the refund
  },
});

// Create and export the Refund model
const Refund = mongoose.model('Refund', RefundSchema);
module.exports = Refund;
