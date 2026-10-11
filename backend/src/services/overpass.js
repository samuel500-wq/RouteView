/**
 * Overpass API client — queries OpenStreetMap for Points of Interest.
 * Free, no key required. Falls back to a demo dataset if Overpass is slow/down.
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

/* Category mapping: what the user says → OSM tags to query */
export const CATEGORY_MAP = {
  restaurant:  { label_en: 'Restaurants',  label_rw: 'Resitora',    tags: ['amenity=restaurant'] },
  cafe:        { label_en: 'Cafés',        label_rw: 'Kafe',        tags: ['amenity=cafe'] },
  fast_food:   { label_en: 'Fast food',    label_rw: 'Ibiryo byihuse', tags: ['amenity=fast_food'] },
  bar:         { label_en: 'Bars',         label_rw: 'Bar',         tags: ['amenity=bar', 'amenity=pub'] },
  supermarket: { label_en: 'Supermarkets', label_rw: 'Amaduka manini', tags: ['shop=supermarket', 'shop=convenience'] },
  market:      { label_en: 'Markets',      label_rw: 'Amasoko',     tags: ['amenity=marketplace'] },
  pharmacy:    { label_en: 'Pharmacies',   label_rw: 'Amavuriro',   tags: ['amenity=pharmacy', 'amenity=chemist'] },
  hospital:    { label_en: 'Hospitals',    label_rw: 'Ibitaro',     tags: ['amenity=hospital', 'amenity=clinic', 'amenity=doctors'] },
  bank:        { label_en: 'Banks & ATMs', label_rw: 'Banki na ATM', tags: ['amenity=bank', 'amenity=atm'] },
  fuel:        { label_en: 'Fuel stations', label_rw: 'Sitasiyo ya lisansi', tags: ['amenity=fuel'] },
  hotel:       { label_en: 'Hotels',       label_rw: 'Hoteli',      tags: ['tourism=hotel', 'tourism=hostel', 'tourism=guest_house'] },
  school:      { label_en: 'Schools',      label_rw: 'Amashuri',    tags: ['amenity=school', 'amenity=university', 'amenity=college'] },
  worship:     { label_en: 'Churches & mosques', label_rw: 'Amasengero', tags: ['amenity=place_of_worship'] }
};

/* Fallback demo places used if Overpass fails — coordinates in Kigali */
const DEMO_PLACES = [
  { id: 'demo:1',  name: 'Chez Lando Restaurant', category: 'restaurant', lat: -1.9441, lng: 30.0976 },
  { id: 'demo:2',  name: 'Heaven Boutique Restaurant', category: 'restaurant', lat: -1.9545, lng: 30.1117 },
  { id: 'demo:3',  name: 'Repub Lounge', category: 'restaurant', lat: -1.9449, lng: 30.0618 },
  { id: 'demo:4',  name: 'Bourbon Coffee', category: 'cafe', lat: -1.9441, lng: 30.0611 },
  { id: 'demo:5',  name: 'Question Coffee', category: 'cafe', lat: -1.9423, lng: 30.0871 },
  { id: 'demo:6',  name: 'Kigali Pharmacy', category: 'pharmacy', lat: -1.9520, lng: 30.0690 },
  { id: 'demo:7',  name: 'Nyabugogo Market', category: 'market', lat: -1.9417, lng: 30.0449 },
  { id: 'demo:8',  name: 'Kimironko Market', category: 'market', lat: -1.9418, lng: 30.1165 },
  { id: 'demo:9',  name: 'Bank of Kigali', category: 'bank', lat: -1.9444, lng: 30.0601 },
  { id: 'demo:10', name: 'King Faisal Hospital', category: 'hospital', lat: -1.9400, lng: 30.0908 },
  { id: 'demo:11', name: 'Kigali Heights', category: 'supermarket', lat: -1.9443, lng: 30.0906 },
  { id: 'demo:12', name: 'Total Nyabugogo', category: 'fuel', lat: -1.9415, lng: 30.0453 }
];

/* ---------- Overpass query ---------- */
async function queryOverpass(lat, lng, tags, radius = 1500) {
  const parts = [];
  for (const t of tags) {
    const [key, value] = t.split('=');
    parts.push(`node["${key}"="${value}"](around:${radius},${lat},${lng});`);
    parts.push(`way["${key}"="${value}"](around:${radius},${lat},${lng});`);
  }
  const q = `[out:json][timeout:12];\n(\n${parts.join('\n')}\n);\nout center 25;`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 14000);
  try {
    const r = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(q)}`,
      signal: ctrl.signal
    });
    if (!r.ok) throw new Error(`overpass_${r.status}`);
    const data = await r.json();
    return (data.elements || []).map((e) => {
      const lat_ = e.lat ?? e.center?.lat;
      const lng_ = e.lon ?? e.center?.lon;
      if (!lat_ || !lng_) return null;
      const t = e.tags || {};
      return {
        id: `osm:${e.type}:${e.id}`,
        name: t.name || t['name:en'] || t['name:rw'] || 'Unnamed place',
        category: Object.keys(t).includes('amenity') ? t.amenity
                 : Object.keys(t).includes('shop') ? t.shop
                 : Object.keys(t).includes('tourism') ? t.tourism
                 : 'place',
        lat: Number(lat_),
        lng: Number(lng_),
        address: [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ') || null,
        phone: t.phone || t['contact:phone'] || null,
        website: t.website || null,
        opening_hours: t.opening_hours || null,
        source: 'osm'
      };
    }).filter(Boolean);
  } finally {
    clearTimeout(timer);
  }
}

export async function findNearbyPlaces({ lat, lng, categories, radius = 1500 }) {
  // Collect tags for all requested categories
  const tags = new Set();
  for (const c of categories) {
    const entry = CATEGORY_MAP[c];
    if (entry) entry.tags.forEach((t) => tags.add(t));
  }
  if (tags.size === 0) {
    // Default: food-related
    ['amenity=restaurant', 'amenity=cafe', 'amenity=fast_food'].forEach((t) => tags.add(t));
  }

  let places = [];
  let source = 'osm';
  try {
    places = await queryOverpass(lat, lng, Array.from(tags), radius);
  } catch (e) {
    console.warn('[overpass] query failed:', e.message);
    source = 'demo';
  }

  // If empty (Kigali coverage is patchy), fall back to demo set filtered by category
  if (places.length === 0) {
    source = 'demo';
    const wanted = new Set(categories.length ? categories : ['restaurant', 'cafe', 'fast_food']);
    places = DEMO_PLACES.filter((p) => wanted.has(p.category));
  }

  // If still empty, return all demo
  if (places.length === 0) {
    places = DEMO_PLACES.slice(0, 8);
  }

  return { places: places.slice(0, 20), source };
}

export function getDemoPlaces(categories = []) {
  const wanted = new Set(categories);
  return wanted.size > 0
    ? DEMO_PLACES.filter((p) => wanted.has(p.category))
    : DEMO_PLACES;
}