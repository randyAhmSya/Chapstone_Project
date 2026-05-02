import prisma from "../config/prisma.js";

const AI_TIMEOUT = 30_000;
const MIN_TEXT_LEN = 50;

export const run = async (req, res) => {
    const { cvUploadId, jobPostingId } = req.body;
    const userId = req.user.id;

    // Validasi CV
    const cv = await prisma.cvUpload.findUnique({ where: { id: cvUploadId } });
    if (!cv) return res.status(404).json({ error: "CV tidak ditemukan" });
    if (cv.userId !== userId)
        return res.status(403).json({ error: "Akses ditolak" });
    if (!cv.extractedText || cv.extractedText.length < MIN_TEXT_LEN) {
        return res.status(422).json({
            error: "Teks CV belum tersedia atau terlalu pendek",
            hint: "Gunakan POST /api/cv/:id/re-extract untuk mencoba ulang ekstraksi teks",
        });
    }

    // Validasi job
    const jobId = parseInt(jobPostingId);
    if (isNaN(jobId))
        return res.status(400).json({ error: "jobPostingId harus berupa angka" });

    const job = await prisma.jobPosting.findUnique({
        where: { id: jobId },
        include: { skills: { include: { skill: true } } },
    });
    if (!job)
        return res.status(404).json({ error: "Job posting tidak ditemukan" });

    // Kirim ke AI Service
    let matchScore = 0;
    let skillGapJson = null;
    let aiOnline = false;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);

        const aiRes = await fetch(`${process.env.AI_SERVICE_URL}/predict`, {
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

        const aiData = await aiRes.json();
        matchScore = aiData.match_score ?? 0;
        skillGapJson = aiData.skill_gap ?? null;
        aiOnline = true;
    } catch (err) {
        console.warn("[Match] AI Service tidak tersedia:", err.message);
        // Fallback berbasis keyword matching
        const cvLower = cv.extractedText.toLowerCase();
        const required = job.skills.map((s) => s.skill);
        const present = required.filter(
            (s) =>
                cvLower.includes(s.skillName.toLowerCase()) ||
                cvLower.includes(s.skillId.toLowerCase()),
        );
        const missing = required.filter(
            (s) =>
                !cvLower.includes(s.skillName.toLowerCase()) &&
                !cvLower.includes(s.skillId.toLowerCase()),
        );

        matchScore =
            required.length > 0
                ? parseFloat((present.length / required.length).toFixed(2))
                : 0;
        skillGapJson = {
            note: "Analisis fallback — AI Service belum aktif (aktif Minggu 4)",
            present: present.map((s) => s.skillId),
            missing: missing.map((s) => s.skillId),
            required: required.map((s) => s.skillId),
        };
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
        return res.status(404).json({ error: "Hasil matching tidak ditemukan" });
    if (result.userId !== req.user.id)
        return res.status(403).json({ error: "Akses ditolak" });
    res.json({ data: result });
};

export const getHistory = async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

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

    res.json({
        data: results,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
};
