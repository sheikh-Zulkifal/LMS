import { Router } from "express";
import { isAuthenticated } from "../middleware/auth";
import { createOrder } from "../controllers/order.controller";

const orderRouter = Router();

orderRouter.post("/create-order", isAuthenticated, createOrder);

export default orderRouter;