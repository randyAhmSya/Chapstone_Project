import cron from "node-cron";
import prisma from "../config/prisma.js";
import supabase from "../config/supabase.js";

const BUCKET = "cv-uploads";

export const startAutoCleanUp = () => {
    // Berjalan setiap 15 menit
    cron.schedule("0 0 * * *", async () => {
        console.log("[Cron] Memulai patroli pembersihan file PDF fisik...");

        try {
            // Hitung mundur 1 jam dari waktu sekarang
            const oneHourAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            // Cari CV yang umurnya > 1 jam DAN file fisiknya (storagePath) masih ada
            const expiredCvs = await prisma.cvUpload.findMany({
                where: {
                    uploadedAt: { lt: oneHourAgo },
                    storagePath: { not: null },
                },
            });

            if (expiredCvs.length === 0) {
                return; // Server bersih, patroli selesai
            }

            for (const cv of expiredCvs) {
                // 1. Hapus file PDF aslinya dari Supabase Storage (Cloud)
                const { error } = await supabase.storage
                    .from(BUCKET)
                    .remove([cv.storagePath]);

                if (error) {
                    console.error(
                        `[Cron] Gagal hapus fisik di Supabase: ${cv.storagePath}`,
                    );
                    continue;
                }

                // 2. Putuskan link di Database (TAPI teksnya tetap aman!)
                await prisma.cvUpload.update({
                    where: { id: cv.id },
                    data: {
                        fileUrl: null, // Link download dihapus karena file sudah lenyap
                        storagePath: null, // Ditandai null agar tidak dicek lagi oleh Cron
                    },
                });

                console.log(`Succes: ${cv.id}`);
            }
        } catch (error) {
            console.error("[Cron Error]:", error.message);
        }
    });
};
