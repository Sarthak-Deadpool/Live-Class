/** @format */

const mongoose = require("mongoose");

const classroomSessionSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    scheduledStart: {
      type: Date,
      required: true,
    },
    scheduledEnd: {
      type: Date,
      required: true,
    },
    mode: {
      type: String,
      required: true,
      enum: ["offline", "online"],
    },
    lifecycle: {
      type: String,
      required: true,
      enum: ["scheduled", "live", "completed", "cancelled"],
    },
    liveRoom: {
      roomName: {
        type: String,
        trim: true,
      },
      startedAt: {
        type: Date,
        default: null,
      },
      endedAt: {
        type: Date,
        default: null,
      },
      startedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
    modeChangedAt: {
      type: Date,
      default: null,
    },
    modeChangedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

classroomSessionSchema.index({
  courseId: 1,
  scheduledStart: 1,
});

classroomSessionSchema.index({
  teacherId: 1,
  lifecycle: 1,
});

const ClassroomSession = mongoose.model(
  "ClassroomSession",
  classroomSessionSchema,
);

module.exports = ClassroomSession;
