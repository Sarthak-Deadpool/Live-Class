/** @format */

const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema(
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
      trim: true,
      minLength: [
        3,
        "title must be atleast 3 characters long. you provided {VALUE}.",
      ],
      maxLength: [
        50,
        "title cannot exceed 50 characters. you provided {VALUE}.",
      ],
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },

    storageKey: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    deletedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

resourceSchema.index({
  courseId: 1,
});

const Resource = mongoose.model("Resource", resourceSchema);

module.exports = Resource;
