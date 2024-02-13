const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MentorSessions', 
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', 
    required: true
  },
  joinTime: {
    type: Date,
    default: Date.now
  }
});

const UserSession = mongoose.model('UserSession', userSessionSchema);
module.exports = UserSession;
