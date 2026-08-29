/** @format */

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../models/user.model");
const EmailVerification = require("../models/emailVerification.model");

const emailVerificationTemplate = require("../templates/verificationEmail.template");
const emailSender = require("../utils/emailSender.util");

const AppError = require("../errors/app.error");

const passwordHashing = require("../utils/passwordHashing.util");
const tokenGenerator = require("../utils/tokenGenerator.util");
const tokenHashing = require("../utils/tokenHashing.util");
const generateJWT = require("../utils/jwt.utility");

// register user service

const registerUserService = async (name, email, password, role) => {
  const existingUserVerified = await User.findOne({
    email: email,
    isEmailVerified: true,
  });

  if (existingUserVerified) {
    throw new AppError("User already exist", 409);
  }

  const existingUserNotVerified = await User.findOne({
    email: email,
    isEmailVerified: false,
  });

  if (existingUserNotVerified) {
    // resend verification email
    return;
  }

  const hashedPassword = passwordHashing(password);

  const response = await User.create({
    name: name,
    email: email,
    passwordHash: hashedPassword,
    role: role,
    status: "activation_pending",
    isEmailVerified: false,
  });

  const {
    _id,
    name: userName,
    email: userEmail,
    role: userRole,
    status: userStatus,
    isEmailVerified: userIsEmailVerified,
  } = response;

  const token = tokenGenerator();
  const hashedToken = tokenHashing(token);

  await EmailVerification.create({
    userId: _id,
    tokenHash: hashedToken,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  const html = emailVerificationTemplate(name, token);
  const subject = "Verify Your Email";

  await emailSender(email, subject, html);

  return {
    _id,
    userName,
    userEmail,
    userRole,
    userStatus,
    userIsEmailVerified,
  };
};

// login user service
const loginUserService = async (email, password) => {
  const user = await User.findOne({ email: email });

  if (!user) {
    throw new AppError("Invalid user or password", 400);
  }

  const hashedPassword = user.passwordHash;

  if (!(await bcrypt.compare(password, hashedPassword))) {
    throw new AppError("Invalid user or password", 400);
  }

  if (
    ["invited", "activation_pending", "suspended", "deactivated"].includes(
      user.status,
    )
  ) {
    throw new AppError("Unauthorized user", 400);
  }

  const accessPayload = {
    userId: user._id,
    email: user.email,
    role: user.role,
  };
  const refreshPayload = {
    userId: user._id,
    email: user.email,
    role: user.role,
    refreshTokenVersion: user.refreshTokenVersion,
  };

  const accessToken = generateJWT(
    accessPayload,
    process.env.ACCESS_SECRET,
    "2h",
  );
  const refreshToken = generateJWT(
    refreshPayload,
    process.env.REFRESH_SECRET,
    "7d",
  );

  user.lastLoginAt = new Date();

  await user.save();

  const {
    _id,
    userName,
    userEmail,
    userRole,
    userStatus,
    userIsEmailVerified,
  } = user;

  return {
    accessToken,
    refreshToken,
    _id,
    userName,
    userEmail,
    userRole,
    userStatus,
    userIsEmailVerified,
  };
};

// refresh Token Service
const refreshTokenService = async (refreshToken) => {
  const decode = jwt.verify(refreshToken, process.env.REFRESH_SECRET);

  const user = await User.findById(decode.userId);

  if (!user) {
    throw new AppError("Invalid User", 400);
  }

  if (decode.refreshTokenVersion !== user.refreshTokenVersion) {
    throw new AppError("Invalid token", 400);
  }

  const accessPayload = {
    userId: user._id,
    email: user.email,
    role: user.role,
  };

  const accessToken = generateJWT(
    accessPayload,
    process.env.ACCESS_SECRET,
    "2h",
  );

  return { accessToken };
};

// logout User service
const logoutUserService = async (userId) => {
  const user = await User.findById(userid);

  if (!user) {
    throw new AppError("Invalid User", 400);
  }

  user.refreshTokenVersion += 1;

  await user.save();

  return;
};

module.exports = {
  registerUserService,
  loginUserService,
  refreshTokenService,
  logoutUserService,
};
