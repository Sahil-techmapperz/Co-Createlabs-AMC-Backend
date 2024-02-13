const express = require('express');
const router = express.Router();
const Sessions = require('../models/ScheduledSessions');
const UserSession = require('../models/userSession');
const Attendee = require('../models/attendee');
const User = require('../models/User');
const Emailtransporter = require('../conf/Email');
const schedule = require('node-schedule');
const User_auth_Middleware = require("../middlewares/Authorization_middleware");
const mongoose = require('mongoose');
const moment = require('moment'); // Use moment for easy date manipulation
// GET route
router.get("/", (req, res) => {
    res.status(200).send("Welcome to Sessions Route");
});

// GET route to fetch all sessions by a specific mentorId with Pagination
router.get('/sessions/byMentor/:mentorId', User_auth_Middleware, async (req, res) => {
    try {
        const { mentorId } = req.params; // Extract mentorId from the route parameters
        const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
        const limit = parseInt(req.query.limit) || 10; // Default to 10 sessions per page if not specified
        const skip = (page - 1) * limit;

        // Query the database for sessions with the specified mentorId with Pagination
        const sessions = await Sessions.find({ mentor: mentorId })
            .populate('mentor', 'name email') // Optionally populate mentor details
            .skip(skip)
            .limit(limit);

        // Count the total number of sessions for the mentor to calculate total pages
        const totalSessions = await Sessions.countDocuments({ mentor: mentorId });
        const totalPages = Math.ceil(totalSessions / limit);

        // Check if sessions exist for the mentor
        if (sessions.length === 0) {
            return res.status(404).send({ message: 'No sessions found for the specified mentor' });
        }

        res.status(200).send({
            sessions,
            pagination: {
                totalSessions,
                totalPages,
                currentPage: page,
                limit,
            },
        });
    } catch (error) {
        console.error('Error fetching sessions for mentor with pagination:', error);
        res.status(500).send({ message: 'Error fetching sessions', error: error.message });
    }
});


// GET route to fetch the next session for a specific mentor by mentorId
router.get('/sessions/nextSession/:mentorId',User_auth_Middleware, async (req, res) => {
    try {
        const { mentorId } = req.params; // Extract mentorId from the route parameters
        const now = new Date(); // Current time

        // Query the database for the next session for this mentor
        const nextSession = await Sessions.findOne({
            mentor: mentorId,
            startTime: { $gt: now } // Find sessions that start in the future
        })
        .sort({ startTime: 1 }) // Sort by startTime in ascending order to get the closest future session
        .populate('mentor', 'name email'); // Optionally populate mentor details

        // Check if a next session exists for the mentor
        if (!nextSession) {
            return res.status(404).send({ message: 'No upcoming sessions found for the specified mentor' });
        }

        res.status(200).send(nextSession);
    } catch (error) {
        console.error('Error fetching the next session for mentor:', error);
        res.status(500).send({ message: 'Error fetching the next session', error: error.message });
    }
});

// GET route to fetch sessions from the past week by a specific mentorId
router.get('/sessions/lastWeek/:mentorId',User_auth_Middleware, async (req, res) => {
    try {
        const { mentorId } = req.params; // Extract mentorId from the route parameters
        const oneWeekAgo = moment().subtract(1, 'weeks').toDate(); // Calculate the date one week ago
        const now = new Date(); // Current time

        // Query the database for sessions that occurred in the past week for this mentor
        const pastWeekSessions = await Sessions.find({
            mentor: mentorId,
            startTime: { $gte: oneWeekAgo, $lte: now } // Sessions that started between one week ago and now
        }).sort({ startTime: -1 }); // Sort by startTime in descending order

        // Check if sessions exist for the mentor in the past week
        if (pastWeekSessions.length === 0) {
            return res.status(404).send({ message: 'No sessions found for the specified mentor in the past week' });
        }

        res.status(200).send(pastWeekSessions);
    } catch (error) {
        console.error('Error fetching past week sessions for mentor:', error);
        res.status(500).send({ message: 'Error fetching past week sessions', error: error.message });
    }
});

router.get('/mentorSessionCounts/:mentorId', User_auth_Middleware, async (req, res) => {
    try {
        const { mentorId } = req.params;
        const { currentMonth, lastMonth } = getMonthDateRanges();


        // Create a new ObjectId instance
        const objectId = new mongoose.Types.ObjectId(mentorId);

        const currentMonthCount = await Sessions.countDocuments({
            mentor: objectId,
            startTime: { $gte: currentMonth.start, $lte: currentMonth.end }
        });

        const lastMonthCount = await Sessions.countDocuments({
            mentor: objectId,
            startTime: { $gte: lastMonth.start, $lte: lastMonth.end }
        });

        let percentageChange = 0;
        if (lastMonthCount > 0) {
            percentageChange = ((currentMonthCount - lastMonthCount) / lastMonthCount) * 100;
        }

        res.status(200).send({
            currentMonthCount,
            lastMonthCount,
            percentageChange: percentageChange.toFixed(2) + '%' // rounded to two decimal places
        });
    } catch (error) {
        res.status(500).send({ message: 'Error retrieving session counts', error: error.message });
    }
});


// GET route to fetch last 6 clients by mentor
router.get('/lastSixClients/:mentorId', async (req, res) => {
    try {
        const { mentorId } = req.params;
        const objectId = new mongoose.Types.ObjectId(mentorId)
        const sessions = await Sessions.find({ mentor: objectId });

        console.log(sessions);

        let clientsDetails = [];

        for (let session of sessions) {
            const userSessions = await UserSession.find({ session: session._id })
                .sort({ joinTime: -1 })
                .limit(6)
                .populate('user'); // Populate user details

            userSessions.forEach(userSession => {
                if (!clientsDetails.some(client => client.id === userSession.user.id)) {
                    clientsDetails.push(userSession.user);
                }
            });

            if (clientsDetails.length >= 6) {
                break;
            }
        }

        clientsDetails = clientsDetails.slice(0, 6); // Ensure only 6 clients are returned

        res.status(200).json(clientsDetails);
    } catch (error) {
        res.status(500).send({ message: 'Error retrieving client details', error: error.message });
    }
});


// Function to calculate date ranges
function getMonthDateRanges() {
    const now = new Date();
    const firstDayCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    return {
        currentMonth: {
            start: firstDayCurrentMonth,
            end: lastDayCurrentMonth
        },
        lastMonth: {
            start: firstDayLastMonth,
            end: lastDayLastMonth
        }
    };
}


// POST route
router.post('/create', User_auth_Middleware, async (req, res) => {
    try {
        const session = new Sessions(req.body);
        await session.save();
        res.status(201).send({ message: 'Session created successfully', session });
    } catch (error) {
        res.status(400).send({ message: 'Error creating session', error: error.message });
    }
});


// POST route
router.post('/purchase', User_auth_Middleware, async (req, res) => {
    try {
        const userId = req.body.user; // Adjust according to your setup
        const sessionId = req.body.session; // Assuming session ID is passed in the request body

        // Fetch user details
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).send({ message: 'User not found' });
        }

        // Check if the user is a 'Client'
        if (user.role !== 'Client') {
            return res.status(403).send({ message: 'Only clients are allowed to join sessions' });
        }

        // Fetch session details
        const session = await Sessions.findById(sessionId).populate('mentor', 'walletBalance');
        if (!session) {
            return res.status(404).send({ message: 'Session not found' });
        }

        // Check if the user is already a participant in the session
        if (session.participants.includes(user.email)) {
            return res.status(400).send({ message: 'User is already registered for this session' });
        }

        // Check if user's walletBalance is sufficient
        if (user.walletBalance < session.price) {
            return res.status(400).send({ message: 'Insufficient wallet balance to join the session' });
        }

        // Deduct session price from client's walletBalance
        user.walletBalance -= session.price;
        user.spent += session.price;
        await user.save();

        // Add session price to mentor's walletBalance
        const mentor = await User.findById(session.mentor._id); // Ensure correct referencing
        if (!mentor) {
            return res.status(404).send({ message: 'Mentor not found' });
        }
        mentor.walletBalance += session.price;
        await mentor.save();

        // Since the user is not already a participant and has sufficient balance, add them now
        session.participants.push(user.email); // Add user's email to session's participants
        await session.save();

        // Email content
        const emailContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                    padding: 0;
                    color: #333;
                }
                .container {
                    background-color: #f8f8f8;
                    padding: 20px;
                    border-radius: 8px;
                    border: 1px solid #e7e7e7;
                    text-align: center; /* Center align the content */
                }
                .logo {
                    font-size: 24px; /* Adjust the size as needed */
                    font-weight: bold;
                    color: #0056b3; /* Adjust the color as needed */
                    margin-bottom: 20px;
                }
                h1 {
                    color: #0056b3;
                }
                ul {
                    list-style-type: none;
                    padding: 0;
                    text-align: left; /* Align list items to the left */
                    display: inline-block; /* For centering the list in a div */
                    margin: 0; /* Remove default margin */
                }
                li {
                    margin-bottom: 10px;
                    font-size: 16px;
                }
                .footer {
                    margin-top: 20px;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">CoCreateLabs</div>
                <h1>Session Confirmation</h1>
                <p>Dear ${user.name},</p>
                <p>You have successfully joined the session: <strong>${session.title}</strong>.</p>
                <p>Session Details:</p>
                <ul>
                    <li><strong>Date:</strong> ${session.startTime.toDateString()}</li>
                    <li><strong>Time:</strong> ${session.startTime.toLocaleTimeString()} - ${session.endTime.toLocaleTimeString()}</li>
                    <li><strong>Mentor:</strong> ${mentor.name}</li>
                    <li><strong>Location:</strong> ${session.location}</li>
                </ul>
                <p class="footer">Thank you for joining!</p>
                <p class="footer">© ${new Date().getFullYear()} CoCreateLabs. All rights reserved.</p>
            </div>
        </body>
        </html>
        
   `;

        // Sending the email
        await Emailtransporter.sendMail({
            from: '"CoCreateLabs"', // Sender address
            to: user.email, // List of receivers
            subject: "Session Join Confirmation", // Subject line
            html: emailContent, // HTML body content
        });

        // Schedule the reminder email to be sent 30 minutes before the session starts
        const reminderTime = new Date(session.startTime.getTime() - (30 * 60 * 1000)); // 30 minutes before session

        schedule.scheduleJob(reminderTime, () => {
            const reminderEmailContent = `
                <h1>Session Reminder</h1>
                <p>Dear ${user.name},</p>
                <p>This is a reminder that you have an upcoming session titled "${session.title}" starting soon.</p>
                <p>Session Details:</p>
                <ul>
                    <li>Date: ${session.startTime.toDateString()}</li>
                    <li>Time: ${session.startTime.toLocaleTimeString()} - ${session.endTime.toLocaleTimeString()}</li>
                    <li>Mentor: ${mentor.name}</li>
                    <li>Location: ${session.location}</li>
                </ul>
                <p>See you there!</p>
            `;

            Emailtransporter.sendMail({
                from: '"CoCreateLabs"', // Sender address
                to: user.email, // Receiver
                subject: "Session Reminder", // Subject line
                html: reminderEmailContent, // HTML body content
            }, (error, info) => {
                if (error) {
                    return console.log(error);
                }
                console.log('Reminder email sent');
            });
        });

        // Proceed to add the user to the session's participants list if required
        // This step depends on how you're managing session participants
        const NewUsersession = new UserSession(req.body);
        await NewUsersession.save();


        const updatedSession = await Sessions.findById(sessionId).populate('mentor', 'walletBalance');

        res.status(201).send({ message: 'Successfully joined the session', "session": updatedSession });
    } catch (error) {
        res.status(400).send({ message: 'Error joining session', error: error.message });
    }
});


router.post('/join', User_auth_Middleware, async (req, res) => {
    try {
        // Destructure and validate the request body
        const { userId, sessionId, joinTime } = req.body;

        if (!userId || !sessionId) {
            return res.status(400).send({ message: 'Missing required fields' });
        }

        // Optional: Check if user and session exist
        const userExists = await User.findById(userId);
        const session = await Sessions.findById(sessionId);
        if (!userExists || !session) {
            return res.status(404).send({ message: 'User or Session not found' });
        }

        // Check if the session is already completed
        if (session.status === 'completed') {
            return res.status(400).send({ message: 'Cannot join a session that is already completed' });
        }

        // Check if the attendee already exists for the session
        const existingAttendee = await Attendee.findOne({ userId, sessionId });
        if (existingAttendee) {
            return res.status(400).send({ message: 'Attendee already joined for this session' });
        }

        // Create a new attendee
        const attendee = new Attendee({
            userId,
            sessionId,
            joinTime: joinTime || new Date() // Use provided joinTime or current time
        });
        await attendee.save();

        // Populate user and session details in the response
        await attendee.populate('userId').populate('sessionId').execPopulate();

        res.status(201).send({ message: 'Attendee created successfully', attendee });
    } catch (error) {
        console.error('Error creating attendee:', error);
        res.status(400).send({ message: 'Error creating attendee', error: error.message });
    }
});

// PATCH route
router.patch('/update/:id', User_auth_Middleware, async (req, res) => {
    try {
        const session = await Sessions.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!session) {
            return res.status(404).send({ message: 'Session not found' });
        }
        res.send({ message: 'Session updated successfully', session });
    } catch (error) {
        res.status(400).send({ message: 'Error updating session', error: error.message });
    }
});


router.delete('/leave', User_auth_Middleware, async (req, res) => {
    try {
        const { userId, sessionId } = req.body;

        if (!userId || !sessionId) {
            return res.status(400).send({ message: 'Missing required fields: userId and sessionId' });
        }

        // Optional: Check if user and session exist
        const userExists = await User.findById(userId);
        const sessionExists = await Sessions.findById(sessionId);
        if (!userExists || !sessionExists) {
            return res.status(404).send({ message: 'User or Session not found' });
        }

        // Check if the session is already completed
        if (sessionExists.status === 'completed') {
            return res.status(400).send({ message: 'Cannot leave a session that is already completed' });
        }

        // Remove the attendee record
        const result = await Attendee.findOneAndDelete({ userId, sessionId });
        if (!result) {
            return res.status(404).send({ message: 'Attendee not found or already removed' });
        }

        res.send({ message: 'Successfully left the session', details: result });
    } catch (error) {
        console.error('Error leaving session:', error);
        res.status(500).send({ message: 'Error processing leave request', error: error.message });
    }
});

// DELETE route
router.delete('/delete/:id', User_auth_Middleware, async (req, res) => {
    try {
        const session = await Sessions.findByIdAndDelete(req.params.id);
        if (!session) {
            return res.status(404).send({ message: 'Session not found' });
        }
        res.send({ message: 'Session deleted successfully', session });
    } catch (error) {
        res.status(500).send({ message: 'Error deleting session', error: error.message });
    }
});

// Bulk DELETE route
router.delete('/bulkdelete', User_auth_Middleware, async (req, res) => {
    try {
        const ids = req.body.ids;
        const result = await Sessions.deleteMany({ _id: { $in: ids } });
        if (result.deletedCount === 0) {
            return res.status(404).send("No sessions found to delete.");
        }
        res.send(`Successfully deleted ${result.deletedCount} sessions.`);
    } catch (error) {
        res.status(500).send({ message: 'Error in bulk deletion', error: error.message });
    }
});

module.exports = router;
