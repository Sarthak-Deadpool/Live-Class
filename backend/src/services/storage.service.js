/** @format */

const { v2: cloudinary } = require("cloudinary");
const cloudinaryConfig = require("../config/storage.config");
const AppError = require("../errors/app.error");

cloudinary.config({
  cloud_name: cloudinaryConfig.cloudName,
  api_key: cloudinaryConfig.apiKey,
  api_secret: cloudinaryConfig.apiSecret,
});

const uploadFileToStorageService = async (file, storageKey) => {
  if (!file) {
    throw new AppError("File is required", 400);
  }
  if (!storageKey) {
    throw new AppError("Storage key is required", 400);
  }

  const result = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: storageKey,
        resource_type: "raw",
      },
      (error, response) => {
        if (error) {
          return reject(error);
        }
        resolve(response);
      },
    );

    uploadStream.end(file.buffer);
  });

  return {
    storageKey: result.public_id,
    secureUrl: result.secure_url,
  };
};

const deleteFileFromStorageService = async (storageKey) => {
  if (!storageKey) {
    throw new AppError("Storage key is required", 400);
  }

  await cloudinary.uploader.destroy(storageKey, {
    resource_type: "raw",
  });

  return true;
};

const generateSignedResourceUrlService = (storageKey) => {
  if (!storageKey) {
    throw new AppError("Storage key is required", 400);
  }

  return cloudinary.url(storageKey, {
    resource_type: "raw",
    type: "upload",
    secure: true,
  });
};

module.exports = {
  uploadFileToStorageService,
  deleteFileFromStorageService,
  generateSignedResourceUrlService,
};
