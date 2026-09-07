/** @format */

require("dotenv").config();

const livekitConfig = {
  apiKey: process.env.LIVEKIT_API_KEY,
  apiSecret: process.env.LIVEKIT_API_SECRET,
  serverUrl: process.env.LIVEKIT_URL,
};

module.exports = livekitConfig;
