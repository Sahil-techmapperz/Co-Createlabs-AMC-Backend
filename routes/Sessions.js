const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Sessions = require('../models/Sessions');
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const moment = require('moment'); // Use moment for easy date manipulation
const { checkTokenMiddleware } = require('../Middleware');
const correctDateFormat = require('../Utilitys/dateFormat');
const getMonthDateRanges = require('../Utilitys/MonthDateRanges');
const refundClient = require('../Utilitys/RefundClient');
const { sendConfirmationEmail, scheduleReminderEmail,sendRescheduleEmail,sendCancellationEmail } = require('./../services/emailService'); // Example path to email services
const momentTime = require('moment-timezone');



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


// GET route to fetch all sessions by clientId
router.get('/all/byclient', checkTokenMiddleware, async (req, res) => {
  const clientId = req.user; // Extract clientId from user in middleware

  // console.log(clientId);

  // Validate the clientId
  if (!mongoose.Types.ObjectId.isValid(clientId)) {
    return res.status(400).send({ message: 'Invalid clientId provided' });
  }

  try {
    // Fetch sessions and populate client details
    const sessions = await Sessions.find({ Client: clientId })
      .populate({
        path: 'mentor', 
        select: 'name profilePictureUrl', 
      });

      // console.log(sessions);

    // Check if no sessions were found
    if (sessions.length === 0) {
      return res.status(404).send({ message: 'No sessions found for the specified client' });
    }

    // Successful response with the sessions
    res.status(200).send({
      message: 'Sessions fetched successfully',
      data: sessions,
    });
  } catch (error) {
    console.error('Error fetching sessions for client:', error);
    res.status(500).send({ message: 'Error fetching sessions', error: error.message });
  }
});


// GET route to fetch the next session for a specific clientId
router.get('/nextSessionbyclient', checkTokenMiddleware, async (req, res) => {
  try {
    const clientId = req.user; // Get the clientId from the authenticated user

    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).send({ message: 'Invalid clientId provided' });
    }

    // Get the current time
    const now = new Date();

    // Find the next session that starts in the future for the given client
    const nextSession = await Sessions.findOne({
      Client: clientId,
      startTime: { $gt: now }, // Find sessions that start after the current time
    })
      .sort({ startTime: 1 }) // Sort by start time in ascending order
      .populate('Client', 'name profilePictureUrl') // Populate client details
      .populate('mentor', 'name email'); // Populate mentor details

    if (!nextSession) {
      return res.status(404).send({ message: 'No upcoming sessions found for the specified client' });
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
    console.error('Error fetching the next session for client:', error);
    res.status(500).send({ message: 'Error fetching the next session', error: error.message });
  }
});



// GET route to fetch sessions for the previous week for a specific clientId
router.get('/clientpreviousWeek', checkTokenMiddleware, async (req, res) => {
  try {
    const clientId = req.user; // Get clientId from token

    // Validate clientId as a MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ message: 'Invalid clientId provided' });
    }

    // Determine the start and end of the previous week
    const now = moment().startOf('isoWeek'); // Start of the current week
    const previousWeekStart = now.subtract(1, 'weeks').toDate(); // Start of previous week
    const previousWeekEnd = moment(previousWeekStart).endOf('isoWeek').toDate(); // End of previous week

    // Find sessions for the specified client in the previous week
    const previousWeekSessions = await Sessions.find({
      Client: clientId,
      startTime: { $gte: previousWeekStart, $lte: previousWeekEnd },
    })
      .populate('Client', 'name profilePictureUrl') // Populate client's details
      .populate('mentor', 'name email') // Populate mentor's details
      .sort({ startTime: -1 }); // Sort sessions by start time

    // Create a readable date range for the previous week
    const previousWeekRange = `${moment(previousWeekStart).format('DD')} - ${moment(previousWeekEnd).format('DD MMMM YYYY')}`;

    // Return the list of sessions and the date range
    res.status(200).json({
      sessions: previousWeekSessions,
      previousWeekRange, // Add the range to the response
    });
  } catch (error) {
    console.error('Error fetching previous week sessions for client:', error);
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

    const countUniqueClients = async (dateRange) => {
      
      const client = await Sessions.find({
        mentor: mentorId,
        status: { $ne: 'Canceled' },
        startTime: { $gte: dateRange.start, $lte: dateRange.end }
      });
      
      const clientCount = new Set();
      client.forEach((c) => {
        clientCount.add(c.Client.toString()); // Convert ObjectID to string if necessary
      })
      
      return clientCount.size?clientCount.size : 0;
    };
    

    const [currentMonthClientCount, lastMonthClientCount] = await Promise.all([
      countUniqueClients(currentMonth),
      countUniqueClients(lastMonth),
    ]);

    let percentageChange = 0;
    if (lastMonthClientCount > 0) {
      percentageChange = ((currentMonthClientCount - lastMonthClientCount) / lastMonthClientCount) * 100;
    }

    res.status(200).send({
      lastMonthClientCount,
      currentMonthClientCount,
      percentageChange: percentageChange.toFixed(2) + '%',
    });
  } catch (error) {
    console.error('Error retrieving client counts:', error);
    res.status(500).send({ message: 'Error retrieving client counts', error: error.message });
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



router.get('/revenue-withdrawal', checkTokenMiddleware, async (req, res) => {
  const mentorId = req.user;

  if (!mongoose.Types.ObjectId.isValid(mentorId)) {
    return res.status(400).send({ message: 'Invalid mentorId provided' });
  }

  try {
    const allTimeDailyRevenue = await Sessions.aggregate([
      {
        $match: {
          mentor: new mongoose.Types.ObjectId(mentorId),
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'mentor',
          foreignField: '_id',
          as: 'mentorDetails',
        },
      },
      { $unwind: '$mentorDetails' },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$startTime" } },
          totalRevenue: { $sum: '$mentorDetails.rate' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const allTimeDailyWithdrawals = await Withdrawal.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(mentorId),
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$requestedAt" } },
          totalWithdrawal: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);



     // Get all unique dates from both revenue and withdrawal arrays
     const uniqueDates = new Set([
      ...allTimeDailyRevenue.map((item) => item._id),
      ...allTimeDailyWithdrawals.map((item) => item._id),
    ]);

    // Map over unique dates to create the final financial data
    const allTimeFinancials = Array.from(uniqueDates).map((date) => {
      const revenueEntry = allTimeDailyRevenue.find((r) => r._id === date) || { totalRevenue: 0 };
      const withdrawalEntry = allTimeDailyWithdrawals.find((w) => w._id === date) || { totalWithdrawal: 0 };
      return {
        date: date,
        Revenue: revenueEntry.totalRevenue,
        Withdrawal: withdrawalEntry.totalWithdrawal,
      };
    });

    res.status(200).json(allTimeFinancials);
  } catch (error) {
    console.error('Error fetching financials:', error);
    res.status(500).send({ message: 'Error fetching financials', error: error.message });
  }
});

  // POST route for booking a session
  
router.post('/booking', checkTokenMiddleware, async (req, res) => {
  const { mentorId, startTime, hours, title, description } = req.body;
  const clientId = req.user;

  // Validate and correct the date format for startTime
  const parsedStartTime = moment.utc(startTime);
  const sessionLink = "http://google.com";

  // If startTime is invalid, return an error
  if (!parsedStartTime.isValid()) {
      return res.status(400).send({ message: 'Invalid start time format. Use YYYY-MM-DDTHH:MM:SS.sssZ' });
  }

  // Calculate endTime by adding the specified hours to startTime
  const parsedEndTime = parsedStartTime.clone().add(Number(hours), 'hours');

  // Ensure the session start time is at least one hour from now
  const oneHourFromNow = moment.utc().add(1, 'hours');

  if (parsedStartTime.isBefore(oneHourFromNow)) {
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
      const sessionRate = mentor.rate * Number(hours);

      if (client.walletBalance < sessionRate) {
          return res.status(400).send({ message: 'Insufficient wallet balance to book a session' });
      }

      // Check if the mentor is available during the specified time range
      const overlappingSessions = await Sessions.find({
          mentor: mentorId,
          startTime: { $lt: parsedEndTime.toDate() },
          endTime: { $gt: parsedStartTime.toDate() },
      });

      if (overlappingSessions.length > 0) {
          return res.status(409).send({ message: 'Mentor is unavailable during the requested time' });
      }

      // Create a new session with the calculated endTime and sessionRate
      const newSession = await Sessions.create({
          title,
          description,
          sessionLink,
          startTime: parsedStartTime.toDate(),
          endTime: parsedEndTime.toDate(),
          mentor: mentorId,
          Client: clientId,
      });

      // Update the client's and mentor's wallet balances with the total session rate
      client.walletBalance -= sessionRate;
      mentor.walletBalance += sessionRate;

      // Remove the booked time slot from the mentor's availability
      mentor.availability.times = mentor.availability.times.filter(time => {
          const mentorStartTime = momentTime.utc(time.start).toDate().getTime();
          const mentorEndTime = momentTime.utc(time.end).toDate().getTime();
          return !(mentorStartTime === parsedStartTime.toDate().getTime() && mentorEndTime === parsedEndTime.toDate().getTime());
      });

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


  router.get('/getsession_bymonths_and_getsession_byweek', checkTokenMiddleware, async (req, res) => {
    try {
        const userId = req.user;

        // Find the sessions for the mentor
        const sessions = await Sessions.find({ mentor: userId });

        // Aggregate sessions by month
        const sessionsByMonth = sessions.reduce((acc, session) => {
            const month = moment(session.startTime).format('MMM');
            acc[month] = acc[month] ? acc[month] + 1 : 1;
            return acc;
        }, {});

        const All_Sessions_By_months = Object.keys(sessionsByMonth).map(month => ({
            name: month,
            amount: sessionsByMonth[month],
        }));

        // Filter sessions for the current month
        const currentMonth = moment().month();
        const sessionsThisMonth = sessions.filter(session => moment(session.startTime).month() === currentMonth);

        // Get the start of the current month
        const startOfMonth = moment().startOf('month');

        // Aggregate sessions by week within the current month
        const sessionsByWeek = sessionsThisMonth.reduce((acc, session) => {
            const weekOfMonth = moment(session.startTime).diff(startOfMonth, 'weeks') + 1;
            acc[weekOfMonth] = acc[weekOfMonth] ? acc[weekOfMonth] + 1 : 1;
            return acc;
        }, {});

        const Sessions_BY_Weeks = Object.keys(sessionsByWeek).map(week => ({
            name: `Week ${week}`,
            amount: sessionsByWeek[week],
        }));

        res.json({ All_Sessions_By_months, Sessions_BY_Weeks });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
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



router.get('/allsession-revenue', checkTokenMiddleware, async (req, res) => {
  const Id = req.user;

  if (!mongoose.Types.ObjectId.isValid(Id)) {
    return res.status(400).send({ message: 'Invalid mentorId provided' });
  }

  let Admindata = await User.findById(Id);

  if (Admindata.role !== "Admin") {
    return res.status(405).send({ message: 'User is not Admin' });
  }

  try {
    const sessions = await Sessions.find({});

    let totalRevenue = 0;

    for (let session of sessions) {
      const durationHours = (session.endTime - session.startTime) / (1000 * 60 * 60);
      const mentor = await User.findById(session.mentor);

      const rate = mentor && mentor.rate || 0;
      totalRevenue += durationHours * rate;
    }

    // const adminRevenue = totalRevenue * 0.20;
    const sessionRevenue = totalRevenue * 0.20;

    res.status(200).send({
      totalRevenue: totalRevenue.toFixed(2),
      // adminRevenue: adminRevenue.toFixed(2), 
      sessionRevenue: sessionRevenue.toFixed(2)
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Internal server error' });
  }
});


router.get('/currentYears_allsession-revenue', checkTokenMiddleware, async (req, res) => {
  const Id = req.user;

  if (!mongoose.Types.ObjectId.isValid(Id)) {
    return res.status(400).send({ message: 'Invalid mentorId provided' });
  }

  let Admindata = await User.findById(Id);

  if (Admindata.role !== "Admin") {
    return res.status(405).send({ message: 'User is not Admin' });
  }

  try {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);

    const sessions = await Sessions.find({
      startTime: { $gte: startOfYear, $lt: endOfYear }
    });

    let monthlyRevenue = Array(12).fill(0); // Initialize an array for 12 months

    for (let session of sessions) {
      const durationHours = (session.endTime - session.startTime) / (1000 * 60 * 60);
      const mentor = await User.findById(session.mentor);
      const rate = mentor && mentor.rate || 0;
      const revenue = durationHours * rate;

      const month = new Date(session.startTime).getMonth();
      monthlyRevenue[month] += revenue;
    }

    const monthlySessionRevenue = monthlyRevenue.map(revenue => (revenue * 0.20).toFixed(2));
    monthlyRevenue = monthlyRevenue.map(revenue => revenue.toFixed(2));

    res.status(200).send({
      monthlyRevenue,
      monthlySessionRevenue
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Internal server error' });
  }
});


router.get('/sessionstats', async (req, res) => {
  try {
    const Session = await Sessions.find();

    const totalSessions = Session.length;
    const scheduledSessions = Session.filter(session => session.status === 'upcoming' || session.status === 'Inprogress' || session.status === 'Reschedule').length;
    const completedSessions = Session.filter(session => session.status === 'completed').length;
    const canceledSessions = Session.filter(session => session.status === 'Canceled').length;

    const scheduledPercentage = totalSessions ? (scheduledSessions / totalSessions) * 100 : 0;
    const completedPercentage = totalSessions ? (completedSessions / totalSessions) * 100 : 0;
    const canceledPercentage = totalSessions ? (canceledSessions / totalSessions) * 100 : 0;

    res.status(200).json({
      totalSessions,
      scheduledSessions,
      completedSessions,
      canceledSessions,
      scheduledPercentage,
      completedPercentage,
      canceledPercentage
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});







module.exports = router;
