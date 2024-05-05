const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const app = express();


// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

// CORS Middleware Setup
app.use(cors({
  credentials: true,
  origin: true, // Allows all origins. If you need more specific control, adjust accordingly.
}));

app.use(express.json());

// Routes
const User = require('./routes/User');
app.use('/api/user', User);
// Uncomment and implement if you plan to use:
const MentorSession = require('./routes/Sessions');
app.use('/api/session', MentorSession);

const Article = require('./routes/Article');
app.use('/api/article', Article);

app.get("/", (req, res) => {
  res.status(200).send({ message: 'Hello from the Cocreatedlab AMC backend' });
});

// Global Error Handling Middleware (simple example)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});










const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Server listening at port http://localhost:${PORT}`));

