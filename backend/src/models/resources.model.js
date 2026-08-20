/** @format */

const mongoose = require("mongoose");

const resourcesSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim:true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      required: true,
    },
    fileSizeBytes: {
      type: Number,
      required: true,
    },
    deletedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

resourcesSchema.index({
  courseId: 1,
  deletedAt: 1,
});

const Resources = mongoose.model("Resources", resourcesSchema);

module.exports = Resources;
