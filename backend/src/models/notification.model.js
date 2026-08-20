/** @format */

const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "enrollment_approved",
        "enrollment_rejected",
        "class_online",
        "announcement",
        "class_cancelled",
      ],
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { timestamps: true },
);

notificationSchema.index({
  userId: 1,
  isRead: 1,
  createdAt: -1,
});

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
