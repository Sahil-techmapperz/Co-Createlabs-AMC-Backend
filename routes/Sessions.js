const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Sessions = require('../models/Sessions');
const User = require('../models/User');
const moment = require('moment'); // Use moment for easy date manipulation
const { checkTokenMiddleware } = require('../Middleware');
const correctDateFormat = require('../Utilitys/dateFormat');
const getMonthDateRanges = require('../Utilitys/MonthDateRanges');
const refundClient = require('../Utilitys/RefundClient');
const { sendConfirmationEmail, scheduleReminderEmail,sendRescheduleEmail,sendCancellationEmail } = require('./../services/emailService'); // Example path to email services




// GET route
router.get("/", (req, res) => {
    res.status(200).send("Welcome to Sessions Route");
});


// GET route to fetch all sessions by mentorId, including renamed client details
router.get('/all/bymentor', checkTokenMiddleware, async (req, res) => {
    const mentorId  = req.user; // Extract mentorId from route parameters

    // Validate the mentorId
    if (!mongoose.Types.ObjectId.isValid(mentorId)) {
        return res.status(400).send({ message: 'Invalid mentorId provided' });
    }

    try {
        // Fetch sessions and populate client details
        const sessions = await Sessions.find({ mentor: mentorId })
            .populate({
                path: 'Client', // Assumes 'Client' is a reference to the User model
                select: 'name profilePictureUrl', // Retrieve original client details
            });

        // Check if no sessions were found
        if (sessions.length === 0) {
            return res.status(404).send({ message: 'No sessions found for the specified mentor' });
        }

      

        // Successful response with the modified sessions
        res.status(200).send({
            message: 'Sessions fetched successfully',
            data: sessions,
        });
    } catch (error) {
        console.error('Error fetching sessions for mentor:', error);
        res.status(500).send({ message: 'Error fetching sessions', error: error.message });
    }
});

// GET route to fetch the next session for a specific mentorId
router.get('/nextSession/bymentor', checkTokenMiddleware, async (req, res) => {
  try {
      const mentorId = req.user; // Get the mentorId from the authenticated user

      if (!mongoose.Types.ObjectId.isValid(mentorId)) {
          return res.status(400).send({ message: 'Invalid mentorId provided' });
      }

      // Get the current time
      const now = new Date();

      // Find the next session that starts in the future for the given mentor
      const nextSession = await Sessions.findOne({
          mentor: mentorId,
          startTime: { $gt: now }, // Find sessions that start after the current time
      })
      .sort({ startTime: 1 }) // Sort by start time in ascending order
      .populate('Client', 'name profilePictureUrl') // Populate client details
      .populate('mentor', 'name email'); // Populate mentor details

      if (!nextSession) {
          return res.status(404).send({ message: 'No upcoming sessions found for the specified mentor' });
      }

      // Convert Mongoose document to plain JavaScript object
      const sessionData = nextSession.toObject();

      // Calculate the time left until the session starts
      const timeLeftMillis = new Date(sessionData.startTime) - now;
      const timeLeftHours = Math.floor(timeLeftMillis / (1000 * 60 * 60));
      const timeLeftMinutes = Math.floor((timeLeftMillis % (1000 * 60 * 60)) / (1000 * 60));

      // Add additional information to the sessionData object
      sessionData.startDate = new Date(sessionData.startTime).toLocaleDateString(); // Formatted start date
      sessionData.startTimeFormatted = new Date(sessionData.startTime).toLocaleTimeString(); // Formatted start time
      sessionData.timeLeft = `${timeLeftHours} hours and ${timeLeftMinutes} minutes`; // Time left as a string

      res.status(200).send({
          message: 'Next session found',
          sessionData, // Return the updated sessionData object with additional information
      });
  } catch (error) {
      console.error('Error fetching the next session for mentor:', error);
      res.status(500).send({ message: 'Error fetching the next session', error: error.message });
  }
});


// GET route to fetch sessions from the previous week by a specific mentorId
router.get('/previousWeek', checkTokenMiddleware, async (req, res) => {
  try {
      const mentorId = req.user; // Get mentorId from token

      // Validate mentorId as a MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(mentorId)) {
          return res.status(400).json({ message: 'Invalid mentorId provided' });
      }

      // Determine the start and end of the previous week
      const now = moment().startOf('isoWeek'); // Start of the current week
      const previousWeekStart = now.subtract(1, 'weeks').toDate(); // Start of previous week
      const previousWeekEnd = moment(previousWeekStart).endOf('isoWeek').toDate(); // End of previous week

      // Find sessions for the specified mentor in the previous week
      const previousWeekSessions = await Sessions.find({
          mentor: mentorId,
          startTime: { $gte: previousWeekStart, $lte: previousWeekEnd },
      })
      .populate('mentor', 'rate') // Populate mentor's rate
      .sort({ startTime: -1 }); // Sort sessions by start time

      // Create a readable date range for the previous week
      const previousWeekRange = `${moment(previousWeekStart).format('DD')} - ${moment(previousWeekEnd).format('DD MMMM YYYY')}`;

      // Return the list of sessions and the date range
      res.status(200).json({
          sessions: previousWeekSessions,
          previousWeekRange, // Add the range to the response
      });
  } catch (error) {
      console.error('Error fetching previous week sessions for mentor:', error);
      res.status(500).json({ message: 'Error fetching previous week sessions', error: error.message });
  }
});

router.get('/mentorSessionCounts',checkTokenMiddleware, async (req, res) => {
    try {
        // const { mentorId } = req.params;
        const { mentorId} = req;


        
        // Validate mentorId
        if (!mongoose.Types.ObjectId.isValid(mentorId)) {
            return res.status(400).send({ message: 'Invalid mentorId provided' });
        }

        const { currentMonth, lastMonth } = getMonthDateRanges();


        const [currentMonthCount, lastMonthCount] = await Promise.all([
            Sessions.countDocuments({
                mentor: mentorId,
                status:{$ne:"Canceled"},
                startTime: { $gte: currentMonth.start, $lte: currentMonth.end }
            }),
            Sessions.countDocuments({
                mentor: mentorId,
                status:{$ne:"Canceled"},
                startTime: { $gte: lastMonth.start, $lte: lastMonth.end }
            })
        ]);

        let percentageChange = 0;
        if (lastMonthCount > 0) {
            percentageChange = ((currentMonthCount - lastMonthCount) / lastMonthCount) * 100;
        }

        res.status(200).send({
            currentMonthCount,
            lastMonthCount,
            percentageChange: percentageChange.toFixed(2) + '%'
        });
    } catch (error) {
        console.error('Error retrieving session counts:', error);
        res.status(500).send({ message: 'Error retrieving session counts', error: error.message });
    }
});


router.get('/client-count', checkTokenMiddleware, async (req, res) => {
  try {
    const mentorId = req.user; // Assuming checkTokenMiddleware provides mentorId

    // Validate mentorId
    if (!mongoose.Types.ObjectId.isValid(mentorId)) {
      return res.status(400).send({ message: 'Invalid mentorId provided' });
    }

    const { currentMonth, lastMonth } = getMonthDateRanges();

    const [currentMonthCount, lastMonthCount] = await Promise.all([
      Sessions.countDocuments({
        mentor: mentorId,
        status: { $ne: 'Canceled' },
        startTime: { $gte: currentMonth.start, $lte: currentMonth.end },
      }),
      Sessions.countDocuments({
        mentor: mentorId,
        status: { $ne: 'Canceled' },
        startTime: { $gte: lastMonth.start, $lte: lastMonth.end },
      }),
    ]);

    let percentageChange = 0;
    if (lastMonthCount > 0) {
      percentageChange = ((currentMonthCount - lastMonthCount) / lastMonthCount) * 100;
    }

    res.status(200).send({
      lastMonthCount,
      currentMonthCount,
      percentageChange: percentageChange.toFixed(2) + '%',
    });
  } catch (error) {
    console.error('Error retrieving session counts:', error);
    res.status(500).send({ message: 'Error retrieving session counts', error: error.message });
  }
});



// Define route to get wallet balances
router.get("/wallet-balances", checkTokenMiddleware, async (req, res) => {
    const { mentorId } = req;

    if (!mentorId) {
        return res.status(400).send({ message: "Mentor ID is missing in the request" });
    }

    try {
        // Fetch wallet balance
        const user = await User.findById(mentorId, "walletBalance");
        if (!user) {
            return res.status(404).send({ message: "Mentor not found" });
        }
        const currentWalletBalance = user.walletBalance;
        // Send response with calculated values
        res.status(200).send({
            currentWalletBalance,
        });
    } catch (error) {
        console.error("Error fetching mentor data:", error);
        res.status(500).send({ message: "Error fetching mentor data", error: error.message });
    }
});


router.get('/lastfiveclients', checkTokenMiddleware, async (req, res) => {
  try {
    const mentorId = req.user; 

    // Validate mentorId
    if (!mongoose.Types.ObjectId.isValid(mentorId)) {
      return res.status(400).send({ message: 'Invalid mentorId provided' });
    }

    // Fetch last five sessions associated with this mentor
    const lastFiveSessions = await Sessions.find({ mentor: mentorId })
      .sort({ createdAt: -1 }) // Sort by creation date descending
      .limit(5) // Limit to the last 5 sessions
      .populate('Client', 'name email  profilePictureUrl') // Populate client information
      .lean(); // Use lean to return plain JavaScript objects for performance



    res.status(200).json(lastFiveSessions);
  } catch (error) {
    console.error('Error retrieving clients:', error);
    res.status(500).send({ message: 'Error retrieving clients', error: error.message });
  }
});


  // POST route for booking a session
router.post('/booking', checkTokenMiddleware, async (req, res) => {
    const { mentorId, startTime, hours } = req.body;
    const clientId = req.user;
  
    // Validate and correct the date format for startTime
    const parsedStartTime = correctDateFormat(startTime);
  
    // If startTime is invalid, return an error
    if (!parsedStartTime) {
      return res.status(400).send({ message: 'Invalid start time format. Use YYYY-MM-DDTHH:MM:SS.sssZ' });
    }
  
    // Calculate endTime by adding the specified hours to startTime
    const parsedEndTime = new Date(parsedStartTime.getTime());
    parsedEndTime.setHours(parsedEndTime.getHours() + hours);
  
    // Ensure the session start time is at least one hour from now
    const oneHourFromNow = new Date();
    oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);
  
    if (parsedStartTime < oneHourFromNow) {
      return res.status(400).send({ message: 'Session start time must be at least one hour from now' });
    }
  
    try {
      // Find the client and mentor in the database
      const client = await User.findById(clientId);
      const mentor = await User.findById(mentorId);
  
      if (!client || !mentor) {
        return res.status(404).send({ message: !client ? 'Client not found' : 'Mentor not found' });
      }
  
      // Check if the client has the correct role and sufficient wallet balance
      if (client.role !== 'Client') {
        return res.status(403).send({ message: 'Only Clients are allowed to book sessions' });
      }
  
      // Calculate the total session rate based on the mentor's hourly rate and the specified duration
      const sessionRate = mentor.rate * hours;
  
      if (client.walletBalance < sessionRate) {
        return res.status(400).send({ message: 'Insufficient wallet balance to book a session' });
      }
  
      // Check if the mentor is available during the specified time range
      const overlappingSessions = await Sessions.find({
        mentor: mentorId,
        startTime: { $lt: parsedEndTime },
        endTime: { $gt: parsedStartTime },
      });
  
      if (overlappingSessions.length > 0) {
        return res.status(409).send({ message: 'Mentor is unavailable during the requested time' });
      }
  
      // Create a new session with the calculated endTime and sessionRate
      const newSession = await Sessions.create({
        title: `Session with ${mentor.name}`,
        description,
        sessionLink,
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        mentor: mentorId,
        category,
        location,
        Client: clientId,
      });
  
      // Update the client's and mentor's wallet balances with the total session rate
      client.walletBalance -= sessionRate;
      mentor.walletBalance += sessionRate;
  
      await Promise.all([client.save(), mentor.save()]); // Save changes to the database
  
      // Send confirmation and reminder emails
      sendConfirmationEmail(client, newSession, mentor);
      scheduleReminderEmail(client, newSession, mentor);
  
      // Respond with a success status and session ID
      res.status(201).send({ message: 'Successfully booked a session', sessionId: newSession._id });
    } catch (error) {
      console.error('Error during booking:', error);
      res.status(500).send({ message: 'Error booking a session', error: error.message });
    }
  });



// PATCH route for rescheduling a session
router.patch('/rescheduled/:id', checkTokenMiddleware, async (req, res) => {
    const { id } = req.params; // Get session ID from route parameters
    const { StartTime, hours } = req.body; // Get start time and hours from request body
    const userId = req.user; // Get user ID from request header

    // Ensure that the user is a mentor
    const mentor = await User.findById(userId);

    if (!mentor || mentor.role !== 'Mentor') {
        return res.status(403).send({ message: 'Only Mentors are allowed to reschedule sessions' });
    }



    // Validate the session ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid session ID' });
    }

    // Validate the start time and ensure it's greater than the current time
    const parsedStartTime = correctDateFormat(StartTime);
    if (!parsedStartTime) {
        return res.status(400).send({ message: 'Invalid start time format. Use YYYY-MM-DDTHH:MM:SS.sssZ' });
    }

    const currentTime = new Date();
    if (parsedStartTime <= currentTime) {
        return res.status(400).send({ message: 'Start time must be greater than the current time' });
    }

    // Calculate the new endTime by adding the specified hours to the startTime
    const parsedEndTime = new Date(parsedStartTime.getTime());
    parsedEndTime.setHours(parsedEndTime.getHours() + (hours || 1)); // Default to 1 hour if not specified

    // Specify the fields to update
    const updates = {
        startTime: parsedStartTime,
        endTime: parsedEndTime, // Set the endTime based on the specified hours
        status:"Reschedule"
    };

    // Validate that only allowed fields are updated
    const allowedUpdates = ['startTime', 'endTime','status'];
    const isValidOperation = Object.keys(updates).every((key) => allowedUpdates.includes(key));

    if (!isValidOperation) {
        return res.status(400).send({ message: 'Invalid updates!' });
    }

    try {
        // Find and update the session with the new times
        const session = await Sessions.findByIdAndUpdate(id, updates, { new: true, runValidators: true });

        if (!session) {
            return res.status(404).send({ message: 'Session not found' });
        }


        // Assuming 'Client' and 'mentor' are references to the 'User' model
      const RescheduleEmailsession = await Sessions.findById(id) // 'sessionId' should be defined earlier
      .populate('Client', 'name email') // Populate the 'Client' field with 'name' and 'email'
      .populate('mentor', 'name'); // Populate the 'mentor' field with 'name'

    if (!RescheduleEmailsession) {
      return res.status(404).send({ message: 'Client not found' });
    }


        // Send the reschedule email after a successful update
        await sendRescheduleEmail(RescheduleEmailsession);



        const Newsessions = await Sessions.find({ mentor: userId })
        .populate({
            path: 'Client', // Assumes 'Client' is a reference to the User model
            select: 'name profilePictureUrl', // Retrieve original client details
        });

    // Check if no sessions were found
    if (Newsessions.length === 0) {
        return res.status(404).send({ message: 'No sessions found for the specified mentor' });
    }

        // Return the updated session information
        res.send({ message: 'Session rescheduled successfully', data:Newsessions });
    } catch (error) {
        // Handle validation errors and other exceptions
        const statusCode = error.name === 'ValidationError' ? 400 : 500;
        res.status(statusCode).send({ message: 'Error rescheduling session', error: error.message });
    }
});




router.patch('/cancel/:id', checkTokenMiddleware, async (req, res) => {
  const { id } = req.params; // Get session ID from route parameters
  const userId = req.user; // Get the ID of the user making the request

  // Validate the session ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).send({ message: 'Invalid session ID' });
  }

  const mentor = await User.findById(userId);

  // Ensure that the user is a mentor
  if (mentor.role !== 'Mentor') {
    return res.status(403).send({ message: 'Only Mentors are allowed to cancel sessions' });
  }

  try {
    // Find the session by ID
    const session = await Sessions.findById(id).populate('Client', 'name email').populate('mentor', 'name rate');

    if (!session) {
      return res.status(404).send({ message: 'Session not found' });
    }

    // If the session is already cancelled, return a conflict status
    if (session.status === 'Canceled') {
      return res.status(409).send({ message: 'Session is already cancelled' });
    }

    // Calculate the duration of the session in hours
    const startTime = new Date(session.startTime);
    const endTime = new Date(session.endTime);
    const durationMillis = endTime - startTime; // Time difference in milliseconds
    const durationHours = durationMillis / (1000 * 60 * 60); // Convert to hours




    // Determine refund amount based on the session rate and duration
    const refundAmount = session.mentor.rate * durationHours; // Example: rate per hour

    // Update the session status to 'Cancelled'
    session.status = 'Canceled';

    // Refund the client if applicable
    const refundResult = await refundClient(session.Client._id,session.mentor._id, refundAmount, id); // Refund logic

    // Save the updated session
    await session.save();

    // Send cancellation email to the client
    await sendCancellationEmail(session);

    const Newsessions = await Sessions.find({ mentor: userId })
        .populate({
            path: 'Client', // Assumes 'Client' is a reference to the User model
            select: 'name profilePictureUrl', // Retrieve original client details
        });

    // Check if no sessions were found
    if (Newsessions.length === 0) {
        return res.status(404).send({ message: 'No sessions found for the specified mentor' });
    }

    // Respond with success message
    res.send({
      message: 'Session cancelled successfully',
      data:Newsessions,
      refundResult
    });
  } catch (error) {
    console.error('Error cancelling session:', error);
    const statusCode = error.name === 'ValidationError' ? 400 : 500;
    res.status(statusCode).send({ message: 'Error cancelling session', error: error.message });
  }
});











module.exports = router;
