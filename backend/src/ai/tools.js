import { pool } from '../db/pool.js';
import { planJourney, nearestStops } from '../services/journey.js';
import { fareBetween } from '../services/fares.js';
import { estimateArrival } from '../services/arrival.js';

/* ================================================================== *
 *  Tool schema advertised to OpenRouter                               *
 * ================================================================== */
export const TOOL_SCHEMA = [
  {
    type: 'function',
    function: {
      name: 'find_stops',
      description:
        'Search RouteView stops by name substring (English or Kinyarwanda) or by code. ' +
        'Returns matching stops with id, names and coordinates. If nothing matches, ' +
        'returns a list of available stops so the assistant can suggest alternatives.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Stop name fragment or code, e.g. "Kimironko" or "ST-KIMI".' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'nearest_stops',
      description: 'Return the closest stops to a latitude/longitude point.',
      parameters: {
        type: 'object',
        properties: {
          lat: { type: 'number' },
          lng: { type: 'number' },
          limit: { type: 'integer', default: 5 }
        },
        required: ['lat', 'lng']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_routes',
      description: 'List active routes. Optional filter by code or name fragment.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Route code or name fragment.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'route_details',
      description: 'Full detail (stops, schedules, direction) of a route by id or code.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          code: { type: 'string' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'plan_journey',
      description:
        'Plan a journey between two stop ids. Returns direct and one-transfer options ' +
        'with duration, distance and fare.',
      parameters: {
        type: 'object',
        properties: {
          from_stop_id: { type: 'integer' },
          to_stop_id: { type: 'integer' }
        },
        required: ['from_stop_id', 'to_stop_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fare_between',
      description: 'Fare in RWF between two stops on a route.',
      parameters: {
        type: 'object',
        properties: {
          route_id: { type: 'integer' },
          from_stop_id: { type: 'integer' },
          to_stop_id: { type: 'integer' }
        },
        required: ['route_id', 'from_stop_id', 'to_stop_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_active_alerts',
      description: 'Active service alerts (disruptions, changes) across the network.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'vehicles_on_route',
      description:
        'Latest positions of vehicles currently on a route. Simulated positions are ' +
        'labelled; do not present them as verified GPS.',
      parameters: {
        type: 'object',
        properties: { route_id: { type: 'integer' } },
        required: ['route_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'arrival_estimate',
      description:
        'Seconds-until-arrival for a vehicle to a target stop, computed by RouteView\'s ' +
        'own Python ML model when available (source="model"), otherwise a physics fallback ' +
        '(source="fallback").',
      parameters: {
        type: 'object',
        properties: {
          vehicle_id: { type: 'integer' },
          target_stop_id: { type: 'integer' }
        },
        required: ['vehicle_id', 'target_stop_id']
      }
    }
  }
];

/* ================================================================== *
 *  Dispatcher                                                         *
 * ================================================================== */
export async function runTool(name, args) {
  switch (name) {

    /* -------------------------------------------------------------- */
    case 'find_stops': {
      const q = String(args.query || '').trim();
      if (!q) {
        const [all] = await pool.query(
          `SELECT id, code, name_rw, name_en, lat, lng FROM stops
            WHERE is_active=1 ORDER BY name_en LIMIT 15`
        );
        return {
          matches: [],
          note: 'No query provided.',
          available_stops: all.map(stopLite)
        };
      }

      const like = `%${q}%`;
      let [rows] = await pool.query(
        `SELECT id, code, name_rw, name_en, lat, lng FROM stops
          WHERE is_active=1 AND (name_rw LIKE ? OR name_en LIKE ? OR code LIKE ?)
          LIMIT 10`,
        [like, like, like]
      );

      // Fuzzy: first 4 chars
      if (rows.length === 0 && q.length >= 4) {
        const fuzzy = `%${q.slice(0, 4)}%`;
        [rows] = await pool.query(
          `SELECT id, code, name_rw, name_en, lat, lng FROM stops
            WHERE is_active=1 AND (name_rw LIKE ? OR name_en LIKE ?)
            LIMIT 10`,
          [fuzzy, fuzzy]
        );
      }

      // Still nothing — return the full available list
      if (rows.length === 0) {
        const [all] = await pool.query(
          `SELECT id, code, name_rw, name_en, lat, lng FROM stops
            WHERE is_active=1 ORDER BY name_en LIMIT 15`
        );
        return {
          matches: [],
          note: `No stop matches "${q}".`,
          available_stops: all.map(stopLite)
        };
      }

      return { matches: rows.map(stopFull) };
    }

    /* -------------------------------------------------------------- */
    case 'nearest_stops': {
      const lat = Number(args.lat);
      const lng = Number(args.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { error: 'invalid_coordinates' };
      }
      const limit = Math.min(20, Math.max(1, Number(args.limit) || 5));
      const rows = await nearestStops({ lat, lng, limit });
      return { stops: rows.map(stopFull) };
    }

    /* -------------------------------------------------------------- */
    case 'list_routes': {
      const q = String(args.query || '').trim();
      const like = `%${q}%`;
      const [rows] = await pool.query(
        `SELECT id, code, name_rw, name_en, direction_label, color_hex
           FROM routes
          WHERE is_active=1 AND (code LIKE ? OR name_rw LIKE ? OR name_en LIKE ?)
          ORDER BY code
          LIMIT 20`,
        [like, like, like]
      );
      return { routes: rows };
    }

    /* -------------------------------------------------------------- */
    case 'route_details': {
      const cond = args.id ? 'id = ?' : 'code = ?';
      const value = args.id || args.code;
      if (!value) return { error: 'id_or_code_required' };

      const [routes] = await pool.query(
        `SELECT * FROM routes WHERE ${cond} LIMIT 1`,
        [value]
      );
      const r = routes[0];
      if (!r) return { error: 'route_not_found' };

      const [stops] = await pool.query(
        `SELECT rs.sequence_no, rs.distance_from_start_m,
                s.id, s.code, s.name_rw, s.name_en, s.lat, s.lng
           FROM route_stops rs
           JOIN stops s ON s.id = rs.stop_id
          WHERE rs.route_id = ?
          ORDER BY rs.sequence_no`,
        [r.id]
      );

      const [schedules] = await pool.query(
        'SELECT departure_time, days_of_week FROM schedules WHERE route_id = ? ORDER BY departure_time',
        [r.id]
      );

      return {
        route: {
          id: r.id,
          code: r.code,
          name_en: r.name_en,
          name_rw: r.name_rw,
          direction_label: r.direction_label,
          color_hex: r.color_hex
        },
        stops,
        schedules,
        total_distance_m: stops.length ? stops[stops.length - 1].distance_from_start_m : 0
      };
    }

    /* -------------------------------------------------------------- */
    case 'plan_journey': {
      const from = Number(args.from_stop_id);
      const to = Number(args.to_stop_id);
      if (!from || !to) return { error: 'from_to_required' };
      if (from === to) return { error: 'same_stop' };
      const options = await planJourney({ fromStopId: from, toStopId: to });
      return { options };
    }

    /* -------------------------------------------------------------- */
    case 'fare_between': {
      const routeId = Number(args.route_id);
      const from = Number(args.from_stop_id);
      const to = Number(args.to_stop_id);
      if (!routeId || !from || !to) return { error: 'route_from_to_required' };
      const fare = await fareBetween(routeId, from, to);
      if (!fare) return { error: 'no_fare_found' };
      return { amount_rwf: fare.amount, source: fare.source };
    }

    /* -------------------------------------------------------------- */
    case 'list_active_alerts': {
      const [rows] = await pool.query(
        `SELECT id, route_id, severity, title_rw, title_en, body_rw, body_en, starts_at, ends_at
           FROM service_alerts
          WHERE is_active=1
            AND (ends_at IS NULL OR ends_at > NOW())
          ORDER BY starts_at DESC
          LIMIT 20`
      );
      return { alerts: rows };
    }

    /* -------------------------------------------------------------- */
    case 'vehicles_on_route': {
      const routeId = Number(args.route_id);
      if (!routeId) return { error: 'route_id_required' };

      const [rows] = await pool.query(
        `SELECT vp.vehicle_id, v.plate, v.label,
                vp.lat, vp.lng, vp.speed_kmh, vp.heading_deg,
                vp.source, vp.recorded_at
           FROM vehicle_positions vp
           JOIN vehicles v ON v.id = vp.vehicle_id
           JOIN (
             SELECT vehicle_id, MAX(recorded_at) AS m
               FROM vehicle_positions
              WHERE route_id = ?
              GROUP BY vehicle_id
           ) latest
             ON latest.vehicle_id = vp.vehicle_id AND latest.m = vp.recorded_at
          WHERE vp.route_id = ?`,
        [routeId, routeId]
      );

      const now = Date.now();
      return {
        route_id: routeId,
        vehicles: rows.map((r) => ({
          vehicle_id: r.vehicle_id,
          plate: r.plate,
          label: r.label,
          lat: Number(r.lat),
          lng: Number(r.lng),
          speed_kmh: r.speed_kmh != null ? Number(r.speed_kmh) : null,
          heading_deg: r.heading_deg,
          source: r.source,
          simulated: r.source === 'simulator',
          age_seconds: Math.round((now - new Date(r.recorded_at).getTime()) / 1000)
        }))
      };
    }

    /* -------------------------------------------------------------- */
    case 'arrival_estimate': {
      const vehicleId = Number(args.vehicle_id);
      const stopId = Number(args.target_stop_id);
      if (!vehicleId || !stopId) return { error: 'vehicle_and_stop_required' };

      const out = await estimateArrival({ vehicleId, targetStopId: stopId });
      if (out.error) return { error: out.error };

      return {
        vehicle_id: vehicleId,
        target_stop_id: stopId,
        seconds: out.seconds,
        minutes: Math.max(1, Math.round(out.seconds / 60)),
        source: out.source,
        model_version: out.model_version,
        stale: !!out.stale,
        vehicle: out.vehicle || null
      };
    }

    /* -------------------------------------------------------------- */
    default:
      return { error: `unknown_tool:${name}` };
  }
}

/* ================================================================== *
 *  Small helpers                                                      *
 * ================================================================== */
function stopLite(s) {
  return {
    id: s.id,
    code: s.code,
    name_en: s.name_en,
    name_rw: s.name_rw
  };
}

function stopFull(s) {
  return {
    id: s.id,
    code: s.code,
    name_en: s.name_en,
    name_rw: s.name_rw,
    lat: s.lat != null ? Number(s.lat) : null,
    lng: s.lng != null ? Number(s.lng) : null,
    ...(s.distance_m != null ? { distance_m: s.distance_m } : {})
  };
}