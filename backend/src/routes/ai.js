import { Router } from 'express';
import { z } from 'zod';
import { chat, aiIsConfigured } from '../ai/openrouter.js';
import { aiPlan } from '../ai/planner.js';
import { ah } from '../middleware/error.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { optionalAuth } from '../middleware/auth.js';

export const aiRouter = Router();

aiRouter.get('/status', (_req, res) => {
  res.json({ configured: aiIsConfigured() });
});

const chatSchema = z.object({
  sessionKey: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
  lang: z.enum(['rw', 'en']).default('rw'),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(4000)
  })).max(20).default([])
});

aiRouter.post('/chat', aiLimiter, optionalAuth, ah(async (req, res) => {
  const b = chatSchema.parse(req.body);
  const sessionKey = b.sessionKey || crypto.randomUUID();
  const out = await chat({
    sessionKey, userMessage: b.message, lang: b.lang,
    history: b.history, userId: req.user?.id || null
  });
  res.json({ sessionKey, ...out });
}));

const planSchema = z.object({
  query: z.string().min(2).max(500),
  lang: z.enum(['rw', 'en']).default('rw')
});

aiRouter.post('/plan', aiLimiter, ah(async (req, res) => {
  const b = planSchema.parse(req.body);
  const out = await aiPlan({ query: b.query, lang: b.lang });
  res.json(out);
}));