const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

//helper
function fail(res, message, field = null) {
    return res.status(400).json({
        error: message,
        ...(field && { field }),
    });
}

//validasi register

export const register = (req, res, next) => {
    let { email, password, name } = req.body;

    email = (email || "").toString().trim().toLowerCase();
    password = (password || "").toString();
    name = (name || "").toString().trim();

    if (!email) return fail(res, "email wajib untuk di isi");
    if (!EMAIL_REGEX.test(email)) return fail(res, "format email tidak valid");
    if (!password) return fail(res, "password wajib untuk di isi");
    if (password.length < 8)
        return fail(res, "password minimal harus 8 karakter");
    if (password.length > 32)
        return fail(res, "password maksimal harus 32 karakter");
    if (name && name.length > 100)
        return fail(res, "name maksimal harus 100 karakter");

    req.body.email = email;
    req.body.password = password;
    req.body.name = name || null;

    next();
};

export const login = (req, res, next) => {
    let { email, password } = req.body;

    email = (email || "").toString().trim().toLowerCase();
    password = (password || "").toString();

    if (!email) return fail(res, "email wajib untuk di isi");
    if (!EMAIL_REGEX.test(email)) return fail(res, "format email tidak valid");
    if (!password) return fail(res, "password wajib untuk di isi");

    req.body.email = email;
    req.body.password = password;

    next();
};

//validasi change password
export const changePassword = (req, res, next) => {
    let { currentPassword, newPassword } = req.body;

    if (!currentPassword)
        return fail(res, "Password saat ini wajib diisi", "currentPassword");
    if (!newPassword)
        return fail(res, "Password baru wajib diisi", "newPassword");
    if (newPassword.length < 8)
        return fail(res, "Password baru minimal 8 karakter", "newPassword");
    if (newPassword.length > 72)
        return fail(res, "Password baru maksimal 72 karakter", "newPassword");
    if (currentPassword === newPassword)
        return fail(
            res,
            "Password baru tidak boleh sama dengan password saat ini",
            "newPassword",
        );

    next();
};

//profil validator
export const updateProfile = (req, res, next) => {
    const { headline, location, careerPrefs } = req.body;

    if (headline && typeof headline !== "string")
        return fail(res, "Headline harus berupa teks", "headline");
    if (headline && headline.length > 200)
        return fail(res, "Headline maksimal 200 karakter", "headline");

    if (location && typeof location !== "string")
        return fail(res, "Location harus berupa teks", "location");
    if (location && location.length > 100)
        return fail(res, "Location maksimal 100 karakter", "location");

    if (careerPrefs && typeof careerPrefs !== "object")
        return fail(res, "careerPrefs harus berupa object JSON", "careerPrefs");

    // Sanitasi
    if (headline) req.body.headline = headline.trim();
    if (location) req.body.location = location.trim();

    next();
};

//analize validator
export const analizeCv = (req, res, next) => {
    const { cvUploadId, jobPostingId } = req.body;

    if (!cvUploadId) return fail(res, "cvUploadId wajib diisi", "cvUploadId");
    if (typeof cvUploadId !== "string" || cvUploadId.trim() === "")
        return fail(res, "cvUploadId tidak valid", "cvUploadId");

    if (!jobPostingId)
        return fail(res, "jobPostingId wajib diisi", "jobPostingId");

    next();
};

//match validator
export const runMatch = (req, res, next) => {
    const { cvUploadId, jobPostingId } = req.body;

    if (!cvUploadId || !jobPostingId)
        return fail(res, "cvUploadId wajib diisi", "cvUploadId");
    if (typeof cvUploadId !== "string" || cvUploadId.trim() === "")
        return fail(res, "cvUploadId tidak valid", "cvUploadId");

    next();
};

export default {
    register,
    login,
    changePassword,
    updateProfile,
    analizeCv,
    runMatch,
};
