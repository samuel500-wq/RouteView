import { pool } from '../db/pool.js';

/**
 * Zone-based demonstration fare: base 300 RWF + 50 RWF per km between stops.
 * Falls back to this formula if no explicit fare row exists.
 */
const BASE_RWF = 300;
const PER_KM_RWF = 50;

const R = 6_371_000;
const toRad = (d) => (d * Math.PI) / 180;
export function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export async function fareBetween(routeId, fromStopId, toStopId) {
  const [rows] = await pool.query(
    'SELECT amount_rwf FROM fares WHERE route_id=? AND from_stop_id=? AND to_stop_id=?',
    [routeId, fromStopId, toStopId]
  );
  if (rows[0]) return { amount: rows[0].amount_rwf, source: 'table' };

  const [stops] = await pool.query(
    `SELECT rs.stop_id, s.lat, s.lng, rs.distance_from_start_m
       FROM route_stops rs JOIN stops s ON s.id = rs.stop_id
      WHERE rs.route_id = ? ORDER BY rs.sequence_no`,
    [routeId]
  );
  const a = stops.find((s) => s.stop_id === fromStopId);
  const b = stops.find((s) => s.stop_id === toStopId);
  if (!a || !b) return null;
  const metres = Math.abs(b.distance_from_start_m - a.distance_from_start_m);
  const km = metres / 1000;
  const amount = Math.round((BASE_RWF + PER_KM_RWF * km) / 50) * 50;
  return { amount, source: 'formula' };
}