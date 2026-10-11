/**
 * In-memory error log. Keeps the last 200 errors/failures the backend
 * has seen so the /admin/status page can show them and offer fixes.
 * Cleared on backend restart.
 */

const MAX = 200;

const entries = [];

export function logIssue({ level = 'error', source = 'unknown', message, detail, meta }) {
  const entry = {
    id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    level,          // 'error' | 'warning' | 'info'
    source,         // 'db' | 'ml' | 'ai' | 'simulator' | 'osrm' | 'overpass' | 'http' | ...
    message: String(message || '').slice(0, 500),
    detail: detail ? String(detail).slice(0, 2000) : null,
    meta: meta || null,
    resolved: false,
    resolvedAt: null,
    fix: null       // filled when an admin resolves it via the UI
  };
  entries.unshift(entry);
  if (entries.length > MAX) entries.length = MAX;
  return entry;
}

export function listIssues({ level, source, only_unresolved, limit = 100 } = {}) {
  let out = entries;
  if (level) out = out.filter((e) => e.level === level);
  if (source) out = out.filter((e) => e.source === source);
  if (only_unresolved) out = out.filter((e) => !e.resolved);
  return out.slice(0, limit);
}

export function getIssue(id) {
  return entries.find((e) => e.id === id) || null;
}

export function resolveIssue(id, { fix, note } = {}) {
  const e = entries.find((x) => x.id === id);
  if (!e) return null;
  e.resolved = true;
  e.resolvedAt = Date.now();
  e.fix = fix || 'manual';
  if (note) e.meta = { ...(e.meta || {}), resolution_note: note };
  return e;
}

export function clearIssues() {
  const n = entries.length;
  entries.length = 0;
  return n;
}

export function stats() {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const lastHour = entries.filter((e) => e.ts >= oneHourAgo);
  return {
    total: entries.length,
    unresolved: entries.filter((e) => !e.resolved).length,
    last_hour: lastHour.length,
    by_level: {
      error: entries.filter((e) => e.level === 'error').length,
      warning: entries.filter((e) => e.level === 'warning').length,
      info: entries.filter((e) => e.level === 'info').length
    },
    by_source: entries.reduce((acc, e) => {
      acc[e.source] = (acc[e.source] || 0) + 1;
      return acc;
    }, {})
  };
}