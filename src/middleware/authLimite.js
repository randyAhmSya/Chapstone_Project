import { rateLimit, ipKeyGenerator } from "express-rate-limit";

// Rate limit LOGIN — 10 percobaan per 15 menit per IP
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "terlalu banyak percobaan untuk login. coba lagi setelah 15 menit",
    },
    keyGenerator: (req) => {
        const ip = ipKeyGenerator(req);
        const email = (req.body.email || "").toLowerCase().trim();
        return `login: ${ip}-${email}`;
    },
});

export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error:
            "terlalu banyak percobaan untuk register. coba lagi setelah 15 menit",
    },
    keyGenerator: (req) => `register: ${ipKeyGenerator(req)}`,
});

export const changePasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error:
            "terlalu banyak percobaan untuk ubah password. coba lagi setelah 15 menit",
    },
    keyGenerator: (req) => `changePassword: ${ipKeyGenerator(req)}`,
});
