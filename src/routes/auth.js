import express from "express";
import * as ctrl from "../controllers/authController.js";
import auth from "../middleware/auth.js";
import * as v from "../middleware/validate.js";
import * as lim from "../middleware/authLimite.js";

const router = express.Router();

router.post("/register", lim.registerLimiter, v.register, ctrl.register);
router.post("/login", lim.loginLimiter, v.login, ctrl.login);
router.get("/me", auth, ctrl.me);
router.post("/logout", auth, ctrl.logout);
router.put(
    "/change-password",
    auth,
    v.changePassword,
    lim.changePasswordLimiter,
    ctrl.changePassword,
);

export default router;
