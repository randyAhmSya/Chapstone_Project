import express from "express";
import * as ctrl from "../controllers/usersController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.use(auth);

router.get("/profile", ctrl.getProfile);
router.put("/profile", ctrl.updateProfile);
router.get("/recommendations", ctrl.getRecommendations);

export default router;
