import prisma from "../config/prisma.js";
import R from "../utils/response.js";
import { parsePagination, buildMeta } from "../utils/pagination.js";
import {
    CV_MIN_TEXT_LEN,
    DEFAULT_MATCH_LIMIT,
    MAX_MATCH_LIMIT,
} from "../utils/constants.js";
import pdfSvc from "../services/pdfServices.js";
import aiSvc from "../services/aiServices.js";
import skillGapSvc from "../services/skillGapServices.js";

// POST /api/match
export const run = async (req, res) => {
    const { cvUploadId, jobPostingId } = req.body;
    const userId = req.user.id;

    // Validasi CV
    const cv = await prisma.cvUpload.findUnique({ where: { id: cvUploadId } });
    if (!cv) return R.notFound(res, "CV tidak ditemukan");
    if (cv.userId !== userId) return R.forbidden(res, "Akses ditolak");
    if (!cv.extractedText || cv.extractedText.length < CV_MIN_TEXT_LEN) {
        return R.unprocessable(res, {
            error: "Teks CV belum tersedia atau terlalu pendek",
            hint: "Gunakan POST /api/cv/:id/re-extract untuk mencoba ulang ekstraksi teks",
        });
    }

    // Validasi job
    const jobId = parseInt(jobPostingId);
    if (isNaN(jobId)) return R.badRequest(res, "jobPostingId harus berupa angka");

    const job = await prisma.jobPosting.findUnique({
        where: { id: jobId },
        include: { skills: { include: { skill: true } } },
    });
    if (!job) return R.notFound(res, "Job posting tidak ditemukan");

    //menyiapkan skill yang dipaai ai atau fallback
    const jobSkills = skillGapSvc.extractJobSkills(job);
    const jobSkillIds = jobSkills.map((s) => s.skillId);

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
        const fallback = skillGapSvc.computeFallBackGap(
            cv.extractedText,
            jobSkills,
        );
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
    if (!result) return R.notFound(res, "Hasil matching tidak ditemukan");
    if (result.userId !== req.user.id) return R.forbidden(res, "Akses ditolak");
    return R.ok(res, result);
};

export const getHistory = async (req, res) => {
    const { page, limit, skip } = parsePagination(
        req.query,
        DEFAULT_MATCH_LIMIT,
        MAX_MATCH_LIMIT,
    );

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

export const autoMatch = async (req, res) => {
    const { cvUploadId } = req.body;
    const userId = req.user.id;

    // --- OPTIMASI 1: PARALEL DATABASE FETCH ---
    // Mengambil data CV dan master Skill secara bersamaan untuk memangkas waktu tunggu kabel bawah laut
    const [cv, allskill] = await Promise.all([
        prisma.cvUpload.findUnique({ where: { id: cvUploadId } }),
        prisma.skill.findMany()
    ]);

    if (!cv) return R.notFound(res, "cv tidak di temukan");
    if (cv.userId !== userId) return R.forbidden(res, "Akses ditolak");
    if (!cv.extractedText || cv.extractedText.length < CV_MIN_TEXT_LEN) {
        return R.unprocessable(res, "Teks CV belum tersedia atau terlalu pendek");
    }

    const cvTextLower = cv.extractedText.toLowerCase();

    const userMatchedSkill = allskill.filter((s) => {
        if (!s.skillName) return false;
        return cvTextLower.includes(s.skillName.toLowerCase());
    });

    const userSkillIds = userMatchedSkill.map((s) => s.skillId);

    if (userSkillIds.length === 0) {
        return R.badRequest(res, "Tidak ada skill yang cocok");
    }

    const candidateJobs = await prisma.jobPosting.findMany({
        where: {
            skills: {
                some: {
                    skillId: {
                        in: userSkillIds,
                    },
                },
            },
        },
        include: {
            company: {
                select: {
                    companyName: true,
                    city: true,
                },
            },
            skills: {
                include: {
                    skill: true,
                },
            },
        },
        take: 50,
    });

    if (candidateJobs.length === 0) {
        return R.notFound(res, "Tidak ada job/lowongan yang cocok");
    }

    const sortedCandidates = candidateJobs
        .map((job) => {
            const jobSkillIds = job.skills.map((s) => s.skillId);
            const intersect = jobSkillIds.filter((id) => userSkillIds.includes(id));
            return {
                ...job,
                preMatchScore: intersect.length,
            };
        })
        .sort((a, b) => b.preMatchScore - a.preMatchScore);

    const top5Jobs = sortedCandidates.slice(0, 5);

    let aiOnline = true;
    const analysPromises = top5Jobs.map(async (job) => {
        const jobSkills = skillGapSvc.extractJobSkills(job);
        const jobSkillIds = jobSkills.map((s) => s.skillId);

        let matchData;
        try {
            const aiRaw = await aiSvc.analyze(cv.extractedText, job, jobSkillIds);
            matchData = {
                matchScore: aiRaw.match_score ?? 0,
                skillGap: aiRaw.skill_gap ?? null,
                suggestions: aiRaw.suggestions ?? [],
            };
        } catch (err) {
            aiOnline = false;
            console.warn(`[AutoMatch] AI gagal untuk job ${job.id}, fallback jalan.`);

            const fallback = skillGapSvc.computeFallBackGap(
                cv.extractedText,
                jobSkills,
            );
            matchData = {
                matchScore: fallback.matchScore,
                skillGap: fallback.skillGapJson,
                suggestions: fallback.suggestion,
            };
        }

        // KITA HAPUS prisma.create DARI SINI AGAR TIDAK SPAM KE DATABASE

        return {
            rawJobId: job.id, // Simpan ID asli (BigInt) untuk disimpan ke Database nanti
            jobId: job.id.toString(), // Ubah jadi String untuk di-return jadi JSON
            jobTitle: job.title,
            company: job.company?.companyName || "Perusahaan Tidak Diketahui",
            location: job.company?.city || "Kota Tidak Diketahui",
            ...matchData,
        };
    });

    // Tunggu semua proses skoring selesai
    const recommendationsRaw = await Promise.all(analysPromises);

    // --- OPTIMASI 2: BATCH INSERT DATABASE ---
    // Kumpulkan semua data yang mau disimpan, lalu tembak Database 1 KALI SAJA
    const matchDataToInsert = recommendationsRaw.map((rec) => ({
        userId,
        cvUploadId,
        jobPostingId: rec.rawJobId, // Gunakan BigInt asli
        matchScore: rec.matchScore,
        skillGapJson: rec.skillGap,
    }));

    await prisma.matchResult.createMany({
        data: matchDataToInsert
    });

    // Format data final sebelum dikirim (buang properti rawJobId agar JSON bersih)
    const recommendations = recommendationsRaw.map(({ rawJobId, ...rest }) => rest);

    recommendations.sort((a, b) => b.matchScore - a.matchScore);

    return res.status(200).json({
        message: "Matching selesai",
        aiOnline,
        detectedUserSkills: userMatchedSkill.map((s) => s.skillName),
        recommendations: recommendations,
    });
};
