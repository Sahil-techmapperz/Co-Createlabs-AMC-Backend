const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Assuming your model is named 'User' and the file path is correct
const User_auth_Middleware= require("../middlewares/Authorization_middleware");
const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secure-secret';



router.get("/", (req, res) => {
    res.status(200).send("Hello from User Route");
});

// Route to get all users
router.get('/all', async (req, res) => {
    try {
      const users = await User.find({}); // Fetch all users
      res.json(users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });


// Signup route for users (Mentors, Clients, Admins)
router.post('/signup', async (req, res) => {
    const { name, email, password, role, ...otherFields } = req.body;

    try {
        // Check if the user already exists
        let user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create a new user with required fields
        user = new User({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role,
            ...otherFields // Include other relevant fields based on the role
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
    const { email, password } = req.body;

    try {
        // Check if the user exists
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Compare the provided password with the stored hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        // Create a JWT token
        const token = jwt.sign({ userId: user._id,user:user }, JWT_SECRET, { expiresIn: '1d' });

        res.status(200).json({ message: 'Login successful', token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});



module.exports = router; // Export the router
