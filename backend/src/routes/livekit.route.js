/** @format */

const express = require("express");

const auth = require("../middlewares/auth.middleware");
const { joinLiveKitClassroom } = require("../controller/livekit.controller");

const router = express.Router();

router.post("/join/:sessionId", auth, joinLiveKitClassroom);

module.exports = router;
