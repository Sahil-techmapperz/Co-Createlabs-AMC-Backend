const AWS = require('aws-sdk');
const multer = require('multer');
const fs = require('fs');

// Multer configuration
const upload = multer({ dest: 'uploads/' });

// AWS configuration
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

const ImageUploadMiddleware = (req, res, next) => {
    upload.single('image')(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            // Handle Multer file upload errors
            return res.status(500).json({ error: err.message });
        } else if (err) {
            // Handle other errors
            return res.status(500).json({ error: err.message });
        }

        // Proceed only if file is uploaded
        if (!req.file) {
            next();
        }

        const file = req.file;

        const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: file.originalname,
            Body: fs.createReadStream(file.path),
            ContentType: file.mimetype,
        };

        s3.upload(params, (err, data) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error uploading to S3');
            }

            // Optionally, you can add the URL to the request for downstream use
            req.body.imageUrl = data.Location;
            

            // Delete the file from local storage after uploading to S3
            fs.unlink(file.path, unlinkErr => {
                if (unlinkErr) console.error(unlinkErr);
            });

            next();
        });
    });
};

module.exports = ImageUploadMiddleware;
