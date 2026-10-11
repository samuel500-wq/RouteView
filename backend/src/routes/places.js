import { Router } from 'express';
import { z } from 'zod';
import { ah } from '../middleware/error.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { optionalAuth } from '../middleware/auth.js';
import { placeChat } from '../ai/placeAssistant.js';
import { getDemoPlaces, CATEGORY_MAP } from '../services/overpass.js';

export const placesRouter = Router();

placesRouter.get('/categories', (_req, res) => {
  res.json({
    categories: Object.entries(CATEGORY_MAP).map(([key, v]) => ({
      key,
      label_en: v.label_en,
      label_rw: v.label_rw
    }))
  });
});

placesRouter.get('/demo', (req, res) => {
  const cats = (req.query.categories || '').toString().split(',').filter(Boolean);
  res.json({ places: getDemoPlaces(cats) });
});

const chatSchema = z.object({
  message: z.string().min(1).max(500),
  lang: z.enum(['rw', 'en']).default('rw'),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(2000)
  })).max(10).default([]),
  userLocation: z.object({
    lat: z.number().gte(-90).lte(90),
    lng: z.number().gte(-180).lte(180)
  }).nullable().optional()
});

placesRouter.post('/chat', aiLimiter, optionalAuth, ah(async (req, res) => {
  const b = chatSchema.parse(req.body);
  const out = await placeChat({
    message: b.message,
    lang: b.lang,
    history: b.history,
    userLocation: b.userLocation || null
  });
  res.json(out);
}));