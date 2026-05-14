import prisma from "../config/prisma.js";
import pdfsrv from "../services/pdfServices.js";
import R from "../utils/response.js";
import storageSrv from "../services/storageService.js";
import skillGapSvc from "../services/skillGapServices.js";
import aiSvc from "../services/aiServices.js";
import recSrv from "../services/recommendationsServices.js";

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
                fileUrl: publicUrl,
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

    return R.ok(
        res,
        cvs.map((cv) => ({
            id: cv.id,
            fileName: cv.fileName,
            fileUrl: cv.fileUrl,
            uploadedAt: cv.uploadedAt,
            textExtracted: pdfsrv.isTextValid(cv.extractedText),
        })),
    );
};

export const getOne = async (req, res) => {
    const cv = await prisma.cvUpload.findUnique({ where: { id: req.params.id } });
    if (!cv) return R.notFound(res, "CV tidak ditemukan");
    if (cv.userId !== req.user.id)
        return R.forbidden(res, "Anda tidak memiliki akses ke CV ini");

    return R.ok(res, {
        ...cv,
        textExtracted: pdfsrv.isTextValid(cv.extractedText),
        textLength: cv.extractedText?.length || 0,
    });
};

export const remove = async (req, res) => {
    const cv = await prisma.cvUpload.findUnique({ where: { id: req.params.id } });
    if (!cv) return R.notFound(res, "CV tidak ditemukan");
    if (cv.userId !== req.user.id) return R.forbidden(res, "Akses ditolak");

    await storageSrv.deleteCv(cv.storagePath);

    await prisma.cvUpload.delete({ where: { id: req.params.id } });
    return R.ok(res, "CV berhasil dihapus");
};

// POST /api/cv/:id/re-extract — coba ekstraksi ulang
export const reExtract = async (req, res) => {
    const cv = await prisma.cvUpload.findUnique({ where: { id: req.params.id } });
    if (!cv) return R.notFound(res, "CV tidak ditemukan");
    if (cv.userId !== req.user.id) return R.forbidden(res, "Akses ditolak");

    let buffer;
    try {
        buffer = await storageSrv.downloadCv(cv.storagePath);
    } catch (err) {
        return R.serverError(res, "Gagal mengunduh file CV");
    }

    const { text: extractedText, reason: extractReason } =
        await pdfsrv.extractTextFromBuffer(buffer);

    if (!extractedText) {
        return R.unprocessable(
            res,
            "gagal mengekstrak teks dari pdf",
            extractReason,
        );
    }

    //update
    await prisma.cvUpload.update({
        where: { id: cv.id },
        data: { extractedText },
    });

    return R.ok(
        res,
        { textLength: extractedText.length },
        "Teks berhasil diekstrak ulang",
    );
};

export const analyze = async (req, res) => {
    const { cvUploadId, jobPostingId } = req.body;
    const userId = req.user.id;

    const cv = await prisma.cvUpload.findUnique({ where: { id: cvUploadId } });
    if (!cv) return R.notFound(res, "CV tidak ditemukan");
    if (cv.userId !== userId) return R.forbidden(res, "Akses ditolak");
    if (!pdfsrv.isTextValid(cv.extractedText)) {
        return R.unprocessable(
            res,
            "Teks CV belum tersedia atau terlalu pendek",
            "Coba upload ulang atau gunakan POST /api/cv/:id/re-extract",
        );
    }

    const job = await prisma.jobPosting.findUnique({
        where: { id: parseInt(jobPostingId) },
        include: {
            skills: { include: { skill: true } },
            company: true,
            salaries: true,
        },
    });
    if (!job) return R.notFound(res, "Job posting tidak ditemukan");

    const jobSkills = skillGapSvc.extractJobSkills(job);
    const jobSkillIds = jobSkills.map((s) => s.skillId);

    let aiOnline = false;
    let matchScore = 0,
        skillGap = null,
        suggestions = [],
        summary = "";

    try {
        const aiRaw = await aiSvc.analyze(cv.extractedText, job, jobSkillIds);
        aiOnline = true;
        matchScore = aiRaw.match_score ?? 0;
        skillGap = aiRaw.skill_gap ?? null;
        suggestions = fb.suggestions || fb.suggestion || [];
        summary = aiRaw.summary ?? "";
    } catch (err) {
        console.warn("[CV Analyze] AI Service tidak tersedia:", err.message);
        const fb = skillGapSvc.computeFallBackGap(cv.extractedText, jobSkills);
        matchScore = fb.matchScore;
        skillGap = fb.skillGapJson;
        suggestions = fb.suggestions;
        summary = fb.summary;
    }

    // Minggu 4: tambah radar + learning path ke response analyze
    const missingSkillIds = skillGap?.missing || [];
    const radarChartData = recSrv.buildRadarChartData(skillGap, jobSkills);
    const learningPath = recSrv.buildLearningPath(missingSkillIds, jobSkills);
    const careerReadiness = recSrv.calcCareerReadiness(matchScore, skillGap);

    return res.json({
        message: "Analisis selesai",
        aiOnline,
        data: {
            cvId: cv.id,
            jobId: job.id,
            jobTitle: job.title,
            company: job.company?.companyName || null,
            matchScore,
            careerReadiness,
            summary,
            skillGap,
            suggestions,
            radarChartData,
            learningPath,
        },
    });
};
