import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import R from "../utils/response.js";
import { cache } from "../utils/cache.js";
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

const userSelect = { id: true, email: true, name: true, createdAt: true };

export const register = async (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password)
        return R.badRequest(res, "email and password wajib diisi");
    if (password.length < 8)
        return R.badRequest(res, "password minimal harus 8 karakter");

    const passwordHash = await bcrypt.hash(password, 10);

    try {
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
        res.status(201).json({
            message: "User berhasil didaftarkan",
            token: makeToken(user.id),
            user,
        });
    } catch (error) {
        if (error.code === "P2002") {
            return R.fail(res, 409, "email sudah terdaftar");
        }

        console.error(error);
        return R.fail(res, 500, "Terjadi kesalahan pada server");
    }
};

export const login = async (req, res) => {
  const { email, password } = req.body

  const user = await prisma.user.findUnique({ where: { email } })

  // Pesan identik — cegah user enumeration
  if (!user) return R.unauthorized(res, 'Email atau password salah')

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok)  return R.unauthorized(res, 'Email atau password salah')

  // Simpan ke cache setelah login berhasil — request berikutnya tidak perlu DB
  cache.set(`user:${user.id}`, { id: user.id, email: user.email, name: user.name })

  return res.json({
    message: 'Login berhasil',
    token:   makeToken(user.id),
    user:    { id: user.id, email: user.email, name: user.name },
  })
};

export const me = async (req, res) => {
  const profile = await prisma.userProfile.findUnique({
    where: { userId: req.user.id },
  })
  return R.ok(res, { ...req.user, profile: profile || null })
};

export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { passwordHash: true },
    });

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return R.unauthorized(res, "password saat ini tidak benar");

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
        where: { id: req.user.id },
        data: { passwordHash: newHash },
    });

    R.ok(res, null, "password berhasil di ubah silahkan login ulang");
};

export const logout = async (req, res) => {
    // Update updatedAt user sebagai tanda aktivitas terakhir
    await prisma.user.update({
        where: { id: req.user.id },
        data: { updatedAt: new Date() },
    });

    R.ok(res, null, "Logout berhasil, hapus token di penyimpanan lokal");
};
