import HttpError from "../models/errorModel.js";
import bcrypt from "bcryptjs";
import User from "../models/userModel.js";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {google} from "googleapis"
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// register
const registerUser = async (req, res, next) => {
  try {
    const { username, email, password, password2 } = req.body;
    
    if (!username || !email || !password) {
      throw new HttpError('Fill in all the fields', 400);
    }

    const newEmail = email.toLowerCase();

    const emailExists = await User.findOne({ email: newEmail });
    if (emailExists) {
      throw new HttpError('Email already exists', 409);
    }

    if (password.trim().length < 8) {
      throw new HttpError("Password should contain at least 8 characters", 400);
    }

    if (password !== password2) {
      throw new HttpError('Passwords do not match', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(password, salt);
    const newUser = await User.create({ username, email: newEmail, password: hashedPass });
    
    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
};

// login

const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(422).json({ message: "Please provide both email and password" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const comparePass = await bcrypt.compare(password, user.password);
    if (!comparePass) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const { _id: id, username } = user;
    const token = jwt.sign({ id, username }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(200).json({ token, id, username });
  } catch (error) {
    next(error);
  }
};

// get author
const getAuthor = async (req, res, next) => {
  try {
    const users = await User.find({}).select("-password");    
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};

// get user

const getUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password");
    if (!user) {
      throw new HttpError('User not found', 404);
    }
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

// change-avatar

async function uploadAvatarToDrive(avatar) {
  const oauth2Client = new google.auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URI);
  oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

  const drive = google.drive({
    version: 'v3',
    auth: oauth2Client
  });

  const fileName = avatar.name;
  const filePath = path.join(__dirname, '..', '/uploads', fileName);
  await avatar.mv(filePath);

  try {
    // Upload the file
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: 'image/jpeg'
      },
      media: {
        mimeType: 'image/jpeg',
        body: fs.createReadStream(filePath)
      },
      fields: 'id'
    });

    const fileId = response.data.id;

    // Set permissions for the file
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    return fileId;
  } catch (error) {
    console.log(error);
    throw new HttpError("Error uploading image to Google Drive", 500);
  }
}

async function deleteAvatarFromDrive(avatarId) {
  try {
    const oauth2Client = new google.auth.OAuth2({
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      redirectUri: process.env.REDIRECT_URI
    });

    oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
    const drive = google.drive({
      version: 'v3',
      auth: oauth2Client
    });

    await drive.files.delete({
      fileId: avatarId
    });

    console.log('Avatar deleted from Google Drive successfully');
  } catch (error) {
    console.error('Error deleting avatar from Google Drive:', error);
    throw new Error('Failed to delete avatar from Google Drive');
  }
}
const changeAvatar = async (req, res, next) => {
  try {
    if (!req.files.avatar) {
      throw new HttpError("Please choose an image", 422);
    }

    const { avatar } = req.files;

    if (avatar.size > 500000) {
      throw new HttpError("Profile picture is too big. Should be less than 500kb");
    }
    const avatarId = await uploadAvatarToDrive(avatar);
    const user = await User.findById(req.user.id);
    if (user.avatar) {
      await deleteAvatarFromDrive(user.avatar);
    }
    const updatedUser =await User.findByIdAndUpdate(req.user.id,{avatar:avatarId},{new:true});
    if (!updatedUser) {
      throw new HttpError("Avatar cannot be changed");
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
};

// edit details
const updateDetails = async (req, res) => {
  try {
    const { username, email, currentPassword, newPassword, newconfirmPassword } = req.body;
    if (!username || !email || !currentPassword || !newPassword || !newconfirmPassword) {
      return res.status(422).json({ error: "Fill in all the fields" });

    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(403).json({ error: "User not found" });
    }

    const emailExists = await User.findOne({ email: email });
    if (emailExists && (emailExists.id != req.user.id)) {
      return res.status(422).json({ error: "Email already exists" });
    }

    const validateUserPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validateUserPassword) {
      return res.status(422).json({ error: "Invalid current Password" });
    }

    if (newPassword.length < 8) {
      return res.status(422).json({ error: "Password must contain at least 8 characters" });
    }

    if (newPassword != newconfirmPassword) {
      return res.status(422).json({ error: "Passwords do not match" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(newPassword, salt);
    
    const newInfo = await User.findByIdAndUpdate(req.user.id, { username, email, password: hashedPass }, { new: true });
    
    res.status(200).json(newInfo);

  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
};



export default {
  registerUser,
  loginUser,
  getAuthor,
  updateDetails,
  changeAvatar,
  getUser
};