/** @format */

const verificationEmailTemplate = (name, verificationToken) => {
  const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;

  return `
      <h2>Hello ${name},</h2>
  
      <p>Thanks for registering with TeacherConnect.</p>
  
      <p>Please click the link below to verify your email:</p>
  
      <a href="${verificationLink}">Verify Email</a>
  
      <p>This verification link will expire in 1 hour.</p>
  
      <p>If you did not create this account, you can ignore this email.</p>
  
      <p>Thanks,<br />TeacherConnect Team</p>
    `;
};

module.exports = verificationEmailTemplate;
