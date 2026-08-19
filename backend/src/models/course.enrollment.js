/** @format */

const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
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
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["draft", "active", "archived"],
    },
  },
  { timestamps: true },
);

courseSchema.index({
  teacherId:1,
})

courseSchema.index({
  status:1
})

const Course = mongoose.model("Course", courseSchema);

module.exports = Course;
