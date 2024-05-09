import Post from "../models/postModel.js"
import jwt from "jsonwebtoken";
import fs, { unlink } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from 'url';
import User from "../models/userModel.js";
import HttpError from "../models/errorModel.js";
import { dirname, join } from 'path';
import {google} from 'googleapis';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);
oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

const drive = google.drive({
  version: 'v3',
  auth: oauth2Client
});

// create new post


const createPost = async (req, res, next) => {
  try {
    let { title, category, description } = req.body;
    if (!title || !category || !description || !req.files || req.files.length === 0) {
      throw new HttpError("Fill in all the fields and upload a file", 422);
    }
    const thumbnail = req.files.thumbnail;
    if (!thumbnail || thumbnail.size === undefined) {
      throw new HttpError("Image not provided. Please upload an image.", 422);
    }
    if (thumbnail.size > 2000000) {
      throw new HttpError("Image too big. It should be less than 2 MB.", 422);
    }
    let fileName = thumbnail.name;
    let splittedFileName = fileName.split('.');
    let newFileName = splittedFileName[0] + uuidv4() + '.' + splittedFileName[splittedFileName.length - 1];
    const filePath = path.join(__dirname, '..', '/uploads', newFileName);
    thumbnail.mv(filePath, async (err) => {
      if (err) {
        throw new HttpError(err);
      } else {
        if (oauth2Client.isTokenExpiring()) {
          const { credentials } = await oauth2Client.refreshAccessToken();
          oauth2Client.setCredentials(credentials);
        }
        const response = await drive.files.create({
          requestBody: {
            name: newFileName,
            mimeType: 'image/jpeg'
          },
          media: {
            mimeType: 'image/jpeg',
            body: fs.createReadStream(filePath)
          },
          fields: 'id' 
        });
        const fileId = response.data.id;
        await drive.permissions.create({
          fileId: fileId,
          requestBody: {
            role: 'reader',
            type: 'anyone'
          }
        });
        const newPost = await Post.create({
          title,
          category,
          description,
          thumbnail: fileId,
          authorId: req.user.id
        });
        const currentUser = await User.findById(req.user.id);
        const userPostCount = currentUser.posts + 1;
        await User.findByIdAndUpdate(req.user.id, { posts: userPostCount });
        res.status(200).json(newPost);
      }
    });
  } catch (error) {
    next(error);
  }
};







// edit existing post


const editPost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, category } = req.body;
    
    if (!title || !category || !description || description.length < 12) {
      throw new HttpError("Fill in all the fields and ensure description is at least 12 characters long", 422);
    }

    const userId = req.user.id;
    console.log(id);
    console.log(userId);
    const post = await Post.findOne({ _id: id, authorId: userId });
    if (!post) {
      throw new HttpError("Post not found or you do not have permission to edit it", 404);
    }

    let updatedPost;
    let thumbnailId;
    
    if (req.files && req.files.thumbnail) {
      const thumbnail = req.files.thumbnail;
      
      if (thumbnail.size > 2000000) {
        throw new HttpError("Image too big. It should be less than 2 MB.", 422);
      }
      
      thumbnailId = await uploadThumbnailToDrive(thumbnail);
    }

    updatedPost = await Post.findByIdAndUpdate(id, { title, description, category, thumbnail: thumbnailId }, { new: true });

    if (!updatedPost) {
      throw new HttpError("Could not update post", 500);
    }

    res.status(200).json(updatedPost);
  } catch (error) {
    next(error);
  }
};

async function uploadThumbnailToDrive(thumbnail) {
  const oauth2Client = new google.auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URI);
  oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

  const drive = google.drive({
    version: 'v3',
    auth: oauth2Client
  });

  const fileName = thumbnail.name;
  const filePath = path.join(__dirname, '..', '/uploads', fileName);

  await thumbnail.mv(filePath);

  try {
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

    return response.data.id;
  } catch (error) {
    console.log(error);
    throw new HttpError("Error uploading image to Google Drive", 500);
  }
}


// delete a post

const deletePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new HttpError("Post ID is unavailable", 400);
    }

    const post = await Post.findById(id);
    if (!post) {
      throw new HttpError("Post not found", 404);
    }
    deleteThumbnailFromDrive(post);
    await Post.findByIdAndDelete(id);
      const currentUser = await User.findById(req.user.id);
      if (currentUser) {
        const userPostCount = currentUser.posts - 1;
        await User.findByIdAndUpdate(req.user.id, { posts: userPostCount });
      }

      res.json("Post deleted successfully");
  } catch (error) {
    next(error);
  }
};

const deleteThumbnailFromDrive = async (post) => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      process.env.REDIRECT_URI
    );
    oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const fileId = await post.thumbnail;
    const response = await drive.files.delete({ fileId });

    return response;
  } catch (error) {
    console.error("Error deleting file from Google Drive:", error);
    throw error;
  }
};

const findFileIdByName = async (drive, fileName) => {
  try {
    const response = await drive.files.list({
      q: `name='${fileName}'`,
      fields: 'files(id)',
    });

    if (response.data.files.length > 0) {
      return response.data.files[0].id;
    } else {
      throw new Error(`File '${fileName}' not found in Google Drive`);
    }
  } catch (error) {
    console.error("Error finding file ID:", error);
    throw error;
  }
};


// get all posts


const getPosts = async (req, res, next) => {
  try {
    const posts = await Post.find({}).sort({ createdAt: -1 }); // Sort by createdAt in descending order
    res.status(200).json(posts);
  } catch (error) {
    next(error);
  }
};

// get posts by author

const authorPosts= async (req,res,next)=>{
  try {
    const {id} = req.params
    const authorPosts = await Post.find({authorId:id}).sort({createdAt:-1})
    res.status(200).json(authorPosts)
  } catch (error) {
    next(error)
  }
}

// get posts by category

const categoryPosts= async (req,res,next)=>{
  try {
    const {category} = req.params
    const categoryPosts = await Post.find({category:category}).sort({createdAt:-1});
    if(categoryPosts.length==0){
      throw new HttpError('Posts not found in this category',404)
    }
    res.status(200).json(categoryPosts)
  } catch (error) {
    throw new HttpError(error)
  }
}

// get a single post

const getPost= async (req,res,next)=>{
  try {
    const {id} = req.params
    const post = await Post.findById(id)
    if(!post){
      throw new HttpError("Post not found",404)
    }
    res.status(200).json(post)
  } catch (error) {
    next(error)
  }
}


export default {getPost,getPosts,editPost,deletePost,authorPosts,categoryPosts,createPost}