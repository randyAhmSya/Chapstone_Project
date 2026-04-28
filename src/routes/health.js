import express from "express";
import prisma from "../config/prisma.js";

const router = express.Router();

router.get("/health", async (req, res) => {
    let dbStatus = "conneted";
    try {
        await prisma.$queryRaw`SELECT 1`;
    } catch {
        dbStatus = "disconneted";
    }

    res.status(dbStatus === "conneted" ? 200 : 500).json({
        status: dbStatus === "conneted" ? "ok" : "error",
        service: "skillalign-backend",
        database: dbStatus,
        timestamp: new Date().toISOString(),
    });
});

export default router;
