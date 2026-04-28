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
