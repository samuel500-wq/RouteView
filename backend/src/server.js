import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { errorHandler, notFound } from './middleware/error.js';
import { publicLimiter } from './middleware/rateLimit.js';

import { authRouter } from './routes/auth.js';
import { transportRouter } from './routes/transport.js';
import { vehiclesRouter } from './routes/vehicles.js';
import { bookingsRouter, ticketsRouter } from './routes/bookings.js';
import { aiRouter } from './routes/ai.js';
import { alertsRouter } from './routes/alerts.js';
import { adminRouter } from './routes/admin.js';
import { placesRouter } from './routes/places.js';
import { intercityRouter } from './routes/intercity.js';

import { startFleetSimulator } from './services/fleetSimulator.js';

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/health', async (_req, res) => {
  let db = 'ok';
  try { await pool.query('SELECT 1'); } catch { db = 'error'; }
  res.json({
    ok: db === 'ok',
    db,
    env: config.env,
    ai_configured: !!config.ai.key,
    ml_url: config.ml.url
  });
});

app.use('/api/auth', authRouter);
app.use('/api', publicLimiter, transportRouter);
app.use('/api', publicLimiter, vehiclesRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/places', placesRouter);
app.use('/api/intercity', intercityRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[routeview] API listening on http://localhost:${config.port}`);
  if (process.env.SIMULATE_VEHICLES !== 'false') {
    startFleetSimulator().catch((e) =>
      console.error('[sim] failed to start:', e.message)
    );
  }
});