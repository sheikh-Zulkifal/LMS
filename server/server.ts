require("dotenv").config();
import { app } from "./app";
import connectDB from "./utils/db";
import "./utils/cloudinary";

const PORT = process.env.PORT ;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    connectDB();
}
);