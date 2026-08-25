/** @format */

const  createCourseService = async (teacherId, title, description, status ) => {

};

const getAllCoursesService = async (userId, role) => {};

const getCourseByIdService = async (courseId, userId, role) => {};

const updateCourseService = async (courseId, teacherId, title, description, status) => {};

const updateCourseStatusService = async (courseId, teacherId, status) => {};

module.exports = {
  createCourseService,
  getAllCoursesService,
  getCourseByIdService,
  updateCourseService,
  updateCourseStatusService,
};
