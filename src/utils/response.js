// Helper untuk format response JSON yang konsisten di semua controller
// Menghindari typo dan memastikan struktur payload seragam

const ok = (res, data, message = null, status = 200) => {
    const payload = {};
    if (message) payload.message = message;
    if (data !== undefined) payload.data = data;
    return res.status(status).json(payload);
};

//response sukses dengan data + meta pagination

const pagination = (res, data, meta) => res.json({ data, meta });

//response 201 create

const created = (res, data, message = "berhasil dibuat") =>
    res.status(201).json({ data, message });

//response error
//
const fail = (res, status, error, hint = null) => {
    const payload = { error };
    if (hint) payload.hint = hint;
    return res.status(status).json(payload);
};

const badRequest = (res, error, hint) => fail(res, 400, error, hint);
const unauthorized = (res, error) => fail(res, 401, error);
const forbidden = (res, error) => fail(res, 403, error);
const notFound = (res, error) => fail(res, 404, error);
const unprocessable = (res, error, hint) => fail(res, 422, error, hint);
const serverError = (res, error) => fail(res, 500, error);

export default {
    ok,
    pagination,
    created,
    fail,
    badRequest,
    unauthorized,
    forbidden,
    notFound,
    unprocessable,
    serverError,
};
