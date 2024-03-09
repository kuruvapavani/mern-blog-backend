import { Router } from "express";
import userControllers from "../controllers/userControllers.js";
import authMiddleware from "../middleware/authMiddleware.js";
const { registerUser,getAuthor, loginUser,changeAvatar ,updateDetails,getUser} = userControllers;

const router = Router();

router.post('/register',registerUser);
router.post('/login',loginUser);
router.get('/authors',getAuthor);
router.get('/:id',getUser);
router.post('/change-avatar',authMiddleware,changeAvatar);
router.patch('/edit-user',authMiddleware,updateDetails)
export default router;