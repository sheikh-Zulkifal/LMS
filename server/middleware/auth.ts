require("dotenv").config();
import jwt from "jsonwebtoken";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "./catchAsyncErrors";
import { NextFunction, Request, Response } from "express";
import { redis } from "../utils/redis";

interface IAccessTokenPayload {
  id: string;
}

// authenticate user
export const isAuthenticated = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const accessToken = req.cookies.accessToken;

    if (!accessToken) {
      return next(
        new ErrorHandler("Please login to access this resource", 401),
      );
    }

    const decoded = jwt.verify(
      accessToken,
      process.env.ACCESS_TOKEN as string,
    ) as IAccessTokenPayload;

    if (!decoded?.id) {
      return next(new ErrorHandler("Access token is invalid", 401));
    }

    const userId = decoded.id.toString();
    const user = await redis.get(userId);
    if (!user) {
      return next(
        new ErrorHandler("Please login to access this resource", 401),
      );
    }

    req.user = JSON.parse(user);
    next();
  },
);

// validate user role
export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user?.role || "")) {
      return next(new ErrorHandler(`Role: ${req.user?.role} is not allowed to access this resource`, 403));
    }
      next();
    };
  };