/** @format */

const AppError = require("../errors/app.error");

let io;

const setSocketIO = (socketIO) => {
  io = socketIO;
};

const getSocketIO = () => {
  if (!io) {
    throw new Error("Socket.io is not initialized");
  }

  return io;
};

module.exports = {
  setSocketIO,
  getSocketIO,
};
