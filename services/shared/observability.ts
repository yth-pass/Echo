/**
 * Unified observability module — JSON structured logger + Prometheus counters.
 * Used by both services/api and services/worker.
 *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Logger {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

interface LogEntry {
  level: 'info' | 'warn' | 'error';
  timestamp: string;
  module: string;
  correlation_id: string;
  message: string;
  metadata_json: string;
}

// ---------------------------------------------------------------------------
// JSON emitter
// ---------------------------------------------------------------------------

function emitLog(entry: LogEntry): void {
  // Output to stdout as single-line JSON per entry.
  // Production environments can redirect stdout to a log file.
  console.log(JSON.stringify(entry));
}

// ---------------------------------------------------------------------------
// Logger factory
// ---------------------------------------------------------------------------

/** Create a structured JSON logger scoped to a module name. */
export function createLogger(module: string): Logger {
  function log(
    level: 'info' | 'warn' | 'error',
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    const correlationId: string =
      (metadata?.correlation_id as string) ?? generateCorrelationId();
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

// ---------------------------------------------------------------------------
// Correlation ID
// ---------------------------------------------------------------------------

/** Generate a v4 UUID for request correlation. */
export function generateCorrelationId(): string {
  return randomUUID();
}

// ---------------------------------------------------------------------------
// Prometheus-style in-memory counters
// ---------------------------------------------------------------------------

interface CounterEntry {
  value: number;
  labels: Record<string, string>;
}

const counters = new Map<string, CounterEntry>();

/**
 * Increment a named counter.  Labels are used to produce unique metric series
 * (matching Prometheus's label model).  Thread-safe only for single-threaded
 * Node.js — for multi-process use a real Prometheus client library.
 */
export function incrementCounter(
  name: string,
  labels?: Record<string, string>,
): void {
  const key = name + ':' + JSON.stringify(labels ?? {});
  const existing = counters.get(key);
  if (existing) {
    existing.value++;
  } else {
    counters.set(key, { value: 1, labels: labels ?? {} });
  }
}

/** Read current value of a counter.  Returns 0 when not found. */
export function getCounterValue(
  name: string,
  labels?: Record<string, string>,
): number {
  const key = name + ':' + JSON.stringify(labels ?? {});
  return counters.get(key)?.value ?? 0;
}

/** Dump all counter series (useful for a `/metrics` scrape endpoint). */
export function getAllCounters(): Array<{
  name: string;
  value: number;
  labels: Record<string, string>;
}> {
  return Array.from(counters.entries()).map(([key, entry]) => ({
    name: key.split(':')[0],
    value: entry.value,
    labels: entry.labels,
  }));
}
