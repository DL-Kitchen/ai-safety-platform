// Saforia - Local Storage Utilities
// Namespaced localStorage wrapper with JSON serialization and quota awareness.

const PREFIX = 'saforia';

function makeKey(namespace, key) {
    return `${PREFIX}:${namespace}:${key}`;
}

export function save(namespace, key, data) {
    try {
        const serialized = JSON.stringify(data);
        localStorage.setItem(makeKey(namespace, key), serialized);
        return true;
    } catch (err) {
        if (err.name === 'QuotaExceededError') {
            console.warn('Saforia: localStorage quota exceeded.');
            return false;
        }
        throw err;
    }
}

export function load(namespace, key, defaultValue = null) {
    try {
        const raw = localStorage.getItem(makeKey(namespace, key));
        if (raw === null) return defaultValue;
        return JSON.parse(raw);
    } catch {
        return defaultValue;
    }
}

export function remove(namespace, key) {
    localStorage.removeItem(makeKey(namespace, key));
}

export function list(namespace) {
    const prefix = `${PREFIX}:${namespace}:`;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
            keys.push(k.slice(prefix.length));
        }
    }
    return keys;
}

export function clear(namespace) {
    const prefix = `${PREFIX}:${namespace}:`;
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
            toRemove.push(k);
        }
    }
    toRemove.forEach(k => localStorage.removeItem(k));
}

export function getStorageUsage() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) {
            total += k.length + (localStorage.getItem(k) || '').length;
        }
    }
    // Approximate: localStorage limit is typically 5MB (5,242,880 chars)
    const limit = 5 * 1024 * 1024;
    const percentage = Math.round((total / limit) * 100);
    return { used: total, limit, percentage };
}

export function isNearQuota(threshold = 80) {
    return getStorageUsage().percentage >= threshold;
}
