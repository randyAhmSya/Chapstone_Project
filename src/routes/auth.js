import express from "express";
import * as ctrl from "../controllers/authController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.post("/register", ctrl.register);
router.post("/login", ctrl.login);
router.get("/me", auth, ctrl.me);

export default router;
