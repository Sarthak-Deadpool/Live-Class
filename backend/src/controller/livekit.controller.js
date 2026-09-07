/** @format */

const {
  generateLiveKitJoinTokenService,
} = require("../services/livekit.service");

const joinLiveKitClassroom = async (req, res) => {
  const userId = req.user.userId;
  const sessionId = req.params.sessionId;

  const response = await generateLiveKitJoinTokenService(userId, sessionId);

  return res.status(200).json({
    success: true,
    data: response,
  });
};

module.exports = { joinLiveKitClassroom };
