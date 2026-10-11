/**
 * RouteView Fleet Simulator.
 * Moves vehicles along their route's stop sequence with realistic dwell,
 * route-appropriate speed, and speed variation. Posts to the backend
 * ingestion endpoint using an operator token.
 *
 * IMPORTANT: These positions are SIMULATED and are labelled as such by the
 * backend (source = 'simulator'). They are never presented as GPS.
 */
import 'dotenv/config';
import jwt from 'jsonwebtoken';

const API = process.env.API_URL || 'http://localhost:4000';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';
const OPERATOR_ID = Number(process.env.SIM_OPERATOR_ID || 2);
const TICK_MS = Number(process.env.SIM_TICK_MS || 3000);

const OPERATOR_TOKEN = jwt.sign(
  { id: OPERATOR_ID, email: 'operator@routeview.rw', role: 'operator' },
  JWT_SECRET, { expiresIn: '7d' }
);

const R = 6_371_000;
const toRad = (d) => (d * Math.PI) / 180;
const haversine = (a, b) => {
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
const lerp = (a, b, t) => ({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
const bearing = (a, b) => {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat))
          - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return Math.round(((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360);
};

// Fetch routes + stops + vehicles from backend
async function fetchFleet() {
  const r = await fetch(`${API}/api/routes`);
  const { routes } = await r.json();

  const detailed = [];
  for (const r of routes) {
    const d = await fetch(`${API}/api/routes/${r.id}`).then((x) => x.json());
    detailed.push(d);
  }
  const vehicles = await fetch(`${API}/api/vehicles`).then((x) => x.json());
  return { routes: detailed, vehicles: vehicles.vehicles || [] };
}

function spawnState(route) {
  return {
    route_id: route.route.id,
    colour: route.route.color_hex,
    stops: route.stops.map((s) => ({ lat: Number(s.lat), lng: Number(s.lng), id: s.id })),
    segIdx: 0,
    progress: 0,
    speedKmh: 15 + Math.random() * 20,
    dwell: 0
  };
}

async function tick(vehicles, state) {
  const updates = [];
  for (const v of vehicles) {
    const s = state[v.id]; if (!s) continue;
    if (s.dwell > 0) {
      s.dwell -= TICK_MS / 1000;
      updates.push({ v, s, pos: s.stops[s.segIdx], speed: 0 });
      continue;
    }
    const a = s.stops[s.segIdx];
    const b = s.stops[s.segIdx + 1];
    if (!b) { s.segIdx = 0; s.progress = 0; continue; }
    const segLen = Math.max(50, haversine(a, b));
    const mps = s.speedKmh / 3.6;
    const stepM = mps * (TICK_MS / 1000);
    s.progress += stepM / segLen;
    if (s.progress >= 1) {
      s.progress = 0;
      s.segIdx += 1;
      s.dwell = 5 + Math.random() * 10;   // seconds
      s.speedKmh = 12 + Math.random() * 22;
      if (s.segIdx >= s.stops.length - 1) s.segIdx = 0;
    }
    const pos = lerp(a, b, Math.max(0, Math.min(1, s.progress)));
    const heading = bearing(a, b);
    updates.push({ v, s, pos, speed: s.speedKmh, heading });
  }

  for (const u of updates) {
    const body = {
      vehicle_id: u.v.id,
      route_id: u.s.route_id,
      lat: Number(u.pos.lat.toFixed(6)),
      lng: Number(u.pos.lng.toFixed(6)),
      speed_kmh: Number(u.speed.toFixed(1)),
      heading_deg: u.heading ?? 0,
      source: 'simulator',
      recorded_at: new Date().toISOString()
    };
    try {
      await fetch(`${API}/api/vehicles/ingest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${OPERATOR_TOKEN}` },
        body: JSON.stringify(body)
      });
    } catch (e) { console.error('ingest failed', e.message); }
  }
  process.stdout.write(`\r[sim] tick: ${updates.length} vehicles @ ${new Date().toLocaleTimeString()}`);
}

async function main() {
  console.log('[sim] loading fleet…');
  const { routes, vehicles } = await fetchFleet();
  if (!vehicles.length) { console.error('no vehicles in DB; seed first.'); return; }
  const state = {};
  vehicles.forEach((v, i) => { state[v.id] = spawnState(routes[i % routes.length]); });
  console.log(`[sim] simulating ${vehicles.length} vehicles on ${routes.length} routes`);
  setInterval(() => tick(vehicles, state).catch((e) => console.error(e)), TICK_MS);
}
main();