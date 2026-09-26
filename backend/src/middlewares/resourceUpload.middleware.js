/** @format */

const multer = require("multer");

const AppError = require("../errors/app.error");

const { validateResourceFile } = require("../utils/file-validation");

const storage = multer.memoryStorage();

const resourceUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    const allowedMimeTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(new AppError("Unsupported file type", 400));
    }

    callback(null, true);
  },
});

const validateUploadedResourceFile = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError("File is required", 400);
    }

    await validateResourceFile(req.file);

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  resourceUpload,
  validateUploadedResourceFile,
};
