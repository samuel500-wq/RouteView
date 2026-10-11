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

/* ================================================================== *
 *  Stop analytics — real insights from route + booking data           *
 * ================================================================== */
export async function stopAnalytics() {
  const [[counts]] = await pool.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN is_active=0 THEN 1 ELSE 0 END) AS inactive
      FROM stops
  `);

  // Stops with the number of routes they serve
  const [stopRoutes] = await pool.query(`
    SELECT s.id, s.code, s.name_en, s.name_rw, s.lat, s.lng, s.is_active,
           COUNT(DISTINCT rs.route_id) AS route_count
      FROM stops s
      LEFT JOIN route_stops rs ON rs.stop_id = s.id
     GROUP BY s.id
  `);

  // Bookings departing from each stop (urban) — 30 days
  const [stopDepartures] = await pool.query(`
    SELECT b.from_stop_id AS stop_id,
           COUNT(*) AS bookings,
           COALESCE(SUM(b.amount_rwf), 0) AS revenue
      FROM bookings b
     WHERE b.status IN ('paid') AND b.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY b.from_stop_id
  `);

  // Bookings arriving at each stop (urban) — 30 days
  const [stopArrivals] = await pool.query(`
    SELECT b.to_stop_id AS stop_id, COUNT(*) AS bookings
      FROM bookings b
     WHERE b.status IN ('paid') AND b.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY b.to_stop_id
  `);

  const departuresById = new Map(stopDepartures.map((r) => [r.stop_id, r]));
  const arrivalsById = new Map(stopArrivals.map((r) => [r.stop_id, r]));

  const enriched = stopRoutes.map((s) => {
    const dep = departuresById.get(s.id);
    const arr = arrivalsById.get(s.id);
    return {
      id: s.id,
      code: s.code,
      name_en: s.name_en,
      name_rw: s.name_rw,
      lat: Number(s.lat),
      lng: Number(s.lng),
      is_active: Boolean(s.is_active),
      route_count: Number(s.route_count) || 0,
      departures_30d: Number(dep?.bookings) || 0,
      arrivals_30d: Number(arr?.bookings) || 0,
      revenue_30d: Number(dep?.revenue) || 0
    };
  });

  // Orphaned: no routes attached
  const orphaned = enriched.filter((s) => s.route_count === 0);

  // Nearby duplicates: pairs within 200 m
  const duplicates = [];
  const seen = new Set();
  for (let i = 0; i < enriched.length; i++) {
    for (let j = i + 1; j < enriched.length; j++) {
      const a = enriched[i], b = enriched[j];
      const d = haversine(a, b);
      if (d < 200) {
        const key = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        duplicates.push({
          a: { id: a.id, code: a.code, name_en: a.name_en },
          b: { id: b.id, code: b.code, name_en: b.name_en },
          distance_m: Math.round(d)
        });
      }
    }
  }
  duplicates.sort((x, y) => x.distance_m - y.distance_m);

  // Top stops by routes served
  const topByRoutes = [...enriched]
    .filter((s) => s.route_count > 0)
    .sort((a, b) => b.route_count - a.route_count)
    .slice(0, 8);

  // Top stops by passenger boardings (30 days)
  const topByBoardings = [...enriched]
    .filter((s) => s.departures_30d > 0)
    .sort((a, b) => b.departures_30d - a.departures_30d)
    .slice(0, 8);

  // Top stops by revenue
  const topByRevenue = [...enriched]
    .filter((s) => s.revenue_30d > 0)
    .sort((a, b) => b.revenue_30d - a.revenue_30d)
    .slice(0, 8);

  // Underused: active, but zero bookings in 30 days
  const underused = enriched.filter(
    (s) => s.is_active && s.route_count > 0 && s.departures_30d === 0
  );

  // Distribution of stops by how many routes they serve
  const routeDistribution = [
    { label: '0 routes', value: enriched.filter((s) => s.route_count === 0).length, color: '#ef4444' },
    { label: '1 route',  value: enriched.filter((s) => s.route_count === 1).length, color: '#f59e0b' },
    { label: '2 routes', value: enriched.filter((s) => s.route_count === 2).length, color: '#0ea5e9' },
    { label: '3+ routes', value: enriched.filter((s) => s.route_count >= 3).length, color: '#10b981' }
  ];

  // Recommendations
  const recommendations = buildRecommendations({
    orphaned, duplicates, underused, topByBoardings, topByRoutes
  });

  return {
    overview: {
      total: Number(counts.total),
      active: Number(counts.active),
      inactive: Number(counts.inactive),
      orphaned: orphaned.length,
      duplicates: duplicates.length,
      underused: underused.length,
      total_routes_attached: enriched.reduce((s, x) => s + x.route_count, 0)
    },
    orphaned: orphaned.slice(0, 10),
    duplicates: duplicates.slice(0, 8),
    underused: underused.slice(0, 10),
    top_by_routes: topByRoutes,
    top_by_boardings: topByBoardings,
    top_by_revenue: topByRevenue,
    route_distribution: routeDistribution,
    recommendations,
    timestamp: new Date().toISOString()
  };
}

/* ================================================================== *
 *  Rule-based recommendations                                         *
 * ================================================================== */
function buildRecommendations({ orphaned, duplicates, underused, topByBoardings, topByRoutes }) {
  const out = [];

  if (orphaned.length > 0) {
    out.push({
      tone: 'warning',
      title: `${orphaned.length} orphaned stop${orphaned.length > 1 ? 's' : ''}`,
      body: 'No active route serves these stops. Attach them to a route or remove them to keep the network tidy.'
    });
  }

  if (duplicates.length > 0) {
    out.push({
      tone: 'warning',
      title: `${duplicates.length} pair${duplicates.length > 1 ? 's' : ''} of stops very close together`,
      body: `The closest pair is ${duplicates[0].a.name_en} and ${duplicates[0].b.name_en} — ${duplicates[0].distance_m} m apart. Consider merging or renaming for clarity.`
    });
  }

  if (underused.length > 0) {
    out.push({
      tone: 'info',
      title: `${underused.length} stop${underused.length > 1 ? 's' : ''} with no recent boardings`,
      body: 'These stops are active but no passenger has booked a trip originating from them in the last 30 days. Check if they need promotion or removal.'
    });
  }

  if (topByBoardings.length > 0) {
    out.push({
      tone: 'positive',
      title: `Busiest stop: ${topByBoardings[0].name_en}`,
      body: `${topByBoardings[0].departures_30d} boardings and ${topByBoardings[0].arrivals_30d} arrivals in the last 30 days.`
    });
  }

  if (topByRoutes.length > 0) {
    out.push({
      tone: 'info',
      title: `Most connected: ${topByRoutes[0].name_en}`,
      body: `Served by ${topByRoutes[0].route_count} routes — a natural transfer hub.`
    });
  }

  return out.slice(0, 6);
}