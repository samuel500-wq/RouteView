import { pool } from '../db/pool.js';

const R = 6371000;
const toRad = (d) => (d * Math.PI) / 180;
function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export async function getVehicleStatuses() {
  const [vehicles] = await pool.query(`
    SELECT vp.vehicle_id, v.plate, v.label, v.capacity, v.status AS vehicle_status,
           vp.route_id, r.code AS route_code, r.color_hex,
           r.name_en AS route_name_en, r.name_rw AS route_name_rw,
           vp.lat, vp.lng, vp.speed_kmh, vp.heading_deg,
           vp.source, vp.recorded_at
      FROM vehicle_positions vp
      JOIN vehicles v ON v.id = vp.vehicle_id
      LEFT JOIN routes r ON r.id = vp.route_id
      JOIN (
        SELECT vehicle_id, MAX(recorded_at) AS m
          FROM vehicle_positions
         GROUP BY vehicle_id
      ) latest ON latest.vehicle_id = vp.vehicle_id AND latest.m = vp.recorded_at
  `);

  const routeIds = [...new Set(vehicles.map((v) => v.route_id).filter(Boolean))];
  const stopsByRoute = {};
  if (routeIds.length > 0) {
    const ph = routeIds.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT rs.route_id, rs.sequence_no,
              s.id, s.code, s.name_en, s.name_rw, s.lat, s.lng
         FROM route_stops rs
         JOIN stops s ON s.id = rs.stop_id
        WHERE rs.route_id IN (${ph})
        ORDER BY rs.route_id, rs.sequence_no`,
      routeIds
    );
    for (const r of rows) {
      (stopsByRoute[r.route_id] ||= []).push({
        sequence_no: r.sequence_no,
        id: r.id, code: r.code,
        name_en: r.name_en, name_rw: r.name_rw,
        lat: Number(r.lat), lng: Number(r.lng)
      });
    }
  }

  const now = Date.now();
  const hour = new Date().getHours();
  const isPeak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);

  return vehicles.map((v) => {
    const routeStops = stopsByRoute[v.route_id] || [];
    let nextStop = null;
    let prevStop = null;
    let destination = null;

    if (routeStops.length > 0) {
      const pos = { lat: Number(v.lat), lng: Number(v.lng) };
      let nearestIdx = 0;
      let minD = Infinity;
      for (let i = 0; i < routeStops.length; i++) {
        const d = haversine(pos, routeStops[i]);
        if (d < minD) { minD = d; nearestIdx = i; }
      }
      prevStop = routeStops[nearestIdx] || null;
      nextStop = routeStops[nearestIdx + 1] || null;
      destination = routeStops[routeStops.length - 1];
    }

    // Deterministic pseudo-random passenger count so it stays stable for a minute
    const seed = (v.vehicle_id * 73856093) ^ (Math.floor(now / 60000) * 19349663);
    const pseudo = (Math.abs((seed * 2654435761) >>> 0) % 10000) / 10000;
    const occupancy = isPeak ? 0.5 + pseudo * 0.45 : 0.15 + pseudo * 0.4;
    const passengers = Math.round((v.capacity || 30) * Math.min(0.98, occupancy));

    return {
      vehicle_id: v.vehicle_id,
      plate: v.plate,
      label: v.label,
      capacity: v.capacity,
      vehicle_status: v.vehicle_status,
      passengers,
      route_id: v.route_id,
      route_code: v.route_code,
      route_name_en: v.route_name_en,
      route_name_rw: v.route_name_rw,
      color_hex: v.color_hex || '#0ea5e9',
      lat: Number(v.lat),
      lng: Number(v.lng),
      speed_kmh: v.speed_kmh != null ? Number(v.speed_kmh) : null,
      heading_deg: v.heading_deg != null ? Number(v.heading_deg) : null,
      source: v.source,
      simulated: v.source === 'simulator',
      age_seconds: Math.round((now - new Date(v.recorded_at).getTime()) / 1000),
      prev_stop: prevStop,
      next_stop: nextStop,
      destination
    };
  });
}