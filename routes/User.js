const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Assuming your model is named 'User' and the file path is correct
const Session = require('../models/Sessions');
const Withdrawal = require('../models/Withdrawal');
// const User_auth_Middleware= require("../middlewares/Authorization_middleware");
const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secure-secret';
const crypto = require('crypto');
const util = require('util');
const { checkTokenMiddleware } = require('../Middleware');
const scrypt = util.promisify(crypto.scrypt); // Promisify scrypt for async use



router.get("/", (req, res) => {
    res.status(200).send("Hello from User Route");
});

// Route to get all users
router.get('/all',checkTokenMiddleware, async (req, res) => {
    try {
      const users = await User.find({}); // Fetch all users
      res.json(users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });


  router.get('/mentors/:mentorId', checkTokenMiddleware, async (req, res) => {
    const { mentorId } = req.params;
    try {
        // Aggregate to count sessions for each mentor
        const mentordetails = await User.findById(mentorId);
        console.log(mentordetails)
        res.status(200).json(mentordetails);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

  
// GET route for getting top 3 mentors by rating
router.get('/mentors/rating/top',checkTokenMiddleware, async (req, res) => {
    try {
        // Find mentors with at least one rating
        const mentorsWithRatings = await User.find({ 'ratings.0': { $exists: true } });

        // Calculate average ratings for each mentor
        const mentorsWithAvgRatings = mentorsWithRatings.map(mentor => {
            const totalRating = mentor.ratings.reduce((acc, curr) => acc + curr.rating, 0);
            const avgRating = totalRating / mentor.ratings.length;
            return { mentor, avgRating };
        });

        // Sort mentors by average rating in descending order
        mentorsWithAvgRatings.sort((a, b) => b.avgRating - a.avgRating);

        // Get top 3 mentors
        const top3Mentors = mentorsWithAvgRatings.slice(0, 3);

        res.status(200).json(top3Mentors);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});




// GET route for most viewed mentor by sessions
router.get('/mentors/most-viewed', checkTokenMiddleware, async (req, res) => {
    try {
        // Aggregate to count sessions for each mentor
        const mostViewedMentors = await Session.aggregate([
            {
                $group: {
                    _id: '$mentor',
                    totalSessions: { $sum: 1 }
                }
            },
            {
                $sort: { totalSessions: -1 }
            },
            {
                $limit: 3 // Get top 3 most viewed mentors
            },
            {
                $lookup: {
                    from: 'users', // Assuming the collection name is 'users' for mentors
                    localField: '_id',
                    foreignField: '_id',
                    as: 'mentorInfo'
                }
            },
            {
                $project: {
                    _id: 0,
                    mentorInfo: 1, // Include all mentor info
                    totalSessions: 1
                }
            }
        ]);

        res.status(200).json(mostViewedMentors);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});





// Signup route for users (Mentors, Clients, Admins)
router.post('/signup', async (req, res) => {
    const { name, email, password, role, ...otherFields } = req.body;

    try {
        let user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Generate a salt
        const salt = crypto.randomBytes(16).toString('hex');

        // Hash the password with salt
        const hashedPasswordBuffer = await scrypt(password, salt, 64);
        const hashedPassword = salt + ':' + hashedPasswordBuffer.toString('hex');

        user = new User({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role,
            ...otherFields
        });

        await user.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});



// Login route for users
router.post('/login', async (req, res) => {
    const { email, password, remember } = req.body;

    try {
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Extract the salt and hashed password from stored data
        const [salt, storedHash] = user.password.split(':');

        // Hash the incoming password with the same salt
        const hashedBuffer = await scrypt(password, salt, 64);
        const hashedPassword = hashedBuffer.toString('hex');

        if (storedHash !== hashedPassword) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        // Set expiration based on 'remember' value
        const expiresIn = remember ? '1d' : '1h';
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn });

        res.status(200).json({ message: 'Login successful', token, user,expiresIn });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// POST route for rating a mentor
router.post('/mentors/:mentorId/rate', checkTokenMiddleware, async (req, res) => {
    const { mentorId } = req.params;
    const userId = req.user; // Assuming req.user contains the ID of the logged-in user
    const { rating, review } = req.body;

    try {
        // Find the mentor and the user by ID
        const mentor = await User.findById(mentorId);
        const user = await User.findById(userId);

        // Check if the mentor exists
        if (!mentor) {
            return res.status(404).json({ error: 'Mentor not found' });
        }

        

        // Check if the mentor and the user are the same
        if (mentor._id.toString() == user._id.toString()) {
            return res.status(403).json({ error: 'Mentors cannot rate themselves' });
        }

        // Check if the user has already rated the mentor
        const existingRating = mentor.ratings.find(rating => rating.reviewedBy.toString() === userId);
       
        if (existingRating) {
            return res.status(403).json({ error: 'User has already rated this mentor' });
        }

        // Validate rating value
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        // Update the mentor's ratings array
        mentor.ratings.push({ rating, review, reviewedBy : userId });

        // Save the mentor's updated data
        await mentor.save();

        res.status(201).json({ message: 'Rating added successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});




// Helper function to calculate the withdrawal fee
function calculateFee(amount, method) {
    const baseFee = 1; // Example base fee
    switch (method) {
        case 'bank_transfer':
            return baseFee + amount * 0.02; // 2% fee for bank transfer
        case 'paypal':
            return baseFee + amount * 0.03; // 3% fee for PayPal
        case 'stripe':
            return baseFee + amount * 0.025; // 2.5% fee for Stripe
        case 'crypto':
            return baseFee + amount * 0.01; // 1% fee for crypto
        default:
            return baseFee; // Default fee if method is unknown
    }
}




router.get('/withdrawals',checkTokenMiddleware, async (req, res) => {
    const Id= req.user;
    try {
      const Withdrawals = await Withdrawal.find({userId:Id}); // Fetch all users
      res.json(Withdrawals);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

// Route for creating a new withdrawal request
router.post('/withdrawals', checkTokenMiddleware, async (req, res) => {
    const userId = req.user; 

    try {
        const { amount, method, notes = "null" } = req.body;

        // Validate input data
        if (!amount || !method) {
            return res.status(400).json({ error: 'Amount and method are required.' });
        }

        // Fetch the user information from the database
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if the user has sufficient balance
        if (user.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance.' });
        }

        // Validate the method information
        let validMethod = false;

        switch (method) {
            case 'bank_transfer':
                validMethod = user.bankTransfer.accountInfo?.accountNumber && user.bankTransfer.accountInfo?.IFSC;
                break;
            case 'paypal':
                validMethod = user.paypal.accountInfo?.paypalEmail;
                break;
            case 'stripe':
                validMethod = user.stripe.accountInfo?.stripeAccountId;
                break;
            case 'crypto':
                validMethod = user.crypto.accountInfo?.walletAddress && user.crypto.accountInfo?.walletType;
                break;
            default:
                return res.status(400).json({ error: 'Invalid method.' });
        }

        if (!validMethod) {
            return res.status(400).json({ error: 'Required method information missing.' });
        }

        // Create new withdrawal document
        const newWithdrawal = new Withdrawal({
            userId,
            amount,
            method,
            notes,
            fee: calculateFee(amount, method),
        });

        // Save the withdrawal to the database
        await newWithdrawal.save();

        // Update the user's balance
        user.balance -= amount;
        await user.save();

        res.status(201).json(newWithdrawal);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error. Please try again later.' });
    }
});


// Route for updating payment info
router.patch('/payment-info', checkTokenMiddleware, async (req, res) => {
    const userId = req.user; 

    try {
        const { method, accountInfo } = req.body;

        console.log(accountInfo);

        if (!method || !accountInfo) {
            return res.status(400).json({ error: 'Method and account information are required.' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        switch (method) {
            case 'bank_transfer':
                if (!accountInfo.accountNumber || !accountInfo.IFSC || !accountInfo.branchName) {
                    return res.status(400).json({ error: 'Bank transfer information is incomplete.' });
                }
                user.bankTransfer.accountInfo = accountInfo;
                break;

            case 'paypal':
                if (!accountInfo.paypalEmail || !validator.isEmail(accountInfo.paypalEmail)) {
                    return res.status(400).json({ error: 'Valid PayPal email is required.' });
                }
                user.paypal.accountInfo = accountInfo;
                break;

            case 'stripe':
                if (!accountInfo.stripeAccountId) {
                    return res.status(400).json({ error: 'Stripe account ID is required.' });
                }
                user.stripe.accountInfo = accountInfo;
                break;

            case 'crypto':
                if (!accountInfo.walletAddress || !accountInfo.walletType) {
                    return res.status(400).json({ error: 'Crypto wallet address and type are required.' });
                }
                user.crypto.accountInfo = accountInfo;
                break;

            default:
                return res.status(400).json({ error: 'Invalid method.' });
        }

        await user.save();

        res.status(200).json({ message: 'Payment information updated successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error. Please try again later.' });
    }
});













module.exports = router; // Export the router
