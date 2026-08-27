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
      minLength:[3, 'title must be atleast 3 characters long. you provided {VALUE}.'],
      maxLength:[50, 'title cannot exceed 50 characters. you provided {VALUE}.'],
    },
    description: {
      type: String,
      trim: true,
      maxLength:[2000, 'description cannot exceed 2000 characters. you provided {VALUE}.'],
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
