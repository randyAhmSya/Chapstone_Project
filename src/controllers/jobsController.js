import prisma from "../config/prisma.js";

export const getAll = async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const { search, location, skill, industry, remote, level } = req.query;

    const where = {};

    if (search) {
        where.OR = [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
        ];
    }
    if (location) {
        where.location = { contains: location, mode: "insensitive" };
    }
    if (remote === "true") {
        where.remoteAllowed = { gt: 0 };
    }
    if (level) {
        where.experienceLevel = { contains: level, mode: "insensitive" };
    }

    if (skill) {
        where.skills = {
            some: {
                skill: {
                    skillName: { contains: skill, mode: "insensitive" },
                },
            },
        };
    }
    if (industry) {
        where.industries = {
            some: {
                industry: {
                    industryName: { contains: industry, mode: "insensitive" },
                },
            },
        };
    }

    const [jobs, total] = await Promise.all([
        prisma.jobPosting.findMany({
            where,
            skip,
            take: limit,
            orderBy: { listedTime: "desc" },
            select: {
                id: true,
                title: true,
                description: true,
                location: true,
                remoteAllowed: true,
                workType: true,
                formattedWorkType: true,
                formattedExperienceLevel: true,
                listedTime: true,
                company: {
                    select: {
                        id: true,
                        companyName: true,
                        city: true,
                        country: true,
                    },
                },
                skills: {
                    select: {
                        skill: {
                            select: {
                                skillId: true,
                                skillName: true,
                            },
                        },
                    },
                },
                salaries: {
                    select: {
                        minSalary: true,
                        maxSalary: true,
                        medSalary: true,
                        payPeriod: true,
                        currency: true,
                    },
                },
            },
        }),
        prisma.jobPosting.count({ where }),
    ]);
    res.json({
        data: jobs,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
};

export const getSkills = async (req, res) => {
    const skills = await prisma.skill.findMany({
        orderBy: { skillName: "asc" },
    });
    res.json({ data: skills });
};

export const getIndustries = async (req, res) => {
    const { search } = req.query;
    const where = search
        ? { industryName: { contains: search, mode: "insensitive" } }
        : { industryName: { not: null } };
    const industries = await prisma.industry.findMany({
        where,
        orderBy: { industryName: "asc" },
    });
    res.json({ data: industries });
};

export const getOne = async (req, res) => {
    let jobId;
    try {
        jobId = BigInt(req.params.id);
    } catch (e) {
        return res.status(400).json({ error: "Format ID pekerjaan tidak valid" });
    }
    const job = await prisma.jobPosting.findUnique({
        where: { id: jobId },
        include: {
            company: true,
            skills: { include: { skill: true } },
            industries: { include: { industry: true } },
            salaries: true,
            benefits: true,
        },
    });
    if (!job)
        return res.status(404).json({ error: "Job posting tidak di temukan" });
    res.json({ data: job });
};

export const getStats = async (req, res) => {
    const [
        totalJobs,
        totalCompanies,
        remoteJobs,
        topSkills,
        topIndustries,
        experienceLevels,
        workTypes,
    ] = await Promise.all([
        prisma.jobPosting.count(),
        prisma.company.count(),
        prisma.jobPosting.count({ where: { remoteAllowed: { gt: 0 } } }),

        prisma.jobSkill.groupBy({
            by: ["skillId"],
            _count: { skillId: true },
            orderBy: { _count: { skillId: "desc" } },
            take: 10,
        }),

        prisma.jobIndustry.groupBy({
            by: ["industryId"],
            _count: { industryId: true },
            orderBy: { _count: { industryId: "desc" } },
            take: 10,
        }),

        prisma.jobPosting.groupBy({
            by: ["formattedExperienceLevel"],
            _count: { formattedExperienceLevel: true },
            where: { formattedExperienceLevel: { not: null } },
            orderBy: { _count: { formattedExperienceLevel: "desc" } },
        }),

        prisma.jobPosting.groupBy({
            by: ["formattedWorkType"],
            _count: { formattedWorkType: true },
            where: { formattedWorkType: { not: null } },
            orderBy: { _count: { formattedWorkType: "desc" } },
        }),
    ]);
    const skillIds = topSkills.map((s) => s.skillId);
    const skillNames = await prisma.skill.findMany({
        where: { skillId: { in: skillIds } },
        select: { skillId: true, skillName: true },
    });
    const skillMap = Object.fromEntries(
        skillNames.map((s) => [s.skillId, s.skillName]),
    );

    const indIds = topIndustries.map((i) => i.industryId).filter(Boolean);
    const indNames = await prisma.industry.findMany({
        where: { industryId: { in: indIds } },
        select: { industryId: true, industryName: true },
    });
    const indMap = Object.fromEntries(
        indNames.map((i) => [i.industryId, i.industryName]),
    );

    res.json({
        data: {
            summary: {
                totalJobs,
                totalCompanies,
                remoteJobs,
                remotePercentage:
                    totalJobs > 0 ? Math.round((remoteJobs / totalJobs) * 100) : 0,
            },
            topSkills: topSkills.map((s) => ({
                skillId: s.skillId,
                skillName: skillMap[s.skillId] || s.skillId,
                count: s._count.skillId,
            })),

            topIndustries: topIndustries.map((i) => ({
                industryId: i.industryId,
                industryName: indMap[i.industryId] || String(i.industryId),
                count: i._count.industryId,
            })),

            experienceLevels: experienceLevels.map((e) => ({
                level: e.formattedExperienceLevel,
                count: e._count.formattedExperienceLevel,
            })),

            workTypes: workTypes.map((w) => ({
                type: w.formattedWorkType,
                count: w._count.formattedWorkType,
            })),
        },
    });
};
