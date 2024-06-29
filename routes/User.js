const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Sessions');
const Withdrawal = require('../models/Withdrawal');
const ChatMessage= require('../models/ChatMessage');
const { checkTokenMiddleware, uploadToS3 } = require('../Middleware');
const crypto = require('crypto');
const util = require('util');
const scrypt = util.promisify(crypto.scrypt);
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const moment = require('moment');
const momentTimezone = require('moment-timezone');
const { Country } = require('country-state-city');
const mongoose = require('mongoose');
const IssueReport = require('../models/IssueReport'); // Adjust the path as necessary

const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secure-secret';

router.get("/", (req, res) => {
  res.status(200).send("Hello from User Route");
});

// Route to get all users with session count
router.get('/all', checkTokenMiddleware, async (req, res) => {
  try {
    const users = await User.find({ role: 'Mentor' });
    const usersWithSessionCount = await Promise.all(users.map(async (user) => {
      const sessionCount = await Session.countDocuments({ $or: [{ mentor: user._id }, { Client: user._id }] });
      return { ...user.toObject(), sessionCount };
    }));
    res.json(usersWithSessionCount);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
// Route to get all users with session count
router.get('/alluserforadmin', checkTokenMiddleware, async (req, res) => {
  try {
    // Find all users except those with the role 'Admin'
    const users = await User.find({ role: { $ne: 'Admin' } });
    const usersWithSessionCount = await Promise.all(users.map(async (user) => {
      const sessionCount = await Session.countDocuments({ $or: [{ mentor: user._id }, { Client: user._id }] });
      return { ...user.toObject(), sessionCount };
    }));
    res.json(usersWithSessionCount);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


router.get('/getallmentorbyclient', checkTokenMiddleware, async (req, res) => {
  try {
    const users = await User.find({ role: 'Mentor' });
    const usersWithSessionCount = await Promise.all(users.map(async (user) => {
      const sessionCount = await Session.countDocuments({ $or: [{ mentor: user._id }, { Client: user._id }] });
      return { ...user.toObject(), sessionCount };
    }));
    res.json(usersWithSessionCount);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Fetch users
router.get('/users', checkTokenMiddleware, async (req, res) => {
    let Userid = req.user;
    try {
      const users = await User.find({ _id: { $ne: Userid } });
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch users' });
    }
});

router.get('/usersbyID', checkTokenMiddleware, async (req, res) => {
  let Userid = req.user;
  try {
    const users = await User.find({ _id:Userid });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

  
  // Fetch messages
  router.get('/messages/:userId', checkTokenMiddleware, async (req, res) => {
    let userId = req.user; // Assuming req.user contains the authenticated user's info
    try {
      const { userId: selectedUserId } = req.params;
      const messages = await ChatMessage.find({
        $or: [
          { senderId: userId, receiverId: selectedUserId },
          { senderId: selectedUserId, receiverId: userId }
        ]
      })
      .populate('senderId', 'username')
      .populate('receiverId', 'username');
  
      res.json(messages);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  

router.get('/userdata', checkTokenMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user);
    res.json(user);
  } catch (error) {
    console.error('Failed to fetch user data:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.get('/payment-methods', checkTokenMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user).select('bankTransfer paypal stripe crypto');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Failed to fetch user payment methods:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});




router.get('/mentors/:mentorId', checkTokenMiddleware, async (req, res) => {
  try {
    const mentor = await User.findById(req.params.mentorId);
    if (!mentor) {
      return res.status(404).json({ message: 'Mentor not found' });
    }

    // Calculate the average rating if ratings are available
    let avgRating = 0;
    if (mentor.ratings && mentor.ratings.length > 0) {
      const totalRating = mentor.ratings.reduce((acc, curr) => acc + curr.rating, 0);
      avgRating = totalRating / mentor.ratings.length;
    }

    // Enhance the response to include average rating
    const mentorData = mentor.toObject();  // Convert the mongoose document to a plain JavaScript object
    mentorData.avgRating = avgRating;  // Add the average rating to the mentor's data

    res.json(mentorData);
  } catch (error) {
    console.error('Failed to fetch mentor details:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});



router.get('/mentors/:mentorId/ratings', checkTokenMiddleware, async (req, res) => {
  try {
    // Find the mentor by ID and populate the ratings with reviewer details
    const mentor = await User.findById(req.params.mentorId)
      .select('ratings')
      .populate({
        path: 'ratings.reviewedBy', // Ensure this path matches the structure of your document
        select: 'name profilePictureUrl createdAt' // Select only necessary fields
      });

    if (!mentor) {
      return res.status(404).json({ message: 'Mentor not found' });
    }

    // If mentor is found but has no ratings
    if (mentor.ratings.length === 0) {
      return res.status(404).json({ message: 'No ratings found for this mentor' });
    }

    // Extract ratings to simplify the response
    const ratings = mentor.ratings.map(rating => ({
      rating: rating.rating,
      review: rating.review,
      reviewerName: rating.reviewedBy ? rating.reviewedBy.name : 'Anonymous',
      reviewerProfilePictureUrl: rating.reviewedBy ? rating.reviewedBy.profilePictureUrl : null,
      _id: rating._id
    }));

    res.json(ratings);
  } catch (error) {
    console.error('Failed to fetch ratings:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


router.get('/mentors/rating/top', checkTokenMiddleware, async (req, res) => {
  try {
    const mentors = await User.find({ role: 'Mentor' });
    const mentorsWithSessionsAndRatings = await Promise.all(mentors.map(async mentor => {
      const totalRating = mentor.ratings.reduce((acc, curr) => acc + curr.rating, 0);
      const avgRating = mentor.ratings.length > 0 ? totalRating / mentor.ratings.length : 0;
      const sessionCount = await Session.countDocuments({ mentor: mentor._id });

      return { 
        mentor: mentor.toJSON(), 
        avgRating,
        sessionCount
      };
    }));
    
    const sortedMentors = mentorsWithSessionsAndRatings.sort((a, b) => b.avgRating - a.avgRating).slice(0, 3);
    res.json(sortedMentors);
  } catch (error) {
    console.error('Failed to fetch top mentors:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});



router.get('/mentors/rating/all', checkTokenMiddleware, async (req, res) => {
  try {
    const mentors = await User.find({ role: 'Mentor' });
    const mentorsWithSessionsAndRatings = await Promise.all(mentors.map(async mentor => {
      const totalRating = mentor.ratings.reduce((acc, curr) => acc + curr.rating, 0);
      const avgRating = mentor.ratings.length > 0 ? totalRating / mentor.ratings.length : 0;
      const sessionCount = await Session.countDocuments({ mentor: mentor._id });

      return { 
        mentor: mentor.toJSON(), 
        avgRating,
        sessionCount
      };
    }));

    res.json(mentorsWithSessionsAndRatings);
  } catch (error) {
    console.error('Failed to fetch all mentors:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});






router.get('/mostviewed-mentor', checkTokenMiddleware, async (req, res) => {
  try {
    const mentorSessionsCount = await Session.aggregate([
      {
        $group: {
          _id: '$mentor',  // Group by mentor ID
          totalSessions: { $sum: 1 }  // Count sessions per mentor
        }
      },
      {
        $lookup: {
          from: 'users',  // Assuming the collection name for the User model is 'users'
          localField: '_id',
          foreignField: '_id',
          as: 'mentorDetails'
        }
      },
      { $unwind: '$mentorDetails' },  // Unwind the results of the lookup
      {
        $addFields: {
          avgRating: { $avg: '$mentorDetails.ratings.rating' }  // Calculate the average rating
        }
      },
      { $sort: { totalSessions: -1 } },  // Sort by the total session count descending
      { $limit: 3 }  // Limit to the top 3
    ]);

    // Map over the aggregated results to fetch additional details and structure the response
    const topMentors = mentorSessionsCount.map(mentor => ({
      mentorId: mentor._id,
      totalSessions: mentor.totalSessions,
      avgRating: mentor.avgRating,
      name: mentor.mentorDetails.name,
      email: mentor.mentorDetails.email,
      profilePictureUrl: mentor.mentorDetails.profilePictureUrl
    }));

    res.json(mentorSessionsCount);
  } catch (error) {
    console.error('Failed to fetch most viewed mentors:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


router.patch('/updateuser', checkTokenMiddleware, async (req, res) => {
  const updateData = {
    ...req.body,
    socialMediaLinks: { facebook: req.body.facebook, twitter: req.body.twitter, linkedin: req.body.linkedin }
  };

  try {
    const updatedUser = await User.findByIdAndUpdate(req.user, updateData, { new: true, runValidators: true });
    res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Failed to update user:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.patch('/Clientupdateuser', checkTokenMiddleware, async (req, res) => {
  const updateData = {
    ...req.body
  };

  // console.log(updateData);

  try {
    const updatedUser = await User.findByIdAndUpdate(req.user, updateData, { new: true, runValidators: true });
    res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Failed to update user:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

const updatePaymentMethod = async (req, res, field) => {
  const updates = { [field]: req.body };
  try {
    const updatedUser = await User.findByIdAndUpdate(req.user, updates, { new: true, runValidators: true });
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    console.error(`Failed to update ${field}:`, error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation Error', details: error.errors });
    } else if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

router.patch('/payment-methods/bankTransfer', checkTokenMiddleware, (req, res) => updatePaymentMethod(req, res, 'bankTransfer'));
router.patch('/payment-methods/stripe', checkTokenMiddleware, (req, res) => updatePaymentMethod(req, res, 'stripe'));
router.patch('/payment-methods/paypal', checkTokenMiddleware, (req, res) => updatePaymentMethod(req, res, 'paypal'));
router.patch('/payment-methods/crypto', checkTokenMiddleware, (req, res) => updatePaymentMethod(req, res, 'crypto'));

router.post('/signup', async (req, res) => {
  const { name, email, password, role, ...otherFields } = req.body;

  try {
    let user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPasswordBuffer = await scrypt(password, salt, 64);
    const hashedPassword = `${salt}:${hashedPasswordBuffer.toString('hex')}`;

    user = new User({ name, email: email.toLowerCase(), password: hashedPassword, role, ...otherFields });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Failed to register user:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/addmentor', checkTokenMiddleware, async (req, res) => {
  const { name, email, password, role, rate, ...otherFields } = req.body;

  try {
    let admin = await User.findById(req.user);
    if (!admin) {
      return res.status(400).json({ message: 'Admin not found' });
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPasswordBuffer = await scrypt(password, salt, 64);
    const hashedPassword = `${salt}:${hashedPasswordBuffer.toString('hex')}`;

    user = new User({ name, email: email.toLowerCase(), password: hashedPassword, role, rate, ...otherFields });
    await user.save();
    res.status(201).json({ message: 'Mentor registered successfully', user });
  } catch (error) {
    console.error('Failed to add mentor:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.patch('/edituser', checkTokenMiddleware, async (req, res) => {
  const { _id, role, rate, name, email } = req.body;

  try {
    const admin = await User.findById(req.user);
    if (!admin) {
      return res.status(400).json({ message: 'Admin not found' });
    }

    const user = await User.findByIdAndUpdate(_id, { role, rate, name, email }, { new: true });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('Failed to update user:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.delete('/deleteuser', checkTokenMiddleware, async (req, res) => {
  const { _id } = req.body;

  try {
    const admin = await User.findById(req.user);
    if (!admin) {
      return res.status(400).json({ message: 'Admin not found' });
    }

    const user = await User.findByIdAndDelete(_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'User deleted successfully', user });
  } catch (error) {
    console.error('Failed to delete user:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password, remember } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const [salt, storedHash] = user.password.split(':');
    const hashedBuffer = await scrypt(password, salt, 64);
    const hashedPassword = hashedBuffer.toString('hex');

    if (storedHash !== hashedPassword) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    const expiresIn = remember ? '1d' : '1h';
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn });

    res.status(200).json({ message: 'Login successful', token, user, expiresIn });
  } catch (error) {
    console.error('Failed to login user:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.patch('/update-password', checkTokenMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const [salt, storedHash] = user.password.split(':');
    const oldPasswordBuffer = await scrypt(oldPassword, salt, 64);
    const hashedOldPassword = oldPasswordBuffer.toString('hex');

    if (storedHash !== hashedOldPassword) {
      return res.status(401).json({ message: 'Old password is incorrect' });
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    const newPasswordBuffer = await scrypt(newPassword, newSalt, 64);
    const hashedNewPassword = newPasswordBuffer.toString('hex');

    user.password = `${newSalt}:${hashedNewPassword}`;
    await user.save();

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Failed to update password:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/mentors/:mentorId/rate', checkTokenMiddleware, async (req, res) => {
  const { mentorId } = req.params;
  const { rating, review } = req.body;
  const userId = req.user;

  try {
    const mentor = await User.findById(mentorId);
    if (!mentor) {
      return res.status(404).json({ error: 'Mentor not found' });
    }

    if (mentorId === userId.toString()) {
      return res.status(403).json({ error: 'Mentors cannot rate themselves' });
    }

    const existingRating = mentor.ratings.find(r => r.reviewedBy.toString() === userId.toString());
    if (existingRating) {
      return res.status(403).json({ error: 'User has already rated this mentor' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    mentor.ratings.push({ rating, review, reviewedBy: userId });
    await mentor.save();

    res.status(201).json({ message: 'Rating added successfully' });
  } catch (error) {
    console.error('Failed to rate mentor:', error);
    res.status(500).json({ error: 'Server error' });
  }
});




router.get('/withdrawals', checkTokenMiddleware, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ userId: req.user });
    res.json(withdrawals);
  } catch (error) {
    console.error('Failed to fetch withdrawals:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/withdrawals', checkTokenMiddleware, async (req, res) => {
  const { amount, coin, method, notes = "null" } = req.body;

  try {
    if (!amount || !method) {
      return res.status(400).json({ error: 'Amount and method are required.' });
    }

    const user = await User.findById(req.user);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.walletBalance < amount) {
      return res.status(400).json({ error: 'Insufficient balance.' });
    }

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

    const newWithdrawal = new Withdrawal({
      userId: req.user,
      amount,
      method,
      notes,
      fee: calculateFee(amount, method),
    });

    await newWithdrawal.save();

    user.walletBalance -= coin;
    await user.save();

    res.status(201).json(newWithdrawal);
  } catch (error) {
    console.error('Failed to create withdrawal:', error);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

router.post('/introductionVideo', checkTokenMiddleware, upload.single('video'), uploadToS3, async (req, res) => {
  try {
    const user = await User.findById(req.user);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.introductionvideoUrl = req.fileUrl;
    const updatedUser = await user.save();
    res.status(201).json(updatedUser);
  } catch (error) {
    console.error('Failed to upload introduction video:', error);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

router.post('/idProof', checkTokenMiddleware, upload.single('idProof'), uploadToS3, async (req, res) => {
  try {
    const user = await User.findById(req.user);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.idProofUrl = req.fileUrl;
    const updatedUser = await user.save();
    res.status(201).json(updatedUser);
  } catch (error) {
    console.error('Failed to upload ID proof:', error);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

router.post('/profilePicture', checkTokenMiddleware, upload.single('profilePicture'), uploadToS3, async (req, res) => {
  try {
    const user = await User.findById(req.user);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.profilePictureUrl = req.fileUrl;
    const updatedUser = await user.save();
    res.status(201).json(updatedUser);
  } catch (error) {
    console.error('Failed to upload profile picture:', error);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});


router.patch('/payment-info', checkTokenMiddleware, async (req, res) => {
  try {
    const { method, accountInfo } = req.body;

    if (!method || !accountInfo) {
      return res.status(400).json({ error: 'Method and account information are required.' });
    }

    const user = await User.findById(req.user);
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
    console.error('Failed to update payment information:', error);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

router.post('/setAvailability', checkTokenMiddleware, async (req, res) => {
  try {
    const { availability } = req.body;

    if (!availability || !Array.isArray(availability.times)) {
      return res.status(400).json({ message: 'Availability must be an array of times' });
    }

    const user = await User.findById(req.user);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existingAvailability = user.availability ? user.availability.times : [];

    const isOverlap = (time1, time2) => {
      const start1 = moment(time1.start);
      const end1 = moment(time1.end);
      const start2 = moment(time2.start);
      const end2 = moment(time2.end);

      return (start1.isBefore(end2) && start2.isBefore(end1));
    };

    const convertedTimes = availability.times.map(time => {
      if (!time.start || !time.end || !moment(time.start, 'YYYY-MM-DDTHH:mm', true).isValid() || !moment(time.end, 'YYYY-MM-DDTHH:mm', true).isValid()) {
        throw new Error('Invalid date-time format for start or end time. Use "YYYY-MM-DDTHH:mm"');
      }

      const startTimeUTC = moment(time.start).utc();
      const endTimeUTC = moment(time.end).utc();

      if (!startTimeUTC.isBefore(endTimeUTC)) {
        throw new Error('Start time must be before end time');
      }

      return { start: startTimeUTC.format(), end: endTimeUTC.format() };
    });

    for (const newTime of convertedTimes) {
      for (const existingTime of existingAvailability) {
        if (isOverlap(newTime, existingTime)) {
          throw new Error('Time slot overlaps with an existing one');
        }
      }
    }

    user.availability = { times: [...existingAvailability, ...convertedTimes] };
    await user.save();

    res.status(200).json({ message: 'Availability updated successfully', user });
  } catch (error) {
    console.error('Error updating availability:', error);
    if (error.message.includes('Invalid date-time format') || error.message.includes('Start time must be before end time') || error.message.includes('Time slot overlaps with an existing one')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/getAvailability', checkTokenMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.location || !user.location.timeZone) {
      return res.status(400).json({ message: 'You need to set the time zone first' });
    }

    const availability = user.availability ? user.availability.times : [];
    const convertedAvailability = availability.map(slot => ({
      start: momentTimezone.tz(slot.start, user.location.timeZone).format(),
      end: momentTimezone.tz(slot.end, user.location.timeZone).format(),
      _id: slot._id
    }));

    res.status(200).json({ message: 'Availability retrieved successfully', availability: convertedAvailability, timeZone: user.location.timeZone });
  } catch (error) {
    console.error('Error retrieving availability:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id/location', checkTokenMiddleware, async (req, res) => {
  const { timeZone, city, state, country } = req.body;

  if (!timeZone || !country || !state || !city) {
    return res.status(400).json({ message: 'All location fields (timeZone, country, state, city) are required' });
  }

  const getCountryISOCode = (countryName) => {
    const country = Country.getAllCountries().find(country => country.name === countryName);
    return country ? country.isoCode : null;
  };

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const countryISO = getCountryISOCode(country);
    if (!countryISO) {
      return res.status(400).json({ message: 'Invalid country name' });
    }

    user.location = { timeZone, country, state, city };
    await user.save();
    res.json({ message: 'Location updated successfully', location: user.location });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

router.get('/getAvailabilityByMentor/:mentorId', checkTokenMiddleware, async (req, res) => {
  try {
    const client = await User.findById(req.user);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    if (!client.location || !client.location.timeZone) {
      return res.status(400).json({ message: 'You need to set your time zone first' });
    }

    const mentor = await User.findById(req.params.mentorId);
    if (!mentor) {
      return res.status(404).json({ message: 'Mentor not found' });
    }

    const availability = mentor.availability ? mentor.availability.times : [];
    const currentTime = momentTimezone.tz(client.location.timeZone);
    const futureAvailability = availability.filter(slot => momentTimezone.tz(slot.start, mentor.location.timeZone).isAfter(currentTime))
      .map(slot => ({
        start: momentTimezone.tz(slot.start, mentor.location.timeZone).tz(client.location.timeZone).format(),
        end: momentTimezone.tz(slot.end, mentor.location.timeZone).tz(client.location.timeZone).format()
      }));

    res.status(200).json({ message: 'Availability retrieved successfully', availability: futureAvailability, timeZone: client.location.timeZone });
  } catch (error) {
    console.error('Error retrieving availability:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/deleteAvailability/:id', checkTokenMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.availability.times = user.availability.times.filter(time => time._id.toString() !== req.params.id);
    await user.save();

    res.json({ message: 'Availability deleted successfully', availability: user.availability.times });
  } catch (error) {
    console.error('Error deleting availability:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Route to get all issue reports
router.get('/issue-reports', checkTokenMiddleware, async (req, res) => {
  try {
      const issues = await IssueReport.find().populate('repotedBy', 'name email');
      res.json(issues);
  } catch (err) {
      res.status(500).json({ message: err.message });
  }
});

// Route to create a new issue report
router.post('/issue-reports', checkTokenMiddleware, async (req, res) => {
  const userid = req.user; // Assuming req.user contains the user object after authentication
  const newIssueReport = new IssueReport({
      issue: req.body.issue,
      repotedTime: new Date(), // Set the current time
      repotedBy: userid,
      status: req.body.status,
      reply: req.body.reply
  });

  try {
      const savedIssue = await newIssueReport.save();
      res.status(201).json(savedIssue);
  } catch (err) {
      res.status(400).json({ message: err.message });
  }
});

// Route to update an issue report's reply
router.patch('/issue-reports/:id', checkTokenMiddleware, async (req, res) => {
  try {
      const updateFields = {};

      if (req.body.issue) {
        updateFields.issue = req.body.issue;
      }
      if (req.body.reply) {
          updateFields.reply = req.body.reply;
      }
      if (req.body.status) {
          updateFields.status = req.body.status;
      }

      const updatedIssue = await IssueReport.findByIdAndUpdate(
          req.params.id,
          { $set: updateFields },
          { new: true, runValidators: true }
      );

      if (!updatedIssue) {
          return res.status(404).json({ message: 'Issue report not found' });
      }

      res.json(updatedIssue);
  } catch (err) {
      res.status(400).json({ message: err.message });
  }
});

// Route to delete an issue report
router.delete('/issue-reports/:id', checkTokenMiddleware, async (req, res) => {
  try {
      const issue = await IssueReport.findById(req.params.id);
      if (!issue) {
          return res.status(404).json({ message: 'Issue report not found' });
      }

      await IssueReport.deleteOne({ _id: req.params.id });
      res.json({ message: 'Issue report deleted' });
  } catch (err) {
      res.status(500).json({ message: err.message });
  }
});

// Route to get all issue reports by user ID
router.get('/issue-reportsbyuser', checkTokenMiddleware, async (req, res) => {
  try {
      const userId = req.user;
      const issues = await IssueReport.find({ repotedBy: userId }).populate('repotedBy', 'name email');
      res.json(issues);
  } catch (err) {
      res.status(500).json({ message: err.message });
  }
});




module.exports = router;

