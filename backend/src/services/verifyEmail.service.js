/** @format */

const AppError = require("../errors/app.error");
const EmailVerification = require("../models/emailVerification.model");
const bcrypt = require("bcrypt");
const User = require("../models/user.model");



const verifyEmailService = async (token) => {
  const verificationRecord = await EmailVerification.find({
    expiresAt: { $gt: new Date() },
  });

  for (let rec of verificationRecord) {
    if (await bcrypt.compare(token, rec.tokenHash)) {
      const userId = rec.userId;
      const user = await User.findById(userId);

      if (!user) {
        throw new AppError("User not found", 404);
      }

      const response = await User.findOneAndUpdate(
        { _id: userId },
        { status: "active", isEmailVerified: true },
        { new: true },
      );
      const { _id, name, email, role, status, isEmailVerified } = response;

      await EmailVerification.findOneAndDelete({ userId: userId });

      return {
        _id,
        name,
        email,
        role,
        status,
        isEmailVerified,
      };
    }
  }
  throw new AppError("Invalid token", 400);
};

module.exports = verifyEmailService;
