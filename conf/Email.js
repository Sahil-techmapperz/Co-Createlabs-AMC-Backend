const nodemailer = require('nodemailer');


 // NodeMailer logic to send the OTP via email
 let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

module.exports= transporter;