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

    // Validasi job
    const jobId = parseInt(jobPostingId);
    if (isNaN(jobId)) return R.badRequest(res, "jobPostingId harus berupa angka");

    // Validasi CV
    const [cv, job] = await Promise.all([
        prisma.cvUpload.findUnique({ where: { id: cvUploadId } }),
        prisma.jobPosting.findUnique({
        where:  { id: jobId },
        select: {
            id:                       true,
            title:                    true,
            description:           true,
            skillsDesc:               true,
            location:                 true,
            remoteAllowed:            true,
            formattedWorkType:        true,
            formattedExperienceLevel: true,
            company:    { select: { companyName: true } },
            skills:     { select: { skill: { select: { skillId: true, skillName: true } } } },
            salaries:   { select: { minSalary: true, maxSalary: true, currency: true, payPeriod: true } },
            industries: { select: { industry: { select: { industryName: true } } } },
        },
        }),

    ])
    
    if (!cv) return R.notFound(res, "CV tidak ditemukan");
    if (cv.userId !== userId) return R.forbidden(res, "Akses ditolak");
    if (!cv.extractedText || cv.extractedText.length < CV_MIN_TEXT_LEN) {
        return R.unprocessable(res, {
            error: "Teks CV belum tersedia atau terlalu pendek",
            hint: "Gunakan POST /api/cv/:id/re-extract untuk mencoba ulang ekstraksi teks",
        });
    }
    if (!job) return R.notFound(res, "Job posting tidak ditemukan");

    //menyiapkan skill yang dipaai ai atau fallback
    const jobSkills = skillGapSvc.extractJobSkills(job);
    const jobSkillIds = jobSkills.map((s) => s.skillId);

    // Kirim ke AI Service
    let matchScore = 0, skillGapJson = null, aiOnline = false, suggestions = [], summary = ''

    try {
        const aiData = await aiSvc.predict(cv.extractedText, job, jobSkillIds);
        matchScore = aiData.match_score ?? 0;
        skillGapJson = aiData.skill_gap ?? null;
        aiOnline = true;
        suggestions = aiData.suggestions ?? [];
        summary = aiData.summary ?? '';
    } catch (err) {
        console.warn('[Match] fallback:', err.message)
        const fb  = skillGapSvc.computeFallBackGap(cv.extractedText, jobSkills)
        matchScore  = fb.matchScore; skillGapJson = fb.skillGapJson
        suggestions = fb.suggestion; summary = fb.summary
    }
    // Simpan hasil ke DB
    const [result] = await Promise.all([
        prisma.matchResult.create({
            data:   { userId, cvUploadId, jobPostingId: jobId, matchScore, skillGapJson },
            select: { id: true },
        }),
    ])

    const missingSkillIds = skillGapJson?.missing || []
    const radarChartData  = recSvc.buildRadarChartData(skillGapJson, jobSkills)
    const learningPath    = recSvc.buildLearningPath(missingSkillIds, jobSkills)
    const careerReadiness = recSvc.calcCareerReadiness(matchScore, skillGapJson)

    res.status(201).json({
        message: "Matching selesai",
        aiOnline,
        data: {
            id:         job.id,
            title:      job.title,
            company:    job.company?.companyName || null,
            location:   job.location             || null,
            workType:   job.formattedWorkType    || null,
            level:      job.formattedExperienceLevel || null,
            remote:     (job.remoteAllowed || 0) > 0,
            salary:     job.salaries?.[0]        || null,
            industries: job.industries?.map(i => i.industry?.industryName).filter(Boolean) || [],
        },
    });
};


export const getOne = async (req, res) => {
  const result = await prisma.matchResult.findUnique({
    where:  { id: req.params.id },
    select: {
      id: true, userId: true, matchScore: true, skillGapJson: true, createdAt: true,
      cvUpload:   { select: { id: true, fileName: true } },
      jobPosting: {
        select: {
          id: true, title: true, jobDescription: true, location: true,
          remoteAllowed: true, formattedWorkType: true, formattedExperienceLevel: true,
          company:    { select: { companyName: true, city: true, country: true } },
          skills:     { select: { skill: { select: { skillId: true, skillName: true } } } },
          industries: { select: { industry: { select: { industryName: true } } } },
          salaries:   { select: { minSalary: true, maxSalary: true, currency: true, payPeriod: true } },
          benefits:   { select: { type: true } },
        },
      },
    },
  })

  if (!result)                       return R.notFound(res, 'Hasil matching tidak ditemukan')
  if (result.userId !== req.user.id) return R.forbidden(res, 'Akses ditolak')

  const jobSkills       = skillGapSvc.extractJobSkills(result.jobPosting)
  const radarChartData  = recSvc.buildRadarChartData(result.skillGapJson, jobSkills)
  const missingSkillIds = result.skillGapJson?.missing || []
  const learningPath    = recSvc.buildLearningPath(missingSkillIds, jobSkills)
  const careerReadiness = recSvc.calcCareerReadiness(result.matchScore, result.skillGapJson)

  return R.ok(res, { ...result, careerReadiness, radarChartData, learningPath })
};

// GET /api/match/history
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
            select: {
                id:           true,
                matchScore:   true,
                skillGapJson: true,   
                createdAt:    true,
                jobPosting: {
                    select: {
                        id:                       true,
                        title:                    true,
                        location:                 true,
                        formattedWorkType:        true,
                        formattedExperienceLevel: true,
                        remoteAllowed:            true,
                        company:  { select: { companyName: true } },
                        salaries: { select: { minSalary: true, maxSalary: true, currency: true }, take: 1 },
                    },
                },
                cvUpload: { select: { id: true, fileName: true } },
            },

        }),
        prisma.matchResult.count({ where: { userId: req.user.id } }),
    ]);

    const enriched = results.map(r => ({
        ...r,
        careerReadiness: recSvc.calcCareerReadiness(r.matchScore, r.skillGapJson),
    }))

    return R.paginated(res, enriched, buildMeta(total, page, limit))
};


export const getDashboard = async (req, res) => {
    const userId = req.user.id

  const allResults = await prisma.matchResult.findMany({
    where:   { userId },
    orderBy: { matchScore: 'desc' },
    take:    30,
    select: {
      id:           true,
      matchScore:   true,
      skillGapJson: true,
      jobPosting: {
        select: {
          id:                       true,
          title:                    true,
          location:                 true,
          remoteAllowed:            true,
          formattedWorkType:        true,
          formattedExperienceLevel: true,
          company:  { select: { companyName: true } },
          salaries: { select: { minSalary: true, maxSalary: true, currency: true, payPeriod: true }, take: 1 },
        },
      },
    },
  })

  if (!allResults.length) {
    return R.ok(res, {
      hasData: false,
      message: 'Belum ada riwayat matching. Upload CV dan jalankan matching terlebih dahulu.',
      topJobs: [], averageScore: 0, totalMatched: 0, bestMatch: null,
    })
  }

  const totalMatched = allResults.length
  const averageScore = parseFloat(
    (allResults.reduce((sum, r) => sum + r.matchScore, 0) / totalMatched).toFixed(2)
  )
  const bestMatch    = allResults[0]
  const topJobs      = recSvc.getTopJobRecommendations(allResults)

  const jobSkills  = bestMatch ? skillGapSvc.extractJobSkills(bestMatch.jobPosting) : []
  const radarData  = bestMatch ? recSvc.buildRadarChartData(bestMatch.skillGapJson, jobSkills) : []

  return R.ok(res, {
    hasData: true, totalMatched, averageScore,
    careerReadiness: recSvc.calcCareerReadiness(bestMatch.matchScore, bestMatch.skillGapJson),
    bestMatch: {
      matchResultId: bestMatch.id,
      matchScore:    bestMatch.matchScore,
      jobTitle:      bestMatch.jobPosting.title,
      company:       bestMatch.jobPosting.company?.companyName || null,
      radarChartData: radarData,
      skillGap:      bestMatch.skillGapJson,
    },
    topJobs,
  })

}

export const autoMatch = async (req, res) => {
    const { cvUploadId } = req.body;
    const userId = req.user.id;

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

        return {
            rawJobId: job.id,
            jobId: job.id.toString(),
            jobTitle: job.title,
            company: job.company?.companyName || "Perusahaan Tidak Diketahui",
            location: job.company?.city || "Kota Tidak Diketahui",
            ...matchData,
        };
    });

    const recommendationsRaw = await Promise.all(analysPromises);

    const matchDataToInsert = recommendationsRaw.map((rec) => ({
        userId,
        cvUploadId,
        jobPostingId: rec.rawJobId,
        matchScore: rec.matchScore,
        skillGapJson: rec.skillGap,
    }));

    await prisma.matchResult.createMany({
        data: matchDataToInsert
    });

    const recommendations = recommendationsRaw.map(({ rawJobId, ...rest }) => rest);

    recommendations.sort((a, b) => b.matchScore - a.matchScore);

    return res.status(200).json({
        message: "Matching selesai",
        aiOnline,
        detectedUserSkills: userMatchedSkill.map((s) => s.skillName),
        recommendations: recommendations,
    });
};
