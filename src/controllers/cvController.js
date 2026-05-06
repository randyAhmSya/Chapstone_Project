import prisma from "../config/prisma.js";
import supabase from "../config/supabase.js";
import pdfsrv from "../service/pdfServices.js";
import R from "../utils/response.js";
import storageSrv from "../service/storageService.js";
import skillGapSrv from "../services/skillGapServices.js"
import aiServices from "../services/aiServices.js";

export const upload = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "file CV wajib diisi" });

    const { buffer, originalname, size } = req.file;
    const userId = req.user.id;
    const safeName = originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${userId}/${Date.now()}_${safeName}`;

    // upload ke supabase storage
    let publicUrl;
    try {
        const result = await storageSrv.uploadCv(storagePath, buffer);
        publicUrl = result.publicUrl;
    } catch (err) {
        console.error("[storage] upload error:", err.message);
        return R.serverError(res, "gagal upload ke storage");
    }

    // 3. Ekstraksi teks
    const { text: extractedText, reason: extractReason } =
        await pdfsrv.extractTextFromBuffer(buffer);

    let cv;

    try {
        cv = await prisma.cvUpload.create({
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
    } catch (dbErr) {
        console.error(
            "[CV Upload] DB insert gagal, rolling back storage:",
            dbErr.message,
        );
        await storageSrv.deleteCv(storagePath);
        return R.serverError(res, "gagal upload ke storage");
    }

    res.status(201).json({
        message: "CV berhasil diupload",
        data: {
            ...cv,
            textExtracted: pdfsrv.isTextValid(cv.extractedText),
        },

        fileSize: size,
        ...(extractReason && { extractWarning: extractReason }),
    });
};


export const getMine = async (req, res) => {
    const cvs = await prisma.cvUpload.findMany({
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

    const data = cvs.map(cv => ({
        id: cv.id,
        fileName: cv.fileName,
        fileUrl: cv.fileUrl,
        uploadedAt: cv.uploadedAt,
        textExtracted: pdfsrv.isTextValid(cv.extractedText),
    }))
    
    return R.ok(res, data);
};

export const getOne = async (req, res) => {
    const cv = await prisma.cvUpload.findUnique({ where: { id: req.params.id } });
    if (!cv)
        return R.notFound(res, "CV tidak ditemukan");
    if (cv.userId !== req.user.id)
        return R.forbidden(res, "Anda tidak memiliki akses ke CV ini");
    
    return R.ok(res, {
        ...cv,
        textExtracted: pdfsrv.isTextValid(cv.extractedText),
        textLength: cv.extractedText?.length || 0,
    })
};



export const remove = async (req, res) => {
    const cv = await prisma.cvUpload.findUnique({ where: { id: req.params.id } });
    if (!cv) return R.notFound(res, "CV tidak ditemukan");
    if (cv.userId !== req.user.id)
        return R.forbidden(res, "Akses ditolak");

    await storageSrv.deleteCv(cv.storagePath);

    await prisma.cvUpload.delete({ where: { id: req.params.id } });
    return R.ok(res, "CV berhasil dihapus");
};


// POST /api/cv/:id/re-extract — coba ekstraksi ulang
// jika pertama kali upload pdf-parse gagal
export const reExtract = async (req, res) => {
    const cv = await prisma.cvUpload.findUnique({ where: { id: req.params.id } });
    if (!cv) return R.notFound(res, "CV tidak ditemukan");
    if (cv.userId !== req.user.id)
        return R.forbidden(res, "Akses ditolak");

    let buffer;
    try {
        buffer = await storageSrv.download(cv.storagePath);
    } catch (err) {
        return R.serverError(res, "Gagal mengunduh file CV");
    }

    const { text: extractedText, reason: extractReason } = await pdfsrv.extractTextFromBuffer(buffer);

    if (!extractedText) {
        return R.unprocessable(res, 'gagal mengekstrak teks dari pdf', extractReason);
    }

    //update
    await prisma.cvUpload.update({
        where: { id: cv.id },
        data: { extractedText }
    });
    
    return R.ok(res, { textLength: extractedText.length }, 'Teks berhasil diekstrak ulang')
};

export const analyze = async (req, res) => {
    const { cvUploadId, jobPostingId } = req.body;
    const userId = req.user.id;

    //validasi
    const cv = await prisma.cvUpload.findUnique({ where: { id: cvUploadId } });
    if (!cv) return R.notFound(res, "CV tidak ditemukan");
    if (cv.userId !== userId)
        return R.forbidden(res, "Akses ditolak");
    if (!cv.extractedText || cv.extractedText.length < MIN_TEXT_LEN) {
        return R.unprocessable(res, "Teks CV belum tersedia atau terlalu pendek", {
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
        return R.notFound(res, "Job posting tidak ditemukan");

    const jobSkills = skillGapSrv.extractJobSkills(job)
    const jobSkillIds = jobSkills.map(s => s.skillId)

    let aiResult;
    let aiOnline = false;

    try {
        const aiRaw = await aiServices.analyze(cv.extractedText, job, jobSkillIds)
        aiOnline = true;
        aiResult = {
            matchScore:  aiRaw.match_score  ?? 0,
            skillGap:    aiRaw.skill_gap    ?? null,
            suggestions: aiRaw.suggestions  ?? [],
            summary:     aiRaw.summary      ?? null,
        }
    } catch (err) {
        console.warn("[CV analyze] AI Service tidak tersedia:", err.message);

        const fallback = skillGapSrv.computeFallBackGap(cv.extractedText.jobSkills)
        aiResult = {
            matchScore:  fallback.matchScore,
            skillGap:    fallback.skillGapJson,
            suggestions: fallback.suggestions,
            summary:     fallback.summary,
        }
    }

    res.json({
        message: "analisis selesai",
        aiOnline,
        data: {
            cvId:     cv.id,
            jobId:    job.id,
            jobTitle: job.title,
            ...aiResult,
        },
    });
};

