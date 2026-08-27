/** @format */

const Course = require("../models/course.model");
const Enrollment = require("../models/enrollment.model");

const createCourseService = async (teacherId, title, description, status) => {
  // Validation

  if (!teacherId) {
    throw new Error("Teacher ID is required");
  }

  if (!title) {
    throw new Error("Course title is required");
  }

  if (typeof title !== "string") {
    throw new Error("Course title must be string");
  }

  if (title.trim().length < 3 || title.trim().length > 50) {
    throw new Error("Course title must be betwwen 3 to 50 characters");
  }

  if (description !== undefined) {
    if (description && typeof description !== "string") {
      throw new Error("Description must be string");
    }

    if (description && description?.trim().length > 2000) {
      throw new Error("Description cannot exceed 2000 characters");
    }
  }

  if (!["draft", "active"].includes(status)) {
    throw new Error("Course status must be draft or active");
  }

  const trimmedTitle = title.trim();
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

  if (title !== undefined) {
    if (typeof title !== "string") {
      throw new Error("Course title must be string");
    }

    if (title.trim().length < 3 || title.trim().length > 50) {
      throw new Error("Course title must be betwwen 3 to 50 characters");
    }
  }
  if (description !== undefined) {
    if (description && typeof description !== "string") {
      throw new Error("Description must be string");
    }

    if (description && description?.trim().length > 2000) {
      throw new Error("Description cannot exceed 2000 characters");
    }
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
    updateData.title = title.trim();
  }
  if (description !== undefined) {
    updateData.description = description.trim();
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

  if (!["draft", "active", "archived"].includes(status)) {
    throw new Error("Course status must be draft or active or archived");
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
