import express from "express";
import prisma from "../config/prisma.js";
import aiSrv from "../services/aiServices.js";

const router = express.Router();

router.get("/health", async (req, res) => {
    let dbStatus = "connected";
    try {
        await prisma.$queryRaw`SELECT 1`;
    } catch {
        dbStatus = "disconnected";
    }

    const aiHealth = await aiSrv.checkHealth();
    const allOk = dbStatus === "connected"
    const circuit = aiSrv.getCircuitState()

    res.status(allOk ? 200 : 503).json({
        status: allOk ? "ok" : "degraded",
        service: "skillAlign Backend",
        timestamp: new Date().toISOString(),
        components: {
            database: {status: dbStatus},
            aiServices: {
                online:       aiHealth.online,
                status:       aiHealth.status     || (aiHealth.online ? 'ok' : 'offline'),
                modelLoaded:  aiHealth.model_loaded ?? null,
                accuracy:     aiHealth.accuracy     ?? null,
                circuitOpen:  circuit.open,
            }

        }
    })
});

export default router;
