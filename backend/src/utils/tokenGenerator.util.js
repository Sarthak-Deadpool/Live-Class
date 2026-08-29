/** @format */

const crypto = require("crypto");

const tokenGenerator = () => {
  const token = crypto.randomBytes(32).toString("hex");
  return token;
};

module.exports = tokenGenerator;
