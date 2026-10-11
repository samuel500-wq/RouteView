import { pool } from '../db/pool.js';
import { config } from '../config.js';
import { haversine } from './fares.js';

const STALE_SECONDS = 90;

/**
 * Get an arrival estimate for a specific vehicle approaching a specific stop.
 * Delegates the numeric prediction to the Python ML service; falls back to a
 * simple physics-based estimate when the model is unavailable.
 *
 * Returns: { seconds, source: 'model'|'fallback', model_version, features, stale }
 */
export async function estimateArrival({ vehicleId, targetStopId }) {
  const [vpRows] = await pool.query(
    `SELECT vp.*, v.plate FROM vehicle_positions vp
       JOIN vehicles v ON v.id = vp.vehicle_id
      WHERE vp.vehicle_id = ?
      ORDER BY vp.recorded_at DESC LIMIT 1`,
    [vehicleId]
  );
  const vp = vpRows[0];
  if (!vp) return { error: 'no_position' };

  const stale = (Date.now() - new Date(vp.recorded_at).getTime()) / 1000 > STALE_SECONDS;

  const [stopRows] = await pool.query('SELECT id, lat, lng FROM stops WHERE id=?', [targetStopId]);
  const stop = stopRows[0];
  if (!stop) return { error: 'no_stop' };

  const straightM = haversine({ lat: vp.lat, lng: vp.lng }, { lat: stop.lat, lng: stop.lng });
  // Path factor: approximate road distance as 1.25 * straight-line.
  const remainingM = straightM * 1.25;
  const recentSpeedKmh = vp.speed_kmh && vp.speed_kmh > 1 ? Number(vp.speed_kmh) : 18;

  const now = new Date();
  const features = {
    distance_remaining_m: Math.round(remainingM),
    recent_speed_kmh: recentSpeedKmh,
    hour_of_day: now.getHours(),
    day_of_week: now.getDay(),
    route_id: vp.route_id || 0,
    remaining_stops: await countRemainingStops(vp.route_id, vp.lat, vp.lng, targetStopId)
  };

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(`${config.ml.url}/predict`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(features),
      signal: ctrl.signal
    });
    clearTimeout(t);
    if (r.ok) {
      const data = await r.json();
      return {
        seconds: Math.max(30, Math.round(data.seconds)),
        source: 'model',
        model_version: data.model_version,
        features,
        stale,
        vehicle: { id: vp.vehicle_id, plate: vp.plate }
      };
    }
  } catch { /* fall through */ }

  // Fallback: constant-speed estimate
  const speedMps = Math.max(2, recentSpeedKmh / 3.6);
  return {
    seconds: Math.round(remainingM / speedMps),
    source: 'fallback',
    model_version: null,
    features,
    stale,
    vehicle: { id: vp.vehicle_id, plate: vp.plate }
  };
}

async function countRemainingStops(routeId, lat, lng, targetStopId) {
  if (!routeId) return 0;
  const [rows] = await pool.query(
    `SELECT rs.stop_id, rs.sequence_no, s.lat, s.lng
       FROM route_stops rs JOIN stops s ON s.id = rs.stop_id
      WHERE rs.route_id = ? ORDER BY rs.sequence_no`,
    [routeId]
  );
  if (!rows.length) return 0;
  // nearest to current vehicle
  let nearest = rows[0], best = Infinity;
  for (const r of rows) {
    const d = haversine({ lat, lng }, { lat: r.lat, lng: r.lng });
    if (d < best) { best = d; nearest = r; }
  }
  const target = rows.find((r) => r.stop_id === targetStopId);
  if (!target) return 0;
  return Math.max(0, target.sequence_no - nearest.sequence_no);
}