import prisma from "../config/prisma.js";

export const run = async (req, res) => {
    const { cvUploadId, jobPostingId } = req.body;
    const userId = req.user.id;

    if (!cvUploadId || !jobPostingId) {
        return res
            .status(400)
            .json({ error: "cvUploadId and jobPostingId wajib di isi" });
    }
    let parsedJobId;
    try {
        parsedJobId = BigInt(jobPostingId);
    } catch (e) {
        return res.status(400).json({ error: "Format jobPostingId tidak valid" });
    }

    const cv = await prisma.cvUpload.findUnique({ where: { id: cvUploadId } });
    if (!cv) return res.status(404).json({ error: "cvUpload tidak ditemukan" });
    if (cv.userId !== userId)
        return res.status(403).json({ error: "Akses ditolak" });
    if (!cv.extractedText)
        return res.status(422).json({ error: "CV belum di ekstrak" });

    const job = await prisma.jobPosting.findUnique({
        where: { id: parsedJobId },
        include: {
            skills: { include: { skill: true } },
        },
    });
    if (!job)
        return res.status(404).json({ error: "jobPosting tidak ditemukan" });

    //AI Service FastAPI
    let matchScore = 0;
    let skillGapJson = null;
    let aiOnline = false;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);

        const aiRes = await fetch(`${process.env.AI_SERVICE}/predict`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                cv_text: cv.extractedText,
                job_description: job.description,
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!aiRes.ok) throw new Error(`AI service status: ${aiRes.status}`);
        const aiData = await aiRes.json();

        matchScore = aiData.match_score ?? 0;
        skillGapJson = aiData.skill_gap ?? null;
        aiOnline = true;
    } catch (err) {
        // AI Service belum aktif — tidak crash, simpan dummy
        console.warn("[matchController] AI Service tidak tersedia:", err.message);
        //ini 85 untuk testing saja asli nya 0
        matchScore = 85;
        // matchScore = 0;
        skillGapJson = {
            note: "AI Service belum aktif — akan terhubung Minggu 4",
            present: [],
            missing: job.skills.map((s) => s.skill.skillId),
            required: job.skills.map((s) => s.skill.skillId),
        };
    }

    const result = await prisma.matchResult.create({
        data: {
            userId,
            cvUploadId,
            jobPostingId: parsedJobId,
            matchScore,
            skillGapJson,
        },
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
        message: "matching berhasil",
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
