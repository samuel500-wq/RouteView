import { config } from '../config.js';
import { findNearbyPlaces, CATEGORY_MAP } from '../services/overpass.js';
import { enrichPlaces } from '../services/places.js';

const CATEGORY_HINTS = {
  rw: `Koresha rimwe muri aya: restaurant, cafe, fast_food, bar, supermarket, market,
pharmacy, hospital, bank, fuel, hotel, school, worship.`,
  en: `Use one of: restaurant, cafe, fast_food, bar, supermarket, market,
pharmacy, hospital, bank, fuel, hotel, school, worship.`
};

const EXTRACT_PROMPT = {
  rw: `Ufasha gusobanukirwa icyifuzo cy’umukoresha. Subiza GUSA JSON nk’iyi:
{"categories": ["..."], "needs_location": true|false, "clarification": "..."|null, "reply": "..."|null}

- "categories": urutonde rw’ibintu ashaka (reba urutonde).
- "needs_location": true niba adashobora kubona ibintu hafi ye nta location.
- "clarification": ikibazo niba ataravuze neza.
- "reply": igisubizo kigufi niba bikenewe.

${CATEGORY_HINTS.rw}`,
  en: `You help parse a user's request. Reply with JSON ONLY:
{"categories": ["..."], "needs_location": true|false, "clarification": "..."|null, "reply": "..."|null}

- "categories": list of categories they want (see below).
- "needs_location": true if they can't get nearby results without a location.
- "clarification": a question if the request is ambiguous.
- "reply": a short reply if appropriate.

${CATEGORY_HINTS.en}`
};

const RECOMMEND_PROMPT = {
  rw: `Ufasha umugenzi mu Rwanda. Uhawe urutonde rw’ahantu hafi ye hamwe n’amakuru
y’urugendo (bisi cyangwa moto, igihe n’igiciro).

Andika igisubizo KIGUFI (2-4 interuro) mu Kinyarwanda cyoroshye:
- Vuga ahantu heza 1-2 hakurikira.
- Vuga uko yahageraho: bisi (n’igiciro) cyangwa moto (n’igiciro).
- Ntukavuge amakuru utahawe.
- Ntukoreshe markdown.`,
  en: `You help a passenger in Rwanda. You receive a list of nearby places with
travel info (bus or moto, time and price).

Write a SHORT reply (2-4 sentences) in simple English:
- Mention the top 1-2 places.
- Say how to get there: bus (with fare) or moto (with fare).
- Do not invent information you weren't given.
- Do not use markdown.`
};

export async function placeChat({ message, lang = 'rw', userLocation = null, history = [] }) {
  if (!config.ai.key) return { error: 'ai_not_configured' };

  // -------- 1. Parse the intent --------
  const parsed = await callJSON([
    { role: 'system', content: EXTRACT_PROMPT[lang] || EXTRACT_PROMPT.en },
    ...history.slice(-4),
    { role: 'user', content: message }
  ]);

  if (!parsed) return { error: 'ai_parse_failed' };

  const categories = Array.isArray(parsed.categories) ? parsed.categories : [];

  // -------- 2. Do we need a location? --------
  if (!userLocation && parsed.needs_location) {
    const askMsg = lang === 'rw'
      ? 'Nkeneye kumenya aho uri kugira ngo nkwereke ibintu biri hafi yawe. Kanda "Aho ndi" hano munsi.'
      : 'I need to know your location so I can find things nearby. Tap "My location" below.';
    return {
      reply: askMsg,
      action: 'request_location',
      categories,
      places: [],
      source: null
    };
  }

  // If user asked something ambiguous and no location yet, ask for clarification
  if (parsed.clarification && !categories.length && !userLocation) {
    return { reply: parsed.clarification, action: 'clarify', places: [], categories: [] };
  }

  // If clarification is requested even with location, deliver it
  if (parsed.clarification && !categories.length) {
    return { reply: parsed.clarification, action: 'clarify', places: [], categories: [] };
  }

  // -------- 3. Find places --------
  if (!userLocation) {
    const askMsg = lang === 'rw'
      ? 'Nshobora kugufasha. Nyamara nkeneye location yawe kugira ngo mbone ibintu biri hafi. Kanda "Aho ndi".'
      : 'I can help. But I need your location first. Tap "My location" to continue.';
    return { reply: askMsg, action: 'request_location', categories, places: [], source: null };
  }

  const { places, source } = await findNearbyPlaces({
    lat: userLocation.lat,
    lng: userLocation.lng,
    categories,
    radius: 2000
  });

  if (!places.length) {
    const msg = lang === 'rw'
      ? 'Nta hantu nabonye hafi yawe. Gerageza kwagura radius cyangwa ubaze ikindi kintu.'
      : 'I could not find any places near you. Try a different category or a wider area.';
    return { reply: msg, action: 'show_places', categories, places: [], source };
  }

  // -------- 4. Enrich with transport --------
  const enriched = await enrichPlaces({
    places: places.slice(0, 8),
    userLat: userLocation.lat,
    userLng: userLocation.lng
  });

  // -------- 5. Ask AI to write a short recommendation --------
  const summaryInput = enriched.slice(0, 3).map((p) => ({
    name: p.name,
    category: p.category,
    distance_m: p.distance_m,
    walking_min: p.walking_min,
    moto: p.moto,
    bus: p.bus ? {
      route: p.bus.route_code,
      duration_min: p.bus.duration_min,
      fare_rwf: p.bus.fare_rwf
    } : null
  }));

  const summary = await callText([
    { role: 'system', content: RECOMMEND_PROMPT[lang] || RECOMMEND_PROMPT.en },
    { role: 'user', content: JSON.stringify(summaryInput) }
  ]);

  const reply = summary || (lang === 'rw'
    ? `Nabonye ahantu ${enriched.length} hafi yawe. Reba ku ikarita.`
    : `I found ${enriched.length} places near you. See the map.`);

  return {
    reply,
    action: 'show_places',
    categories,
    places: enriched,
    source
  };
}

/* ---------- low-level OpenRouter helpers ---------- */

async function callJSON(messages) {
  const text = await callText(messages, { json: true });
  if (!text) return null;
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch { return null; }
}

async function callText(messages, { json = false } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), config.ai.timeoutMs);
  try {
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
        messages,
        temperature: json ? 0.1 : 0.4,
        ...(json ? { response_format: { type: 'json_object' } } : {})
      }),
      signal: ctrl.signal
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data.choices?.[0]?.message?.content || null;
  } catch { return null; } finally { clearTimeout(t); }
}