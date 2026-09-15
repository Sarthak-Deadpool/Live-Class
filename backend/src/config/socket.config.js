/** @format */

const socketConfig = {
  cors: {
    origin: process.env.FRONTEND_URL,
    credential: true,
  },
};

module.exports = socketConfig;