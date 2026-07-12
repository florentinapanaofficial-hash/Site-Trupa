const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_PATTERN = /(token|secret|key|pass|password|streamkey|passphrase|authorization|bearer|cookie|private|api[_-]?key|client[_-]?email)/i;

function isSensitiveKey(key) {
    if (!key || typeof key !== 'string') return false;
    return SENSITIVE_KEY_PATTERN.test(key);
}

function redactString(value, parentKey = '') {
    if (isSensitiveKey(parentKey)) {
        return REDACTED;
    }

    let output = String(value);

    output = output.replace(/(Bearer\s+)[A-Za-z0-9._~+/\-=]+/gi, `$1${REDACTED}`);

    output = output.replace(
        /((?:^|\b)[A-Z0-9_]*(?:TOKEN|SECRET|KEY|PASS|PASSWORD)[A-Z0-9_]*\s*[=:]\s*)([^\s,;"']+)/gi,
        `$1${REDACTED}`,
    );

    output = output.replace(
        /("(?:token|secret|key|pass|password|streamKey|passphrase|authorization|privateKey|apiKey)"\s*:\s*)"[^"]*"/gi,
        `$1"${REDACTED}"`,
    );

    output = output.replace(
        /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
        REDACTED,
    );

    return output;
}

function normalizeError(error) {
    if (!(error instanceof Error)) {
        return error;
    }

    return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause,
    };
}

function sanitize(value, parentKey = '', seen = new WeakSet()) {
    const normalized = normalizeError(value);

    if (normalized == null) return normalized;

    if (typeof normalized === 'string') {
        return redactString(normalized, parentKey);
    }

    if (typeof normalized === 'number' || typeof normalized === 'boolean' || typeof normalized === 'bigint') {
        return normalized;
    }

    if (typeof normalized === 'function' || typeof normalized === 'symbol') {
        return String(normalized);
    }

    if (Array.isArray(normalized)) {
        if (seen.has(normalized)) return '[Circular]';
        seen.add(normalized);
        return normalized.map((item) => sanitize(item, parentKey, seen));
    }

    if (typeof normalized === 'object') {
        if (seen.has(normalized)) return '[Circular]';
        seen.add(normalized);

        const out = {};
        for (const [key, nestedValue] of Object.entries(normalized)) {
            if (isSensitiveKey(key)) {
                out[key] = REDACTED;
            } else {
                out[key] = sanitize(nestedValue, key, seen);
            }
        }

        return out;
    }

    return normalized;
}

function sanitizeArgs(args) {
    return args.map((arg) => sanitize(arg));
}

function emit(level, ...args) {
    const writer = console[level] || console.log;
    writer(...sanitizeArgs(args));
}

export const secureLogger = {
    log: (...args) => emit('log', ...args),
    info: (...args) => emit('info', ...args),
    warn: (...args) => emit('warn', ...args),
    error: (...args) => emit('error', ...args),
    debug: (...args) => emit('debug', ...args),
};

export { sanitize as sanitizeLogValue, REDACTED as REDACTED_LOG_VALUE };
