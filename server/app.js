"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
require("dotenv").config();
const express_1 = __importDefault(require("express"));
const error_1 = require("./middleware/error");
exports.app = (0, express_1.default)();
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
// body parser
exports.app.use(express_1.default.json({ limit: "50mb" }));
exports.app.use((0, cors_1.default)({
    origin: process.env.ORIGIN,
}));
exports.app.use((0, cookie_parser_1.default)());
exports.app.get("/test", (req, res, next) => {
    res.status(200).json({
        success: true,
        message: "Hello World",
    });
});
// unknown routes
exports.app.use((req, res, next) => {
    const err = new Error(`Route ${req.originalUrl} not found`);
    err.status = 404;
    next(err);
});
exports.app.use(error_1.errorMiddleware);
