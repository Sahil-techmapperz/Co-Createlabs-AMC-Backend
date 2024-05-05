const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Article = require('../models/Article');
const { checkTokenMiddleware, upload, uploadToS3 } = require('../Middleware');

// Base route response
router.get("/", (req, res) => {
    res.status(200).send("Hello from User Article routes");
});

// Route to get all articles
router.get('/all', checkTokenMiddleware, async (req, res) => {
    try {
        const articles = await Article.find({}); // Fetch all articles
        res.json(articles);
    } catch (error) {
        console.error('Failed to fetch articles:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Route to create an article
router.post('/create', checkTokenMiddleware, upload.single('bannerImage'), uploadToS3, async (req, res) => {
    try {
        const { title, description } = req.body;

        if (!title || !description) {
            return res.status(400).send({ message: 'All fields are required.' });
        }

        // Check if the user is allowed to create an article
        const userId = req.user; // Assuming the middleware sets req.user

        const user = await User.findById(userId);

        if (user.role === "client") {
            return res.status(403).send({ message: 'Clients are not allowed to create articles.' });
        }

        const currentDate = new Date().toISOString(); // Gets the current date in ISO format

        const newArticle = new Article({
            bannerimage: req.fileUrl, // Use the URL obtained from uploadToS3
            title,
            description,
            author :user.name,
            date: currentDate,
        });

        await newArticle.save();

        res.status(201).send({ message: 'Article created successfully', articleId: newArticle._id });
    } catch (error) {
        console.error('Error during article creation:', error);
        res.status(500).send({ message: 'Error creating article', error: error.message });
    }
});

module.exports = router;
