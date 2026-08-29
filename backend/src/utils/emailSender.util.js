const transporter = require("../config/email.config");

const emailSender = async (to, subject, html) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject,
        html,
    }

    const response = await transporter.sendMail(mailOptions);

    return response;
}

module.exports = emailSender;