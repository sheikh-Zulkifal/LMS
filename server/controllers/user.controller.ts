require("dotenv").config();
import { Request, Response, NextFunction } from "express";
import userModel, { IUser } from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import jwt, { JwtPayload } from "jsonwebtoken";
import ejs from "ejs";
import path from "node:path";
import sendMail from "../utils/sendMail";
import {
  accessTokenOptions,
  refreshTokenOptions,
  sendToken,
} from "../utils/jwt";
import { redis } from "../utils/redis";
import { getAllUsersService, getUserById, updateUserRoleService } from "../services/user.service";
import cloudinary from "../utils/cloudinary";

interface IRegiterationBody {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}

interface IAccessTokenPayload {
  id: string;
}

export const registerationUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password, avatar }: IRegiterationBody = req.body;
      const isEmailExist = await userModel.findOne({ email });
      if (isEmailExist) {
        return next(new ErrorHandler("Email already exists", 400));
      }
      const user: IRegiterationBody = {
        name,
        email,
        password,
      };
      const activationToken = createActivationToken(user);

      const activationCode = activationToken.activationCode;

      const data = { user: { name: user.name }, activationCode };

      const html = await ejs.renderFile(
        path.join(__dirname, "../mails/activation-mail.ejs"),
        data,
      );
      try {
        await sendMail({
          email: user.email,
          subject: "Account Activation",
          template: "activation-mail.ejs",
          data,
        });
        res.status(200).json({
          success: true,
          message: `Activation code sent to ${user.email}`,
          activationToken: activationToken.token,
        });
      } catch (error) {
        return next(new ErrorHandler("Failed to send activation email", 400));
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  },
);

interface IActivationToken {
  token: string;
  activationCode: string;
}

export const createActivationToken = (user: any): IActivationToken => {
  const activationCode = Math.floor(100000 + Math.random() * 900000).toString();
  const token = jwt.sign(
    { user, activationCode },
    process.env.ACTIVATION_SECRET,
    {
      expiresIn: "5m",
    },
  );
  return { token, activationCode };
};

// activate user

interface IActivateUserRequest {
  activationToken: string;
  activationCode: string;
}

export const activateUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { activationToken, activationCode } =
        req.body as IActivateUserRequest;
      const newUser: { user: IUser; activationCode: string } = jwt.verify(
        activationToken,
        process.env.ACTIVATION_SECRET as string,
      ) as { user: IUser; activationCode: string };

      if (newUser.activationCode !== activationCode) {
        return next(new ErrorHandler("Invalid activation code", 400));
      }
      const { name, email, password } = newUser.user;
      const existUser = await userModel.findOne({ email });
      if (existUser) {
        return next(new ErrorHandler("Email already exists", 400));
      }
      const user = await userModel.create({
        name,
        email,
        password,
      });
      res.status(201).json({
        success: true,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  },
);

// login user

interface ILoginRequest {
  email: string;
  password: string;
}

export const loginUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as ILoginRequest;

      if (!email || !password) {
        return next(new ErrorHandler("Please provide email and password", 400));
      }
      const user = await userModel.findOne({ email }).select("+password");
      if (!user) {
        return next(new ErrorHandler("Invalid email or password", 401));
      }
      const isPasswordMatched = await user.comparePassword(password);
      if (!isPasswordMatched) {
        return next(new ErrorHandler("Invalid email or password", 401));
      }

      sendToken(user, 200, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  },
);
// logout user

export const logoutUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
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

      const userId = decoded?.id?.toString();

      if (!userId) {
        return next(new ErrorHandler("Access token is invalid", 401));
      }

      const cookieOptions = {
        httpOnly: true,
        sameSite: "lax" as const,
        ...(process.env.NODE_ENV === "production" && { secure: true }),
      };

      await redis.del(userId);

      res.clearCookie("accessToken", cookieOptions);
      res.clearCookie("refreshToken", cookieOptions);

      redis.del(userId);

      res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  },
);

// update access token
export const updateAccessToken = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refresh_token = req.cookies.refreshToken as string;
      const decoded = jwt.verify(
        refresh_token,
        process.env.REFRESH_TOKEN as string,
      ) as JwtPayload;
      const message = "Could not refresh token";
      if (!decoded) {
        return next(new ErrorHandler(message, 400));
      }

      const session = await redis.get(decoded.id as string);

      if (!session) {
        return next(new ErrorHandler(message, 400));
      }

      const user = JSON.parse(session);

      const accessToken = jwt.sign(
        { id: user._id },
        process.env.ACCESS_TOKEN as string,
        {
          expiresIn: "5m",
        },
      );

      const refreshToken = jwt.sign(
        { id: user._id },
        process.env.REFRESH_TOKEN as string,
        {
          expiresIn: "3d",
        },
      );
      res.user = user;
      res.cookie("access_token", accessToken, accessTokenOptions);
      res.cookie("refresh_token", refreshToken, refreshTokenOptions);

      res.status(200).json({
        status: "success",
        accessToken,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  },
);

// get user info

export const getUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id?.toString();
      if (!userId) {
        return next(new ErrorHandler("User not found", 404));
      }
      await getUserById(userId, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  },
);

interface ISocialAuthBody {
  name: string;
  email: string;
  avatar: string;
}

// social auth

export const socialAuth = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, avatar } = req.body as ISocialAuthBody;
      const user = await userModel.findOne({ email });
      if (!user) {
        const newUser = await userModel.create({ name, email, avatar });
        sendToken(newUser, 200, res);
      } else {
        sendToken(user, 200, res);
      }
    } catch (error: any) {
      next(new ErrorHandler(error.message, 400));
    }
  },
);

// update user info

interface IUserInfo {
  name: string;
  email: string;
}

export const updateUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email } = req.body as IUserInfo;
      const userId = req.user?._id?.toString();

      if (!userId) {
        return next(new ErrorHandler("User not found", 404));
      }

      const user = await userModel.findById(userId);

      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      if (email) {
        const isEmailExist = await userModel.findOne({ email });
        if (isEmailExist && isEmailExist._id.toString() !== userId) {
          return next(new ErrorHandler("User Already Exist", 400));
        }
        user.email = email;
      }
      if (name) {
        user.name = name;
      }

      await user.save();
      await redis.set(userId, JSON.stringify(user));

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  },
);

// update user password

interface IUpdatePassword {
  oldPassword: string;
  newPassword: string;
}

export const updatePassword = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { oldPassword, newPassword } = req.body as IUpdatePassword;

      if (!oldPassword || !newPassword) {
        return next(new ErrorHandler("Please enter old and new password", 400));
      }

      const user = await userModel.findById(req.user._id).select("+password");

      if (user.password === undefined) {
        return next(new ErrorHandler("Invalid User", 400));
      }

      const isPasswrodMatch = await user.comparePassword(oldPassword);
      if (!isPasswrodMatch) {
        return next(new ErrorHandler("Invalid old Password", 400));
      }
      user.password = newPassword;
      await user.save();
      await redis.set(req.user?._id?.toString(), JSON.stringify(user));

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  },
);

// update profile picture

interface IUpdateProfilePicture {
  avatar: string;
}

export const updateProfilePicture = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { avatar } = req.body as IUpdateProfilePicture;
      const userId = req.user?._id?.toString();

      if (!userId) {
        return next(new ErrorHandler("User not found", 404));
      }

      if (!avatar) {
        return next(new ErrorHandler("Please provide an avatar", 400));
      }

      const user = await userModel.findById(userId);

      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      if (user.avatar?.public_id) {
        try {
          await cloudinary.uploader.destroy(user.avatar.public_id);
        } catch {
          // ignore if old avatar was not stored in Cloudinary
        }
      }

      const myCloud = await cloudinary.uploader.upload(avatar, {
        folder: "avatars",
        width: 150,
        crop: "scale",
      });

      user.avatar = {
        public_id: myCloud.public_id,
        url: myCloud.secure_url,
      };

      await user.save();
      await redis.set(userId, JSON.stringify(user));

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  },
);

// get all users --only for admin

export const getAllUsers = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
     getAllUsersService(res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  },
);

//  update user role --only for admin

export const updateUserRole = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, role } = req.body;
      updateUserRoleService(res,id, role);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  },
);