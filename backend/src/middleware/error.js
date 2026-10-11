import { logIssue } from '../services/systemLog.js';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(req, res) {
  res.status(404).json({ error: 'not_found' });
}

export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const body = { error: err.code || 'internal_error' };
  if (err.details) body.details = err.details;
  if (process.env.NODE_ENV !== 'production' && status >= 500) {
    body.message = err.message;
  }
  if (status >= 500) {
    console.error('[error]', err);

    // Record 5xx errors in the in-memory log so the admin can see them.
    try {
      logIssue({
        level: 'error',
        source: 'http',
        message: err.message || err.code || 'Unknown server error',
        detail: err.stack ? String(err.stack).split('\n').slice(0, 6).join('\n') : null,
        meta: {
          method: req.method,
          path: req.originalUrl,
          status,
          user_id: req.user?.id || null
        }
      });
    } catch { /* never fail the response because of logging */ }
  } else if (status === 429) {
    // Rate limits are worth surfacing as warnings
    try {
      logIssue({
        level: 'warning',
        source: 'http',
        message: 'Rate limit hit',
        meta: { method: req.method, path: req.originalUrl }
      });
    } catch { /* ignore */ }
  }
  res.status(status).json(body);
}

export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);