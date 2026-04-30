import { PDFParse } from "pdf-parse";
import prisma from "../config/prisma.js";
import supabase from "../config/supabase.js";

const BUCKET = "cv-uploads";
const MIN_TEXT_LEN = 50; // minimal karakter agar teks dianggap valid
const AI_TIMEOUT = 30_000;

async function extractText(buffer) {
    try {
        const result = await PDFParse(buffer);
        const text = result.text?.replace(/\s+/g, " ").trim() || "";

        if (text.length < MIN_TEXT_LEN) {
            return {
                text: null,
                reason:
                    "PDF tampaknya kosong atau hasil scan gambar (tidak ada teks yang bisa diekstrak)",
            };
        }
        return { text, reason: null };
    } catch {
        return {
            text: null,
            reason: "PDF tidak bisa dibaca — mungkin terproteksi atau rusak",
        };
    }
}

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

    // 3. Ekstraksi teks
    const { text: extractedText, reason: extractReason } =
        await extractText(buffer);
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
        ...(extractReason && { extractWarning: extractReason }),
    });
};

export const getMine = async (req, res) => {
    const list = await prisma.cvUpload.findMany({
        where: { userId: req.user.id },
        orderBy: { uploadedAt: "desc" },
        select: {
            id: true,
            fileName: true,
            fileUrl: true,
            uploadedAt: true,
            extractedText: false,
        },
    });

    // Tambahkan flag apakah sudah ada teks atau belum
    const withStatus = await prisma.cvUpload.findMany({
        where: { userId: req.user.id },
        orderBy: { uploadedAt: "desc" },
        select: {
            id: true,
            fileName: true,
            fileUrl: true,
            uploadedAt: true,
            extractedText: true,
        },
    });

    const result = withStatus.map((cv) => ({
        id: cv.id,
        fileName: cv.fileName,
        fileUrl: cv.fileUrl,
        uploadedAt: cv.uploadedAt,
        textExtracted:
            cv.extractedText !== null && cv.extractedText.length >= MIN_TEXT_LEN,
    }));

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
    res.json({
        data: {
            ...cv,
            textExtracted:
                cv.extractedText !== null && cv.extractedText.length >= MIN_TEXT_LEN,
            textLength: cv.extractedText?.length || 0,
        },
    });
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

// POST /api/cv/:id/re-extract — coba ekstraksi ulang
// jika pertama kali upload pdf-parse gagal
export const reExtract = async (req, res) => {
    const cv = await prisma.cvUpload.findUnique({ where: { id: req.params.id } });
    if (!cv) return res.status(404).json({ error: "CV tidak ditemukan" });
    if (cv.userId !== req.user.id)
        return res.status(403).json({ error: "Akses ditolak" });

    const { data: fileData, error: dlErr } = await supabase.storage
        .from(BUCKET)
        .download(cv.storagePath);
    if (dlErr || !fileData) {
        return res.status(500).json({ error: "gagal download file CV" });
    }
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const { text: extractedText, reason: extractReason } =
        await extractedText(buffer);

    if (!extractedText) {
        return res.status(422).json({
            error: "CV belum di ekstrak",
            reason: extractReason,
        });
    }

    await prisma.cvUpload.update({
        error: { id: cv.id },
        data: {
            extractedText,
        },
    });

    res.json({
        message: "CV berhasil di ekstrak ulang",
        textLength: extractedText.length,
    });
};

export const analyze = async (req, res) => {
    const { cvUploadId, jobPostingId } = req.body;
    const userId = req.user.id;

    //validasi
    const cv = await prisma.cvUpload.findUnique({ where: { id: cvUploadId } });
    if (!cv) return res.status(404).json({ error: "CV tidak ditemukan" });
    if (cv.userId !== userId)
        return res.status(403).json({ error: "Akses ditolak" });
    if (!cv.extractedText || cv.extractedText.length < MIN_TEXT_LEN) {
        return res.status(422).json({
            error: "Teks CV belum tersedia atau terlalu pendek",
            hint: "Coba upload ulang atau gunakan POST /api/cv/:id/re-extract",
        });
    }

    //ambil jobPosting
    const job = await prisma.jobPosting.findUnique({
        where: { id: parseInt(jobPostingId) },
        include: {
            skills: { include: { skill: true } },
        },
    });
    if (!job)
        return res.status(404).json({ error: "Job posting tidak ditemukan" });

    let aiResult = null;
    let aiOnline = false;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);

        const aiRes = await fetch(`${process.env.AI_SERVICE_URL}/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                cv_text: cv.extractedText,
                job_description: job.jobDescription || "",
                job_title: job.title || "",
                skills_desc: job.skillsDesc || "",
                required_skills: job.skills.map((s) => s.skill.skillId),
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!aiRes.ok) throw new Error(`AI Service HTTP ${aiRes.status}`);
        aiResult = await aiRes.json();
        aiOnline = true;
    } catch (err) {
        console.warn("[CV analyze] AI Service tidak tersedia:", err.message);

        aiResult = buildFallbackAnalysis(cv.extractedText, job);
    }

    res.json({
        message: "analisis selesai",
        aiOnline,
        data: {
            cvId: cv.id,
            jobId: job.id,
            jobTitle: job.title,
            matchScore: aiResult.match_score ?? aiResult.matchScore ?? 0,
            skillGap: aiResult.skill_gap ?? aiResult.skillGap ?? null,
            suggestions: aiResult.suggestions ?? [],
            summary: aiResult.summary ?? null,
        },
    });
};

function buildFallbackAnalysis(cv_Text, job) {
    const cvLower = cv_Text.toLowerCase();
    const required = job.skills.map((s) => ({
        id: s.skill.skillId,
        name: s.skill.skillName,
    }));

    const present = required.filter(
        (s) =>
            cvLower.includes(s.name.toLowerCase()) ||
            cvLower.includes(s.id.toLowerCase()),
    );

    const missing = required.filter(
        (s) =>
            !cvLower.includes(s.name.toLowerCase()) &&
            !cvLower.includes(s.id.toLowerCase()),
    );

    const score =
        required.length > 0
            ? parseFloat((present.length / required.length).toFixed(2))
            : 0;

    return {
        match_score: score,
        skill_gap: {
            note: "Analisis fallback — AI Service belum aktif (Minggu 4)",
            present: present.map((s) => s.id),
            missing: missing.map((s) => s.id),
            required: required.map((s) => s.id),
        },
        suggestions: missing.map((s) => ({
            skill: s.name,
            action: `Pelajari ${s.name} untuk meningkatkan kesesuaian dengan posisi ini`,
        })),
        summary: `Dari ${required.length} skill yang dibutuhkan, CV ini memenuhi ${present.length} skill (${Math.round(score * 100)}% match).`,
    };
}
