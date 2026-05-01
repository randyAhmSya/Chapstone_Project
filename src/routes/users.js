import express from "express";
import * as ctrl from "../controllers/usersController.js";
import auth from "../middleware/auth.js";
import v from "../middleware/validate.js";

const router = express.Router();

router.use(auth);

router.get("/profile", ctrl.getProfile);
router.put("/profile", v.updateProfile, ctrl.updateProfile);
router.get("/recommendations", ctrl.getRecommendations);
router.delete("/account", ctrl.deleteAcount);

router.get("/:userId/recommendations", ctrl.getRecommendationsById);
router.get("/:userId/cvs", ctrl.getCvsByUserId);

export default router;
