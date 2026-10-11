import { routeAnalytics } from '../services/routeAnalytics.js';
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { planJourney, nearestStops } from '../services/journey.js';
import { ah, ApiError } from '../middleware/error.js';

export const transportRouter = Router();

transportRouter.get('/routes', ah(async (req, res) => {
  const q = `%${(req.query.q || '').toString().trim()}%`;
  const [rows] = await pool.query(
    `SELECT id, code, name_rw, name_en, direction_label, color_hex
       FROM routes WHERE is_active=1
         AND (code LIKE ? OR name_rw LIKE ? OR name_en LIKE ?)
       ORDER BY code`, [q, q, q]
  );
  res.json({ routes: rows });
}));

transportRouter.get('/routes/:id/analytics', ah(async (req, res) => {
  const data = await routeAnalytics(Number(req.params.id));
  if (!data) throw new ApiError(404, 'route_not_found');
  res.json(data);
}));

transportRouter.get('/routes/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  const [routes] = await pool.query('SELECT * FROM routes WHERE id=?', [id]);
  if (!routes[0]) throw new ApiError(404, 'route_not_found');
  const [stops] = await pool.query(
    `SELECT rs.sequence_no, rs.distance_from_start_m,
            s.id, s.code, s.name_rw, s.name_en, s.lat, s.lng
       FROM route_stops rs JOIN stops s ON s.id = rs.stop_id
      WHERE rs.route_id=? ORDER BY rs.sequence_no`, [id]
  );
  const [schedules] = await pool.query(
    'SELECT departure_time, days_of_week FROM schedules WHERE route_id=? ORDER BY departure_time', [id]
  );
  res.json({ route: routes[0], stops, schedules });
}));

transportRouter.get('/stops', ah(async (req, res) => {
  const q = `%${(req.query.q || '').toString().trim()}%`;
  const [rows] = await pool.query(
    `SELECT id, code, name_rw, name_en, lat, lng FROM stops
      WHERE is_active=1 AND (name_rw LIKE ? OR name_en LIKE ? OR code LIKE ?)
      ORDER BY name_en LIMIT 100`, [q, q, q]
  );
  res.json({ stops: rows });
}));

transportRouter.get('/stops/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  const [stops] = await pool.query('SELECT * FROM stops WHERE id=?', [id]);
  if (!stops[0]) throw new ApiError(404, 'stop_not_found');
  const [routes] = await pool.query(
    `SELECT r.id, r.code, r.name_rw, r.name_en, rs.sequence_no
       FROM route_stops rs JOIN routes r ON r.id = rs.route_id
      WHERE rs.stop_id=? ORDER BY r.code`, [id]
  );
  res.json({ stop: stops[0], routes });
}));

const planSchema = z.object({
  fromStopId: z.number().int().positive(),
  toStopId: z.number().int().positive()
});
transportRouter.post('/journeys/plan', ah(async (req, res) => {
  const body = planSchema.parse(req.body);
  if (body.fromStopId === body.toStopId) throw new ApiError(400, 'same_stop');
  const options = await planJourney(body);
  res.json({ options });
}));

transportRouter.get('/stops/near', ah(async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new ApiError(400, 'bad_coords');
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
  res.json({ stops: await nearestStops({ lat, lng, limit }) });
}));