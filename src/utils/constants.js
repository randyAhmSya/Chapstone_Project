// constants CV
const CV_MIN_TEXT_LEN = 50; // karakter minimal agar teks CV dianggap valid
const CV_BUCKET = "cv-uploads"; // nama bucket Supabase Storage
const CV_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB (juga diset di middleware/upload.js)

// constatns AI service
const AI_TIMEOUT_MS = 1500; // timeout request ke FastAPI (30 detik)

//memory caching
const jobDetailsCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

const STATS_CACHE_DURATION = 5 * 60 * 1000;

// constatns paginations
const DEFAULT_PAGE = 1;
const DEFAULT_JOB_LIMIT = 20;
const MAX_JOB_LIMIT = 50;
const DEFAULT_MATCH_LIMIT = 10;
const MAX_MATCH_LIMIT = 20;
const MAX_RECOMMENDATIONS = 10;

export {
    CV_MIN_TEXT_LEN,
    CV_BUCKET,
    CV_MAX_FILE_SIZE,
    AI_TIMEOUT_MS,
    DEFAULT_PAGE,
    DEFAULT_JOB_LIMIT,
    MAX_JOB_LIMIT,
    DEFAULT_MATCH_LIMIT,
    MAX_MATCH_LIMIT,
    MAX_RECOMMENDATIONS,
    jobDetailsCache,
    CACHE_TTL,
    STATS_CACHE_DURATION,
};
