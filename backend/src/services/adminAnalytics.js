import { pool } from '../db/pool.js';
import { getVehicleStatuses } from './vehicleStatus.js';
import { simulatorStatus } from './fleetSimulator.js';

/* ================================================================== *
 *  Overview KPIs — current vs previous 30-day window                  *
 * ================================================================== */
export async function adminOverview() {
  // Combined urban + intercity paid bookings
  const [[urban]] = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                        THEN amount_rwf ELSE 0 END), 0) AS revenue_cur,
      COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
                        AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
                        THEN amount_rwf ELSE 0 END), 0) AS revenue_prev,
      COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) AS bookings_cur,
      COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
                 AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) AS bookings_prev
      FROM bookings WHERE status IN ('paid')
  `);

  const [[inter]] = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                        THEN amount_rwf ELSE 0 END), 0) AS revenue_cur,
      COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
                        AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
                        THEN amount_rwf ELSE 0 END), 0) AS revenue_prev,
      COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) AS bookings_cur,
      COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
                 AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) AS bookings_prev
      FROM intercity_bookings WHERE status IN ('paid')
  `);

  const [[fleet]] = await pool.query('SELECT COUNT(*) AS c FROM vehicles');
  const [[active]] = await pool.query(`
    SELECT COUNT(DISTINCT vehicle_id) AS c FROM vehicle_positions
     WHERE recorded_at > DATE_SUB(NOW(), INTERVAL 3 MINUTE)
  `);
  const [[sim]] = await pool.query(`
    SELECT COUNT(*) AS c FROM vehicle_positions
     WHERE source='simulator' AND recorded_at > DATE_SUB(NOW(), INTERVAL 3 MINUTE)
  `);
  const [[redemptions]] = await pool.query(`
    SELECT COUNT(*) AS c FROM (
      SELECT id FROM ticket_redemptions WHERE redeemed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      UNION ALL
      SELECT id FROM intercity_tickets WHERE used_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    ) u
  `);
  const [[alerts]] = await pool.query(`
    SELECT COUNT(*) AS c FROM service_alerts
     WHERE is_active=1 AND (ends_at IS NULL OR ends_at > NOW())
  `);
  const [[users]] = await pool.query('SELECT COUNT(*) AS c FROM users');

  const revenueCur = Number(urban.revenue_cur) + Number(inter.revenue_cur);
  const revenuePrev = Number(urban.revenue_prev) + Number(inter.revenue_prev);
  const bookingsCur = Number(urban.bookings_cur) + Number(inter.bookings_cur);
  const bookingsPrev = Number(urban.bookings_prev) + Number(inter.bookings_prev);

  return {
    revenue_30d: revenueCur,
    revenue_prev_30d: revenuePrev,
    revenue_change_pct: pctChange(revenueCur, revenuePrev),

    bookings_30d: bookingsCur,
    bookings_prev_30d: bookingsPrev,
    bookings_change_pct: pctChange(bookingsCur, bookingsPrev),

    active_vehicles: active.c,
    total_vehicles: fleet.c,
    simulated_vehicles: sim.c,

    redemptions_30d: Number(redemptions.c),
    active_alerts: Number(alerts.c),
    total_users: Number(users.c),

    timestamp: new Date().toISOString(),
    note: 'Urban + intercity bookings, 30-day rolling window.'
  };
}

function pctChange(cur, prev) {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

/* ================================================================== *
 *  Daily bookings trend (last 30 days, urban + intercity combined)    *
 * ================================================================== */
export async function bookingsTrend() {
  const [urban] = await pool.query(`
    SELECT DATE(created_at) AS d, COUNT(*) AS c, COALESCE(SUM(amount_rwf), 0) AS r
      FROM bookings
     WHERE status IN ('paid') AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY DATE(created_at)
     ORDER BY d
  `);
  const [inter] = await pool.query(`
    SELECT DATE(created_at) AS d, COUNT(*) AS c, COALESCE(SUM(amount_rwf), 0) AS r
      FROM intercity_bookings
     WHERE status IN ('paid') AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY DATE(created_at)
     ORDER BY d
  `);

  // Merge by date and fill gaps
  const map = new Map();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);

  for (let i = 0; i < 30; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    map.set(key, { date: key, urban: 0, intercity: 0, total: 0, revenue: 0 });
  }
  for (const row of urban) {
    const key = String(row.d).slice(0, 10);
    const e = map.get(key);
    if (e) { e.urban = Number(row.c); e.total += Number(row.c); e.revenue += Number(row.r); }
  }
  for (const row of inter) {
    const key = String(row.d).slice(0, 10);
    const e = map.get(key);
    if (e) { e.intercity = Number(row.c); e.total += Number(row.c); e.revenue += Number(row.r); }
  }
  return Array.from(map.values());
}

/* ================================================================== *
 *  Top routes — 30 days                                           *
 * ================================================================== */
export async function topRoutes() {
  const [urban] = await pool.query(`
    SELECT r.code, r.name_en, r.color_hex,
           COUNT(b.id) AS bookings,
           COALESCE(SUM(b.amount_rwf), 0) AS revenue
      FROM routes r
      LEFT JOIN bookings b ON b.route_id = r.id
        AND b.status IN ('paid') AND b.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY r.id
     ORDER BY bookings DESC
     LIMIT 8
  `);
  const [inter] = await pool.query(`
    SELECT r.destination_city AS code, r.province AS name_en, '#0ea5e9' AS color_hex,
           COUNT(b.id) AS bookings,
           COALESCE(SUM(b.amount_rwf), 0) AS revenue
      FROM intercity_routes r
      LEFT JOIN intercity_trips t ON t.route_id = r.id
      LEFT JOIN intercity_bookings b ON b.trip_id = t.id AND b.status='paid'
        AND b.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
     WHERE r.origin_city = 'Kigali'
     GROUP BY r.destination_city, r.province
     ORDER BY bookings DESC
     LIMIT 8
  `);

  const combined = [
    ...urban.map((r) => ({
      label: r.code,
      sub: r.name_en,
      color: r.color_hex,
      type: 'urban',
      bookings: Number(r.bookings),
      revenue: Number(r.revenue)
    })),
    ...inter.map((r) => ({
      label: r.code,
      sub: `${r.name_en} province`,
      color: '#10b981',
      type: 'intercity',
      bookings: Number(r.bookings),
      revenue: Number(r.revenue)
    }))
  ]
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 8);

  return combined;
}

/* ================================================================== *
 *  Bookings by hour (heatmap across 24 hours)                        *
 * ================================================================== */
export async function bookingsByHour() {
  const [urban] = await pool.query(`
    SELECT HOUR(depart_at) AS h, COUNT(*) AS c
      FROM bookings
     WHERE status IN ('paid') AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY HOUR(depart_at)
  `);
  const [inter] = await pool.query(`
    SELECT HOUR(t.departure_dt) AS h, COUNT(*) AS c
      FROM intercity_bookings b
      JOIN intercity_trips t ON t.id = b.trip_id
     WHERE b.status='paid' AND b.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY HOUR(t.departure_dt)
  `);

  const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  for (const r of urban) buckets[r.h].count += Number(r.c);
  for (const r of inter) buckets[r.h].count += Number(r.c);
  return buckets;
}

/* ================================================================== *
 *  Bookings by province                                              *
 * ================================================================== */
export async function bookingsByProvince() {
  const [rows] = await pool.query(`
    SELECT COALESCE(r.province, 'urban') AS province,
           COUNT(b.id) AS bookings,
           COALESCE(SUM(b.amount_rwf), 0) AS revenue
      FROM intercity_bookings b
      JOIN intercity_trips t ON t.id = b.trip_id
      JOIN intercity_routes r ON r.id = t.route_id
     WHERE b.status='paid' AND b.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY r.province
  `);
  const [[urbanBookings]] = await pool.query(`
    SELECT COUNT(*) AS c FROM bookings WHERE status='paid'
      AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
  `);

  const palette = {
    northern: '#0ea5e9',
    southern: '#10b981',
    eastern: '#f59e0b',
    western: '#8b5cf6',
    urban: '#64748b'
  };

  const out = rows.map((r) => ({
    label: capitalise(r.province),
    value: Number(r.bookings),
    revenue: Number(r.revenue),
    color: palette[r.province] || '#94a3b8'
  }));
  if (Number(urbanBookings.c) > 0) {
    out.push({
      label: 'Kigali (urban)',
      value: Number(urbanBookings.c),
      revenue: 0,
      color: palette.urban
    });
  }
  return out;
}

/* ================================================================== *
 *  Recent activity feed                                              *
 * ================================================================== */
export async function recentActivity(limit = 12) {
  const [bookings] = await pool.query(`
    (SELECT 'intercity' AS kind, b.reference AS ref, b.created_at AS ts,
            b.amount_rwf AS amount, r.origin_city AS a, r.destination_city AS b_text
       FROM intercity_bookings b
       JOIN intercity_trips t ON t.id = b.trip_id
       JOIN intercity_routes r ON r.id = t.route_id
      WHERE b.status='paid'
      ORDER BY b.created_at DESC LIMIT ${limit})
    UNION ALL
    (SELECT 'urban' AS kind, b.reference AS ref, b.created_at AS ts,
            b.amount_rwf AS amount, r.code AS a, r.name_en AS b_text
       FROM bookings b
       JOIN routes r ON r.id = b.route_id
      WHERE b.status='paid'
      ORDER BY b.created_at DESC LIMIT ${limit})
    ORDER BY ts DESC
    LIMIT ${limit}
  `);

  const [redemptions] = await pool.query(`
    (SELECT 'redeem_intercity' AS kind, t.code AS ref, t.used_at AS ts,
            NULL AS amount, r.origin_city AS a, r.destination_city AS b_text
       FROM intercity_tickets t
       JOIN intercity_bookings b ON b.id = t.booking_id
       JOIN intercity_trips tr ON tr.id = b.trip_id
       JOIN intercity_routes r ON r.id = tr.route_id
      WHERE t.status='used' AND t.used_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY t.used_at DESC LIMIT ${limit})
    UNION ALL
    (SELECT 'redeem_urban' AS kind, t.code AS ref, r.redeemed_at AS ts,
            NULL AS amount, '' AS a, '' AS b_text
       FROM ticket_redemptions r
       JOIN tickets t ON t.id = r.ticket_id
      WHERE r.redeemed_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY r.redeemed_at DESC LIMIT ${limit})
    ORDER BY ts DESC
    LIMIT ${limit}
  `);

  const feed = [
    ...bookings.map((r) => ({
      kind: 'booking',
      label: `New ${r.kind === 'intercity' ? 'interprovincial' : 'urban'} booking`,
      detail: r.kind === 'intercity' ? `${r.a} → ${r.b_text}` : `${r.a} · ${r.b_text}`,
      amount: Number(r.amount),
      ref: r.ref,
      ts: r.ts
    })),
    ...redemptions.map((r) => ({
      kind: 'redeem',
      label: 'Ticket redeemed',
      detail: r.a ? `${r.a} → ${r.b_text}` : 'Urban ticket',
      amount: null,
      ref: r.ref,
      ts: r.ts
    }))
  ]
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))
    .slice(0, limit);

  return feed;
}

/* ================================================================== *
 *  Live fleet snapshot                                               *
 * ================================================================== */
export async function fleetSnapshot() {
  const vehicles = await getVehicleStatuses();
  const sim = simulatorStatus();
  const byRoute = {};
  for (const v of vehicles) {
    const key = v.route_code || '—';
    (byRoute[key] ||= []).push({
      plate: v.plate,
      passengers: v.passengers,
      capacity: v.capacity,
      next_stop: v.next_stop?.name_en || null,
      simulated: v.simulated
    });
  }
  return {
    simulator: sim,
    total: vehicles.length,
    by_route: byRoute
  };
}

/* ================================================================== *
 *  Rule-based insights (used when AI is off, and as AI input)         *
 * ================================================================== */
export function ruleBasedInsights({ overview, trend, routes, provinces, hours }) {
  const out = [];

  if (overview.bookings_change_pct !== 0) {
    const dir = overview.bookings_change_pct > 0 ? 'up' : 'down';
    out.push({
      tone: overview.bookings_change_pct > 0 ? 'positive' : 'warning',
      title: `Bookings ${dir} ${Math.abs(overview.bookings_change_pct)}%`,
      body: `30-day bookings: ${overview.bookings_30d} vs ${overview.bookings_prev_30d} in the previous period.`
    });
  }

  if (routes.length > 0 && routes[0].bookings > 0) {
    out.push({
      tone: 'info',
      title: `Top route: ${routes[0].label}`,
      body: `${routes[0].bookings} bookings · ${routes[0].revenue.toLocaleString()} RWF.`
    });
  }

  const peakHour = hours.reduce((a, b) => (b.count > a.count ? b : a), { hour: 0, count: 0 });
  if (peakHour.count > 0) {
    out.push({
      tone: 'info',
      title: `Peak departure hour: ${String(peakHour.hour).padStart(2, '0')}:00`,
      body: `${peakHour.count} bookings at this hour in the last 30 days.`
    });
  }

  const topProv = provinces.slice().sort((a, b) => b.value - a.value)[0];
  if (topProv && topProv.value > 0) {
    out.push({
      tone: 'info',
      title: `Top province: ${topProv.label}`,
      body: `${topProv.value} bookings.`
    });
  }

  if (overview.active_vehicles < overview.total_vehicles) {
    out.push({
      tone: 'warning',
      title: `${overview.total_vehicles - overview.active_vehicles} idle vehicles`,
      body: `${overview.active_vehicles} of ${overview.total_vehicles} vehicles reporting in the last 3 minutes.`
    });
  }

  if (overview.active_alerts > 0) {
    out.push({
      tone: 'warning',
      title: `${overview.active_alerts} active service alert${overview.active_alerts > 1 ? 's' : ''}`,
      body: 'Check the Alerts tab for details.'
    });
  }

  return out.slice(0, 6);
}

function capitalise(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}