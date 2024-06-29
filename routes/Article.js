const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Article = require('../models/Article');
const { checkTokenMiddleware, upload, uploadToS3, uploadnoticeimageToS3 } = require('../Middleware');

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
        if (user.role === "Mentor") {
            return res.status(403).send({ message: 'Mentor are not allowed to create articles.' });
        }
        const currentDate = new Date().toISOString(); // Gets the current date in ISO format

        const newArticle = new Article({
            bannerimage: req.fileUrl, // Use the URL obtained from uploadToS3
            title,
            description,
            author: user.name,
            date: currentDate,
        });

        await newArticle.save();

        res.status(201).send({ message: 'Article created successfully', articleId: newArticle._id });
    } catch (error) {
        console.error('Error during article creation:', error);
        res.status(500).send({ message: 'Error creating article', error: error.message });
    }
});

// Route to edit an article
router.put('/edit/:id', checkTokenMiddleware, upload.single('bannerImage'), uploadnoticeimageToS3, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description } = req.body;

        if (!title || !description) {
            return res.status(400).send({ message: 'All fields are required.' });
        }

        // Check if the user is allowed to edit the article
        const userId = req.user; // Assuming the middleware sets req.user
        const user = await User.findById(userId);

        if (user.role === "client" || user.role === "Mentor") {
            return res.status(403).send({ message: 'You are not allowed to edit articles.' });
        }

        const article = await Article.findById(id);
        if (!article) {
            return res.status(404).send({ message: 'Article not found.' });
        }

        // Update the article
        article.title = title;
        article.description = description;
        if (req.fileUrl) {
            article.bannerimage = req.fileUrl;
        }

        await article.save();

        res.status(200).send({ message: 'Article updated successfully' });
    } catch (error) {
        console.error('Error during article update:', error);
        res.status(500).send({ message: 'Error updating article', error: error.message });
    }
});

// Route to delete an article
router.delete('/delete/:id', checkTokenMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if the user is allowed to delete the article
        const userId = req.user; // Assuming the middleware sets req.user
        const user = await User.findById(userId);

        if (user.role === "client" || user.role === "Mentor") {
            return res.status(403).send({ message: 'You are not allowed to delete articles.' });
        }

        const article = await Article.findByIdAndDelete(id);
        if (!article) {
            return res.status(404).send({ message: 'Article not found.' });
        }

        res.status(200).send({ message: 'Article deleted successfully' });
    } catch (error) {
        console.error('Error during article deletion:', error);
        res.status(500).send({ message: 'Error deleting article', error: error.message });
    }
});

module.exports = router;
