// Normalisasi parameter page & limit dari query string
// Menghindari penulisan Math.max / Math.min / parseInt berulang di setiap controller

import { DEFAULT_PAGE, DEFAULT_JOB_LIMIT, MAX_JOB_LIMIT } from "./constants.js";

const parsePagination = (
    query,
    defaultLimit = DEFAULT_JOB_LIMIT,
    maxLimit = MAX_JOB_LIMIT,
) => {
    const page = Math.max(DEFAULT_PAGE, parseInt(query.page) || DEFAULT_PAGE);
    const limit = Math.min(maxLimit, parseInt(query.limit) || defaultLimit);
    return { page, limit, skip };
};

//nuat object parsePagination untuk response

const buildMeta = (total, page, limit) => ({
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
});

export { parsePagination, buildMeta };
