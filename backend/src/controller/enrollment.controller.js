/** @format */

const {
  requestEnrollmentService,
  getMyEnrollmentsService,
  getCourseEnrollmentsService,
  approveEnrollmentService,
} = require("../services/enrollment.service");

// request enrollment
const requestEnrollment = async (req, res) => {
  const studentId = req.user.userId;
  const courseId = req.body.courseId;

  const response = await requestEnrollmentService(studentId, courseId);

  return res.status(201).json({
    success: true,
    data: response,
  });
};

// fetch Enrollment Student

const getMyEnrollments = async (req, res) => {
  const studentId = req.user.userId;

  const response = await getMyEnrollmentsService(studentId);

  return res.status(200).json({
    success: true,
    data: response,
  });
};

// get Enrollmet Course teacher

const getCourseEnrollments = async (req, res) => {
  const teacherId = req.user.userId;
  const courseId = req.params.courseId;

  const response = await getCourseEnrollmentsService(teacherId, courseId);

  return res.status(200).json({
    success: true,
    data: response,
  });
};

const approveEnrollment = async (req, res) => {
  const teacherId = req.user.userId;
  const enrollmentId = req.params.enrollmentId;

  const response = await approveEnrollmentService(teacherId, enrollmentId);

  return res.status(200).json({
    success: true,
    data: response,
  });
};

module.exports = {
  requestEnrollment,
  getMyEnrollments,
  getCourseEnrollments,
  approveEnrollment,
};
