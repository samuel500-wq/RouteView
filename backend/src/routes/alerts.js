import { Router } from 'express';
import { pool } from '../db/pool.js';
import { ah } from '../middleware/error.js';

export const alertsRouter = Router();

alertsRouter.get('/', ah(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT id, route_id, severity, title_rw, title_en, body_rw, body_en, starts_at, ends_at
       FROM service_alerts
      WHERE is_active = 1
        AND (ends_at IS NULL OR ends_at > NOW())
      ORDER BY starts_at DESC
      LIMIT 50`
  );
  res.json({ alerts: rows });
}));