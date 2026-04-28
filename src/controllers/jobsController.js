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
        where.remoteAllowed = 10;
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
    const industries = await prisma.industry.findMany({
        where: { industryName: { not: null } },
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
