import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import { USER_TTL_MS } from "../utils/constants.js";
import { cache } from "../utils/cache.js";

export const auth = async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "Token tidak ada. Sertakan header: Authorization: Bearer <token>",
        });
    }

    try {
        const token = header.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        const cacheKey = `user:${userId}`;
        const useCache = process.env.NODE_ENV !== "test";
        let user = useCache ? cache.get(cacheKey) : null;

        if (!user) {
            user = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, email: true, name: true },
            });
            if (!user) return res.status(401).json({ error: "User tidak ditemukan" });
            if (useCache && user) {
                cache.set(cacheKey, user, USER_TTL_MS);
            }
        }
        
        req.user = user;
        next();
    } catch (err) {
        console.error("Auth Middleware Error:", err);
        const msg =
            err.name === "TokenExpiredError"
                ? "Token kadaluarsa silahkan login ulang"
                : "Token tidak valid";
        res.status(401).json({ error: msg });
    }
};

export default auth;
