import prisma from "../config/prisma.js";
import R from "../utils/response.js";
import { parsePagination, buildMeta } from "../utils/pagination.js"
import { DEFAULT_JOB_LIMIT, MAX_JOB_LIMIT } from "../utils/constants.js"

export const getAll = async (req, res) => {
    const {page, limit, skip} = parsePagination(req.query, DEFAULT_JOB_LIMIT, MAX_JOB_LIMIT)

    const { search, location, skill, industry, remote, level, company } = req.query;

    const where = {};

    if (search) {
        where.OR = [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { skillsDesc: { contains: search, mode: "insensitive" } }
        ];
    }
    if (location) 
        where.location = { contains: location, mode: "insensitive" };
    
    if (remote === "true") 
        where.remoteAllowed = { gt: 0 };
    
    if (level) 
        where.formattedExperienceLevel = { contains: level, mode: "insensitive" };
    
    if(company) where.company = { companyName: { contains: company, mode: "insensitive" } };

    if (skill) 
        where.skills = {
            some: {
                skill: {
                    skillName: { contains: skill, mode: "insensitive" },
                },
            },
        };
    
    if (industry) 
        where.industries = {
            some: {
                industry: {
                    industryName: { contains: industry, mode: "insensitive" },
                },
            },
        };
    

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
                formattedWorkType: true,
                formattedExperienceLevel: true,
                applies: true,
                listedTime: true,
                sponsored: true,
                company: {
                    select: {
                        id: true,
                        companyName: true,
                        city: true,
                        country: true,
                        companySize: true,
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
    return R.pagination(res, jobs, buildMeta(total, page, limit));
};

export const getSkills = async (req, res) => {
    const skills = await prisma.skill.findMany({
        orderBy: { skillName: "asc" },
    });
    return R.ok(res, skills);
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
    return R.ok(res, industries);
};

export const getOne = async (req, res) => {
    
    const id = parseInt(req.params.id);

    if(isNaN(id)) return R.badRequest(res, "Invalid job ID");

    const job = await prisma.jobPosting.findUnique({
        where: { id: id },
        include: {
            company: true,
            skills: { include: { skill: true } },
            industries: { include: { industry: true } },
            salaries: true,
            benefits: true,
        },
    });
    if (!job)
        return R.notFound(res, "Job posting tidak di temukan");
    return R.ok(res, job);
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

    // Resolve nama skill & industri secara paralel
    const [skillNames, indNames] = await Promise.all([
        prisma.skill.findMany({
        where:  { skillId: { in: topSkillsRaw.map(s => s.skillId) } },
        select: { skillId: true, skillName: true },
        }),
        prisma.industry.findMany({
        where:  { industryId: { in: topIndustriesRaw.map(i => i.industryId).filter(Boolean) } },
        select: { industryId: true, industryName: true },
        }),
    ])

    const skillMap = Object.fromEntries(skillNames.map(s => [s.skillId, s.skillName]))
    const indMap   = Object.fromEntries(indNames.map(i => [i.industryId, i.industryName]))

    return R.ok(res, {
        summary: {
        totalJobs,
        totalCompanies,
        remoteJobs,
        remotePercentage: totalJobs > 0 ? Math.round((remoteJobs / totalJobs) * 100) : 0,
        },
        topSkills: topSkillsRaw.map(s => ({
        skillId:   s.skillId,
        skillName: skillMap[s.skillId] || s.skillId,
        count:     s._count.skillId,
        })),
        topIndustries: topIndustriesRaw.map(i => ({
        industryId:   i.industryId,
        industryName: indMap[i.industryId] || String(i.industryId),
        count:        i._count.industryId,
        })),
        experienceLevels: experienceLevels.map(e => ({
        level: e.formattedExperienceLevel,
        count: e._count.formattedExperienceLevel,
        })),
        workTypes: workTypes.map(w => ({
        type:  w.formattedWorkType,
        count: w._count.formattedWorkType,
        })),
    })

};
