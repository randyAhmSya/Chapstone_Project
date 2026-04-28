import express from "express";
import * as ctrl from "../controllers/matchController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.use(auth);
router.post("/", ctrl.run);
router.get("/:id", ctrl.getOne);

export default router;
