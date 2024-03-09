import dotenv from 'dotenv';
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import userRoutes from "./routes/userRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import errorMiddleware from "./middleware/errorMiddleware.js"
import upload from 'express-fileupload';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const {notFound,errorHandler}= errorMiddleware



const port = process.env.PORT;

const app = express();
app.use(upload());
app.use(express.json({ extended: true }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({ credentials: true, origin: process.env.BASE_URL_FRONTEND }));





app.use('/uploads', express.static(join(__dirname, 'uploads')));

app.use('/api/users',userRoutes);
app.use('/api/posts',postRoutes);
app.use(notFound);
app.use(errorHandler);












(async () => {
  try {
    await mongoose.connect(process.env.DATA_URI);

    app.listen(port, () => {
      console.log("server started successfully");
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
})();