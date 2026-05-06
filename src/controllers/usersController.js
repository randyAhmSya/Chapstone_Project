import prisma from "../config/prisma.js";
import R from "../utils/response.js";
import { MAX_RECOMMENDATIONS } from "../utils/constants.js";
import pdfSvc from "../services/pdfService.js";

const RECOMMENDATION_INCLUDE = {
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
};

// GET /api/users/profile
export const getProfile = async (req, res) => {
  const profile = await prisma.userProfile.findUnique({
    where: { userId: req.user.id },
  });
  if (!profile) return R.notFound(res, "Profil tidak ditemukan");
  return R.ok(res, profile);
};

// PUT /api/users/profile
export const updateProfile = async (req, res) => {
  const { headline, location, careerPrefs } = req.body;

  const profile = await prisma.userProfile.upsert({
    where: { userId: req.user.id },
    update: { headline, location, careerPrefs },
    create: { userId: req.user.id, headline, location, careerPrefs },
  });
  return R.ok(res, profile, "Profil berhasil diupdate");
};

// GET /api/users/recommendations
export const getRecommendations = async (req, res) => {
  const result = await prisma.matchResult.findMany({
    where: { userId: req.user.id },
    orderBy: { matchScore: "desc" },
    take: MAX_RECOMMENDATIONS,
    include: RECOMMENDATION_INCLUDE,
  });
  return R.ok(res, result);
};

// Ambil daftar CV milik userId (hanya milik sendiri)
export const getCvsByUserId = async (req, res) => {
  const { userId } = req.params;

  if (userId !== req.user.id) 
    return R.forbidden(res, "Akses ditolak");
  

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

  const result = cvs.map(cv => ({
    id: cv.id,
    fileName: cv.fileName,
    fileUrl: cv.fileUrl,
    uploadedAt: cv.uploadedAt,
    textExtracted: pdfSvc.isTextValid(cv.extractedText),
  }));

  return R.ok(res, result);
};

//GET /api/users/:userId/recommendations
export const getRecommendationsById = async (req, res) => {
  const { userId } = req.params;

  if (userId !== req.user.id)
    return R.forbidden(res, "Akses ditolak");

  const results = await prisma.matchResult.findMany({
    where: { userId: req.user.id },
    orderBy: { matchScore: "desc" },
    take: MAX_RECOMMENDATIONS,
    include: RECOMMENDATION_INCLUDE,
  });

  return R.ok(res, results);
};

export const deleteAcount = async (req, res) => {
  await prisma.user.delete({
    where: { id: req.user.id },
  });
  return R.ok(res, null, "Akun berhasil dihapus");
};
