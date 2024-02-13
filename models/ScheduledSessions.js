const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  participants: [String], // Array of participant identifiers (e.g., email)
  location: String, // Physical address or online meeting link
  mentor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Assuming you have a User model
  },
  capacity: Number,
  status: {
    type: String,
    enum: ['upcoming', 'Inprogress','Reschedule', 'completed', 'Canceled'],
    default: 'upcoming'
  },
  price: {
    type: Number,
    required: true, // or false, depending on your requirements
    min: 0, // Ensures the price is non-negative
    default: 0 // Optional, based on your default pricing strategy
  },
  category: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Session = mongoose.model('MentorSessions', sessionSchema);
module.exports = Session;
