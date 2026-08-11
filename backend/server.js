/** @format */

require("dotenv").config();

const app = require("./src/app");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    app.listen(PORT, () => {
      console.log("Server running on port 5000");
    });
  } catch (error) {
    console.error(error);
    console.log("Something went wrong");
  }
}

startServer();
