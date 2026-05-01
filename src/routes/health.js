import express from "express";
import prisma from "../config/prisma.js";

const router = express.Router();

router.get("/health", async (req, res) => {
    let dbStatus = "connected";
    try {
        await prisma.$queryRaw`SELECT 1`;
    } catch {
        dbStatus = "disconnected";
    }

    res.status(dbStatus === "connected" ? 200 : 500).json({
        status: dbStatus === "connected" ? "ok" : "error",
        service: "skillalign-backend",
        database: dbStatus,
        timestamp: new Date().toISOString(),
    });
});

export default router;
