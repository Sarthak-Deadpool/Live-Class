/** @format */

const bcrypt = require("bcrypt");

const passwordHashing = (password) => {
  const saltRound = 10;

  const hashedPassword = bcrypt.hashSync(password, saltRound);

  return hashedPassword;
};

module.exports = passwordHashing;
