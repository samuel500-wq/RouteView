import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { ah, ApiError } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { estimateArrival } from '../services/arrival.js';
import { getVehicleStatuses } from '../services/vehicleStatus.js';
import { simulatorStatus } from '../services/fleetSimulator.js';

export const vehiclesRouter = Router();

/* ------------------------------------------------------------------ *
 *  Live vehicles with rich status (passengers, next stop, destination)
 * ------------------------------------------------------------------ */
vehiclesRouter.get('/vehicles', ah(async (_req, res) => {
  const vehicles = await getVehicleStatuses();
  res.json({ vehicles });
}));

/* ------------------------------------------------------------------ *
 *  Fleet simulator status — useful during a demo to prove it is running
 * ------------------------------------------------------------------ */
vehiclesRouter.get('/simulator/status', (_req, res) => {
  res.json(simulatorStatus());
});

/* ------------------------------------------------------------------ *
 *  ML arrival estimate
 * ------------------------------------------------------------------ */
vehiclesRouter.get('/vehicles/:id/arrival', ah(async (req, res) => {
  const vehicleId = Number(req.params.id);
  const targetStopId = Number(req.query.stop_id);
  if (!targetStopId) throw new ApiError(400, 'stop_id_required');
  const out = await estimateArrival({ vehicleId, targetStopId });
  if (out.error) throw new ApiError(404, out.error);
  res.json(out);
}));

/* ------------------------------------------------------------------ *
 *  Ingest — used by ESP32 devices or an external simulator (operator+)
 * ------------------------------------------------------------------ */
const ingestSchema = z.object({
  vehicle_id: z.number().int().positive(),
  route_id: z.number().int().positive().nullable().optional(),
  trip_id: z.number().int().positive().nullable().optional(),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  speed_kmh: z.number().min(0).max(200).optional(),
  heading_deg: z.number().int().min(0).max(359).optional(),
  source: z.enum(['simulator', 'gps', 'manual']).default('gps'),
  recorded_at: z.string().datetime().optional()
});

vehiclesRouter.post('/vehicles/ingest',
  requireAuth, requireRole('operator', 'admin'),
  ah(async (req, res) => {
    const b = ingestSchema.parse(req.body);
    const [r] = await pool.execute(
      `INSERT INTO vehicle_positions
        (vehicle_id, route_id, trip_id, lat, lng, speed_kmh, heading_deg, source, recorded_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [b.vehicle_id, b.route_id || null, b.trip_id || null,
       b.lat, b.lng, b.speed_kmh ?? null, b.heading_deg ?? null, b.source,
       b.recorded_at ? new Date(b.recorded_at) : new Date()]
    );
    res.json({ ok: true, id: r.insertId });
  })
);