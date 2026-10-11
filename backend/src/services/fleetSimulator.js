import { pool } from '../db/pool.js';
import { getRoadPath, positionAt, distanceOfNearestVertex } from './roadPath.js';

const TICK_MS = 3000;
const TARGET_VEHICLES = 12;

let timer = null;
const state = new Map();
let running = false;

/* ------------------------------------------------------------------ */

async function ensureVehicles() {
  const [[{ c }]] = await pool.query('SELECT COUNT(*) AS c FROM vehicles');
  if (c >= TARGET_VEHICLES) return;
  const needed = TARGET_VEHICLES - c;
  for (let i = 0; i < needed; i++) {
    const n = c + i + 1;
    const plate = `RAD ${100 + n} ${String.fromCharCode(65 + (n % 26))}`;
    const label = `Bus ${String(n).padStart(2, '0')}`;
    const capacity = 28 + Math.floor(Math.random() * 22);
    try {
      await pool.execute(
        'INSERT INTO vehicles (plate, label, capacity, status) VALUES (?,?,?,?)',
        [plate, label, capacity, 'active']
      );
    } catch { /* duplicate plate — skip */ }
  }
}

async function loadFleet() {
  const [vehicles] = await pool.query(
    "SELECT id, capacity FROM vehicles WHERE status IN ('active','idle') ORDER BY id"
  );
  const [routes] = await pool.query(
    'SELECT id FROM routes WHERE is_active = 1 ORDER BY id'
  );
  const [stops] = await pool.query(`
    SELECT rs.route_id, rs.sequence_no, s.id, s.lat, s.lng
      FROM route_stops rs
      JOIN stops s ON s.id = rs.stop_id
     ORDER BY rs.route_id, rs.sequence_no
  `);
  const stopsByRoute = {};
  for (const s of stops) {
    (stopsByRoute[s.route_id] ||= []).push({
      id: s.id,
      lat: Number(s.lat),
      lng: Number(s.lng)
    });
  }
  return { vehicles, routes, stopsByRoute };
}

/* ------------------------------------------------------------------ */

function spawnState(vehicleId, routeId, roadPath, stopDistances) {
  return {
    vehicle_id: vehicleId,
    route_id: routeId,
    roadPath,
    stopDistances,          // sorted array of metres-along where real stops are
    distanceAlong: Math.random() * roadPath.total,
    direction: 1,           // 1 forward, -1 backward (round trip)
    speedKmh: 18 + Math.random() * 10,
    dwellSec: 0,
    nextStopIndex: 0
  };
}

/* ------------------------------------------------------------------ */

async function tick() {
  const now = new Date();
  const hour = now.getHours();
  const isPeak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  const isNight = hour >= 22 || hour <= 5;
  const baseSpeed = isPeak ? 14 : isNight ? 30 : 22;

  const updates = [];

  for (const s of state.values()) {
    const dt = TICK_MS / 1000;

    if (s.dwellSec > 0) {
      s.dwellSec -= dt;
      const pos = positionAt(s.roadPath, s.distanceAlong);
      updates.push({ s, pos, speed: 0 });
      continue;
    }

    // Gentle speed variation each tick
    s.speedKmh = Math.max(8, baseSpeed + (Math.random() - 0.5) * 5);

    const advance = (s.speedKmh / 3.6) * dt * s.direction;
    s.distanceAlong += advance;

    // Reached a real stop? dwell briefly
    if (s.direction === 1) {
      const next = s.stopDistances.find((d) => d > s.distanceAlong - advance && d <= s.distanceAlong);
      if (next !== undefined) s.dwellSec = 4 + Math.random() * 6;
    } else {
      const prev = [...s.stopDistances].reverse().find(
        (d) => d < s.distanceAlong - advance && d >= s.distanceAlong
      );
      if (prev !== undefined) s.dwellSec = 4 + Math.random() * 6;
    }

    // Route ends — reverse direction (round trip) instead of teleporting
    if (s.distanceAlong >= s.roadPath.total) {
      s.distanceAlong = s.roadPath.total;
      s.direction = -1;
      s.dwellSec = 6 + Math.random() * 4;
    } else if (s.distanceAlong <= 0) {
      s.distanceAlong = 0;
      s.direction = 1;
      s.dwellSec = 6 + Math.random() * 4;
    }

    const pos = positionAt(s.roadPath, s.distanceAlong);
    updates.push({ s, pos, speed: s.speedKmh });
  }

  if (updates.length === 0) return;

  const values = [];
  const params = [];
  for (const u of updates) {
    values.push('(?,?,?,?,?,?,?,?)');
    params.push(
      u.s.vehicle_id,
      u.s.route_id,
      Number(u.pos.lat.toFixed(7)),
      Number(u.pos.lng.toFixed(7)),
      Number(u.speed.toFixed(1)),
      u.pos.heading,
      'simulator',
      now
    );
  }

  const sql = `INSERT INTO vehicle_positions
    (vehicle_id, route_id, lat, lng, speed_kmh, heading_deg, source, recorded_at)
    VALUES ${values.join(',')}`;

  try {
    await pool.execute(sql, params);
  } catch (e) {
    console.error('[sim] insert failed:', e.message);
  }
}

async function loop() {
  try { await tick(); }
  catch (e) { console.error('[sim] tick error:', e.message); }
  finally { timer = setTimeout(loop, TICK_MS); }
}

/* ------------------------------------------------------------------ */

export async function startFleetSimulator() {
  if (running) return;
  running = true;

  try { await ensureVehicles(); }
  catch (e) { console.error('[sim] ensureVehicles failed:', e.message); }

  let fleet;
  try { fleet = await loadFleet(); }
  catch (e) {
    console.error('[sim] loadFleet failed:', e.message);
    running = false;
    return;
  }

  if (fleet.vehicles.length === 0 || fleet.routes.length === 0) {
    console.warn('[sim] no vehicles or routes — simulator idle');
    running = false;
    return;
  }

  const validRouteIds = fleet.routes
    .map((r) => r.id)
    .filter((id) => (fleet.stopsByRoute[id] || []).length >= 2);

  if (validRouteIds.length === 0) {
    console.warn('[sim] no routes with enough stops — simulator idle');
    running = false;
    return;
  }

  // Fetch road geometry for each route (OSRM, cached)
  const roadPaths = {};
  const stopDistances = {};
  for (const routeId of validRouteIds) {
    const waypoints = fleet.stopsByRoute[routeId].map((s) => ({ lat: s.lat, lng: s.lng }));
    try {
      const rp = await getRoadPath(routeId, waypoints);
      roadPaths[routeId] = rp;
      stopDistances[routeId] = waypoints
        .map((w) => distanceOfNearestVertex(rp, w))
        .sort((a, b) => a - b);
    } catch (e) {
      console.error(`[sim] roadPath failed for route ${routeId}: ${e.message}`);
    }
  }

  const usableRouteIds = Object.keys(roadPaths).map(Number);
  if (usableRouteIds.length === 0) {
    console.warn('[sim] no usable road paths — simulator idle');
    running = false;
    return;
  }

  fleet.vehicles.forEach((v, i) => {
    const routeId = usableRouteIds[i % usableRouteIds.length];
    state.set(
      v.id,
      spawnState(v.id, routeId, roadPaths[routeId], stopDistances[routeId])
    );
  });

  console.log(
    `[sim] fleet simulator started — ${state.size} vehicles across ${usableRouteIds.length} routes`
  );
  loop();
}

export function stopFleetSimulator() {
  if (timer) clearTimeout(timer);
  timer = null;
  running = false;
  state.clear();
}

export function simulatorStatus() {
  return {
    running,
    vehicles: state.size,
    tick_ms: TICK_MS,
    target_vehicles: TARGET_VEHICLES
  };
}