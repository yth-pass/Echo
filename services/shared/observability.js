"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = createLogger;
exports.generateCorrelationId = generateCorrelationId;
exports.incrementCounter = incrementCounter;
exports.getCounterValue = getCounterValue;
exports.getAllCounters = getAllCounters;
const crypto_1 = require("crypto");
function emitLog(entry) {
    console.log(JSON.stringify(entry));
}
function createLogger(module) {
    function log(level, message, metadata) {
        const correlationId = metadata?.correlation_id ?? generateCorrelationId();
        const { correlation_id: _cid, ...rest } = metadata ?? {};
        emitLog({
            level,
            timestamp: new Date().toISOString(),
            module,
            correlation_id: correlationId,
            message,
            metadata_json: JSON.stringify(rest),
        });
    }
    return {
        info: (message, metadata) => log('info', message, metadata),
        warn: (message, metadata) => log('warn', message, metadata),
        error: (message, metadata) => log('error', message, metadata),
    };
}
function generateCorrelationId() {
    return (0, crypto_1.randomUUID)();
}
const counters = new Map();
function incrementCounter(name, labels) {
    const key = name + ':' + JSON.stringify(labels ?? {});
    const existing = counters.get(key);
    if (existing) {
        existing.value++;
    }
    else {
        counters.set(key, { value: 1, labels: labels ?? {} });
    }
}
function getCounterValue(name, labels) {
    const key = name + ':' + JSON.stringify(labels ?? {});
    return counters.get(key)?.value ?? 0;
}
function getAllCounters() {
    return Array.from(counters.entries()).map(([key, entry]) => ({
        name: key.split(':')[0],
        value: entry.value,
        labels: entry.labels,
    }));
}
//# sourceMappingURL=observability.js.map