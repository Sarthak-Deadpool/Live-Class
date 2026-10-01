/** @format */

const AppError = require("../errors/app.error");
const JSZip = require("jszip");

const validateResourceFile = async (file) => {
  if (!file || !file.buffer) {
    throw new AppError("File is required", 400);
  }

  const mimeType = file.mimetype;
  const buffer = file.buffer;

  // PDF file
  if (mimeType === "application/pdf") {
    const signature = Buffer.from("%PDF-");

    if (!buffer.subarray(0, 5).equals(signature)) {
      throw new AppError("Invalid PDF file", 400);
    }

    return true;
  }

  // PNG file
  if (mimeType === "image/png") {
    const signature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    if (!buffer.subarray(0, 8).equals(signature)) {
      throw new AppError("Invalid PNG file", 400);
    }

    return true;
  }

  // JPEG file
  if (mimeType === "image/jpeg") {
    if (
      buffer.length < 3 ||
      buffer[0] !== 0xff ||
      buffer[1] !== 0xd8 ||
      buffer[2] !== 0xff
    ) {
      throw new AppError("Invalid JPEG file", 400);
    }

    return true;
  }

  // WebP file
  if (mimeType === "image/webp") {
    if (
      buffer.length < 12 ||
      !buffer.subarray(0, 4).equals(Buffer.from("RIFF")) ||
      !buffer.subarray(8, 12).equals(Buffer.from("WEBP"))
    ) {
      throw new AppError("Invalid WebP file", 400);
    }

    return true;
  }

  // DOCX / PPTX file
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    const zipSignature = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

    if (!buffer.subarray(0, 4).equals(zipSignature)) {
      throw new AppError("Invalid Office document", 400);
    }

    let zip;

    try {
      zip = await JSZip.loadAsync(buffer);
    } catch (error) {
      throw new AppError("Invalid Office document", 400);
    }

    const requiredFiles = ["[Content_Types].xml", "_rels/.rels"];

    for (const fileName of requiredFiles) {
      if (!zip.file(fileName)) {
        throw new AppError("Invalid Office document", 400);
      }
    }

    if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      if (!zip.file("word/document.xml")) {
        throw new AppError("Invalid DOCX file", 400);
      }

      return true;
    }

    if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ) {
      if (!zip.file("ppt/presentation.xml")) {
        throw new AppError("Invalid PPTX file", 400);
      }

      return true;
    }
  }

  throw new AppError("Unsupported file type", 400);
};

module.exports = {
  validateResourceFile,
};
