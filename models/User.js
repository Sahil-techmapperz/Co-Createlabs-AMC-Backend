const mongoose = require('mongoose');
const validator = require('validator');
const crypto = require('crypto');



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
        timeZone: String,
        city: String,
        country: String
    },
    languages: [String],
    skills: {
        type: [String], // Corrected syntax error
        default: []
      },
    profilePictureUrl: {
        default:"",
        type: String,
    },
    professionalDetails: {
        yearsOfExperience: Number,
        currentPosition: String,
        educationalBackground: String
    },
    availability: {
        days: [String],
        timeSlots: [String]
    },
    ratings: [{
        rating: Number,
        review: String,
        reviewedBy: mongoose.Schema.Types.ObjectId
    }],
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

   // Payment methods as part of the User model
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

// Ensure indexes for improved query performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ uniqueUserId: 1 }, { unique: true });
// Additional indexes for other fields can be added as needed


// Middleware for generating a unique user ID using crypto
userSchema.pre('save', async function(next) {
    if (this.isNew || this.isModified('uniqueUserId')) {
      const User = mongoose.model('User');
      let unique = false;
      do {
        // Generate a random byte sequence and convert it to a hexadecimal string
        const randomBytes = crypto.randomBytes(6); // Adjust the byte size as needed
        this.uniqueUserId = randomBytes.toString('hex');
  
        // Check if the generated ID is unique
        unique = await User.findOne({ uniqueUserId: this.uniqueUserId }).exec() == null;
      } while (!unique);
    }
    next();
  });

const User = mongoose.model('User', userSchema);
module.exports = User;
