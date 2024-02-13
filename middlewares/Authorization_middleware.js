const jwt = require('jsonwebtoken');

// Assuming JWT_SECRET is defined in your environment
const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = (req, res, next) => {
    // Extract the token from the Authorization header and remove any leading/trailing whitespace
    const token = req.header('Authorization')?.replace('Bearer ', '').trim();
    if (!token) {
        return res.status(401).send('Access denied. No token provided.');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (ex) {
        res.status(400).send('Invalid token.');
    }
};

module.exports = authMiddleware;

