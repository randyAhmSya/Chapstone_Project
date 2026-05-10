import prisma from "../config/prisma.js";
import R from "../utils/response.js";
import { parsePagination, buildMeta } from "../utils/pagination.js";
import {
    DEFAULT_JOB_LIMIT,
    MAX_JOB_LIMIT,
    CACHE_TTL,
    jobDetailsCache,
    STATS_CACHE_DURATION,
} from "../utils/constants.js";

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
            // { title: { contains: search, mode: "insensitive" } },
            // { description: { contains: search, mode: "insensitive" } },
            // { skillsDesc: { contains: search, mode: "insensitive" } }
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
    if (isNaN(id)) return R.badRequest(res, "Invalid job ID");

    // --- STRATEGI 1: CEK CACHE (INSTANT RESPONSE) ---
    const cachedData = jobDetailsCache.get(id);
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
        console.log(`[CACHE HIT] Mengirim Job ID ${id} dari memori RAM (300ms)`);
        return R.ok(res, cachedData.job);
    }

    try {
        console.log(
            `[CACHE MISS] Mengambil Job ID ${id} dengan Query Splitting...`,
        );

        // --- STRATEGI 2: QUERY SPLITTING (MEMANGKAS 5 DETIK KE ~2 DETIK) ---
        // Ambil data dasar dulu untuk cek keberadaan Job
        const jobBase = await prisma.jobPosting.findUnique({
            where: { id },
            include: {
                company: {
                    select: {
                        id: true,
                        companyName: true,
                        city: true,
                        url: true, // <-- Ganti logoUrl dengan url (karena kolom ini ada di database-mu)
                        companySize: true, // (Opsional) Tambahan data yang mungkin berguna
                    },
                },
            },
        });

        if (!jobBase) return R.notFound(res, "Job posting tidak ditemukan");

        // Ambil semua data relasi secara PARALEL dalam satu waktu tunggu jaringan
        const [skills, industries, salaries, benefits] = await Promise.all([
            prisma.jobSkill.findMany({
                where: { jobPostingId: id },
                include: { skill: true },
            }),
            prisma.jobIndustry.findMany({
                where: { jobPostingId: id },
                include: { industry: true },
            }),
            prisma.salary.findMany({ where: { jobPostingId: id } }),
            prisma.benefit.findMany({ where: { jobPostingId: id } }),
        ]);

        // Gabungkan semua hasil query menjadi satu objek utuh
        const finalJob = {
            ...jobBase,
            skills,
            industries,
            salaries,
            benefits,
        };

        // --- STRATEGI 3: SIMPAN KE CACHE UNTUK PENGGUNA BERIKUTNYA ---
        jobDetailsCache.set(id, {
            job: finalJob,
            timestamp: Date.now(),
        });

        return R.ok(res, finalJob);
    } catch (error) {
        console.error("Error pada getOne:", error);
        return R.fail(res, 500, "Gagal mengambil detail pekerjaan");
    }
};

export const getStats = async (req, res) => {
    // 1. CEK CACHE: Apakah datanya sudah ada di RAM dan umurnya masih di bawah 5 menit?
    if (
        cachedStats &&
        statsLastUpdated &&
        Date.now() - statsLastUpdated < STATS_CACHE_DURATION
    ) {
        console.log("[CACHE HIT] Mengirim statistik instan dari RAM (1ms)!");
        return R.ok(res, cachedStats);
    }

    console.log(
        "[CACHE MISS] Menghitung ulang 7 Query Statistik dari Seoul (Tunggu bentar ya)...",
    );

    try {
        // 2. AMBIL DATA DARI DATABASE (Hanya jalan 5 menit sekali)
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
                where: { skillId: { in: topSkills.map((s) => s.skillId) } },
                select: { skillId: true, skillName: true },
            }),
            prisma.industry.findMany({
                where: {
                    industryId: {
                        in: topIndustries.map((i) => i.industryId).filter(Boolean),
                    },
                },
                select: { industryId: true, industryName: true },
            }),
        ]);

        const skillMap = Object.fromEntries(
            skillNames.map((s) => [s.skillId, s.skillName]),
        );
        const indMap = Object.fromEntries(
            indNames.map((i) => [i.industryId, i.industryName]),
        );

        // 3. FORMAT DATA DAN SIMPAN KE "LEMARI" CACHE
        cachedStats = {
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
        };

        // Catat waktu kapan cache ini diperbarui
        statsLastUpdated = Date.now();

        // 4. KIRIM RESPONS
        return R.ok(res, cachedStats);
    } catch (error) {
        console.error("Error pada getStats:", error);

        // Fitur Penyelamat: Kalau database tiba-tiba ngadat/error saat waktu update 5 menit tiba,
        // kita tetap kirimkan data cache lama (kadaluarsa) daripada memberikan error ke frontend.
        if (cachedStats) {
            console.log(
                "[CACHE FALLBACK] Database error, mengirim data statistik versi lama.",
            );
            return R.ok(res, cachedStats);
        }

        return R.fail(res, 500, "Gagal mengambil data statistik");
    }
};
