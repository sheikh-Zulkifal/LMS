require("dotenv").config();
import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import { redis } from "../utils/redis";
import cloudinary from "../utils/cloudinary";
import { createCourse } from "../services/course.service";
import CourseModel from "../models/course.model";
import userModel from "../models/user.model";
import mongoose from "mongoose";
import sendMail from "../utils/sendMail";

// upload course
export const uploadCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      const thumbnail = data.thumbnail;
      if (thumbnail) {
        const image = await cloudinary.uploader.upload(thumbnail, {
          folder: "courses",
        });
        data.thumbnail = {
          public_id: image.public_id,
          url: image.secure_url,
        };
      }
      createCourse(data, res, next);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  },
);

// edit course

export const editCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      const thumbnail = data.thumbnail;
      if (thumbnail) {
        await cloudinary.uploader.destroy(thumbnail.public_id);

        const myCloud = await cloudinary.uploader.upload(thumbnail, {
          folder: "courses",
        });
        data.thumbnail = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }
      const courseId = req.params.id;
      const course = await CourseModel.findByIdAndUpdate(
        courseId,
        { $set: data },
        { new: true },
      );
      res.status(201).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  },
);
// get single course without purchasing
export const getSingleCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!courseId) {
        return next(new ErrorHandler("Invalid course id", 400));
      }

      const isCacheExist = await redis.get(courseId);
      if (isCacheExist) {
        const course = JSON.parse(isCacheExist);
        res.status(200).json({
          success: true,
          course,
        });
      } else {
        const course = await CourseModel.findById(courseId).select(
          "-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links",
        );

        await redis.set(courseId, JSON.stringify(course));
        res.status(200).json({
          success: true,
          course,
        });
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  },
);
// get all courses without purchasing
export const getAllCourses = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isCacheExist = await redis.get("allCourses");
      if (isCacheExist) {
        const courses = JSON.parse(isCacheExist);
        res.status(200).json({
          success: true,
          courses,
        });
      } else {
        const courses = await CourseModel.find().select(
          "-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links",
        );
        await redis.set("allCourses", JSON.stringify(courses));
        res.status(200).json({
          success: true,
          courses,
        });
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  },
);

//  get course content -only for valid user

export const getCourseByUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userCourseList = req.user?.courses;
      const courseId = req.params.id;
      const courseExists = userCourseList?.find(
        (course: any) => course._id.toString() === courseId,
      );
      if (!courseExists) {
        return next(
          new ErrorHandler("You are not enrolled in this course", 400),
        );
      }
      const course = await CourseModel.findById(courseId);
      const content = course?.courseData;
      res.status(200).json({
        success: true,
        content,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  },
);

// add questions to the course

interface IQuestion {
  question: string;
  courseId: string;
  contentId: string;
}

export const addQuestion = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { question, courseId, contentId } = req.body as IQuestion;
      const course = await CourseModel.findById(courseId);
      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        return next(new ErrorHandler("Invalid course id", 400));
      }
      const courseContent = course?.courseData?.find(
        (item: any) => item._id.toString() === contentId,
      );
      if (!courseContent) {
        return next(new ErrorHandler("Content not found", 400));
      }
      // create a new question object
      const newQuestion: any = {
        user: req.user?._id,
        question,
        questionReplies: [],
      };
      // add this question to the course content
      courseContent?.questions.push(newQuestion);
      // save the updated course content
      await course?.save();
      res.status(200).json({
        success: true,
        message: "Question added successfully",
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  },
);

//  add answer in a course question

interface IAddAnswerData {
  answer: string;
  questionId: string;
  courseId: string;
  contentId: string;
}

export const addAnswer = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { answer, questionId, courseId, contentId } =
        req.body as IAddAnswerData;
      const course = await CourseModel.findById(courseId);
      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        return next(new ErrorHandler("Invalid course id", 400));
      }
      const courseContent = course?.courseData?.find(
        (item: any) => item._id.toString() === contentId,
      );
      if (!courseContent) {
        return next(new ErrorHandler("Content not found", 400));
      }

      const question = courseContent?.questions?.find(
        (item: any) => item._id.toString() === questionId,
      );

      if (!question) {
        return next(new ErrorHandler("Question not found", 400));
      }
      // create a new answer object
      const newAnswer: any = {
        user: req.user?._id,
        answer,
      };
      // add this answer to the question
      question?.questionReplies.push(newAnswer);
      // save the updated course content

      await course?.save();

      const questionUserId = question.user?.toString();

      if (req.user?._id?.toString() === questionUserId) {
        // answerer is the same user who asked the question
      } else {
        const questionUser = await userModel.findById(question.user);

        if (!questionUser?.email) {
          return next(new ErrorHandler("Question owner email not found", 404));
        }

        const data = {
          name: questionUser.name,
          title: courseContent?.title,
        };

        try {
          await sendMail({
            email: questionUser.email,
            subject: "Question Reply",
            template: "question-reply.ejs",
            data,
          });
        } catch (error: any) {
          return next(new ErrorHandler(error.message, 500));
        }
      }

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);
