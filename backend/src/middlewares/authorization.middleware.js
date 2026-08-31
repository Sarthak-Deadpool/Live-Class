/** @format */

const AppError = require("../errors/app.error");

const authorizationMiddleware = (requiredRole) => {
  return (req, res, next) => {
    const role = req.user.role;

    if (requiredRole !== role) {
      throw new AppError("Forbidden", 403);
    }

    next();
  };
};
module.exports = authorizationMiddleware;
