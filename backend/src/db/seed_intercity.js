import { pool, tx } from './pool.js';

const COMPANIES = [
  ['VOL', 'Volcano Express', '+250 788 300 300'],
  ['RIT', 'Ritco',           '+250 788 300 400'],
  ['KBS', 'Kigali Bus Services', '+250 788 300 500'],
  ['TRI', 'Trinity Express', '+250 788 300 600'],
  ['ALP', 'Alpha Express',   '+250 788 300 700'],
  ['OME', 'Omega Express',   '+250 788 300 800'],
  ['JAL', 'Jali Transport',  '+250 788 300 900'],
  ['STA', 'Star Express',    '+250 788 301 000']
];

const TERMINALS = {
  'Kigali':       { terminal: 'Nyabugogo', province: null },
  'Musanze':      { terminal: 'Musanze Bus Park', province: 'northern' },
  'Gicumbi':      { terminal: 'Byumba Terminal', province: 'northern' },
  'Rulindo':      { terminal: 'Base Terminal', province: 'northern' },
  'Gakenke':      { terminal: 'Gakenke Terminal', province: 'northern' },
  'Burera':       { terminal: 'Kagogo Bus Park', province: 'northern' },
  'Huye':         { terminal: 'Huye Central', province: 'southern' },
  'Nyanza':       { terminal: 'Nyanza Bus Park', province: 'southern' },
  'Muhanga':      { terminal: 'Muhanga Terminal', province: 'southern' },
  'Ruhango':      { terminal: 'Ruhango Station', province: 'southern' },
  'Nyamagabe':    { terminal: 'Gasaka Terminal', province: 'southern' },
  'Gisagara':     { terminal: 'Gisagara Center', province: 'southern' },
  'Rwamagana':    { terminal: 'Rwamagana Bus Park', province: 'eastern' },
  'Kayonza':      { terminal: 'Kayonza Terminal', province: 'eastern' },
  'Nyagatare':    { terminal: 'Nyagatare Terminal', province: 'eastern' },
  'Nyamata':      { terminal: 'Nyamata Bus Stop', province: 'eastern' },
  'Kirehe':       { terminal: 'Kirehe Terminal', province: 'eastern' },
  'Ngoma':        { terminal: 'Kibungo Terminal', province: 'eastern' },
  'Rubavu':       { terminal: 'Gisenyi Bus Park', province: 'western' },
  'Karongi':      { terminal: 'Kibuye Terminal', province: 'western' },
  'Rusizi':       { terminal: 'Kamembe Terminal', province: 'western' },
  'Nyabihu':      { terminal: 'Nyabihu Bus Park', province: 'western' },
  'Nyamasheke':   { terminal: 'Nyamasheke Terminal', province: 'western' },
  'Ngororero':    { terminal: 'Ngororero Center', province: 'western' },
  'Rutsiro':      { terminal: 'Rutsiro Terminal', province: 'western' }
};

const KIGALI_ROUTES = [
  // Northern
  { to: 'Musanze',   km: 107, min: 130, price: 3000, prov: 'northern', companies: ['VOL','RIT','KBS'],
    fwd: ['06:00','07:00','08:30','10:00','12:00','14:00','16:00','17:30','18:30'],
    rev: ['05:00','06:00','07:30','09:00','11:00','13:00','15:00','16:30','18:00'] },
  { to: 'Gicumbi',   km: 75,  min: 90,  price: 2200, prov: 'northern', companies: ['VOL','ALP'],
    fwd: ['06:30','08:00','10:30','13:00','15:00','17:00'],
    rev: ['05:30','07:00','09:30','12:00','14:00','16:30'] },
  { to: 'Rulindo',   km: 45,  min: 60,  price: 1500, prov: 'northern', companies: ['KBS'],
    fwd: ['07:00','09:00','12:00','15:00','17:30'],
    rev: ['06:00','08:00','11:00','14:00','16:30'] },
  { to: 'Gakenke',   km: 90,  min: 110, price: 2500, prov: 'northern', companies: ['VOL','ALP'],
    fwd: ['07:00','09:30','12:30','15:30'],
    rev: ['06:30','09:00','12:00','15:00'] },
  { to: 'Burera',    km: 125, min: 150, price: 3500, prov: 'northern', companies: ['VOL'],
    fwd: ['06:30','10:00','14:00'],
    rev: ['06:00','09:30','13:30'] },
  // Southern
  { to: 'Huye',      km: 135, min: 150, price: 3500, prov: 'southern', companies: ['VOL','RIT','TRI'],
    fwd: ['06:00','07:30','09:00','11:00','13:00','15:00','16:30','18:00'],
    rev: ['05:00','06:30','08:00','10:00','12:00','14:00','15:30','17:00'] },
  { to: 'Nyanza',    km: 100, min: 120, price: 2800, prov: 'southern', companies: ['RIT','TRI'],
    fwd: ['06:30','08:30','11:00','14:00','16:30'],
    rev: ['05:30','07:30','10:00','13:00','15:30'] },
  { to: 'Muhanga',   km: 50,  min: 60,  price: 1200, prov: 'southern', companies: ['KBS','RIT'],
    fwd: ['06:00','07:00','09:00','11:00','13:00','15:00','17:00','18:30'],
    rev: ['05:00','06:00','08:00','10:00','12:00','14:00','16:00','17:30'] },
  { to: 'Ruhango',   km: 75,  min: 90,  price: 1800, prov: 'southern', companies: ['RIT'],
    fwd: ['07:30','10:00','13:30','16:00'],
    rev: ['06:30','09:00','12:30','15:00'] },
  { to: 'Nyamagabe', km: 170, min: 190, price: 4000, prov: 'southern', companies: ['VOL','RIT'],
    fwd: ['06:00','09:00','13:00','16:00'],
    rev: ['05:30','08:30','12:30','15:30'] },
  { to: 'Gisagara',  km: 155, min: 180, price: 3800, prov: 'southern', companies: ['RIT'],
    fwd: ['07:00','10:30','14:00'],
    rev: ['06:30','10:00','13:30'] },
  // Eastern
  { to: 'Rwamagana', km: 60,  min: 75,  price: 1500, prov: 'eastern', companies: ['KBS','ALP','OME'],
    fwd: ['06:00','07:00','08:00','09:00','11:00','13:00','15:00','17:00','18:00'],
    rev: ['05:00','06:00','07:00','08:00','10:00','12:00','14:00','16:00','17:30'] },
  { to: 'Kayonza',   km: 95,  min: 105, price: 2000, prov: 'eastern', companies: ['VOL','OME'],
    fwd: ['06:30','08:30','11:00','14:00','16:30'],
    rev: ['05:30','07:30','10:00','13:00','15:30'] },
  { to: 'Nyagatare', km: 180, min: 210, price: 4000, prov: 'eastern', companies: ['VOL','ALP'],
    fwd: ['06:00','09:00','13:00','16:00'],
    rev: ['05:00','08:00','12:00','15:00'] },
  { to: 'Nyamata',   km: 40,  min: 45,  price: 1000, prov: 'eastern', companies: ['KBS'],
    fwd: ['06:00','07:30','09:00','11:00','13:00','15:00','17:00','18:00'],
    rev: ['05:00','06:30','08:00','10:00','12:00','14:00','16:00','17:30'] },
  { to: 'Kirehe',    km: 140, min: 165, price: 3200, prov: 'eastern', companies: ['OME','STA'],
    fwd: ['06:30','09:30','13:30','16:30'],
    rev: ['06:00','09:00','13:00','16:00'] },
  { to: 'Ngoma',     km: 105, min: 120, price: 2200, prov: 'eastern', companies: ['OME'],
    fwd: ['07:00','10:00','13:00','16:00'],
    rev: ['06:30','09:30','12:30','15:30'] },
  // Western
  { to: 'Rubavu',    km: 155, min: 180, price: 5000, prov: 'western', companies: ['VOL','RIT','TRI'],
    fwd: ['06:00','07:30','09:00','11:00','13:00','15:00','16:30','18:00'],
    rev: ['05:00','06:30','08:00','10:00','12:00','14:00','15:30','17:00'] },
  { to: 'Karongi',   km: 190, min: 240, price: 5000, prov: 'western', companies: ['VOL','RIT'],
    fwd: ['06:30','09:00','12:00','15:00'],
    rev: ['05:30','08:00','11:00','14:00'] },
  { to: 'Rusizi',    km: 320, min: 360, price: 9000, prov: 'western', companies: ['VOL','RIT'],
    fwd: ['05:30','07:00','09:30','13:00'],
    rev: ['05:00','06:30','09:00','12:00'] },
  { to: 'Nyabihu',   km: 130, min: 150, price: 3500, prov: 'western', companies: ['VOL'],
    fwd: ['06:30','10:00','14:00','17:00'],
    rev: ['05:30','09:00','13:00','16:00'] },
  { to: 'Nyamasheke', km: 240, min: 300, price: 6000, prov: 'western', companies: ['VOL','JAL'],
    fwd: ['06:00','09:00','12:00','15:00'],
    rev: ['05:30','08:30','11:30','14:30'] },
  { to: 'Ngororero', km: 130, min: 165, price: 3000, prov: 'western', companies: ['JAL'],
    fwd: ['07:00','10:30','14:00'],
    rev: ['06:30','10:00','13:30'] },
  { to: 'Rutsiro',   km: 175, min: 220, price: 4500, prov: 'western', companies: ['VOL','JAL'],
    fwd: ['07:00','10:00','13:00'],
    rev: ['06:30','09:30','12:30'] }
];

const CROSS_ROUTES = [
  { from: 'Musanze', to: 'Rubavu',    km: 65,  min: 90,  price: 2000, prov: 'western',  companies: ['VOL','TRI'],
    fwd: ['07:00','10:00','13:00','16:00'], rev: ['08:30','11:30','14:30','17:30'] },
  { from: 'Musanze', to: 'Nyabihu',   km: 25,  min: 40,  price: 800,  prov: 'western',  companies: ['VOL'],
    fwd: ['07:30','11:00','14:30','17:30'], rev: ['08:00','11:30','15:00','18:00'] },
  { from: 'Musanze', to: 'Huye',      km: 230, min: 240, price: 5500, prov: 'southern', companies: ['VOL','RIT'],
    fwd: ['06:00','09:00','13:00'], rev: ['06:00','09:00','13:00'] },
  { from: 'Musanze', to: 'Rwamagana', km: 140, min: 165, price: 3500, prov: 'eastern',  companies: ['VOL'],
    fwd: ['07:00','11:00','15:00'], rev: ['07:00','11:00','15:00'] },
  { from: 'Rubavu',  to: 'Huye',      km: 280, min: 300, price: 6500, prov: 'southern', companies: ['VOL','RIT'],
    fwd: ['06:00','10:00'], rev: ['06:00','10:00'] },
  { from: 'Rubavu',  to: 'Karongi',   km: 120, min: 150, price: 3000, prov: 'western',  companies: ['VOL','RIT'],
    fwd: ['07:00','10:00','13:00','16:00'], rev: ['07:00','10:00','13:00','16:00'] },
  { from: 'Rubavu',  to: 'Rusizi',    km: 200, min: 240, price: 5500, prov: 'western',  companies: ['VOL'],
    fwd: ['06:30','10:00'], rev: ['06:30','10:00'] },
  { from: 'Karongi', to: 'Rusizi',    km: 110, min: 150, price: 3000, prov: 'western',  companies: ['VOL','RIT'],
    fwd: ['08:00','11:00','14:00'], rev: ['08:00','11:00','14:00'] },
  { from: 'Huye',    to: 'Rwamagana', km: 150, min: 180, price: 3500, prov: 'eastern',  companies: ['RIT','TRI'],
    fwd: ['07:00','11:00','15:00'], rev: ['07:00','11:00','15:00'] },
  { from: 'Huye',    to: 'Nyamata',   km: 130, min: 150, price: 3000, prov: 'eastern',  companies: ['RIT'],
    fwd: ['08:00','12:00','16:00'], rev: ['08:00','12:00','16:00'] },
  { from: 'Rubavu',  to: 'Nyabihu',   km: 30,  min: 45,  price: 900,  prov: 'western',  companies: ['VOL','JAL'],
    fwd: ['08:00','11:00','14:00','17:00'], rev: ['08:30','11:30','14:30','17:30'] }
];

function ymd(d) { return d.toISOString().slice(0, 10); }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }

async function insertRoute(conn, { fromCity, toCity, km, min, price, prov }) {
  const [r] = await conn.execute(
    `INSERT INTO intercity_routes
      (origin_city, origin_terminal, destination_city, destination_terminal,
       province, distance_km, duration_min, base_price_rwf)
     VALUES (?,?,?,?,?,?,?,?)`,
    [fromCity, TERMINALS[fromCity].terminal, toCity, TERMINALS[toCity].terminal, prov, km, min, price]
  );
  return r.insertId;
}

async function insertTrips(conn, routeId, price, companyIds, times, days = 14) {
  let count = 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 0; i < times.length; i++) {
    const companyCode = companyIds[i % companyIds.length];
    const busType = ['standard','express','vip'][i % 3];
    const totalSeats = busType === 'vip' ? 32 : busType === 'express' ? 40 : 49;
    const [s] = await conn.execute(
      `INSERT INTO intercity_schedules
        (route_id, company_id, departure_time, bus_type, total_seats)
       VALUES (?,?,?,?,?)`,
      [routeId, companyCode, times[i] + ':00', busType, totalSeats]
    );
    const scheduleId = s.insertId;
    for (let d = 0; d < days; d++) {
      const day = addDays(today, d);
      const [hh, mm] = times[i].split(':').map(Number);
      const departure = new Date(day); departure.setHours(hh, mm, 0, 0);
      const adjusted = Math.round(price * (busType === 'vip' ? 1.3 : busType === 'express' ? 1.1 : 1) / 100) * 100;
      const plate = `RAD ${200 + count} ${String.fromCharCode(65 + (count % 26))}`;
      const driver = `Driver ${count % 100}`;
      await conn.execute(
        `INSERT INTO intercity_trips
          (schedule_id, route_id, company_id, trip_date, departure_dt,
           price_rwf, seats_total, plate_number, driver_name)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [scheduleId, routeId, companyCode, ymd(day), departure, adjusted, totalSeats, plate, driver]
      );
      count++;
    }
  }
  return count;
}

async function main() {
  console.log('[ic-seed] resetting interprovincial tables…');
  await tx(async (conn) => {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of ['intercity_tickets','intercity_bookings','intercity_trips',
      'intercity_schedules','intercity_routes','intercity_companies']) {
      await conn.query(`TRUNCATE TABLE ${t}`);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    const companyId = {};
    for (const [code, name, phone] of COMPANIES) {
      const [r] = await conn.execute(
        'INSERT INTO intercity_companies (code, name, phone) VALUES (?,?,?)',
        [code, name, phone]
      );
      companyId[code] = r.insertId;
    }
    console.log(`[ic-seed] ${COMPANIES.length} companies`);

    let routeCount = 0, tripCount = 0;

    for (const r of KIGALI_ROUTES) {
      const cids = r.companies.map((c) => companyId[c]);
      const fwdId = await insertRoute(conn, { fromCity: 'Kigali', toCity: r.to, km: r.km, min: r.min, price: r.price, prov: r.prov });
      tripCount += await insertTrips(conn, fwdId, r.price, cids, r.fwd);
      routeCount++;
      const revId = await insertRoute(conn, { fromCity: r.to, toCity: 'Kigali', km: r.km, min: r.min, price: r.price, prov: r.prov });
      tripCount += await insertTrips(conn, revId, r.price, cids, r.rev);
      routeCount++;
    }

    for (const r of CROSS_ROUTES) {
      const cids = r.companies.map((c) => companyId[c]);
      const fwdId = await insertRoute(conn, { fromCity: r.from, toCity: r.to, km: r.km, min: r.min, price: r.price, prov: r.prov });
      tripCount += await insertTrips(conn, fwdId, r.price, cids, r.fwd);
      routeCount++;
      const revId = await insertRoute(conn, { fromCity: r.to, toCity: r.from, km: r.km, min: r.min, price: r.price, prov: r.prov });
      tripCount += await insertTrips(conn, revId, r.price, cids, r.rev);
      routeCount++;
    }

    console.log(`[ic-seed] ${routeCount} route directions`);
    console.log(`[ic-seed] ${tripCount} trips (14 days)`);
    console.log('[ic-seed] done.');
  });
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => pool.end());