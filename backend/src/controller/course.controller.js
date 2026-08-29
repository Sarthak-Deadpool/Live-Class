/** @format */

const {
  createCourseService,
  getAllCoursesService,
  getCourseByIdService,
  updateCourseService,
  updateCourseStatusService,
} = require("../services/course.service");

// create course

const createCourse = async (req, res) => {
  const teacherId = req.user.id;
  const { title, description, status } = req.body;

  const response = await createCourseService(
    teacherId,
    title,
    description,
    status,
  );

  return res.status(201).json({ success: true, data: response });
};

const getAllCourses = async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;

  const response = await getAllCoursesService(userId, role);

  return res.status(200).json({ success: true, data: response });
};

const getCourseById = async (req, res) => {
  const courseId = req.params.id;
  const userId = req.user.id;
  const role = req.user.role;

  const response = await getCourseByIdService(courseId, userId, role);

  return res.status(200).json({ success: true, data: response });
};

const updateCourse = async (req, res) => {
  const courseId = req.params.id;
  const teacherId = req.user.id;
  const { title, description } = req.body;

  const response = await updateCourseService(
    courseId,
    teacherId,
    title,
    description,
  );

  return res.status(200).json({ success: true, data: response });
};

const updateCourseStatus = async (req, res) => {
  const courseId = req.params.id;
  const teacherId = req.user.id;
  const status = req.body.status;

  const response = await updateCourseStatusService(courseId, teacherId, status);

  return res.status(200).json({ success: true, data: response });
};

module.exports = {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  updateCourseStatus,
};
