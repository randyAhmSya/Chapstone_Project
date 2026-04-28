import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import cvRouter from "./routes/cv.js";
import jobsRouter from "./routes/jobs.js";
import usersRouter from "./routes/users.js";
import matchRouter from "./routes/match.js";
import { startAutoCleanUp } from "./utils/deletecv.js";

// Patch untuk mengatasi error serialisasi BigInt ke JSON di Express
BigInt.prototype.toJSON = function() {
    return this.toString();
};

const app = express();

const PORT = process.env.PORT || 3001;

//security
app.use(helmet());
app.use(
    cors({
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        credentials: true,
    }),
);

app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 100,
        message: { error: "terlalu banyak request, coba lagi setelah 15 menit" },
    }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "combined"));

//routes
app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/cv", cvRouter);
app.use("/api/users", usersRouter);
app.use("/api/match", matchRouter);

// error 404

app.use((req, res) => {
    res.status(404).json({
        error: `Endpoint ${req.method} ${req.path} tidak ditemukan`,
    });
});

// error handler
app.use((err, req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    console.error(`[ERROR ${status}] ${req.method} ${req.path} — ${err.message}`);
    res.status(status).json({
        error: err.message || "internal server error",
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
});

startAutoCleanUp();

app.listen(PORT, () => {
    console.log(`    http://localhost:${PORT}`);
    console.log(`    ENV : ${process.env.NODE_ENV}`);
    console.log(`    DB  : Supabase PostgreSQL via Prisma\n`);
});
