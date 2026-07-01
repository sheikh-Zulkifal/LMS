import { NextFunction, Request, Response } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import { redis } from "../utils/redis";
import OrderModel,{IOrder} from "../models/order.model";
import userModel from "../models/user.model";
import path from "path";
import ejs from "ejs";
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notificatio.model";
import CourseModel from "../models/course.model";
import { newOrder } from "../services/order.service";

// create order

export const createOrder = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {courseId, payment_info} = req.body as IOrder;
        const user = await userModel.findById(req.user?._id);

        const courseExistInUser = user?.courses.some((course: any) => course._id.toString() === courseId);
        if(courseExistInUser) {
            return next(new ErrorHandler("You have already enrolled in this course", 400));
        }
        const course = await CourseModel.findById(courseId);
        if(!course) {
            return next(new ErrorHandler("Course not found", 404));
        }

        const data:any = {
            courseId: course._id,
            userId : user?._id,
            payment_info,
        }


        const mailData = {
            order: {
                _id: course._id.toString().slice(0,6),
                name: course.name,
                price: course.price,
                date: new Date().toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'}),
            }}

            const html = await ejs.renderFile(path.join(__dirname, "../mails/order-confimation.ejs"), {order:mailData});

try {
    if(user){
        await sendMail({
            email: user.email,
            subject: "Order Confimation",
            template: "order-confimation.ejs",
            data: mailData,
        });
    }

    user.courses.push(course?._id);

    await user.save();

    await NotificationModel.create({
        user: user?._id,
        title: "New Order",
        message: `You have a new order from ${course?.name}`,
    });
    course.purchased = (course.purchased ?? 0) + 1;
    await course.save();
    await newOrder(data, res, next);

}catch(error: any) {
    return next(new ErrorHandler(error.message, 500));
}



    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});



