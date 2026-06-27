require("dotenv").config();
import { IUser } from "../models/user.model";
import { Response } from "express";
import { redis } from "./redis";

interface ITokenOptions {
  expires: Date;
  maxAge: number;
  httpOnly: boolean;
  secure?: boolean;
  sameSite: "strict" | "lax" | "none";
}

export const sendToken = (user: IUser, statusCode: number, res: Response) => {
  const accessToken = user.SignAccessToken();
  const refreshToken = user.SignRefreshToken();

  // upload session to redis

  redis.set(user._id.toString(), JSON.stringify(user) as any);

  // parse environment variables to integrate with fallback values
  const accessTokenExpires = parseInt(
    process.env.ACCESS_TOKEN_EXPIRE || "300",
    10,
  );
  const refreshTokenExpires = parseInt(
    process.env.REFRESH_TOKEN_EXPIRE || "1200",
    10,
  );

  const accessTokenOptions: ITokenOptions = {
    expires: new Date(Date.now() + accessTokenExpires * 1000),
    maxAge: accessTokenExpires * 1000,
    httpOnly: true,
    sameSite: "lax",
  };

  const refreshTokenOptions: ITokenOptions = {
    expires: new Date(Date.now() + refreshTokenExpires * 1000),
    maxAge: refreshTokenExpires * 1000,
    httpOnly: true,
    sameSite: "lax",
  };

  // only secure to true in production
  if (process.env.NODE_ENV === "production") {
    accessTokenOptions.secure = true;
    refreshTokenOptions.secure = true;
  }

  res.cookie("accessToken", accessToken, accessTokenOptions);
  res.cookie("refreshToken", refreshToken, refreshTokenOptions);

  res.status(statusCode).json({
    success: true,
    user,
    accessToken,
  });
};
