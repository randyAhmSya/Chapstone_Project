import prisma from "../config/prisma.js";
import R from "../utils/response.js";
import { parsePagination, buildMeta } from "../utils/pagination.js";
import {
    DEFAULT_JOB_LIMIT,
    MAX_JOB_LIMIT,
    CACHE_TTL,
    jobDetailsCache,
    STATS_CACHE_DURATION,
    SKILLS_TTL,
    INDUSTRIES_TTL,
    STATS_TTL,
} from "../utils/constants.js";
import { getOrSet } from "../utils/cache.js";

let cachedStats = null;
let statsLastUpdated = null;

export const getAll = async (req, res) => {
    const { page, limit, skip } = parsePagination(
        req.query,
        DEFAULT_JOB_LIMIT,
        MAX_JOB_LIMIT,
    );

    const { search, location, skill, industry, remote, level, company } =
        req.query;

    const where = {};

    if (search) {
        where.OR = [
            { title: { contains: search, mode: "insensitive" } },
            { company: { companyName: { contains: search, mode: "insensitive" } } },
            { skillsDesc: { contains: search, mode: "insensitive" } },
        ];
    }
    if (location) where.location = { contains: location, mode: "insensitive" };

    if (remote === "true") where.remoteAllowed = { gt: 0 };

    if (level)
        where.formattedExperienceLevel = { contains: level, mode: "insensitive" };

    if (company)
        where.company = { companyName: { contains: company, mode: "insensitive" } };

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
    const skills = await getOrSet(
        "jobs:skills",
        () => prisma.skill.findMany({ orderBy: { skillName: "asc" } }),
        SKILLS_TTL,
    );
    return R.ok(res, skills);
};

export const getIndustries = async (req, res) => {
    const { search } = req.query;
    if (search) {
        const industries = await prisma.industry.findMany({
            where: {
                industryName: {
                    contains: search,
                    mode: "insensitive",
                },
            },
            orderBy: { industryName: "asc" },
            take: 50,
        });
        return R.ok(res, industries);
    }
    const industries = await getOrSet(
        "jobs:industries",
        () => prisma.industry.findMany({where: {industryName: {not: null}}, orderBy: { industryName: "asc" } }),
        INDUSTRIES_TTL,
    );
    return R.ok(res, industries);
};

export const getOne = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return R.badRequest(res, "Invalid job ID");

    const job = await prisma.jobPosting.findUnique({
    where:  { id },
    select: {
      id:                       true,
      title:                    true,
      jobDescription:           true,
      skillsDesc:               true,
      location:                 true,
      remoteAllowed:            true,
      formattedWorkType:        true,
      formattedExperienceLevel: true,
      applies:                  true,
      listedTime:               true,
      sponsored:                true,
      company: {
        select: { companyName: true, city: true, country: true, companySize: true,
                  employeeCount: true, followerCount: true, companyUrl: true },
      },
      skills:     { select: { skill: { select: { skillId: true, skillName: true } } } },
      industries: { select: { industry: { select: { industryId: true, industryName: true } } } },
      salaries:   { select: { minSalary: true, maxSalary: true, medSalary: true, payPeriod: true, currency: true } },
      benefits:   { select: { type: true } },
    },
  })
  if (!job) return R.notFound(res, 'Job posting tidak ditemukan')

  return R.ok(res, job)
};

export const getStats = async (req, res) => {
    const stats = await getOrSet('jobs:stats', async () => {
    const [
      totalJobs, totalCompanies, remoteJobs,
      topSkillsRaw, topIndustriesRaw,
      experienceLevels, workTypes,
    ] = await Promise.all([
      prisma.jobPosting.count(),
      prisma.company.count(),
      prisma.jobPosting.count({ where: { remoteAllowed: { gt: 0 } } }),
      prisma.jobSkill.groupBy({
        by: ['skillId'], _count: { skillId: true },
        orderBy: { _count: { skillId: 'desc' } }, take: 10,
      }),
      prisma.jobIndustry.groupBy({
        by: ['industryId'], _count: { industryId: true },
        orderBy: { _count: { industryId: 'desc' } }, take: 10,
      }),
      prisma.jobPosting.groupBy({
        by: ['formattedExperienceLevel'], _count: { formattedExperienceLevel: true },
        where: { formattedExperienceLevel: { not: null } },
        orderBy: { _count: { formattedExperienceLevel: 'desc' } },
      }),
      prisma.jobPosting.groupBy({
        by: ['formattedWorkType'], _count: { formattedWorkType: true },
        where: { formattedWorkType: { not: null } },
        orderBy: { _count: { formattedWorkType: 'desc' } },
      }),
    ])

    // OPTIMASI: resolve skill + industry name
    const skillIds   = topSkillsRaw.map(s => s.skillId)
    const industryIds = topIndustriesRaw.map(i => i.industryId).filter(Boolean)

    const [skillNames, indNames] = await Promise.all([
      skillIds.length
        ? prisma.skill.findMany({ where: { skillId: { in: skillIds } }, select: { skillId: true, skillName: true } })
        : [],
      industryIds.length
        ? prisma.industry.findMany({ where: { industryId: { in: industryIds } }, select: { industryId: true, industryName: true } })
        : [],
    ])

    const skillMap = Object.fromEntries(skillNames.map(s => [s.skillId, s.skillName]))
    const indMap   = Object.fromEntries(indNames.map(i => [i.industryId, i.industryName]))

    return {
      summary: {
        totalJobs, totalCompanies, remoteJobs,
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
    }
  }, STATS_TTL)

  return R.ok(res, stats)

};
