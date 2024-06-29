const mongoose = require('mongoose');
const validator = require('validator');
const crypto = require('crypto');

const availabilitySchema = new mongoose.Schema({
  start: { type: String },
  end: { type: String },
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true }
});

const ratingSchema = new mongoose.Schema({
  rating: {
    type: Number,
    required: true
  },
  review: {
    type: String,
    required: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
    validate: [validator.isEmail, 'Invalid email format']
  },
  
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true,
    enum: ['Mentor', 'Client', 'Admin']
  },
  uniqueUserId: {
    type: Number,
    unique: true
  },
  expertise: [String],
  bio: String,
  contactNumber: String,
  website: {
    type: String,
    validate: [validator.isURL, 'Invalid URL format']
  },
  socialMediaLinks: {
    linkedin: {
      type: String,
      validate: [validator.isURL, 'Invalid URL format']
    },
    twitter: {
      type: String,
      validate: [validator.isURL, 'Invalid URL format']
    },
    facebook: {
      type: String,
      validate: [validator.isURL, 'Invalid URL format']
    },
  },
  location: {
    timeZone: {
      default: "",
      type: String,
    },
    country: {
      default: "",
      type: String,
    },
    state: {
      default: "",
      type: String,
    },
    city: {
      default: "",
      type: String,
    },
  },
  languages: [String],
  skills: {
    type: [String],
    default: []
  },
  profilePictureUrl: {
    default: "",
    type: String,
  },
  introductionvideoUrl: {
    default: "",
    type: String,
  },
  bio: {
    type: String,
    maxlength: 200,
    default: ''
  },
  professionalDetails: {
    type: String,
    default: ''
  },
  availability: {
    times: [availabilitySchema]
  },
  ratings: [ratingSchema],
  walletBalance: {
    type: Number,
    default: 0
  },
  rate: {
    type: Number,
    required: true,
    default: 100
  },
  spent: {
    type: Number,
    default: 0,
    validate: {
      validator: function(value) {
        return value >= 0;
      },
      message: props => `${props.value} is not a valid amount for 'spent'! Amount cannot be negative.`
    }
  },
  refunds: {
    type: Number,
    default: 0,
    validate: {
      validator: function(value) {
        return value >= 0;
      },
      message: props => `${props.value} is not a valid amount for 'refunds'! Amount cannot be negative.`
    }
  },
  idProof: String,
  idProofUrl: {
    type: String,
    validate: [validator.isURL, 'Invalid URL format']
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
    email: {
      type: String,
      validate: [validator.isEmail, 'Invalid email format']
    }
  },
  bankTransfer: {
    feePercentage: { type: Number, default: 2 },
    accountInfo: {
      accountNumber: { type: String },
      IFSC: { type: String },
      branchName: { type: String },
    },
  },
  paypal: {
    feePercentage: { type: Number, default: 3 },
    accountInfo: {
      paypalEmail: {
        type: String,
        validate: [validator.isEmail, 'Invalid email format']
      },
    }
  },
  stripe: {
    feePercentage: { type: Number, default: 2.5 },
    accountInfo: {
      stripeAccountId: { type: String },
    }
  },
  crypto: {
    feePercentage: { type: Number, default: 1 },
    accountInfo: {
      walletAddress: { type: String },
      walletType: { type: String, enum: ['Bitcoin', 'Ethereum', 'Others'] },
    }
  },
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ uniqueUserId: 1 }, { unique: true });

userSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('uniqueUserId')) {
    const User = mongoose.model('User');
    let unique = false;
    do {
      const randomBytes = crypto.randomBytes(6);
      this.uniqueUserId = randomBytes.toString('hex');
      unique = await User.findOne({ uniqueUserId: this.uniqueUserId }).exec() == null;
    } while (!unique);
  }
  next();
});

const User = mongoose.model('User', userSchema);
module.exports = User;
