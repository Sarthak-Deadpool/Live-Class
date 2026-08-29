/** @format */

const express = require("express");

const validate = require("../middlewares/validate.middleware");

const { registerUserSchema } = require("../validations/user.validation");

const {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
} = require("../controller/user.controller");

const router = express.Router();

router.post("/register", validate(registerUserSchema), registerUser);
router.post("/login", loginUser);
router.post("/refresh", refreshToken);
router.post("/logout", logoutUser);

module.exports = router;
