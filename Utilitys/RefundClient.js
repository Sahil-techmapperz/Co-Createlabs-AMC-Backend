const Refund = require('../models/Refund');
const User = require('../models/User');



// Function to handle refunding a client and updating mentor balance
const refundClient = async (clientId, mentorId, refundAmount, sessionId) => {
    console.log('Processing refund for client:', clientId);

  
    try {
      // Validate that the client exists
      const client = await User.findById(clientId);
      if (!client) {
        console.error('Client not found for refund:', clientId);
        throw new Error('Client not found');
      }
  
      // Validate that the mentor exists
      const mentor = await User.findById(mentorId);
      if (!mentor) {
        console.error('Mentor not found for refund:', mentorId);
        throw new Error('Mentor not found');
      }
  
      // Update the client's wallet balance to reflect the refund
      client.walletBalance += refundAmount;
  
      // Deduct the refund amount from the mentor's wallet balance
      mentor.walletBalance -= refundAmount;
  
      // Create a new refund record
      const refund = new Refund({
        clientId,
        sessionId,
        refundAmount,
        refundDate: new Date(), // Record the current date for the refund
        refundStatus: 'completed', // Assume the refund is completed for simplicity
        reason: 'Session cancelled', // Reason for the refund
      });
  
      // Save the refund record, updated client data, and updated mentor data
      await Promise.all([refund.save(), client.save(), mentor.save()]);
  
      console.log('Refund processed successfully for client and mentor:', clientId, mentorId);
      return refund; // Return the refund record
    } catch (error) {
      console.error('Error processing refund:', error);
      throw error; // Rethrow the error to be handled by the calling function
    }
  };


module.exports = refundClient;