const bcrypt = require("bcrypt");

const tokenHashing = (token) => {
    const saltRound = 10;

    const hashedToken = bcrypt.hashSync(token, saltRound);
    return hashedToken;
}

module.exports = tokenHashing;