/** @format */

const { registerUserService } = require("../services/user.service");

const registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  const response = await registerUserService(name, email, password, role);

  return res.status(201).json({
    success: true,
    data: response,
  });
};

const loginUser = (req, res) => {};

const refreshToken = (req, res) => {};

const logoutUser = (req, res) => {};

module.exports = { registerUser, loginUser, refreshToken, logoutUser };
