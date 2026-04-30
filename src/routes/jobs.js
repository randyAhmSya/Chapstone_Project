import express from "express";
import * as ctrl from "../controllers/jobsController.js";

const router = express.Router();

router.get("/", ctrl.getAll);
router.get("/skills", ctrl.getSkills);
router.get("/stats", ctrl.getStats);
router.get("/industries", ctrl.getIndustries);
router.get("/:id", ctrl.getOne);

export default router;
