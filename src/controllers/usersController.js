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
  try {
    const userId = req.user.id;

    // 1. Ambil data dari riwayat analisis user
    let results = await prisma.matchResult.findMany({
      where: { userId },
      orderBy: { matchScore: "desc" },
      take: 10,
      include: {
        jobPosting: {
          select: {
            id: true,
            title: true,
            location: true,
            remoteAllowed: true,
            formattedWorkType: true,
            formattedExperienceLevel: true,
            company: {
              select: { companyName: true, city: true, country: true },
            },
            skills: {
              include: {
                skill: { select: { skillId: true, skillName: true } },
              },
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

    // 2. 🚀 JIKA KOSONG: Ambil lowongan default agar response tidak kosong
    if (results.length === 0) {
      console.log(
        "ℹ️ Belum ada history match, menarik data lowongan default...",
      );
      const defaultJobs = await prisma.jobPosting.findMany({
        take: 3,
        include: {
          company: { select: { companyName: true, city: true, country: true } },
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
      });

      // Format agar strukturnya mirip dengan hasil analisis
      results = defaultJobs.map((job) => ({
        id: `fallback-${job.id}`,
        userId,
        jobPostingId: job.id,
        matchScore: 0.5, // Skor default (50%)
        createdAt: new Date(),
        jobPosting: job,
      }));
    }

    res.json({ data: results, total: results.length });
  } catch (error) {
    console.error("[getRecommendations Error]:", error.message);
    res.status(500).json({ error: "Gagal mengambil rekomendasi" });
  }
};
// Ambil daftar CV milik userId (hanya milik sendiri)
export const getCvsByUserId = async (req, res) => {
  const { userId } = req.params;

  if (userId !== req.user.id) {
    return res.status(403).json({ error: "Akses ditolak" });
  }

  const cvs = await prisma.cvUpload.findMany({
    where: { userId },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      uploadedAt: true,
      extractedText: true,
    },
  });

  const result = cvs.map((cv) => ({
    id: cv.id,
    fileName: cv.fileName,
    fileUrl: cv.fileUrl,
    uploadedAt: cv.uploadedAt,
    textExtracted: cv.extractedText !== null && cv.extractedText.length >= 50,
  }));

  res.json({ data: result, total: result.length });
};

export const getRecommendationsById = async (req, res) => {
  const { userId } = req.params;

  if (userId !== req.user.id)
    return res.status(403).json({
      error: "Akses ditolak",
    });

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
          formattedWorkType: true,
          formattedExperienceLevel: true,
          company: { select: { companyName: true, city: true, country: true } },
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

  res.json({
    data: results,
    total: results.length,
  });
};

export const deleteAcount = async (req, res) => {
  try {
    const userId = req.user.id;

    // Menghapus data user otomatis akan menghapus data terkait jika diset ON DELETE CASCADE
    await prisma.user.delete({
      where: { id: userId },
    });

    res.json({ message: "Akun berhasil dihapus" });
  } catch (error) {
    console.error("[deleteAccount Error]:", error.message);
    res.status(500).json({ error: "Gagal menghapus akun" });
  }
};
