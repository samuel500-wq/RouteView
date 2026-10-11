import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

export const publicLimiter = rateLimit({
  windowMs: 60_000, max: 240, standardHeaders: true, legacyHeaders: false
});

export const aiLimiter = rateLimit({
  windowMs: 60_000, max: config.ai.ratePerMin, standardHeaders: true, legacyHeaders: false,
  message: { error: 'ai_rate_limited' }
});

export const authLimiter = rateLimit({
  windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false
});