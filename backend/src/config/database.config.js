/** @format */

const mongoose = require("mongoose");
const dns = require("dns");

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const dbConnection = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    

    if (!uri) throw new Error("URI not found!");

    await mongoose.connect(uri);
    console.log("Databse connected successfully");
  } catch (err) {
    console.error("Database connection error = " + err.message);
    process.exit(1);
  }
};

module.exports = dbConnection;
