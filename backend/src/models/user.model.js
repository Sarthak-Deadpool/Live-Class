/** @format */

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minLength: 3,
      maxLength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase:true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: ["teacher", "student"],
    },
    status: {
      type: String,
      required: true,
      enum: ["invited", "activation_pending", "active", "suspended", "deactivated"],
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    refreshTokenVersion: {
      type: Number,
      default: 0,
    }
  },
  {
    timestamps: true,
  },
);

userSchema.index({
  email: 1,
});

const User = mongoose.model("User", userSchema);

module.exports = User;
