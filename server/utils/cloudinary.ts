require("dotenv").config();
import { v2 as cloudinary } from "cloudinary";

const cloudName = process.env.CLOUD_NAME;
const apiKey = process.env.CLOUD_API_KEY;
const apiSecret = process.env.CLOUD_SECRET_KEY;

if (!cloudName || !apiKey || !apiSecret) {
  console.warn(
    "Cloudinary env vars missing. Set CLOUD_NAME, CLOUD_API_KEY, and CLOUD_SECRET_KEY in .env",
  );
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

export default cloudinary;
