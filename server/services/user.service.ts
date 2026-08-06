import { Response } from "express";
import { redis } from "../utils/redis";
import userModel from "../models/user.model";

//  get user id
export const getUserById = async (id: string, res: Response) => {
  const userJson = await redis.get(id);

  // fall back to the database so a missing/expired cache never hangs the request
  const user = userJson ? JSON.parse(userJson) : await userModel.findById(id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  if (!userJson) {
    await redis.set(id, JSON.stringify(user), "EX", 7 * 24 * 60 * 60);
  }

  res.status(200).json({
    success: true,
    user,
  });
};

//  Get All Users

export const getAllUsersService = async (res: Response) => {
  const users = await userModel.find().sort({ createdAt: -1 });
  res.status(201).json({
    success: true,
    users,
  });
};

// update user role --only for admin

export const updateUserRoleService = async (res: Response, id: string, role: string) => {
  const user = await userModel.findByIdAndUpdate(id, { role }, { new: true });
  res.status(201).json({
    success: true,
    user,
  });
};