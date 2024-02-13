const mongoose = require('mongoose');

const attendeeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the User model
    required: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MentorSessions', // Reference to the Session model
    required: true
  },
  joinTime: {
    type: Date,
    default: Date.now, // Automatically set the join time to the current time
    required: true
  }
});

const Attendee = mongoose.model('Attendee', attendeeSchema);
module.exports = Attendee;
