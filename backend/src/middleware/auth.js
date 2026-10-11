import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function sign(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'auth_required' });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
};

/** Optional auth: fills req.user if token valid, else continues. */
export function optionalAuth(req, _res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (token) {
    try { req.user = jwt.verify(token, config.jwtSecret); } catch { /* ignore */ }
  }
  next();
}
export function verify(token) {
  return jwt.verify(token, config.jwtSecret);
}