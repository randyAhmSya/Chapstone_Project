import multer from "multer";


const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype !== "application/pdf") {
            return cb(
                Object.assign(new Error("hanya file pdf yang diperbolehkan"), {
                    status: 400,
                }),
            );
        }
        cb(null, true);
    },
});

export default upload;
