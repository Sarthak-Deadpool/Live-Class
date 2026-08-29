/** @format */

const AppError = require("../errors/app.error");

const errorMiddleware = (err, req, res, next) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message =
    err instanceof AppError ? err.message : "Internal Server Error";

  return res.status(statusCode).json({
    success: false,
    message: message,
  });
};

module.exports = errorMiddleware;
