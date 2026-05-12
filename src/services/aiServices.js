//tempat berkomunikasi dengan Fast API di AI
// Controller tidak pernah fetch() langsung ke AI — selalu lewat sini


import { AI_TIMEOUT_MS, AI_HEALTH_TIMEOUT_MS, AI_RETRY_ATTEMPTS, AI_RETRY_DELAY_MS } from "../utils/constants.js"

let _circuitOpen = false
let _circuitResetAt = null

const CIRCUIT_COOLDOWN_MS = 30_000

const isCircuitOpen = () => {
    if (!_circuitOpen) return false
    if(Date.now() > _circuitResetAt) {
        _circuitOpen = false
        console.info('[AI] Circuit half-open — mencoba koneksi ulang ke AI Service')
        return false
    }
    return true
}

const openCircuit = () => {
    _circuitOpen = true
    _circuitResetAt = Date.now() + CIRCUIT_COOLDOWN_MS
    console.warn('[AI] Circuit OPEN — AI Service offline, fallback aktif selama 30 detik')
}

const closeCircuit = () => {
    if (_circuitOpen) {
        _circuitOpen = false
        _circuitResetAt = null
        console.info('[AI] Circuit CLOSED — AI Service kembali aktif')
    }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

//fect timeout
const fetchWithTimeout = async(url, options, timeoutMs) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
        const res = await fetch(url, {...options, signal: controller.signal})
        if (!res.ok) throw new Error(`AI Service responded ${res.status}: ${res.statusText}`)
        return await res.json()
    } finally {
        clearTimeout(timer)
    }
}

//fecth retry
const fecthWithRetry = async(endpoint, payload) => {
    const baseUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000'
    const url = `${baseUrl}${endpoint}`
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    }
    let lastErr
    for (let attempt = 1; attempt <= AI_RETRY_ATTEMPTS; attempt++) {
        try {
            const result = await  fetchWithTimeout(url, options, AI_TIMEOUT_MS)
            closeCircuit()
            return result
        } catch (err) {
            lastErr = err
            const isAbort = err.name === 'AbortError'
            console.warn(`[AI] Attempt ${attempt}/${AI_RETRY_ATTEMPTS} failed (${isAbort ? 'timeout' : err.message})`)

            if (attempt < AI_RETRY_ATTEMPTS) {
                await sleep(AI_RETRY_DELAY_MS)
            }
            
        }   
    }
    openCircuit()
    throw lastErr || new Error('Unknown AI error')
}

//pembuatan payload
const buildPayload = (cvText, job, jobSkillIds) => ({
    cv_text:         cvText,
    job_description: job.jobDescription || '',
    job_title:       job.title          || '',
    skills_desc:     job.skillsDesc     || '',
    required_skills: jobSkillIds,
})


// POST /predict — dipakai oleh matchController

const predict = (cvText, job, jobSkillIds) => {
    if (isCircuitOpen()) throw new Error('AI Service circuit open — menggunakan fallback')
    return fecthWithRetry('/predict', buildPayload(cvText, job, jobSkillIds))
}

//POST /analyze — dipakai oleh cvController

const analyze = (cvText, job, jobSkillIds) => {
    if (isCircuitOpen()) throw new Error('AI Service circuit open — menggunakan fallback')
    return fecthWithRetry('/analyze', buildPayload(cvText, job, jobSkillIds))
}

const checkHealth = async () => {
    const baseUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000'
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), AI_HEALTH_TIMEOUT_MS)

    try {
        const res = await fetch(`${baseUrl}/health`, { signal: controller.signal })
        if (!res.ok) return { online: false, status: `HTTP ${res.status}` }
        const data = await res.json()
        closeCircuit()
        return { online: true, ...data }
    } catch {
        return { online: false, status: 'uncreachable' }
    } finally {
        clearTimeout(timer)
    }
    
}

const getCircuitState =() => ({
    open: _circuitOpen,
    resetAt: _circuitResetAt
})

export default {
    predict,
    analyze,
    checkHealth,
    getCircuitState
}