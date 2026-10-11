import bcrypt from 'bcryptjs';
import { pool, tx } from './pool.js';

const KIGALI = { lat: -1.9441, lng: 30.0619 };

/**
 * Demonstration seed. Stop coordinates are approximate points in Kigali.
 * Do NOT treat them as verified stop locations.
 */
const STOPS = [
  ['ST-NYAB', 'Nyabugogo',     'Nyabugogo',     -1.9418, 30.0449],
  ['ST-DOWN', 'Mu gitondo',    'Downtown',      -1.9499, 30.0589],
  ['ST-KIMI', 'Kimironko',     'Kimironko',     -1.9418, 30.1165],
  ['ST-REME', 'Remera',        'Remera',        -1.9570, 30.1120],
  ['ST-KICUK', 'Kicukiro',     'Kicukiro',      -1.9855, 30.1010],
  ['ST-KACY',  'Kacyiru',      'Kacyiru',       -1.9350, 30.0805],
  ['ST-GIKO',  'Gikondo',      'Gikondo',       -1.9800, 30.0830],
  ['ST-REB',   'Rebeca',       'Rebecca',       -1.9520, 30.0690],
  ['ST-MUHA',  'Muhima',       'Muhima',        -1.9492, 30.0580],
  ['ST-NYAR',  'Nyamirambo',   'Nyamirambo',    -1.9786, 30.0446]
];

const ROUTES = [
  { code: 'R1', name_rw: 'Nyabugogo – Kimironko', name_en: 'Nyabugogo – Kimironko',
    color: '#0ea5e9', stops: ['ST-NYAB','ST-DOWN','ST-KACY','ST-REME','ST-KIMI'] },
  { code: 'R2', name_rw: 'Nyabugogo – Kicukiro',  name_en: 'Nyabugogo – Kicukiro',
    color: '#10b981', stops: ['ST-NYAB','ST-MUHA','ST-REB','ST-GIKO','ST-KICUK'] },
  { code: 'R3', name_rw: 'Downtown – Nyamirambo', name_en: 'Downtown – Nyamirambo',
    color: '#f59e0b', stops: ['ST-DOWN','ST-MUHA','ST-NYAR'] },
  { code: 'R4', name_rw: 'Kimironko – Kicukiro',  name_en: 'Kimironko – Kicukiro',
    color: '#8b5cf6', stops: ['ST-KIMI','ST-REME','ST-KACY','ST-GIKO','ST-KICUK'] }
];

async function main() {
  await tx(async (conn) => {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of ['ticket_redemptions','tickets','bookings','fares','vehicle_positions',
      'trips','schedules','route_stops','stops','routes','vehicles','service_alerts',
      'press_resources','ai_conversations','audit_log','users']) {
      await conn.query(`TRUNCATE TABLE ${t}`);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // Users
    const pwd = await bcrypt.hash('Password123!', 10);
    const users = [
      ['passenger@routeview.rw', 'Aline Uwase',    'passenger'],
      ['operator@routeview.rw',  'Jean Bosco',     'operator'],
      ['admin@routeview.rw',     'Admin',          'admin']
    ];
    const userIds = {};
    for (const [email, name, role] of users) {
      const [r] = await conn.execute(
        `INSERT INTO users (email, password_hash, full_name, role, preferred_lang)
         VALUES (?,?,?,?, 'rw')`, [email, pwd, name, role]);
      userIds[email] = r.insertId;
    }

    // Stops
    const stopIds = {};
    for (const [code, rw, en, lat, lng] of STOPS) {
      const [r] = await conn.execute(
        'INSERT INTO stops (code, name_rw, name_en, lat, lng) VALUES (?,?,?,?,?)',
        [code, rw, en, lat, lng]);
      stopIds[code] = r.insertId;
    }

    // Routes + route_stops + schedules + fares
    for (const rt of ROUTES) {
      const [r] = await conn.execute(
        `INSERT INTO routes (code, name_rw, name_en, direction_label, color_hex)
         VALUES (?,?,?,?,?)`,
        [rt.code, rt.name_rw, rt.name_en, 'Outbound', rt.color]);
      const routeId = r.insertId;

      let cum = 0, prev = null;
      for (let i = 0; i < rt.stops.length; i++) {
        const code = rt.stops[i];
        const [srow] = await conn.query('SELECT lat,lng FROM stops WHERE id=?', [stopIds[code]]);
        const s = srow[0];
        if (prev) {
          const R = 6_371_000, toRad = (d) => d * Math.PI / 180;
          const dLat = toRad(s.lat - prev.lat), dLng = toRad(s.lng - prev.lng);
          const a = Math.sin(dLat/2)**2 + Math.cos(toRad(prev.lat))*Math.cos(toRad(s.lat))*Math.sin(dLng/2)**2;
          cum += Math.round(2 * R * Math.asin(Math.sqrt(a)));
        }
        prev = s;
        await conn.execute(
          'INSERT INTO route_stops (route_id, stop_id, sequence_no, distance_from_start_m) VALUES (?,?,?,?)',
          [routeId, stopIds[code], i + 1, cum]);
      }

      // Schedules: 06:00–21:00, every 20 min
      for (let h = 6; h <= 21; h++) {
        for (const m of [0, 20, 40]) {
          await conn.execute(
            `INSERT INTO schedules (route_id, departure_time, days_of_week)
             VALUES (?,?, 'mon,tue,wed,thu,fri,sat,sun')`,
            [routeId, `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`]);
        }
      }

      // Fares: base 300 + 50/km for every (from,to) pair
      for (let i = 0; i < rt.stops.length; i++) {
        for (let j = i + 1; j < rt.stops.length; j++) {
          // approximate — real distance computed at runtime from route_stops
          const distM = Math.abs(j - i) * 1500;
          const amt = Math.round((300 + 50 * distM / 1000) / 50) * 50;
          await conn.execute(
            `INSERT INTO fares (route_id, from_stop_id, to_stop_id, amount_rwf) VALUES (?,?,?,?)`,
            [routeId, stopIds[rt.stops[i]], stopIds[rt.stops[j]], amt]);
        }
      }
    }

    // Vehicles
    const vehicles = [
      ['RAD 123 A', 'Bus 01', 'active'],
      ['RAD 234 B', 'Bus 02', 'active'],
      ['RAD 345 C', 'Bus 03', 'active'],
      ['RAD 456 D', 'Bus 04', 'active'],
      ['RAD 567 E', 'Bus 05', 'idle']
    ];
    const vehicleIds = [];
    for (const [plate, label, status] of vehicles) {
      const [r] = await conn.execute(
        'INSERT INTO vehicles (plate, label, status) VALUES (?,?,?)', [plate, label, status]);
      vehicleIds.push(r.insertId);
    }

    // Alerts
    await conn.execute(
      `INSERT INTO service_alerts (route_id, severity, title_rw, title_en, body_rw, body_en,
        starts_at, ends_at, is_active, created_by)
       VALUES (NULL, 'info', ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 1, ?)`,
      ['Ubutumwa bwa demonstration',
       'RouteView demonstration service',
       'Aya makuru ni demonstration gusa.',
       'These alerts are demonstration data, not verified operator notices.',
       userIds['admin@routeview.rw']]
    );

    // Press resource (link only; file optional)
    await conn.execute(
      `INSERT INTO press_resources (slug, title, category, description, external_url,
        is_published, published_at, created_by)
       VALUES (?,?,?,?,?, 1, NOW(), ?)`,
      ['routeview-fact-sheet-2025',
       'RouteView fact sheet',
       'factsheet',
       'Overview of the RouteView platform, its components and demonstration scope.',
       'https://example.org/routeview-factsheet',
       userIds['admin@routeview.rw']]
    );

    console.log('[seed] demo data inserted.');
  });
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => pool.end());