/** @format */

const mongoose = require("mongoose");

const attendanceSegmentSchema = new mongoose.Schema(
  {
    classSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassroomSession",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    enrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enrollment",
      required: true,
    },
    joinedAt: {
      type: Date,
      required: true,
    },
    leftAt: {
      type: Date,
      default: null,
    },
    source: {
      type: String,
      required: true,
      enum:["socket", "manual_correction"]
    },
    correctedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:'User'
    },
  },
  { timestamps: true },
);

attendanceSegmentSchema.index({
  classSessionId: 1,
  studentId: 1,
});

attendanceSegmentSchema.index({
  studentId: 1,
  classSessionId: 1,
});
const Attendance = mongoose.model("Attendance", attendanceSegmentSchema);

module.exports = Attendance;
