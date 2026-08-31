/** @format */

const { encodeAsync } = require("zod");
const {
  registerUserService,
  loginUserService,
  refreshTokenService,
  logoutUserService,
} = require("../services/user.service");
const verifyEmailService = require("../services/verifyEmail.service");

// register user Api
const registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  const response = await registerUserService(name, email, password, role);
  return res.status(201).json({
    success: true,
    data: response,
  });
};

// verify email Api
const verifyEmail = async (req, res) => {
const token = req.body.token;

  const response = await verifyEmailService(token);

  return res.status(200).json({
    success: true,
    data: response,
  });
};

// login user api
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  const response = await loginUserService(email, password);

  res.cookie("refreshToken", response.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.status(200).json({
    success: true,
    data: {
      accessToken: response.accessToken,
      user: {
        _id: response._id,
        name: response.name,
        email: response.email,
        role: response.role,
        status: response.status,
        isEmailVerified: response.isEmailVerified,
      },
    },
  });
};

// refresh token api
const refreshToken = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  const response = await refreshTokenService(refreshToken);

  return res.status(200).json({
    success: true,
    data: response,
  });
};

// logoutUser Api
const logoutUser = async (req, res) => {
  const userId = req.user.userId;

  await logoutUserService(userId);

  res.clearCookie("refreshToken");

  return res.status(200).json({
    success: true,
    message: "logged out successfully",
  });
};

module.exports = {
  registerUser,
  verifyEmail,
  loginUser,
  refreshToken,
  logoutUser,
};
