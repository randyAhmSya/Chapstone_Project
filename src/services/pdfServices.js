// isolasi dari logika ekstraksi pdf tekst nya
// dipakai di cvcontroller (upload and reextract)

import { PDFParse } from "pdf-parse";
import { CV_MIN_TEXT_LEN } from "../utils/constants.js";

// Ekstrak teks dari Buffer PDF
// Selalu mengembalikan objek — tidak pernah throw ke luar
const extractTextFromBuffer = async (Buffer) => {
    try {
        const parser = new PDFParse({ data: Buffer });

        const result = await parser.getText();

        await parser.destroy();

        const text = result.text?.replace(/\s+/g, " ").trim() || "";

        if (text.length < CV_MIN_TEXT_LEN) {
            return {
                text: null,
                reason:
                    "PDF tampaknya kosong atau hasil scan gambar (tidak ada teks yang bisa diekstrak)",
            };
        }
        console.log("Ekstraksi sukses pakai pdf-parse v2.4.5!");
        return { text, reason: null };
    } catch {
        return {
            text: null,
            reason: "PDF tidak bisa dibaca — mungkin terproteksi atau rusak",
        };
    }
};

// pengecek an text apakah cukup panjang > 50
const isTextValid = (text) =>
    typeof text === "string" && text.length >= CV_MIN_TEXT_LEN;

export default {
    extractTextFromBuffer,
    isTextValid,
};
