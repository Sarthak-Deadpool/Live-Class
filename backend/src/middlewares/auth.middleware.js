/** @format */

const jwt = require("jsonwebtoken");
const AppError = require("./error.middleware");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startWith("Bearer ")) {
    throw new AppError("Unauthorized", 401);
  }

  const accessToken = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(accessToken, process.env.ACCESS_SECRET);

    req.user = decoded;
    next();
  } catch (error) {
    throw new AppError("Invalid or Expired token", 401);
  }
};

module.exports = authMiddleware;
