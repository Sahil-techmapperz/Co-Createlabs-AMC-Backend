const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 100,
    index: true,
  },
  description: {
    type: String,
    maxlength: 500,
  },
  sessionLink: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^(http|https):\/\/[^ "]+$/.test(v);
      },
      message: props => `${props.value} is not a valid URL!`
    }
  },
  startTime: {
    type: Date,
    required: true,
    index: true,
    validate: [function(value) {
      return this.endTime && value < this.endTime;
    }, 'Start time must be before end time']
  },
  endTime: {
    type: Date,
    required: true,
  },
  location: {
    type: String,
    maxlength: 200,
    default: 'remote'
  },
  mentor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  Client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['upcoming', 'Inprogress', 'Reschedule', 'completed', 'Canceled'],
    default: 'upcoming',
  },
  category: {
    type: String,
    maxlength: 50,
  },
}, {
  timestamps: true,
});

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
