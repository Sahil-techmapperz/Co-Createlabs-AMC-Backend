const mongoose = require('mongoose');

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
        unique: true
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
    // Unique and random 6-digit user ID
    uniqueUserId: {
        type: Number,
        unique: true
    },
    // Fields specific to the Mentor role
    expertise: [String],
    bio: String,
    // Common fields for all users
    contactNumber: String,
    website: String,
    socialMediaLinks: {
        linkedin: String,
        twitter: String,
        facebook: String,
    },
    location: {
        timeZone: String,
        city: String,
        country: String
    },
    languages: [String],
    profilePictureUrl: String,
    // Fields specific to the Mentor role
    professionalDetails: {
        yearsOfExperience: Number,
        currentPosition: String,
        educationalBackground: String
    },
    availability: {
        days: [String],
        timeSlots: [String]
    },
    // Ratings and reviews applicable for Mentor role
    ratings: [{
        rating: Number,
        review: String,
        reviewedBy: mongoose.Schema.Types.ObjectId // reference to user who gave the review
    }],
    walletBalance: {
        type: Number,
        default: 0 // Assuming default balance is 0
    },
    withdrawals: [{
        amount: {
            type: Number,
            required: true
        },
        requestedAt: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'cancelled'],
            default: 'pending'
        },
        transactionId: {
            type: String,
            required: true,
            unique: true // Ensure that each transaction ID is unique
        },
        method: {
            type: String,
            required: true,
            enum: ['bank_transfer', 'paypal', 'stripe', 'crypto'] // Example methods
        },
        fee: {
            type: Number,
            default: 0 // Assuming no fee by default, or specify if your system charges a withdrawal fee
        },
        notes: String, // Any additional information about the withdrawal
        completedAt: Date 
        // Optional: Include any other relevant fields such as transaction ID, method, etc.
    }],
    spent: {
        type: Number,
        default: 0, // Assuming default spent amount is 0
        validate: {
            validator: function (value) {
                // Ensure that the spent amount is not negative
                return value >= 0;
            },
            message: props => `${props.value} is not a valid amount for 'spent'! Amount cannot be negative.`
        }
    },
    refunds: {
        type: Number,
        default: 0, // Assuming default refund amount is 0
        validate: {
            validator: function (value) {
                return value >= 0;
            },
            message: props => `${props.value} is not a valid amount for 'refunds'! Amount cannot be negative.`
        }
    },

    // ID Proof - assuming it's a government ID number
    idProof: {
        type: String,
    },

    // Alternatively, if storing a URL to an image or document
    idProofUrl: {
        type: String,
        validate: {
            validator: function (value) {
                // Validate the URL format
                return /^(http|https):\/\/[^ "]+$/.test(value);
            },
            message: props => `${props.value} is not a valid URL!`
        }
    },
    // Emergency contact
    emergencyContact: {
        name: {
            type: String,
            trim: true
        },
        relationship: {
            type: String,
            trim: true
        },
        phone: {
            type: String,
            trim: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            validate: {
                validator: function(value) {
                    // Validate the email format
                    return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(value);
                },
                message: props => `${props.value} is not a valid email address!`
            }
        }
    },
}, { timestamps: true });




// Function to generate a 6-digit number
function generateUniqueUserId() {
    return Math.floor(100000 + Math.random() * 900000);
}

// Middleware to ensure uniqueUserId is unique
userSchema.pre('save', async function (next) {
    if (!this.isNew) {
        next(); // Only run this for new documents
        return;
    }

    this.uniqueUserId = generateUniqueUserId();
    const User = mongoose.model('User');

    while (true) {
        try {
            let existingUser = await User.findOne({ uniqueUserId: this.uniqueUserId });
            if (!existingUser) {
                break; // Unique ID is found, exit the loop
            }
            this.uniqueUserId = generateUniqueUserId(); // Generate a new ID and check again
        } catch (error) {
            next(error); // Pass any errors to the next middleware
            return;
        }
    }

    next(); // Proceed with saving the document
});

const User = mongoose.model('User', userSchema);

module.exports = User; // Export the model for use in your application
