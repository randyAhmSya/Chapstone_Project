// Logika kalkulasi skill gap berbasis keyword matching
// Dipakai sebagai FALLBACK saat AI Service (FastAPI) belum aktif atau offline


/**
 * Bentuk payload skills dari job posting untuk dikirim ke AI Service
 * maupun untuk dipakai fallback. Dipakai di dua tempat (cv + match),
 * jadi diextract sebagai helper.
 */
const extractJobSkills = (job) => job.skills.map(s => ({
    skillId: s.skill.skillId,
    skillName: s.skill.skillName,
}))

/**
 * Hitung skill gap menggunakan keyword matching sederhana
 * Cek apakah skillName atau skillId muncul di teks CV (case-insensitive)
 */



const computeFallBackGap = (cvText, jobSkills) => {
    const cvLower = cvText.toLowerCase()

    const present = jobSkills.filter(s => cvLower.includes(s.skillName.toLowerCase()) || cvLower.includes(s.skillId.toLowerCase()))
    
    const missing = jobSkills.filter(s => !cvLower.includes(s.skillName.toLowerCase()) && !cvLower.includes(s.skillId.toLowerCase()))
    
    const matchScore = jobSkills.length > 0 ? parseFloat((present.length / jobSkills.length).toFixed(2)) : 0

    const skillGapJson = {
        note: "analisis fallback ai service belum aktif",
        present: present.map(s => s.skillId),
        missing: missing.map(s => s.skillId),
        required: jobSkills.map(s => s.skillId),
    }

    const suggestion = missing.map(s => ({
        skill: s.skillName,
        action: `Pelajari ${s.skillName} untuk meningkatkan kesesuaian dengan posisi ini`,
    }))

    const summary = `Dari ${jobSkills.length} skill yang dibutuhkan, ` +
    `CV ini memenuhi ${present.length} skill (${Math.round(matchScore * 100)}% match).`


    return {
        skillGapJson,
        suggestion,
        summary,
        matchScore,
    }
}

export default {
    extractJobSkills,
    computeFallBackGap,
}
