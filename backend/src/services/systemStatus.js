import { pool } from '../db/pool.js';
import { config } from '../config.js';
import { simulatorStatus, stopFleetSimulator, startFleetSimulator } from './fleetSimulator.js';
import { clearRoadPathCache } from './roadPath.js';
import { logIssue, listIssues, stats as logStats } from './systemLog.js';

/* ================================================================== *
 *  Full system status
 * ================================================================== */
export async function fullStatus() {
  const [db, ml, ai, sim, osrm, overpass] = await Promise.all([
    checkDb(),
    checkMl(),
    checkAi(),
    Promise.resolve(checkSimulator()),
    checkOsrm(),
    checkOverpass()
  ]);

  // Database stats
  let dbStats = null;
  if (db.ok) {
    try {
      dbStats = await dbCounts();
    } catch { /* ignore */ }
  }

  return {
    backend: {
      ok: true,
      env: config.env,
      port: config.port,
      uptime_seconds: Math.round(process.uptime()),
      node_version: process.version,
      memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      timestamp: new Date().toISOString()
    },
    db,
    ml,
    ai,
    simulator: sim,
    osrm,
    overpass,
    db_stats: dbStats,
    error_log: logStats()
  };
}

/* ================================================================== *
 *  Individual checks
 * ================================================================== */
async function checkDb() {
  const t0 = Date.now();
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    const latency = Date.now() - t0;
    return { ok: rows[0]?.ok === 1, latency_ms: latency, host: config.db.host, database: config.db.database };
  } catch (e) {
    logIssue({ level: 'error', source: 'db', message: 'Database unreachable', detail: e.message });
    return { ok: false, error: e.message };
  }
}

async function checkMl() {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(`${config.ml.url}/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    const latency = Date.now() - t0;
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    return {
      ok: !!j.ok,
      url: config.ml.url,
      latency_ms: latency,
      model_version: j.model_version || null,
      chosen: j.chosen || null
    };
  } catch (e) {
    return { ok: false, url: config.ml.url, error: e.message };
  }
}

async function checkAi() {
  if (!config.ai.key) {
    return { ok: false, configured: false, model: config.ai.model, error: 'no_api_key' };
  }
  // We don't want to burn tokens on every status check — a HEAD-like call
  // would be ideal, but OpenRouter has no free "ping". Instead, verify the
  // key format and report configuration state.
  const looksValid = config.ai.key.startsWith('sk-or-');
  return {
    ok: looksValid,
    configured: true,
    model: config.ai.model,
    base_url: config.ai.baseUrl,
    key_prefix: config.ai.key.slice(0, 10) + '…',
    error: looksValid ? null : 'invalid_key_format'
  };
}

function checkSimulator() {
  const s = simulatorStatus();
  return {
    ok: s.running && s.vehicles > 0,
    running: s.running,
    vehicles: s.vehicles,
    tick_ms: s.tick_ms,
    target_vehicles: s.target_vehicles
  };
}

async function checkOsrm() {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(
      'https://router.project-osrm.org/route/v1/driving/30.0619,-1.9441;30.1120,-1.9570?overview=false',
      { signal: ctrl.signal }
    );
    clearTimeout(timer);
    const latency = Date.now() - t0;
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    return { ok: j.code === 'Ok', latency_ms: latency };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function checkOverpass() {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch('https://overpass-api.de/api/status', { signal: ctrl.signal });
    clearTimeout(timer);
    const latency = Date.now() - t0;
    return { ok: r.ok, latency_ms: latency };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function dbCounts() {
  const [[users]]        = await pool.query('SELECT COUNT(*) AS c FROM users');
  const [[stops]]        = await pool.query('SELECT COUNT(*) AS c FROM stops');
  const [[routes]]       = await pool.query('SELECT COUNT(*) AS c FROM routes');
  const [[vehicles]]     = await pool.query('SELECT COUNT(*) AS c FROM vehicles');
  const [[urbanBookings]] = await pool.query('SELECT COUNT(*) AS c FROM bookings');
  const [[icBookings]]   = await pool.query('SELECT COUNT(*) AS c FROM intercity_bookings');
  const [[icTrips]]      = await pool.query('SELECT COUNT(*) AS c FROM intercity_trips');
  const [[aiMsgs]]       = await pool.query('SELECT COUNT(*) AS c FROM ai_conversations');
  const [[positions]]    = await pool.query('SELECT COUNT(*) AS c FROM vehicle_positions');
  return {
    users: Number(users.c),
    stops: Number(stops.c),
    routes: Number(routes.c),
    vehicles: Number(vehicles.c),
    urban_bookings: Number(urbanBookings.c),
    intercity_bookings: Number(icBookings.c),
    intercity_trips: Number(icTrips.c),
    vehicle_positions: Number(positions.c),
    ai_messages: Number(aiMsgs.c)
  };
}

/* ================================================================== *
 *  Diagnostics
 * ================================================================== */
export async function runDiagnostics() {
  const issues = [];

  // 1. Orphaned routes (no stops)
  const [orphanRoutes] = await pool.query(`
    SELECT r.id, r.code FROM routes r
     WHERE NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id = r.id)
  `);
  for (const r of orphanRoutes) {
    issues.push({ severity: 'warning', area: 'routes', message: `Route ${r.code} has no stops`, fix: 'assign_stops' });
  }

  // 2. Routes with only 1 stop (can't be simulated)
  const [shortRoutes] = await pool.query(`
    SELECT r.id, r.code, COUNT(rs.stop_id) AS c
      FROM routes r
      LEFT JOIN route_stops rs ON rs.route_id = r.id
     GROUP BY r.id
    HAVING c < 2
  `);
  for (const r of shortRoutes) {
    issues.push({ severity: 'warning', area: 'routes', message: `Route ${r.code} has only ${r.c} stop(s)`, fix: 'assign_stops' });
  }

  // 3. Vehicles without a position in the last hour
  const [staleVehicles] = await pool.query(`
    SELECT v.id, v.plate
      FROM vehicles v
     WHERE v.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM vehicle_positions vp
          WHERE vp.vehicle_id = v.id
            AND vp.recorded_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
       )
  `);
  for (const v of staleVehicles) {
    issues.push({ severity: 'info', area: 'fleet', message: `Vehicle ${v.plate} has no recent positions`, fix: 'restart_simulator' });
  }

  // 4. Intercity trips expiring soon (fewer than 3 days of future trips)
  const [[{ future_trips }]] = await pool.query(`
    SELECT COUNT(*) AS future_trips FROM intercity_trips
     WHERE trip_date > DATE_ADD(CURDATE(), INTERVAL 3 DAY)
  `);
  if (Number(future_trips) < 10) {
    issues.push({
      severity: 'warning',
      area: 'intercity',
      message: `Only ${future_trips} trips scheduled more than 3 days out`,
      fix: 'extend_intercity'
    });
  }

  // 5. Stale vehicle positions (older than 24 hours)
  const [[{ stale_count }]] = await pool.query(`
    SELECT COUNT(*) AS stale_count FROM vehicle_positions
     WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
  `);
  if (Number(stale_count) > 10000) {
    issues.push({
      severity: 'warning',
      area: 'db',
      message: `${Number(stale_count).toLocaleString()} old vehicle positions can be purged`,
      fix: 'purge_positions'
    });
  }

  // 6. Users without a valid role
  const [badRoles] = await pool.query(`
    SELECT COUNT(*) AS c FROM users
     WHERE role NOT IN ('passenger','operator','admin')
  `);
  if (Number(badRoles[0].c) > 0) {
    issues.push({ severity: 'error', area: 'users', message: `${badRoles[0].c} users with invalid role`, fix: 'reset_roles' });
  }

  // 7. Duplicate stop codes (should be impossible, but check anyway)
  const [dups] = await pool.query(`
    SELECT code, COUNT(*) AS c FROM stops GROUP BY code HAVING c > 1
  `);
  for (const d of dups) {
    issues.push({ severity: 'error', area: 'stops', message: `Duplicate stop code: ${d.code}`, fix: 'manual' });
  }

  return {
    run_at: new Date().toISOString(),
    total: issues.length,
    by_severity: {
      error: issues.filter((i) => i.severity === 'error').length,
      warning: issues.filter((i) => i.severity === 'warning').length,
      info: issues.filter((i) => i.severity === 'info').length
    },
    issues
  };
}

/* ================================================================== *
 *  Fix actions
 * ================================================================== */
export async function applyFix(kind, params = {}) {
  switch (kind) {

    case 'clear_osrm_cache': {
      clearRoadPathCache();
      logIssue({ level: 'info', source: 'osrm', message: 'OSRM cache cleared by admin' });
      return { ok: true, note: 'OSRM road cache cleared. Next simulator tick will re-fetch.' };
    }

    case 'restart_simulator': {
      try { stopFleetSimulator(); } catch { /* ignore */ }
      await new Promise((r) => setTimeout(r, 300));
      await startFleetSimulator();
      logIssue({ level: 'info', source: 'simulator', message: 'Simulator restarted by admin' });
      return { ok: true, note: 'Fleet simulator restarted.' };
    }

    case 'purge_positions': {
      const [r] = await pool.query(
        'DELETE FROM vehicle_positions WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)'
      );
      logIssue({ level: 'info', source: 'db', message: `Purged ${r.affectedRows} old vehicle positions` });
      return { ok: true, note: `${r.affectedRows} positions deleted.` };
    }

    case 'purge_ai_history': {
      const [r] = await pool.query(
        'DELETE FROM ai_conversations WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)'
      );
      logIssue({ level: 'info', source: 'ai', message: `Purged ${r.affectedRows} old AI messages` });
      return { ok: true, note: `${r.affectedRows} AI messages deleted.` };
    }

    case 'extend_intercity': {
      // Regenerate 14 more days of intercity trips from existing schedules
      const [schedules] = await pool.query(`
        SELECT s.id, s.route_id, s.company_id, s.departure_time, s.bus_type, s.total_seats,
               r.base_price_rwf
          FROM intercity_schedules s
          JOIN intercity_routes r ON r.id = s.route_id
      `);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let created = 0;
      for (let d = 1; d <= 14; d++) {
        const day = new Date(today);
        day.setDate(day.getDate() + d);
        const dateStr = day.toISOString().slice(0, 10);
        for (const s of schedules) {
          const [hh, mm] = String(s.departure_time).split(':').map(Number);
          const departure = new Date(day);
          departure.setHours(hh, mm, 0, 0);
          const adj = Math.round(
            s.base_price_rwf * (s.bus_type === 'vip' ? 1.3 : s.bus_type === 'express' ? 1.1 : 1) / 100
          ) * 100;
          try {
            await pool.execute(
              `INSERT IGNORE INTO intercity_trips
                 (schedule_id, route_id, company_id, trip_date, departure_dt,
                  price_rwf, seats_total, status)
               VALUES (?,?,?,?,?,?,?, 'scheduled')`,
              [s.id, s.route_id, s.company_id, dateStr, departure, adj, s.total_seats]
            );
            created++;
          } catch { /* ignore duplicates */ }
        }
      }
      logIssue({ level: 'info', source: 'intercity', message: `Extended intercity schedule: ${created} trips` });
      return { ok: true, note: `${created} future trips added (or already existed).` };
    }

    case 'reconnect_db': {
      try {
        await pool.query('SELECT 1');
        logIssue({ level: 'info', source: 'db', message: 'Database ping successful' });
        return { ok: true, note: 'Database responds normally.' };
      } catch (e) {
        logIssue({ level: 'error', source: 'db', message: 'Reconnect failed', detail: e.message });
        return { ok: false, note: 'Database still unreachable.', error: e.message };
      }
    }

    case 'test_ml': {
      try {
        const r = await fetch(`${config.ml.url}/predict`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            route_id: 1, hour_of_day: 8, day_of_week: 2,
            distance_remaining_m: 3200, recent_speed_kmh: 18,
            remaining_stops: 4, delay_indicator: 0.3
          })
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        return { ok: true, note: `ML responded: ${Math.round(j.seconds)}s (model ${j.model_version})`, data: j };
      } catch (e) {
        logIssue({ level: 'error', source: 'ml', message: 'ML test failed', detail: e.message });
        return { ok: false, note: 'ML service did not respond.', error: e.message };
      }
    }

    case 'test_ai': {
      if (!config.ai.key) return { ok: false, note: 'No API key configured.' };
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 15000);
        const r = await fetch(`${config.ai.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${config.ai.key}`,
            'HTTP-Referer': config.ai.appUrl,
            'X-Title': config.ai.appName
          },
          body: JSON.stringify({
            model: config.ai.model,
            messages: [{ role: 'user', content: 'Reply with the single word OK.' }],
            max_tokens: 5
          }),
          signal: ctrl.signal
        });
        clearTimeout(timer);
        if (!r.ok) {
          const text = await r.text().catch(() => '');
          throw new Error(`HTTP ${r.status}: ${text.slice(0, 120)}`);
        }
        return { ok: true, note: 'AI provider responded normally.' };
      } catch (e) {
        logIssue({ level: 'error', source: 'ai', message: 'AI test failed', detail: e.message });
        return { ok: false, note: 'AI provider unreachable.', error: e.message };
      }
    }

    case 'reset_roles': {
      const [r] = await pool.query(
        `UPDATE users SET role = 'passenger'
          WHERE role NOT IN ('passenger','operator','admin')`
      );
      logIssue({ level: 'info', source: 'users', message: `Reset ${r.affectedRows} invalid roles` });
      return { ok: true, note: `${r.affectedRows} users reset to passenger.` };
    }

    case 'clear_error_log': {
      const n = (await import('./systemLog.js')).clearIssues();
      return { ok: true, note: `${n} log entries cleared.` };
    }

    default:
      return { ok: false, note: `Unknown fix: ${kind}` };
  }
}

/* ================================================================== *
 *  Error log access
 * ================================================================== */
export function getIssueLog(filter) {
  return listIssues(filter);
}

export function resolve(id, opts) {
  return (async () => {
    const { resolveIssue } = await import('./systemLog.js');
    return resolveIssue(id, opts);
  })();
}