/** @format */

require("dotenv").config();

const socketConfig = require("./src/config/socket.config");
const initializeSocket = require("./src/sockets/index");

const http = require("http");
const { Server } = require("socket.io");
const dbConnection = require("./src/config/database.config");
const app = require("./src/app");

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, socketConfig);

initializeSocket(io);
dbConnection();

server.listen(PORT, () => {
  console.log("Server running on port 5000");
});

// async function startServer() {
//   try {
//     await dbConnection();

//     app.listen(PORT, () => {
//       console.log("Server running on port 5000");
//     });
//   } catch (error) {
//     console.error(error);
//     console.log("Something went wrong");
//   }
// }

// startServer();
