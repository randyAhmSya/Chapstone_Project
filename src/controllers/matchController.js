import prisma from "../config/prisma.js";
import R from "../utils/response.js";
import { parsePagination, buildMeta } from "../utils/pagination.js"
import { DEFAULT_MATCH_LIMIT,MAX_MATCH_LIMIT } from "../utils/constants.js"
import pdfSvc from "../services/pdfServices.js"
import aiSvc from "../services/aiServices.js"
import skillGapSvc from "../services/skillGapServices.js"

// POST /api/match
export const run = async (req, res) => {
    const { cvUploadId, jobPostingId } = req.body;
    const userId = req.user.id;

    // Validasi CV
    const cv = await prisma.cvUpload.findUnique({ where: { id: cvUploadId } });
    if (!cv) return R.notFound(res, "CV tidak ditemukan");
    if (cv.userId !== userId)
        return R.forbidden(res, "Akses ditolak");
    if (!cv.extractedText || cv.extractedText.length < MIN_TEXT_LEN) {
        return R.unprocessable(res, {
            error: "Teks CV belum tersedia atau terlalu pendek",
            hint: "Gunakan POST /api/cv/:id/re-extract untuk mencoba ulang ekstraksi teks",
        });
    }

    // Validasi job
    const jobId = parseInt(jobPostingId);
    if (isNaN(jobId))
        return R.badRequest(res, "jobPostingId harus berupa angka");

    const job = await prisma.jobPosting.findUnique({
        where: { id: jobId },
        include: { skills: { include: { skill: true } } },
    });
    if (!job)
        return R.notFound(res, "Job posting tidak ditemukan");

    //menyiapkan skill yang dipaai ai atau fallback
    const jobSkills = skillGapSvc.extractJobSkills(job)
    const jobSkillIds = jobSkills.map(s => s.skillId)

    // Kirim ke AI Service
    let matchScore = 0;
    let skillGapJson = null;
    let aiOnline = false;

    try {
        const aiData = await aiSvc.predict(cv.extractedText, job, jobSkillIds);
        matchScore = aiData.match_score ?? 0;
        skillGapJson = aiData.skill_gap ?? null;
        aiOnline = true;
    } catch (err) {
        console.warn("[Match] AI Service tidak tersedia:", err.message);
        // Fallback logika terpusat di skillGapService
        const fallback = skillGapSvc.computeFallBackGap(cv.extractedText, jobSkills);
        matchScore = fallback.matchScore;
        skillGapJson = fallback.skillGapJson;
    }
    // Simpan hasil ke DB
    const result = await prisma.matchResult.create({
        data: { userId, cvUploadId, jobPostingId: jobId, matchScore, skillGapJson },
        include: {
            jobPosting: {
                select: {
                    id: true,
                    title: true,
                    company: { select: { companyName: true } },
                },
            },
        },
    });

    res.status(201).json({
        message: "Matching selesai",
        aiOnline,
        data: result,
    });
};

// GET /api/match/history
export const getOne = async (req, res) => {
    const result = await prisma.matchResult.findUnique({
        where: { id: req.params.id },
        include: {
            cvUpload: { select: { id: true, fileName: true } },
            jobPosting: {
                include: {
                    company: true,
                    skills: { include: { skill: true } },
                    industries: { include: { industry: true } },
                    salaries: true,
                    benefits: true,
                },
            },
        },
    });
    if (!result)
        return R.notFound(res, "Hasil matching tidak ditemukan");
    if (result.userId !== req.user.id)
        return R.forbidden(res, "Akses ditolak");
    return R.ok(res, { data: result });
};

export const getHistory = async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, DEFAULT_MATCH_LIMIT, MAX_MATCH_LIMIT);

    const [results, total] = await Promise.all([
        prisma.matchResult.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            include: {
                jobPosting: {
                    select: {
                        id: true,
                        title: true,
                        location: true,
                        formattedExperienceLevel: true,
                        company: { select: { companyName: true } },
                    },
                },
                cvUpload: { select: { id: true, fileName: true } },
            },
        }),
        prisma.matchResult.count({ where: { userId: req.user.id } }),
    ]);

    return R.pagination(res, results, buildMeta(total, page, limit));

    // res.json({
    //     data: results,
    //     meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    // });
};
