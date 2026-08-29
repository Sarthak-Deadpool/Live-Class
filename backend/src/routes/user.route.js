/** @format */

const express = require("express");

const validate = require("../middlewares/validate.middleware");
const auth = require("../middlewares/auth.middleware");

const { registerUserSchema, loginUserSchema } = require("../validations/user.validation");

const {
  registerUser,
  verifyEmail,
  loginUser,
  refreshToken,
  logoutUser,
} = require("../controller/user.controller");

const router = express.Router();

router.post("/register", validate(registerUserSchema), registerUser);
router.post("/verify-email", verifyEmail);
router.post("/login",validate(loginUserSchema), loginUser);
router.post("/refresh", refreshToken);
router.post("/logout",auth, logoutUser);

module.exports = router;
