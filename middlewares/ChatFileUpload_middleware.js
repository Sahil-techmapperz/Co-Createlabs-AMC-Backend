const AWS = require('aws-sdk');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Configure AWS S3
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

// Multer configuration for image uploads
const imageStorage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/images/');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Append timestamp to the original file name
    },
});
const imageUpload = multer({
    storage: imageStorage,
    fileFilter: function(req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image! Please upload only images.'), false);
        }
    },
});

// Multer configuration for generic file uploads
const fileStorage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/files/');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Append timestamp to the original file name
    },
});
const fileUpload = multer({ storage: fileStorage });

// Middleware for image uploads
const ChatImageUpload_middleware = (req, res, next) => {
    imageUpload.single('image')(req, res, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (!req.file) {
            return res.status(400).send('No image file uploaded.');
        }

        uploadFileToS3(req.file, req, res, next);
    });
};

// Middleware for generic file uploads
const ChatFileUpload_middleware = (req, res, next) => {
    fileUpload.single('file')(req, res, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        uploadFileToS3(req.file, req, res, next);
    });
};

// Function to upload a file to S3
function uploadFileToS3(file, req, res, next) {
    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: file.filename, // Using the timestamped filename
        Body: fs.createReadStream(file.path),
        ContentType: file.mimetype,
    };

    s3.upload(params, (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error uploading to S3');
        }

        req.body.fileUrl = data.Location; // Or req.body.fileUrl for generic files

        fs.unlink(file.path, unlinkErr => {
            if (unlinkErr) {
                console.error(unlinkErr);
            }
            next();
        });
    });
}

module.exports = { ChatImageUpload_middleware, ChatFileUpload_middleware };
