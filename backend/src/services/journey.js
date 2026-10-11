import { pool } from '../db/pool.js';
import { fareBetween, haversine } from './fares.js';

/**
 * Very small journey planner: direct routes first, then one transfer.
 * Uses actual route_stops data from the DB. Not a full RAPTOR/CSA planner,
 * but coherent for the demonstration network.
 */
export async function planJourney({ fromStopId, toStopId, maxTransfers = 1 }) {
  const [direct] = await pool.query(
    `SELECT r.id AS route_id, r.code, r.name_rw, r.name_en, r.color_hex,
            rs_a.sequence_no AS seq_a, rs_b.sequence_no AS seq_b
       FROM routes r
       JOIN route_stops rs_a ON rs_a.route_id = r.id AND rs_a.stop_id = ?
       JOIN route_stops rs_b ON rs_b.route_id = r.id AND rs_b.stop_id = ?
      WHERE rs_a.sequence_no < rs_b.sequence_no
        AND r.is_active = 1`,
    [fromStopId, toStopId]
  );

  const directOptions = [];
  for (const d of direct) {
    const fare = await fareBetween(d.route_id, fromStopId, toStopId);
    const [seg] = await pool.query(
      `SELECT SUM(rs2.distance_from_start_m - rs1.distance_from_start_m) AS m
         FROM route_stops rs1
         JOIN route_stops rs2 ON rs2.route_id = rs1.route_id
        WHERE rs1.route_id = ? AND rs1.sequence_no = ?
          AND rs2.sequence_no = ?`,
      [d.route_id, d.seq_a, d.seq_b]
    );
    const metres = Number(seg[0]?.m || 0);
    directOptions.push({
      type: 'direct',
      route: { id: d.route_id, code: d.code, name_rw: d.name_rw, name_en: d.name_en, color: d.color_hex },
      fromStopId, toStopId,
      distance_m: metres,
      estimated_minutes: Math.max(6, Math.round(metres / 1000 / 22 * 60)),
      fare: fare ? { amount_rwf: fare.amount, source: fare.source } : null,
      instructions: [
        `Board route ${d.code} at the origin stop.`,
        `Ride ${d.seq_b - d.seq_a} stop(s).`,
        `Alight at the destination stop.`
      ]
    });
  }
  if (directOptions.length || maxTransfers < 1) return directOptions;

  // Single transfer
  const [legs1] = await pool.query(
    `SELECT r.id AS route_id, r.code, r.name_rw, r.name_en, r.color_hex,
            rs_a.sequence_no AS seq_a, rs_b.sequence_no AS seq_b, rs_b.stop_id AS transfer_id
       FROM routes r
       JOIN route_stops rs_a ON rs_a.route_id = r.id AND rs_a.stop_id = ?
       JOIN route_stops rs_b ON rs_b.route_id = r.id
      WHERE rs_a.sequence_no < rs_b.sequence_no AND r.is_active = 1`,
    [fromStopId]
  );

  const options = [];
  for (const l1 of legs1) {
    if (l1.transfer_id === toStopId) continue;
    const [legs2] = await pool.query(
      `SELECT r.id AS route_id, r.code, r.name_rw, r.name_en, r.color_hex,
              rs_a.sequence_no AS seq_a, rs_b.sequence_no AS seq_b
         FROM routes r
         JOIN route_stops rs_a ON rs_a.route_id = r.id AND rs_a.stop_id = ?
         JOIN route_stops rs_b ON rs_b.route_id = r.id AND rs_b.stop_id = ?
        WHERE rs_a.sequence_no < rs_b.sequence_no
          AND r.is_active = 1 AND r.id <> ?`,
      [l1.transfer_id, toStopId, l1.route_id]
    );
    for (const l2 of legs2) {
      const f1 = await fareBetween(l1.route_id, fromStopId, l1.transfer_id);
      const f2 = await fareBetween(l2.route_id, l1.transfer_id, toStopId);
      if (!f1 || !f2) continue;
      const totalFare = f1.amount + f2.amount;
      options.push({
        type: 'transfer',
        legs: [
          { route: { id: l1.route_id, code: l1.code, name_rw: l1.name_rw, name_en: l1.name_en, color: l1.color_hex },
            fromStopId, toStopId: l1.transfer_id, fare: f1 },
          { route: { id: l2.route_id, code: l2.code, name_rw: l2.name_rw, name_en: l2.name_en, color: l2.color_hex },
            fromStopId: l1.transfer_id, toStopId, fare: f2 }
        ],
        estimated_minutes: 35 + Math.floor(Math.random() * 15), // demo heuristic
        fare: { amount_rwf: totalFare, source: 'sum' },
        instructions: [
          `Board route ${l1.code}.`,
          `Transfer at stop ${l1.transfer_id}.`,
          `Board route ${l2.code} to destination.`
        ]
      });
    }
    if (options.length >= 5) break;
  }
  return options.slice(0, 5);
}

export async function nearestStops({ lat, lng, limit = 5 }) {
  const [rows] = await pool.query('SELECT id, code, name_rw, name_en, lat, lng FROM stops WHERE is_active=1');
  return rows
    .map((s) => ({ ...s, distance_m: Math.round(haversine({ lat, lng }, s)) }))
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, limit);
}