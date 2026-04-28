import { PDFParse } from "pdf-parse";
import prisma from "../config/prisma.js";
import supabase from "../config/supabase.js";

const BUCKET = "cv-uploads";

export const upload = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "file CV wajib diisi" });

    const { buffer, originalname, size } = req.file;
    const userId = req.user.id;
    const safeName = originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${userId}/${Date.now()}_${safeName}`;

    const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
            contentType: "application/pdf",
            upsert: false,
        });
    if (upErr) {
        console.error("[storage] upload error:", upErr.message);
        return res.status(500).json({ error: "gagal upload ke storage" });
    }

    const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(storagePath);

    let extractedText = null;
    try {
        // 1. Inisialisasi parser dengan buffer file PDF dari Multer
        const parser = new PDFParse({ data: buffer });

        // 2. Jalankan proses ekstraksi teks
        const textResult = await parser.getText();

        // 3. Wajib: Hancurkan instance setelah selesai agar tidak terjadi memory leak
        await parser.destroy();

        // 4. Ambil teksnya, bersihkan spasi kosong di awal/akhir, atau jadikan null jika kosong
        extractedText = textResult.text?.trim() || null;

        console.log("✅ Ekstraksi sukses pakai pdf-parse v2.4.5!");
    } catch (e) {
        console.warn("[pdf-parse] gagal ekstraksi:", e.message);
    }

    const cv = await prisma.cvUpload.create({
        data: {
            userId,
            fileName: originalname,
            fileUrl: urlData.publicUrl,
            storagePath,
            extractedText,
        },
        select: {
            id: true,
            fileName: true,
            fileUrl: true,
            uploadedAt: true,
            extractedText: true,
        },
    });

    res.status(201).json({
        message: "CV berhasil diupload",
        data: cv,
        textExtracted: extractedText !== null,
        fileSize: size,
    });
};

export const getMine = async (req, res) => {
    const list = await prisma.cvUpload.findMany({
        where: { userId: req.user.id },
        orderBy: { uploadedAt: "desc" },
        select: { id: true, fileName: true, fileUrl: true, uploadedAt: true },
    });
    res.json({ data: list, total: list.length });
};

export const getOne = async (req, res) => {
    const cv = await prisma.cvUpload.findUnique({ where: { id: req.params.id } });
    if (!cv)
        return res.status(404).json({
            error: "CV tidak ditemukan",
        });
    if (cv.userId !== req.user.id)
        return res.status(403).json({
            error: "Anda tidak memiliki akses ke CV ini",
        });
    res.json({ data: cv });
};

export const remove = async (req, res) => {
    const cv = await prisma.cvUpload.findUnique({ where: { id: req.params.id } });
    if (!cv) return res.status(404).json({ error: "CV tidak ditemukan" });
    if (cv.userId !== req.user.id)
        return res.status(403).json({ error: "Akses ditolak" });

    const { error } = await supabase.storage
        .from(BUCKET)
        .remove([cv.storagePath]);
    if (error) console.warn("[storage] delete warning:", error.message);

    await prisma.cvUpload.delete({ where: { id: req.params.id } });
    res.json({ message: "CV berhasil dihapus" });
};
