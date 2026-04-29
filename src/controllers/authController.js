import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
// import { token } from "morgan";

const makeToken = (userId) => {
    return jwt.sign(
        {
            userId,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "7d",
        },
    );
};

export const register = async (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password)
        return res.status(400).json({ error: "email and password wajib diisi" });
    if (password.length < 8)
        return res.status(400).json({ error: "password minimal harus 8 karakter" });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: "email sudah terdaftar" });

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
        data: {
            email,
            passwordHash,
            name: name?.trim() || null,
            profile: { create: {} },
        },
        select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
        },
    });
    res.status(201).json({ token: makeToken(user.id), user });
};

export const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: "email and password wajib diisi" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
        return res.status(401).json({ error: "email atau password salah" });

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid)
        return res.status(401).json({ error: "email atau password salah" });

    res.json({
        token: makeToken(user.id),
        user: { id: user.id, email: user.email, name: user.name },
    });
};

export const me = async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            profile: true,
        },
    });
    res.json({
        data: user,
    });
};

export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { passwordHash: true },
    });

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok)
        return res.status(401).json({
            error: "password tidak benar",
        });

    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
        where: { id: req.user.id },
        data: { passwordHash: newHash },
    });

    res.json({
        message: "password berhasil diubah. silahkanlogin ulang",
    });
};
