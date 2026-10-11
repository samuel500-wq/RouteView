const R = 6371000;
const toRad = (d) => (d * Math.PI) / 180;
function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const cache = new Map();

async function fetchOSRM(waypoints) {
  const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`osrm_${r.status}`);
    const data = await r.json();
    const coords2 = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords2) || coords2.length < 2) throw new Error('osrm_no_geometry');
    return coords2.map(([lng, lat]) => ({ lat, lng }));
  } finally {
    clearTimeout(t);
  }
}

function buildStats(polyline) {
  const cumulative = [0];
  for (let i = 1; i < polyline.length; i++) {
    cumulative.push(cumulative[i - 1] + haversine(polyline[i - 1], polyline[i]));
  }
  return { polyline, cumulative, total: cumulative[cumulative.length - 1] };
}

export async function getRoadPath(routeId, waypoints) {
  if (cache.has(routeId)) return cache.get(routeId);

  let stats;
  let source = 'osrm';
  try {
    const polyline = await fetchOSRM(waypoints);
    stats = buildStats(polyline);
  } catch (e) {
    // Fallback: straight lines between waypoints (still smooth, just not road-aligned)
    const polyline = waypoints.map((w) => ({ lat: w.lat, lng: w.lng }));
    stats = buildStats(polyline);
    source = `fallback (${e.message})`;
  }

  const result = { ...stats, source };
  cache.set(routeId, result);
  console.log(
    `[road] route ${routeId}: ${stats.polyline.length} points, ` +
    `${(stats.total / 1000).toFixed(1)} km, source=${source}`
  );
  return result;
}

export function clearRoadPathCache() { cache.clear(); }

/** Return {lat, lng, heading} at a given distance along the polyline. */
export function positionAt(roadPath, distance) {
  const { polyline, cumulative, total } = roadPath;
  const d = Math.max(0, Math.min(total, distance));

  let lo = 0, hi = cumulative.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] <= d) lo = mid; else hi = mid;
  }
  const a = polyline[lo], b = polyline[hi];
  const segLen = cumulative[hi] - cumulative[lo];
  const t = segLen > 0 ? (d - cumulative[lo]) / segLen : 0;
  const lat = a.lat + (b.lat - a.lat) * t;
  const lng = a.lng + (b.lng - a.lng) * t;

  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  const heading = Math.round(((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360);

  return { lat, lng, heading };
}

/** Snap a stop to the nearest polyline distance (approximate by nearest vertex). */
export function distanceOfNearestVertex(roadPath, point) {
  let bestIdx = 0, bestD = Infinity;
  for (let i = 0; i < roadPath.polyline.length; i++) {
    const d = haversine(point, roadPath.polyline[i]);
    if (d < bestD) { bestD = d; bestIdx = i; }
  }
  return roadPath.cumulative[bestIdx];
}