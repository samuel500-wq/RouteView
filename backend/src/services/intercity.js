import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { customAlphabet } from 'nanoid';
import { pool, tx } from '../db/pool.js';
import { ApiError } from '../middleware/error.js';

const refGen = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);
const codeGen = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 24);

/* ------------------------------------------------------------------ *
 *  Search trips
 * ------------------------------------------------------------------ */
export async function searchTrips({ from, to, date, passengers = 1 }) {
  if (!from || !to) throw new ApiError(400, 'from_to_required');
  if (!date) date = new Date().toISOString().slice(0, 10);

  const [rows] = await pool.query(
    `SELECT t.id AS trip_id, t.departure_dt, t.price_rwf, t.seats_total, t.seats_booked,
            t.plate_number, t.driver_name, t.status,
            r.id AS route_id, r.origin_city, r.origin_terminal,
            r.destination_city, r.destination_terminal,
            r.distance_km, r.duration_min, r.province,
            c.code AS company_code, c.name AS company_name, c.phone AS company_phone,
            s.bus_type
       FROM intercity_trips t
       JOIN intercity_routes r ON r.id = t.route_id
       JOIN intercity_companies c ON c.id = t.company_id
       JOIN intercity_schedules s ON s.id = t.schedule_id
      WHERE LOWER(r.origin_city) = LOWER(?)
        AND LOWER(r.destination_city) = LOWER(?)
        AND t.trip_date = ?
        AND t.status IN ('scheduled','boarding')
      ORDER BY t.departure_dt`,
    [from.trim(), to.trim(), date]
  );

  return rows.map((r) => ({
    trip_id: r.trip_id,
    departure_dt: r.departure_dt,
    arrival_dt: new Date(new Date(r.departure_dt).getTime() + r.duration_min * 60000),
    price_rwf: r.price_rwf,
    seats_available: r.seats_total - r.seats_booked,
    seats_total: r.seats_total,
    bus_type: r.bus_type,
    plate_number: r.plate_number,
    driver_name: r.driver_name,
    route: {
      id: r.route_id,
      origin_city: r.origin_city,
      origin_terminal: r.origin_terminal,
      destination_city: r.destination_city,
      destination_terminal: r.destination_terminal,
      distance_km: r.distance_km,
      duration_min: r.duration_min,
      province: r.province
    },
    company: {
      code: r.company_code,
      name: r.company_name,
      phone: r.company_phone
    }
  }));
}

/* ------------------------------------------------------------------ *
 *  Origins (cities that appear as origin_city)
 * ------------------------------------------------------------------ */
export async function listOriginCities() {
  const [rows] = await pool.query(
    `SELECT origin_city AS city, COUNT(*) AS routes
       FROM intercity_routes WHERE is_active = 1
      GROUP BY origin_city
      ORDER BY origin_city`
  );
  return rows;
}

/* ------------------------------------------------------------------ *
 *  Destinations (optionally filtered by origin)
 * ------------------------------------------------------------------ */
export async function listDestinations(fromCity = null) {
  const args = [];
  let where = 'WHERE is_active = 1';
  if (fromCity) {
    where += ' AND LOWER(origin_city) = LOWER(?)';
    args.push(fromCity);
  }
  const [rows] = await pool.query(
    `SELECT destination_city AS city, province,
            MIN(distance_km) AS distance_km,
            MIN(duration_min) AS duration_min,
            MIN(base_price_rwf) AS from_price_rwf
       FROM intercity_routes ${where}
      GROUP BY destination_city, province
      ORDER BY province, destination_city`,
    args
  );
  return rows;
}

export async function listProvinces() {
  const [rows] = await pool.query(
    `SELECT province, COUNT(*) AS routes
       FROM intercity_routes WHERE is_active = 1
      GROUP BY province
      ORDER BY FIELD(province,'northern','southern','eastern','western')`
  );
  return rows;
}

/* ------------------------------------------------------------------ *
 *  Booking creation (pending)
 * ------------------------------------------------------------------ */
export async function createBooking({ userId, tripId, passengerName, passengerPhone,
                                       passengerEmail, passengerIdNo }) {
  return tx(async (conn) => {
    const [trips] = await conn.execute(
      `SELECT t.*, r.origin_city, r.destination_city
         FROM intercity_trips t
         JOIN intercity_routes r ON r.id = t.route_id
        WHERE t.id = ? FOR UPDATE`,
      [tripId]
    );
    const trip = trips[0];
    if (!trip) throw new ApiError(404, 'trip_not_found');
    if (trip.status === 'cancelled') throw new ApiError(409, 'trip_cancelled');
    if (trip.seats_booked >= trip.seats_total) throw new ApiError(409, 'trip_full');
    if (new Date(trip.departure_dt) < new Date(Date.now() - 5 * 60 * 1000)) {
      throw new ApiError(409, 'trip_departed');
    }

    const reference = refGen();
    const [r] = await conn.execute(
      `INSERT INTO intercity_bookings
        (reference, user_id, trip_id, passenger_name, passenger_phone,
         passenger_email, passenger_id_no, amount_rwf, status)
       VALUES (?,?,?,?,?,?,?,?, 'pending')`,
      [reference, userId, tripId, passengerName, passengerPhone || null,
       passengerEmail || null, passengerIdNo || null, trip.price_rwf]
    );
    return { id: r.insertId, reference, amount_rwf: trip.price_rwf, status: 'pending' };
  });
}

/* ------------------------------------------------------------------ *
 *  Demo payment — issues the ticket
 * ------------------------------------------------------------------ */
export async function payDemo({ bookingId, userId }) {
  return tx(async (conn) => {
    const [rows] = await conn.execute(
      `SELECT b.*, t.departure_dt, t.seats_total, t.seats_booked
         FROM intercity_bookings b
         JOIN intercity_trips t ON t.id = b.trip_id
        WHERE b.id = ? FOR UPDATE`,
      [bookingId]
    );
    const b = rows[0];
    if (!b) throw new ApiError(404, 'booking_not_found');
    if (b.user_id !== userId) throw new ApiError(404, 'booking_not_found');
    if (b.status === 'paid') {
      return { status: 'paid', ticket: await loadTicket(conn, bookingId) };
    }
    if (b.status !== 'pending') throw new ApiError(409, 'booking_not_pending');

    await conn.execute(
      'UPDATE intercity_trips SET seats_booked = seats_booked + 1 WHERE id = ?',
      [b.trip_id]
    );
    const seatNumber = (b.seats_booked || 0) + 1;

    await conn.execute(
      `UPDATE intercity_bookings
          SET status='paid', payment_ref=?, seat_number=?
        WHERE id=?`,
      [`demo-${Date.now()}`, seatNumber, bookingId]
    );

    const code = codeGen();
    const qrPayload = `routeview://intercity/${code}`;
    await conn.execute(
      `INSERT INTO intercity_tickets (booking_id, code, qr_payload, departure_dt, status)
       VALUES (?,?,?,?, 'issued')`,
      [bookingId, code, qrPayload, b.departure_dt]
    );

    return { status: 'paid', ticket: await loadTicket(conn, bookingId) };
  });
}

/* ------------------------------------------------------------------ *
 *  Load ticket with QR image
 * ------------------------------------------------------------------ */
async function loadTicket(conn, bookingId) {
  const [rows] = await conn.execute(
    `SELECT t.id, t.code, t.qr_payload, t.status, t.issued_at,
            t.departure_dt, t.used_at,
            b.reference, b.seat_number, b.amount_rwf,
            b.passenger_name, b.passenger_phone,
            r.origin_city, r.origin_terminal,
            r.destination_city, r.destination_terminal,
            r.distance_km, r.duration_min, r.province,
            c.name AS company_name, c.phone AS company_phone,
            tr.plate_number, tr.driver_name, tr.driver_phone, s.bus_type
       FROM intercity_tickets t
       JOIN intercity_bookings b ON b.id = t.booking_id
       JOIN intercity_trips tr ON tr.id = b.trip_id
       JOIN intercity_routes r ON r.id = tr.route_id
       JOIN intercity_companies c ON c.id = tr.company_id
       JOIN intercity_schedules s ON s.id = tr.schedule_id
      WHERE t.booking_id = ?`,
    [bookingId]
  );
  const t = rows[0];
  if (!t) return null;
  const qr = await QRCode.toDataURL(t.qr_payload, { margin: 1, width: 360 });
  return { ...t, qr_data_url: qr };
}

/* ------------------------------------------------------------------ *
 *  List user's intercity bookings
 * ------------------------------------------------------------------ */
export async function listUserBookings(userId) {
  const [rows] = await pool.query(
    `SELECT b.id, b.reference, b.status, b.amount_rwf, b.seat_number,
            b.passenger_name, b.created_at,
            r.origin_city, r.destination_city, r.province,
            tr.departure_dt, c.name AS company_name,
            s.bus_type,
            t.status AS ticket_status, t.code AS ticket_code
       FROM intercity_bookings b
       JOIN intercity_trips tr ON tr.id = b.trip_id
       JOIN intercity_routes r ON r.id = tr.route_id
       JOIN intercity_companies c ON c.id = tr.company_id
       JOIN intercity_schedules s ON s.id = tr.schedule_id
       LEFT JOIN intercity_tickets t ON t.booking_id = b.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC`,
    [userId]
  );
  return rows;
}

/* ------------------------------------------------------------------ *
 *  Get a single ticket (with owner check)
 * ------------------------------------------------------------------ */
export async function getTicket(bookingId, userId) {
  const conn = await pool.getConnection();
  try {
    const [own] = await conn.execute(
      'SELECT user_id FROM intercity_bookings WHERE id = ?', [bookingId]
    );
    if (!own[0] || own[0].user_id !== userId) throw new ApiError(404, 'booking_not_found');
    return await loadTicket(conn, bookingId);
  } finally { conn.release(); }
}

/* ------------------------------------------------------------------ *
 *  Redeem — scan by driver/operator. Single-use, race-safe.
 * ------------------------------------------------------------------ */
export async function redeemTicket({ codeOrPayload, operatorUserId, plateNumber }) {
  const code = codeOrPayload.startsWith('routeview://intercity/')
    ? codeOrPayload.replace('routeview://intercity/', '')
    : codeOrPayload.trim();

  return tx(async (conn) => {
    const [rows] = await conn.execute(
      `SELECT t.*, b.reference, b.passenger_name, b.status AS booking_status,
              tr.departure_dt, tr.plate_number, tr.driver_name,
              r.origin_city, r.destination_city,
              c.name AS company_name
         FROM intercity_tickets t
         JOIN intercity_bookings b ON b.id = t.booking_id
         JOIN intercity_trips tr ON tr.id = b.trip_id
         JOIN intercity_routes r ON r.id = tr.route_id
         JOIN intercity_companies c ON c.id = tr.company_id
        WHERE t.code = ? FOR UPDATE`,
      [code]
    );
    const t = rows[0];
    if (!t) throw new ApiError(404, 'ticket_not_found');
    if (t.booking_status === 'cancelled') throw new ApiError(409, 'booking_cancelled');
    if (t.booking_status === 'refunded') throw new ApiError(409, 'booking_refunded');
    if (t.status === 'used')      throw new ApiError(409, 'already_used');
    if (t.status === 'cancelled') throw new ApiError(409, 'ticket_cancelled');
    if (t.status === 'expired')   throw new ApiError(409, 'ticket_expired');

    const now = Date.now();
    const dep = new Date(t.departure_dt).getTime();
    if (now < dep - 6 * 3600 * 1000) throw new ApiError(409, 'too_early');
    if (now > dep + 2 * 3600 * 1000) {
      await conn.execute("UPDATE intercity_tickets SET status='expired' WHERE id=?", [t.id]);
      throw new ApiError(409, 'departed_expired');
    }

    const [upd] = await conn.execute(
      `UPDATE intercity_tickets
          SET status='used', used_at=NOW(), used_by=?, scanned_plate=?
        WHERE id=? AND status='issued'`,
      [operatorUserId, plateNumber || t.plate_number || null, t.id]
    );
    if (upd.affectedRows !== 1) throw new ApiError(409, 'already_used');

    return {
      ok: true,
      ticket_id: t.id,
      code: t.code,
      reference: t.reference,
      passenger_name: t.passenger_name,
      route: `${t.origin_city} → ${t.destination_city}`,
      company: t.company_name,
      departure_dt: t.departure_dt,
      plate_number: t.plate_number,
      driver_name: t.driver_name,
      used_at: new Date()
    };
  });
}