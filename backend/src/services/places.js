import { pool } from '../db/pool.js';
import { planJourney } from './journey.js';
import { fareBetween } from './fares.js';

const R = 6371000;
const toRad = (d) => (d * Math.PI) / 180;
function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Nearest N stops to a point, from our own stops table. */
export async function nearestStops({ lat, lng, limit = 3 }) {
  const [rows] = await pool.query(
    'SELECT id, code, name_rw, name_en, lat, lng FROM stops WHERE is_active=1'
  );
  return rows
    .map((s) => ({
      id: s.id, code: s.code, name_rw: s.name_rw, name_en: s.name_en,
      lat: Number(s.lat), lng: Number(s.lng),
      distance_m: Math.round(haversine({ lat, lng }, { lat: Number(s.lat), lng: Number(s.lng) }))
    }))
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, limit);
}

/**
 * Enrich one place with transport options from the user's position.
 * Returns walking distance, nearest stop from user, nearest stop to place,
 * a bus route option (from our planner), bus fare, and a moto fare estimate.
 */
export async function enrichPlace({ place, userLat, userLng }) {
  const from = { lat: userLat, lng: userLng };
  const to = { lat: place.lat, lng: place.lng };

  const straightM = Math.round(haversine(from, to));
  const walkingMin = Math.max(1, Math.round(straightM / 1000 / 5 * 60));

  // Moto estimate — Kigali typical: 500 base + 250/km, round to nearest 100
  const km = straightM / 1000;
  const motoFare = Math.max(500, Math.round((500 + 250 * km) / 100) * 100);
  const motoMin = Math.max(2, Math.round(km / 25 * 60)); // ~25 km/h average

  // Nearest stops to user and to place
  const [fromStops, toStops] = await Promise.all([
    nearestStops({ lat: userLat, lng: userLng, limit: 2 }),
    nearestStops({ lat: place.lat, lng: place.lng, limit: 2 })
  ]);

  let bus = null;
  if (fromStops.length && toStops.length) {
    // Try each combination until a route is found
    for (const a of fromStops) {
      for (const b of toStops) {
        if (a.id === b.id) continue;
        try {
          const opts = await planJourney({ fromStopId: a.id, toStopId: b.id });
          if (opts && opts.length > 0) {
            const best = opts[0];
            bus = {
              available: true,
              type: best.type,
              route_code: best.type === 'direct' ? best.route.code : best.legs.map((l) => l.route.code).join(' → '),
              route_color: best.type === 'direct' ? best.route.color : best.legs[0].route.color,
              from_stop: { id: a.id, name_en: a.name_en, name_rw: a.name_rw, distance_m: a.distance_m },
              to_stop: { id: b.id, name_en: b.name_en, name_rw: b.name_rw, distance_m: b.distance_m },
              duration_min: best.estimated_minutes,
              fare_rwf: best.fare?.amount_rwf || 500,
              instructions: best.instructions
            };
            break;
          }
        } catch { /* try next */ }
      }
      if (bus) break;
    }
  }

  return {
    ...place,
    distance_m: straightM,
    walking_min: walkingMin,
    moto: { fare_rwf: motoFare, duration_min: motoMin },
    bus,
    from_stops: fromStops,
    to_stops: toStops
  };
}

export async function enrichPlaces({ places, userLat, userLng }) {
  const enriched = [];
  for (const p of places) {
    try {
      enriched.push(await enrichPlace({ place: p, userLat, userLng }));
    } catch (e) {
      enriched.push({ ...p, distance_m: null, moto: null, bus: null });
    }
  }
  // Sort by straight-line distance
  enriched.sort((a, b) => (a.distance_m || 9e9) - (b.distance_m || 9e9));
  return enriched;
}