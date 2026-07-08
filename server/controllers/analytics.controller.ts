import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import userModel from "../models/user.model";
import { generateLast12MonthsData } from "../utils/analytics.generator";
import ErrorHandler from "../utils/ErrorHandler";
import CourseModel from "../models/course.model";
import OrderModel from "../models/order.model";



// get user analytics --admin

export const getUserAnalytics = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const users =await  generateLast12MonthsData(userModel)
       res.status(200).json({
        success: true,
        users
       })
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);


// get courses analytics --admin

export const getCoursesAnalytics = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const courses =await  generateLast12MonthsData(CourseModel)
       res.status(200).json({
        success: true,
        courses
       })
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// get orders analytics --admin

export const getOrdersAnalytics = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orders =await  generateLast12MonthsData(OrderModel)
       res.status(200).json({
        success: true,
        orders
       })
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

