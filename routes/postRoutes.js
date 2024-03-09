import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js"
import postControllers from "../controllers/postControllers.js"
const {getPost,getPosts,editPost,deletePost,authorPosts,categoryPosts,createPost} = postControllers
const router = Router();

router.get('/',getPosts);
router.get('/:id',getPost);
router.patch('/:id',authMiddleware,editPost);
router.delete('/:id',authMiddleware,deletePost)
router.get('/authors/:id',authorPosts)
router.get('/categories/:category',categoryPosts)
router.post('/create',authMiddleware,createPost)

export default router;