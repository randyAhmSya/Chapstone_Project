import express from "express";
import * as ctrl from "../controllers/cvController.js";
import auth from "../middleware/auth.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router.use(auth);

router.post("/upload", upload.single("cv"), ctrl.upload);
router.post("/analyze", ctrl.analyze);
router.get("/", ctrl.getMine);
router.get("/:id", ctrl.getOne);
router.delete("/:id", ctrl.remove);

router.post("/:id/re-extract", ctrl.reExtract);

export default router;
