/** @format */
const AppError = require("../errors/app.error");
const Resource = require("../models/resource.model");
const Course = require("../models/course.model");
const crypto = require("crypto");

const { uploadFileToStorageService } = require("./storage.service");

const uploadResourceService = async (teacherId, courseId, title, file) => {
  if (!teacherId) {
    throw new AppError("Teacher Id is required", 400);
  }

  const course = await Course.findById(courseId);
  if (!course) {
    throw new AppError("Course not found", 404);
  }

  if (course.teacherId?.toString() !== teacherId) {
    throw new AppError("Forbidden", 403);
  }

  if (!file) {
    throw new AppError("File is empty", 400);
  }

  const storageKey = crypto.randomUUID();
  const fileData = await uploadFileToStorageService(file, storageKey);
  if (!fileData) {
    throw new AppError("Upload failed", 500);
  }

  const response = await Resource.create({
    courseId: courseId,
    uploadedBy: teacherId,
    title: title,
    fileName: file.originalname,
    mimeType: file.mimetype,
    fileSize: file.size,
    storageKey: fileData.storageKey,
  });

  return response;
};

module.exports = {
  uploadResourceService,
};
