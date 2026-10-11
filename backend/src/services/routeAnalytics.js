import { pool } from '../db/pool.js';

export async function routeAnalytics(routeId) {
  const [routeRows] = await pool.query(
    'SELECT id, code, name_rw, name_en, direction_label, color_hex FROM routes WHERE id = ?',
    [routeId]
  );
  const route = routeRows[0];
  if (!route) return null;

  const [stops] = await pool.query(
    `SELECT rs.sequence_no, rs.distance_from_start_m,
            s.id, s.code, s.name_rw, s.name_en, s.lat, s.lng
       FROM route_stops rs
       JOIN stops s ON s.id = rs.stop_id
      WHERE rs.route_id = ?
      ORDER BY rs.sequence_no`,
    [routeId]
  );

  const [schedules] = await pool.query(
    'SELECT departure_time, days_of_week FROM schedules WHERE route_id = ? ORDER BY departure_time',
    [routeId]
  );

  const [[fareStats]] = await pool.query(
    `SELECT COUNT(*) AS pairs, MIN(amount_rwf) AS min_fare,
            MAX(amount_rwf) AS max_fare, AVG(amount_rwf) AS avg_fare
       FROM fares WHERE route_id = ?`,
    [routeId]
  );

  const [[bookingStats]] = await pool.query(
    `SELECT COUNT(*) AS total_bookings,
            COALESCE(SUM(amount_rwf), 0) AS revenue,
            COALESCE(AVG(amount_rwf), 0) AS avg_paid
       FROM bookings WHERE route_id = ?`,
    [routeId]
  );

  const [hourly] = await pool.query(
    `SELECT HOUR(depart_at) AS hour, COUNT(*) AS count
       FROM bookings WHERE route_id = ?
       GROUP BY HOUR(depart_at) ORDER BY count DESC LIMIT 3`,
    [routeId]
  );

  const [vehicles] = await pool.query(
    `SELECT vp.vehicle_id, vp.lat, vp.lng, vp.speed_kmh, vp.source,
            vp.recorded_at, v.plate
       FROM vehicle_positions vp
       JOIN vehicles v ON v.id = vp.vehicle_id
       JOIN (
         SELECT vehicle_id, MAX(recorded_at) AS m
           FROM vehicle_positions WHERE route_id = ?
          GROUP BY vehicle_id
       ) latest ON latest.vehicle_id = vp.vehicle_id AND latest.m = vp.recorded_at
      WHERE vp.route_id = ?`,
    [routeId, routeId]
  );

  const [alerts] = await pool.query(
    `SELECT id, severity, title_rw, title_en, body_rw, body_en, starts_at, ends_at
       FROM service_alerts
      WHERE (route_id = ? OR route_id IS NULL)
        AND is_active = 1
        AND (ends_at IS NULL OR ends_at > NOW())
      ORDER BY starts_at DESC LIMIT 5`,
    [routeId]
  );

  const [trend] = await pool.query(
    `SELECT DATE(created_at) AS d, COUNT(*) AS c
       FROM bookings
      WHERE route_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 14 DAY)
      GROUP BY DATE(created_at) ORDER BY d`,
    [routeId]
  );

  const totalDistance = stops.length ? stops[stops.length - 1].distance_from_start_m : 0;
  const now = Date.now();
  const liveVehicles = vehicles.map((v) => ({
    vehicle_id: v.vehicle_id,
    plate: v.plate,
    lat: Number(v.lat),
    lng: Number(v.lng),
    speed_kmh: v.speed_kmh ? Number(v.speed_kmh) : null,
    source: v.source,
    simulated: v.source === 'simulator',
    age_seconds: Math.round((now - new Date(v.recorded_at).getTime()) / 1000)
  }));

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const nextDep = schedules
    .map((s) => {
      const [h, m] = String(s.departure_time).split(':').map(Number);
      return { time: s.departure_time, mins: h * 60 + m };
    })
    .filter((s) => s.mins >= nowMin)
    .sort((a, b) => a.mins - b.mins)[0];

  const insights = buildInsights({
    stops, totalDistance, fareStats, bookingStats,
    liveVehicles, nextDep, schedules, alerts
  });

  return {
    route,
    stops,
    schedules,
    fares: {
      pairs: Number(fareStats.pairs) || 0,
      min_rwf: Number(fareStats.min_fare) || 0,
      max_rwf: Number(fareStats.max_fare) || 0,
      avg_rwf: Math.round(Number(fareStats.avg_fare) || 0)
    },
    bookings: {
      total: Number(bookingStats.total_bookings) || 0,
      revenue_rwf: Number(bookingStats.revenue) || 0,
      avg_paid_rwf: Math.round(Number(bookingStats.avg_paid) || 0)
    },
    peak_hours: hourly.map((h) => ({ hour: Number(h.hour), count: Number(h.count) })),
    live_vehicles: liveVehicles,
    alerts,
    trend: trend.map((t) => ({ date: String(t.d).slice(0, 10), count: Number(t.c) })),
    distance_km: Math.round(totalDistance / 100) / 10,
    insights
  };
}

function buildInsights({
  stops, totalDistance, fareStats, bookingStats,
  liveVehicles, nextDep, schedules, alerts
}) {
  const insights = [];
  const recommendations = [];

  if (totalDistance > 0) {
    insights.push({
      icon: 'distance',
      label: 'Total distance',
      value: `${(totalDistance / 1000).toFixed(1)} km`,
      detail: `${stops.length} stops`
    });
  }

  if (Number(fareStats.pairs) > 0) {
    insights.push({
      icon: 'fare',
      label: 'Fare range',
      value: `${fareStats.min_fare}–${fareStats.max_fare} RWF`,
      detail: `avg ${Math.round(Number(fareStats.avg_fare))} RWF`
    });
  }

  insights.push({
    icon: 'live',
    label: 'Live now',
    value: String(liveVehicles.length),
    detail: liveVehicles.length === 1 ? 'vehicle on route' : 'vehicles on route'
  });

  if (nextDep) {
    insights.push({
      icon: 'clock',
      label: 'Next departure',
      value: String(nextDep.time).slice(0, 5),
      detail: `${schedules.length} today`
    });
  }

  if (schedules.length > 0) {
    const first = schedules[0];
    const last = schedules[schedules.length - 1];
    insights.push({
      icon: 'frequency',
      label: 'Service window',
      value: `${String(first.departure_time).slice(0, 5)}–${String(last.departure_time).slice(0, 5)}`,
      detail: `${schedules.length} departures`
    });
  }

  const totalBookings = Number(bookingStats.total_bookings) || 0;
  if (totalBookings > 0) {
    insights.push({
      icon: 'trend',
      label: 'Bookings',
      value: String(totalBookings),
      detail: `avg ${Math.round(Number(bookingStats.avg_paid))} RWF`
    });
  }

  if (alerts.length > 0) {
    recommendations.push({
      tone: 'warning',
      title: `${alerts.length} active service notice${alerts.length > 1 ? 's' : ''}`,
      body: 'There is an active alert affecting this route or the network. Check the notice below.'
    });
  }

  if (liveVehicles.length === 0) {
    recommendations.push({
      tone: 'info',
      title: 'No vehicles currently on route',
      body: 'Check back in a few minutes, or use the schedule below to plan a departure time.'
    });
  } else if (liveVehicles.length <= 2) {
    recommendations.push({
      tone: 'info',
      title: `${liveVehicles.length} vehicle${liveVehicles.length > 1 ? 's' : ''} active right now`,
      body: 'Buses are running. Open the live map to see exact positions and arrival estimates.'
    });
  } else {
    recommendations.push({
      tone: 'success',
      title: `${liveVehicles.length} vehicles running`,
      body: 'Good coverage on this route right now. Live map shows each vehicle.'
    });
  }

  if (Number(fareStats.pairs) > 0) {
    recommendations.push({
      tone: 'info',
      title: 'Demonstration fare structure',
      body: `Fares on this route range from ${fareStats.min_fare} to ${fareStats.max_fare} RWF depending on the distance travelled.`
    });
  }

  if (nextDep) {
    recommendations.push({
      tone: 'success',
      title: 'Well-served route',
      body: `${schedules.length} scheduled departures today. The next one leaves at ${String(nextDep.time).slice(0, 5)}.`
    });
  }

  return { insights, recommendations };
}