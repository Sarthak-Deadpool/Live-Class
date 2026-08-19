/** @format */

const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["requested", "active", "rejected", "withdrawn", "removed"],
    },
    studentCourseId: {
      type: String,
    },
    requestedAt: {
      type: Date,
      required: true,
    },
    decidedAt: {
      type: Date,
      default: null,
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    removedAt: {
      type: Date,
      default: null,
    },
    removedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    removalReason: {
      type: String,
    },
  },
  { timestamps: true },
);

enrollmentSchema.index(
  {
    studentId: 1,
    courseId: 1,
    status: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      status: {
        $in: ["requested", "active"],
      },
    },
  },
);

enrollmentSchema.index({
  courseId: 1,
  status: 1,
});

const Enrollment = mongoose.model("Enrollment", enrollmentSchema);

module.exports = Enrollment;
