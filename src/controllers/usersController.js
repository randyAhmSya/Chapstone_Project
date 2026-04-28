import prisma from "../config/prisma.js";

export const getProfile = async (req, res) => {
    const profile = await prisma.userProfile.findUnique({
        where: { userId: req.user.id },
    });
    if (!profile)
        return res.status(404).json({ error: "Profil tidak ditemukan" });
    res.json({ data: profile });
};

export const updateProfile = async (req, res) => {
    const { headline, location, careerPrefs } = req.body;

    const profile = await prisma.userProfile.upsert({
        where: { userId: req.user.id },
        update: { headline, location, careerPrefs },
        create: { userId: req.user.id, headline, location, careerPrefs },
    });
    res.json({ message: "Profil berhasil diupdate", data: profile });
};

export const getRecommendations = async (req, res) => {
    const results = await prisma.matchResult.findMany({
        where: { userId: req.user.id },
        orderBy: { matchScore: "desc" },
        take: 10,
        include: {
            jobPosting: {
                select: {
                    id: true,
                    title: true,
                    location: true,
                    remoteAllowed: true,
                    company: { select: { companyName: true } },
                    skills: {
                        include: { skill: { select: { skillId: true, skillName: true } } },
                    },
                    salaries: {
                        select: {
                            minSalary: true,
                            maxSalary: true,
                            payPeriod: true,
                            currency: true,
                        },
                    },
                },
            },
        },
    });
    res.json({ data: results, total: results.length });
};
