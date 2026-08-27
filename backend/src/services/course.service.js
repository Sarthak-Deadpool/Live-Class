/** @format */

const Course = require("../models/course.model");
const Enrollment = require("../models/enrollment.model");

const createCourseService = async (teacherId, title, description, status) => {
  // Validation

  if (!teacherId) {
    throw new Error("Teacher ID is required");
  }

  const trimmedTitle = title?.trim();
  const trimmedDescription = description?.trim();

  const createdCourse = await Course.create({
    teacherId: teacherId,
    title: trimmedTitle,
    description: trimmedDescription,
    status: status,
  });

  return createdCourse;
};

const getAllCoursesService = async (userId, role) => {
  // validation
  if (!userId) {
    throw new Error("User ID is required.");
  }
  if (!role) {
    throw new Error("Role is required");
  }

  if (!["teacher", "student"].includes(role)) {
    throw new Error("Invalid role");
  }

  // for teacher
  if (role === "teacher") {
    const courses = await Course.find({ teacherId: userId });
    return courses;
  }

  // for student
  if (role === "student") {
    const enrollments = await Enrollment.find({
      studentId: userId,
      status: "active",
    });

    const courseIds = enrollments.map((enrollment) => enrollment.courseId);

    const courses = await Course.find({
      _id: { $in: courseIds },
    });

    return courses;
  }
};

const getCourseByIdService = async (courseId, userId, role) => {
  // valdation
  if (!courseId) {
    throw new Error("Course ID is required");
  }

  if (!userId) {
    throw new Error("User ID is required");
  }

  if (!role) {
    throw new Error("Role is required");
  }

  if (!["teacher", "student"].includes(role)) {
    throw new Error("Invalid role");
  }

  // finding Course

  const course = await Course.findById(courseId);

  if (!course) {
    throw new Error("Course not found");
  }

  // student
  if (role === "student") {
    const enrollment = await Enrollment.findOne({
      courseId: courseId,
      studentId: userId,
      status: "active",
    });

    if (!enrollment) {
      throw new Error("Forbidden");
    }

    return course;
  }
  // teacher
  if (role === "teacher") {
    if (course.teacherId.toString() !== userId) {
      throw new Error("Forbidden");
    }
    return course;
  }
};

const updateCourseService = async (courseId, teacherId, title, description) => {
  // validation
  if (!courseId) {
    throw new Error("Course ID is required");
  }

  if (!teacherId) {
    throw new Error("Teacher ID is required");
  }

  // finding course
  const course = await Course.findOne({
    _id: courseId,
    teacherId: teacherId,
  });

  if (!course) {
    throw new Error("Course not found");
  }

  // update course
  const updateData = {};

  if (title !== undefined) {
    updateData.title = title?.trim();
  }
  if (description !== undefined) {
    updateData.description = description?.trim();
  }

  const updatedCourse = await Course.findOneAndUpdate(
    { _id: courseId, teacherId: teacherId },

    updateData,

    { new: true },
  );

  return updatedCourse;
};

const updateCourseStatusService = async (courseId, teacherId, status) => {
  // validation

  if (!courseId) {
    throw new Error("Course ID is required");
  }

  if (!teacherId) {
    throw new Error("Teacher ID is required");
  }

  // find course
  const course = await Course.findOne({
    _id: courseId,
    teacherId: teacherId,
  });

  if (!course) {
    throw new Error("Course not found");
  }
  // upadte course
  if (course.status === "draft" && status !== "active") {
    throw new Error("Draft course can only be activated");
  }
  if (course.status === "active" && status !== "archived") {
    throw new Error("Active course can only be archived");
  }
  if (course.status === "archived") {
    throw new Error("Archived course cannot change status");
  }
  const updatedCourse = await Course.findOneAndUpdate(
    { _id: courseId, teacherId: teacherId },
    {
      status: status,
    },
    { new: true },
  );

  return updatedCourse;
};

module.exports = {
  createCourseService,
  getAllCoursesService,
  getCourseByIdService,
  updateCourseService,
  updateCourseStatusService,
};
