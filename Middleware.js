const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Update AWS config
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Temporary storage path
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({ storage: storage });

// Middleware for uploading files to S3
const uploadToS3 = (req, res, next) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    
    const file = req.file;

    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: file.filename, // Use the filename from multer to ensure uniqueness
        Body: fs.createReadStream(file.path),
        ContentType: file.mimetype,
    };

    s3.upload(params, (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error uploading to S3');
        }

        // Attach the URL to the request so it can be used in subsequent middleware or route handler
        req.fileUrl = data.Location;

        // Clean up the uploaded file from local storage
        fs.unlink(file.path, (err) => {
            if (err) console.error('Error removing temporary file:', err);
        });

        next(); // Proceed to the next middleware or route handler
    });
};
const uploadnoticeimageToS3 = (req, res, next) => {
    if (!req.file) {
      return  next(); //
    }
    
    const file = req.file;

    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: file.filename, // Use the filename from multer to ensure uniqueness
        Body: fs.createReadStream(file.path),
        ContentType: file.mimetype,
    };

    s3.upload(params, (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error uploading to S3');
        }

        // Attach the URL to the request so it can be used in subsequent middleware or route handler
        req.fileUrl = data.Location;

        // Clean up the uploaded file from local storage
        fs.unlink(file.path, (err) => {
            if (err) console.error('Error removing temporary file:', err);
        });

        next(); // Proceed to the next middleware or route handler
    });
};



const uploadVideoToS3 = (req, res, next) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const file = req.file;

    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: file.filename, // Use the filename from multer to ensure uniqueness
        Body: fs.createReadStream(file.path),
        ContentType: file.mimetype,
    };

    s3.upload(params, (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error uploading to S3');
        }

        // Attach the URL to the request so it can be used in subsequent middleware or route handler
        req.fileUrl = data.Location;

        // Optionally, clean up the uploaded file from local storage if it's no longer needed
        fs.unlink(file.path, err => {
            if (err) console.error('Error removing temporary file:', err);
        });

        next(); // Proceed to the next middleware or route handler
    });
};


// Middleware for checking JWT token
const checkTokenMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // Use actual secret from env
        req.mentorId = decoded.userId;
        req.user = decoded.userId; 
        next(); // Proceed to the next middleware/route handler
    } catch (error) {
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};

// Middleware for authenticating WebSocket connections
const authenticateSocket = (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('No token provided'));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => { // Use secret from env
        if (err) {
            return next(new Error('Authentication error'));
        }

        socket.user = decoded; // Attach user info to socket
        next();
    });
};

// Named export
module.exports = { checkTokenMiddleware, authenticateSocket, upload, uploadToS3,uploadVideoToS3,uploadnoticeimageToS3 };
