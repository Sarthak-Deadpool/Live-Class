/** @format */

const jwt = require("jsonwebtoken");

const generateJWT = (payload, Secret, duration) => {
  return jwt.sign(payload, Secret, { expiresIn: duration });
};

module.exports = generateJWT;
