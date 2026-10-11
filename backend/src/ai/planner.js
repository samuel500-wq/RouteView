import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { planJourney } from '../services/journey.js';
import { estimateArrival } from '../services/arrival.js';

const SYSTEM_PROMPT = {
  rw: `Ufasha abagenzi bo mu Rwanda guhuza ahantu h'aho bakwiriye kujya.
Uhabwa ikibazo mu Kinyarwanda cyangwa Icyongereza.
Inshingano yawe: MENYA ahantu h'aho uva n'aho ujya muri sisitemu ya RouteView.

Subiza GUSA JSON nk'iyi: {"from_stop_id": <int|null>, "to_stop_id": <int|null>, "confidence": <0..1>, "language": "rw"|"en", "note": "..."}

Niba utazi stop_id, subiza null kuri byo. Ntukavuge ibintu birenga JSON.`,
  en: `You help passengers in Rwanda find which stops their journey starts and ends at.
You receive a request in English or Kinyarwanda.
Your job: identify the origin stop and destination stop IDs from RouteView's network.

Respond ONLY with JSON: {"from_stop_id": <int|null>, "to_stop_id": <int|null>, "confidence": <0..1>, "language": "en"|"rw", "note": "..."}

If you can't determine a stop ID, use null. Do not output anything except the JSON.`
};

export async function aiPlan({ query, lang = 'rw' }) {
  if (!config.ai.key) return { ok: false, error: 'ai_not_configured' };
  if (!query || !query.trim()) return { ok: false, error: 'empty_query' };

  // 1. Build the stop catalogue the model can match against
  const [stops] = await pool.query(
    `SELECT id, code, name_rw, name_en FROM stops WHERE is_active = 1 ORDER BY name_en`
  );
  const catalogue = stops
    .map((s) => `${s.id} | ${s.name_en} | ${s.name_rw} | ${s.code}`)
    .join('\n');

  // 2. Ask OpenRouter to resolve the two endpoints
  const extracted = await callOpenRouterJSON([
    { role: 'system', content: SYSTEM_PROMPT[lang] || SYSTEM_PROMPT.en },
    { role: 'system', content: `RouteView stops (id | English | Kinyarwanda | code):\n${catalogue}` },
    { role: 'user', content: query }
  ]);

  if (!extracted) return { ok: false, error: 'ai_parse_failed' };

  const fromId = Number.isInteger(extracted.from_stop_id) ? extracted.from_stop_id : null;
  const toId = Number.isInteger(extracted.to_stop_id) ? extracted.to_stop_id : null;

  if (!fromId || !toId) {
    return {
      ok: false,
      error: 'stops_not_resolved',
      confidence: extracted.confidence ?? 0,
      note: extracted.note || null
    };
  }
  if (fromId === toId) return { ok: false, error: 'same_stop' };

  // 3. Validate the IDs really exist and fetch full records
  const [stopInfo] = await pool.query(
    'SELECT id, code, name_rw, name_en, lat, lng FROM stops WHERE id IN (?, ?) AND is_active = 1',
    [fromId, toId]
  );
  if (stopInfo.length !== 2) {
    return { ok: false, error: 'invalid_stop_id', note: extracted.note || null };
  }

  const fromStop = stopInfo.find((s) => s.id === fromId);
  const toStop = stopInfo.find((s) => s.id === toId);

  // 4. Run the real journey planner
  const options = await planJourney({ fromStopId: fromId, toStopId: toId });

  // 5. Enrich with routes, live vehicles, arrival predictions, recommendation
  const enriched = await enrichPlan({ options, fromStop, toStop, lang });

  return {
    ok: true,
    confidence: extracted.confidence ?? 1,
    note: extracted.note || null,
    from_stop: fromStop,
    to_stop: toStop,
    options,
    ...enriched
  };
}

/* ------------------------------------------------------------------ *
 *  Enrichment: routes for the map, live vehicles, next arrivals, recs
 * ------------------------------------------------------------------ */

async function enrichPlan({ options, fromStop, toStop, lang }) {
  const routeIds = new Set();
  for (const o of options) {
    if (o.route?.id) routeIds.add(o.route.id);
    if (o.legs) for (const l of o.legs) routeIds.add(l.route.id);
  }

  // ---- Routes with full stop lists (for map polylines) ----
  const routes_map = {};
  if (routeIds.size > 0) {
    const ph = Array.from(routeIds).map(() => '?').join(',');
    const [routeRows] = await pool.query(
      `SELECT id, code, name_rw, name_en, color_hex FROM routes WHERE id IN (${ph})`,
      [...routeIds]
    );
    for (const r of routeRows) {
      const [routeStops] = await pool.query(
        `SELECT s.id, s.code, s.name_rw, s.name_en, s.lat, s.lng, rs.sequence_no
           FROM route_stops rs
           JOIN stops s ON s.id = rs.stop_id
          WHERE rs.route_id = ?
          ORDER BY rs.sequence_no`,
        [r.id]
      );
      routes_map[r.id] = {
        id: r.id,
        code: r.code,
        name_rw: r.name_rw,
        name_en: r.name_en,
        color: r.color_hex,
        stops: routeStops.map((s) => ({
          id: s.id,
          code: s.code,
          name_rw: s.name_rw,
          name_en: s.name_en,
          lat: Number(s.lat),
          lng: Number(s.lng)
        }))
      };
    }
  }

  // ---- Latest vehicle position per vehicle, on the relevant routes ----
  const vehicles_by_route = {};
  const next_arrivals = [];

  if (routeIds.size > 0) {
    const ph = Array.from(routeIds).map(() => '?').join(',');
    const [vehicles] = await pool.query(
      `SELECT vp.vehicle_id, vp.route_id, vp.lat, vp.lng, vp.speed_kmh,
              vp.source, vp.recorded_at, v.plate, r.code AS route_code
         FROM vehicle_positions vp
         JOIN vehicles v ON v.id = vp.vehicle_id
         JOIN routes   r ON r.id = vp.route_id
         JOIN (
           SELECT vehicle_id, MAX(recorded_at) AS m
             FROM vehicle_positions
            WHERE route_id IN (${ph})
            GROUP BY vehicle_id
         ) latest
           ON latest.vehicle_id = vp.vehicle_id AND latest.m = vp.recorded_at
        WHERE vp.route_id IN (${ph})`,
      [...routeIds, ...routeIds]
    );

    const now = Date.now();
    for (const v of vehicles) {
      const bucket = vehicles_by_route[v.route_id] || (vehicles_by_route[v.route_id] = []);
      bucket.push({
        vehicle_id: v.vehicle_id,
        plate: v.plate,
        route_code: v.route_code,
        lat: Number(v.lat),
        lng: Number(v.lng),
        speed_kmh: v.speed_kmh ? Number(v.speed_kmh) : null,
        source: v.source,
        simulated: v.source === 'simulator',
        age_seconds: Math.round((now - new Date(v.recorded_at).getTime()) / 1000)
      });
    }

    // ---- ML arrival estimates to the origin stop for each route ----
    for (const routeId of routeIds) {
      const vs = vehicles_by_route[routeId] || [];
      if (!vs.length) continue;

      const fLat = Number(fromStop.lat), fLng = Number(fromStop.lng);
      const sorted = vs
        .map((v) => ({ ...v, _d: haversine({ lat: fLat, lng: fLng }, { lat: v.lat, lng: v.lng }) }))
        .sort((a, b) => a._d - b._d);

      const closest = sorted[0];
      if (closest._d > 15000) continue; // more than 15 km away — skip

      try {
        const est = await estimateArrival({
          vehicleId: closest.vehicle_id,
          targetStopId: fromStop.id
        });
        if (!est.error) {
          next_arrivals.push({
            route_id: routeId,
            route_code: routes_map[routeId]?.code || closest.route_code,
            route_color: routes_map[routeId]?.color || '#0ea5e9',
            vehicle_id: closest.vehicle_id,
            plate: closest.plate,
            stop_id: fromStop.id,
            stop_name: fromStop.name_en,
            distance_m: Math.round(closest._d),
            seconds: est.seconds,
            minutes: Math.max(1, Math.round(est.seconds / 60)),
            source: est.source,
            model_version: est.model_version,
            simulated: closest.simulated
          });
        }
      } catch { /* ignore */ }
    }
  }

  const recommendation = buildRecommendation({ options, next_arrivals, fromStop, toStop, lang });

  return { routes_map, live: { vehicles_by_route, next_arrivals }, recommendation };
}

/* ------------------------------------------------------------------ *
 *  Recommendation generator
 * ------------------------------------------------------------------ */

function buildRecommendation({ options, next_arrivals, fromStop, toStop, lang }) {
  const t = (rw, en) => (lang === 'rw' ? rw : en);

  if (!options.length) {
    return {
      best_option_index: -1,
      reasons: [],
      tips: [
        t(
          'Nta nzira ibonetse hagati y’ahantu habiri. Gerageza ahantu handi.',
          'No route found between these two stops. Try a different pair.'
        )
      ],
      summary: t('Nta nzira ibonetse.', 'No route found.')
    };
  }

  const scored = options.map((o, i) => {
    const minutes = o.estimated_minutes || 60;
    const fare = o.fare?.amount_rwf ?? 9999;
    const transfers = o.type === 'direct' ? 0 : (o.legs?.length || 1) - 1;
    const score = minutes * 1.0 + fare / 100 + transfers * 5;
    return { i, o, minutes, fare, transfers, score };
  });

  const best = scored.reduce((a, b) => (a.score < b.score ? a : b));
  const fastest = scored.reduce((a, b) => (a.minutes < b.minutes ? a : b));
  const cheapest = scored.reduce((a, b) => (a.fare < b.fare ? a : b));
  const fewest = scored.reduce((a, b) => (a.transfers < b.transfers ? a : b));

  const reasons = [];
  if (best.i === fastest.i) reasons.push(t('Nziza mu gihe', 'Fastest'));
  if (best.i === cheapest.i) reasons.push(t('Nziza mu giciro', 'Cheapest'));
  if (best.i === fewest.i && best.transfers === 0) reasons.push(t('Nta guhindura bisi', 'No transfers'));

  const tips = [];

  // Next bus from the ML model
  if (next_arrivals.length > 0) {
    const soonest = next_arrivals.reduce((a, b) => (a.seconds < b.seconds ? a : b));
    if (soonest.minutes <= 1) {
      tips.push(t(
        `Bisi ${soonest.route_code} iri hafi — igeze mu ${soonest.seconds} amasegonda.`,
        `Bus ${soonest.route_code} is arriving now — about ${soonest.seconds} seconds away.`
      ));
    } else {
      tips.push(t(
        `Bisi ${soonest.route_code} izagera kuri ${soonest.stop_name} mu minota ~${soonest.minutes}.`,
        `Next ${soonest.route_code} arrives at ${soonest.stop_name} in ~${soonest.minutes} min.`
      ));
    }
  }

  // Fare
  const bestOption = options[best.i];
  if (bestOption.fare?.amount_rwf) {
    tips.push(t(
      `Igiciro: ${bestOption.fare.amount_rwf} RWF. Wishyura ukoresheje telefone.`,
      `Fare: ${bestOption.fare.amount_rwf} RWF. Pay with your phone.`
    ));
  }

  // Transfers
  if (best.transfers > 0) {
    tips.push(t(
      `Ugomba guhindura bisi ${best.transfers} ${best.transfers === 1 ? 'inshuro imwe' : 'inshuro'}.`,
      `You'll make ${best.transfers} transfer${best.transfers > 1 ? 's' : ''}.`
    ));
  } else {
    tips.push(t(
      'Inzira itaziguye — ntuzahindura bisi.',
      'Direct route — no transfers needed.'
    ));
  }

  // Duration
  tips.push(t(
    `Urugero rw’urugendo: ~${best.minutes} min.`,
    `Estimated journey time: ~${best.minutes} min.`
  ));

  const routeDesc = bestOption.type === 'direct'
    ? bestOption.route.code
    : bestOption.legs.map((l) => l.route.code).join(' → ');
  const fromName = lang === 'rw' ? fromStop.name_rw : fromStop.name_en;
  const toName = lang === 'rw' ? toStop.name_rw : toStop.name_en;

  const summary = t(
    `Fata ${routeDesc} uve kuri ${fromName} ujye kuri ${toName}. Urugendo ni ~${best.minutes} min.`,
    `Take ${routeDesc} from ${fromName} to ${toName}. Journey is ~${best.minutes} min.`
  );

  return { best_option_index: best.i, reasons, tips, summary };
}

/* ------------------------------------------------------------------ *
 *  Utilities
 * ------------------------------------------------------------------ */

function haversine(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function callOpenRouterJSON(messages) {
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
        temperature: 0.1
      }),
      signal: ctrl.signal
    });
    if (!r.ok) return null;
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || '';
    const clean = content.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}