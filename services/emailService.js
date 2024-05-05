const Emailtransporter = require('./../conf/Emailsetup'); 
const schedule = require('node-schedule');



const sendConfirmationEmail = async (user, session, mentor) => {
    console.log('Sending confirmation email to:', user.email);

    // Basic validation
    if (!user || !user.email || !user.name || !session || !mentor) {
        console.error('Invalid or missing parameters.');
        return;
    }


    const sessionStartTime = session.startTime.toLocaleString();
    const sessionEndTime = session.endTime.toLocaleString();

    const emailContent = `<!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; color: #333; background-color: #f4f4f4; font-size: 16px; }
            .container { max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); }
            .header { background-color: #0056b3; color: #ffffff; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { padding: 20px; line-height: 1.5; }
            h1, p { color: #0056b3; }
            h1 { font-size: 24px; margin-bottom: 20px; }
            p { font-size: 16px; margin-bottom: 15px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <img src="${process.env.company_logo_url}" alt="CoCreateLab Logo" style="max-width: 150px;">
            </div>
            <div class="content">
                <h1>Session Confirmation</h1>
                <p>Dear ${user.name},</p>
                <p>You have successfully joined the session titled "<strong>${session.title}</strong>". Below are the session details:</p>
                
                <div><strong>Date & Time:</strong> <span>${sessionStartTime} to ${sessionEndTime}</span></div>
                <div><strong>Mentor:</strong> <span>${mentor.name}</span></div>
                <div><strong>Location:</strong> <span>${session.location}</span></div>
                <div><strong>Description:</strong> <span>${session.description}</span></div>
                <div style="margin-top: 20px;"><a href="${process.env.Sitebase_URL}/sessions/${session._id}" style="background-color: #007bff; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; display: inline-block;">Join Session</a></div>
                
                <p>Please ensure you have the necessary system requirements installed prior to the session, and log in 5-10 minutes early to troubleshoot any technical issues.</p>
                <p>If you have any questions or need further assistance, please contact us at <a href="mailto:support@cocreatelab.com" style="color: #007bff;">support@cocreatelab.com</a>.</p>
                <p>We look forward to seeing you there!</p>
            </div>
            <div class="footer" style="text-align: center; font-size: 14px; color: #777; padding: 20px;">
                <p>Thank you for choosing CoCreateLab!</p>
            </div>
        </div>
    </body>
    </html>`;
    
    
    
    try {
        await Emailtransporter.sendMail({
            from: process.env.EMAIL_FROM, // Use an environment variable
            to: user.email,
            subject: "Session Join Confirmation",
            html: emailContent,
        });
        console.log('Confirmation email sent successfully to:', user.email);
    } catch (error) {
        console.error('Error sending confirmation email:', error);
    }
};




const scheduleReminderEmail = (user, session, mentor) => {
        // Basic validation
        if (!user || !user.email || !user.name || !session || !mentor) {
            console.error('Invalid or missing parameters.');
            return;
        }

       
    const reminderTime = new Date(session.startTime.getTime() - (30 * 60 * 1000)); // 30 minutes before session
    const sessionStartTime = session.startTime.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    const sessionEndTime = session.endTime.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

    const reminderEmailContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 0;
                color: #333;
                background-color: #f4f4f4;
            }
            .container {
                max-width: 600px;
                margin: auto;
                background-color: #ffffff;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }
            .header {
                background-color: #0056b3;
                color: #ffffff;
                padding: 20px;
                border-radius: 8px 8px 0 0;
                text-align: center;
            }
            .header img {
                max-width: 150px;
            }
            .content {
                padding: 20px;
            }
            h1, p {
                color: #0056b3;
            }
            .footer {
                margin-top: 20px;
                text-align: center;
                font-size: 14px;
                color: #777;
            }
            a, .button {
                background-color: #007bff;
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                text-decoration: none;
                display: inline-block;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <img src="${process.env.company_logo_url}" alt="CoCreateLab Logo">
            </div>
            <div class="content">
                <h1>Session Reminder</h1>
                <p>Dear ${user.name},</p>
                <p>This is a reminder that you have an upcoming session titled "<strong>${session.title}</strong>" starting soon. Here are the details:</p>
                
                <div><strong>Date & Time:</strong> <span>${sessionStartTime} to ${sessionEndTime}</span></div>
                <div><strong>Mentor:</strong> <span>${mentor.name}</span></div>
                <div><strong>Location:</strong> <span>${session.location}</span></div>
                <div><strong>Session Overview:</strong> <span>${session.description}</span></div>
                <div style="margin-top: 20px;"><a href="${process.env.Sitebase_URL}/sessions/${session._id}" style="background-color: #007bff; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; display: inline-block;">Join Session</a></div>
                
                <p>To ensure a seamless experience, please:</p>
                
                <div>Check your internet connection beforehand.</div>
                <div>Log in 5-10 minutes early to address any technical issues.</div>
                <div>Prepare any questions or topics you'd like to discuss during the session.</div>
                
                <p>If you need any assistance or have questions, feel free to reach out to us at <a href="mailto:support@cocreatelab.com" style="color: #0056b3;">support@cocreatelab.com</a>.</p>
                <p>We look forward to seeing you there!</p>
            </div>
            <div class="footer">
                <p>Thank you for choosing CoCreateLab!</p>
            </div>
        </div>
    </body>
    </html>
    `;
    
    

    schedule.scheduleJob(reminderTime, async () => {
        try {
            await Emailtransporter.sendMail({
                from: 'Cocreatelab', // Update this
                to: user.email,
                subject: "Session Reminder",
                html: reminderEmailContent,
            });
            console.log('Reminder email scheduled successfully');
        } catch (error) {
            console.error('Error scheduling reminder email:', error);
        }
    });
};



const sendCancellationEmail = async (session) => {
    const client = session.Client; // Assuming session has a Client reference
    const mentor = session.mentor; // Assuming session has a mentor reference

    console.log('Sending cancellation email to:', client.email);

    // Basic validation
    if (!client || !client.email || !session || !mentor) {
        console.error('Invalid or missing parameters for cancellation email.');
        return;
    }

    const sessionStartTime = session.startTime.toLocaleString();
    const sessionEndTime = session.endTime.toLocaleString();

    const emailContent = `<!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; color: #333; background-color: #f4f4f4; font-size: 16px; }
            .container { max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); }
            .header { background-color: #d9534f; color: #ffffff; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { padding: 20px; line-height: 1.5; }
            h1, p { color: #d9534f; }
            h1 { font-size: 24px; margin-bottom: 20px; }
            p { font-size: 16px; margin-bottom: 15px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <img src="${process.env.company_logo_url}" alt="Company Logo" style="max-width: 150px;">
            </div>
            <div class="content">
                <h1>Session Cancellation Notice</h1>
                <p>Dear ${client.name},</p>
                <p>We regret to inform you that the session titled "<strong>${session.title}</strong>" has been cancelled.</p>
                <p>Session details:</p>
                <div><strong>Date & Time:</strong> <span>${sessionStartTime} to ${sessionEndTime}</span></div>
                <div><strong>Mentor:</strong> <span>${mentor.name}</span></div>
                <div><strong>Location:</strong> <span>${session.location}</span></div>
                <div><strong>Description:</strong> <span>${session.description}</span></div>
                
                <p>We apologize for the inconvenience this may cause. If you have any questions or require further assistance, please contact us at <a href="mailto:support@yourcompany.com" style="color: #d9534f;">support@yourcompany.com</a>.</p>
                <p>If a refund is due, it will be processed shortly. Please allow 3-5 business days for the refund to appear in your account.</p>
                
                <p>Thank you for your understanding, and we hope to see you in future sessions.</p>
            </div>
            <div class="footer" style="text-align: center; font-size: 14px; color: #777; padding: 20px;">
                <p>Best regards,</p>
                <p>Your Company Team</p>
            </div>
        </div>
    </body>
    </html>`;

    try {
        await Emailtransporter.sendMail({
            from: process.env.EMAIL_FROM, // Use environment variable for sender
            to: client.email,
            subject: "Session Cancellation Notice",
            html: emailContent,
        });
        console.log('Cancellation email sent successfully to:', client.email);
    } catch (error) {
        console.error('Error sending cancellation email:', error);
    }
};


const sendRescheduleEmail = async (session) => {
    const client = session.Client; // Assuming session has a Client reference
    const mentor = session.mentor; // Assuming session has a mentor reference

    console.log('Sending reschedule email to:', client.email);

    // Basic validation to ensure required parameters are present
    if (!client || !client.email || !session || !mentor) {
        console.error('Invalid or missing parameters for reschedule email.');
        return;
    }

    const sessionStartTime = session.startTime.toLocaleString(); // Convert to readable format
    const sessionEndTime = session.endTime.toLocaleString();

    const emailContent = `<!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; color: #333; background-color: #f4f4f4; font-size: 16px; }
            .container { max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); }
            .header { background-color: #007bff; color: #ffffff; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { padding: 20px; line-height: 1.5; }
            h1, p { color: #007bff; }
            h1 { font-size: 24px; margin-bottom: 20px; }
            p { font-size: 16px; margin-bottom: 15px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <img src="${process.env.company_logo_url}" alt="Company Logo" style="max-width: 150px;">
            </div>
            <div class="content">
                <h1>Session Rescheduled</h1>
                <p>Dear ${client.name},</p>
                <p>The session "<strong>${session.title}</strong>" has been rescheduled. Below are the updated session details:</p>
                
                <div><strong>New Date & Time:</strong> <span>${sessionStartTime} to ${sessionEndTime}</span></div>
                <div><strong>Mentor:</strong> <span>${mentor.name}</span></div>
                <div><strong>Location:</strong> <span>${session.location}</span></div>
                <div><strong>Description:</strong> <span>${session.description}</span></div>
                
                <p>We apologize for any inconvenience this may have caused. If you have any questions or require further assistance, please contact us at <a href="mailto:support@yourcompany.com" style="color: #007bff;">support@yourcompany.com</a>.</p>
                <p>We look forward to seeing you at the rescheduled session.</p>
            </div>
            <div class="footer" style="text-align: center; font-size: 14px; color: #777; padding: 20px;">
                <p>Best regards,</p>
                <p>Your Company Team</p>
            </div>
        </div>
    </body>
    </html>`;

    try {
        await Emailtransporter.sendMail({
            from: process.env.EMAIL_FROM, // Ensure this is set in your environment variables
            to: client.email,
            subject: "Session Rescheduled Notification",
            html: emailContent,
        });

        console.log('Reschedule email sent successfully to:', client.email);
    } catch (error) {
        console.error('Error sending reschedule email:', error);
    }
};



module.exports = {
    sendConfirmationEmail,
    scheduleReminderEmail,
    sendCancellationEmail,
    sendRescheduleEmail
};