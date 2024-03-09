import jwt from "jsonwebtoken";
import HttpError from "../models/errorModel.js";

const authMiddleware = async (req, res, next) => {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer')) {
      throw new HttpError("Unauthorized. No token", 401);
    }

    const token = authorizationHeader.split(' ')[1];
    const decodedInfo = await jwt.verify(token, process.env.JWT_SECRET);

    req.user = decodedInfo;
    next();
  } catch (error) {
    next(error);
  }
};

export default authMiddleware;