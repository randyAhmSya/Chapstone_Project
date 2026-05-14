import { STATS_CACHE_DURATION } from "./constants.js";

class MemChache {
    constructor(){this._store = new Map()}

    get(key) {
        const entry = this._store.get(key);
        if (!entry) return null;
        if(Date.now() > entry.expiresAt) {
            this._store.delete(key);
            return null;
        }
        return entry.value;
    }

    set(key, value, ttlMs = STATS_CACHE_DURATION) {
        this._store.set(key, { value, expiresAt: Date.now() + ttlMs });
        return value;
    }
    del(key) { this._store.delete(key); }
    flush() { this._store.clear(); }
    size() { return this._store.size; }
}

export const cache = new MemChache();

export const getOrSet = async (key, fn, ttlMs = STATS_CACHE_DURATION) => {
    const hit = cache.get(key);
    if (hit !== null) return hit;
    const value = await fn();
    cache.set(key, value, ttlMs);
    return value;
};

export default {
    cache,
    getOrSet,
};

