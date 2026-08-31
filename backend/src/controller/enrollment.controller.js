/** @format */

const { requestEnrollmentService } = require("../services/enrollment.service");

const requestEnrollment = async (req, res) => {
  const studentId = req.user.userId;
  const courseId = req.body.courseId;

  const response = await requestEnrollmentService(studentId, courseId);

  return res.status(201).json({
    success: true,
    data: response,
  });
};

module.exports = { requestEnrollment };
