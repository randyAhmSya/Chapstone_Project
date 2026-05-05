// Wrapper operasi Supabase Storage — upload, delete, download, getPublicUrl
// Controller tidak import supabase langsung — selalu lewat sini
//
// - Jika provider storage berganti (S3, Cloudflare R2), cukup ganti file ini
// - Error handling storage terpusat dan konsisten
// - Mudah di-mock saat unit testing

import { supabase } from "../config/supabase.js";
import { CV_BUCKET } from "../utils/constants.js";

// - upload buffer ke supabase storage
const uploadCv = async (
    storagePath,
    buffer,
    contentType = "application/pdf",
) => {
    const { error } = await supabase.storage
        .from(CV_BUCKET)
        .upload(storagePath, buffer, { contentType, upsert: false });
    if (error) throw new error(`storage Upload gagal ${error.message}`);

    const { data } = supabase.storage.from(CV_BUCKET).getPublicUrl(storagePath);
    return { publicUrl: data.publicUrl };
};

// - delete file di supabase storage
const deleteCv = async (storagePath) => {
    const { error } = await supabase.storage
        .from(CV_BUCKET)
        .remove([storagePath]);
    if (error)
        throw new error(`storage Delete gagal delete warn:`, error.message);
};

// - download file di supabase storage
const downloadCv = async (storagePath) => {
    const { data, error } = await supabase.storage
        .from(CV_BUCKET)
        .download(storagePath);
    if (error || !data)
        throw new error(
            `storage Download gagal: ${error?.message || "data kosong"}`,
        );
    return Buffer.from(await data.arrayBuffer());
};

export default {
    uploadCv,
    deleteCv,
    downloadCv,
};
