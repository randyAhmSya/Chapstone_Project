//tempat berkomunikasi dengan Fast API di AI
// Controller tidak pernah fetch() langsung ke AI — selalu lewat sini


import { AI_TIMEOUT_MS } from "../utils/constants.js"


//pembuatan payload
const buildPayload = (cvText, job, jobSkillIds) => ({
    cv_text:         cvText,
    job_description: job.jobDescription || '',
    job_title:       job.title          || '',
    skills_desc:     job.skillsDesc     || '',
    required_skills: jobSkillIds,
})

//Fetch ke AI Service dengan timeout yang terkontrol

const fetchAI = async(endpoint, payload) => {
 const controller = new AbortController()
 const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
 
 try {
    const baseUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000'
    const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
    })

    if (!res.ok) throw new Error(`AI service responded ${res.status}`);
    return await res.json()
    
 } finally {
    clearTimeout(timer)
 }
}

// POST /predict — dipakai oleh matchController

const predict = (cvText, job, jobSkillIds) => fetchAI('/predict', buildPayload(cvText, job, jobSkillIds))

//POST /analyze — dipakai oleh cvController

const analyze = (cvText, job, jobSkillIds) => fetchAI('/analyze', buildPayload(cvText, job, jobSkillIds))

export default {
    predict,
    analyze
}