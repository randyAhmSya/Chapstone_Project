// constants CV
const CV_MIN_TEXT_LEN = 50; // karakter minimal agar teks CV dianggap valid
const CV_BUCKET = "cv-uploads"; // nama bucket Supabase Storage
const CV_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB (juga diset di middleware/upload.js)

// constatns AI service
const AI_TIMEOUT_MS = 1500;
const AI_HEALTH_TIMEOUT_MS = 5_000;
const AI_RETRY_ATTEMPTS = 2;
const AI_RETRY_DELAY_MS = 500;

//memory caching
const jobDetailsCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const STATS_CACHE_DURATION = 5 * 60 * 1000;

//matching dan rekomendasi
const MATH_SCORE_THRESHOLD = 0.60;
const TOP_JOBS_LIMIT = 5;
const LEARNING_PATH_LIMIT = 3;

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
    MATH_SCORE_THRESHOLD,
    TOP_JOBS_LIMIT,
    LEARNING_PATH_LIMIT,
    AI_RETRY_ATTEMPTS,
    AI_RETRY_DELAY_MS,
    AI_HEALTH_TIMEOUT_MS,
};
