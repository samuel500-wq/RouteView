import { pool } from '../db/pool.js';

/* ================================================================== *
 *  Combined list of urban + intercity bookings                        *
 * ================================================================== */
export async function listBookings({
  page = 1,
  pageSize = 20,
  status,
  type = 'all',
  q,
  date_from,
  date_to
} = {}) {
  page = Math.max(1, Number(page) || 1);
  pageSize = Math.min(100, Math.max(5, Number(pageSize) || 20));
  const offset = (page - 1) * pageSize;

  const includeUrban = type === 'all' || type === 'urban';
  const includeInter = type === 'all' || type === 'intercity';

  const parts = [];

  /* ---------------- Urban ---------------- */
  if (includeUrban) {
    const w = ['1=1'];
    const a = [];
    if (status)    { w.push('b.status = ?');       a.push(status); }
    if (date_from) { w.push('b.created_at >= ?');  a.push(date_from + ' 00:00:00'); }
    if (date_to)   { w.push('b.created_at <= ?');  a.push(date_to + ' 23:59:59'); }
    if (q) {
      w.push('(b.reference LIKE ? OR b.passenger_name LIKE ? OR r.code LIKE ? OR u.email LIKE ?)');
      const like = `%${q}%`;
      a.push(like, like, like, like);
    }
    parts.push({
      sql: `
        SELECT 'urban' AS type,
               b.id, b.reference, b.status, b.amount_rwf AS amount,
               b.created_at, b.passenger_name, b.passenger_phone,
               NULL AS seat_number, b.depart_at AS trip_departure,
               r.code AS route_code, r.name_en AS route_name,
               r.color_hex COLLATE utf8mb4_unicode_ci AS route_color,
               u.email AS user_email,
               t.code COLLATE utf8mb4_unicode_ci AS ticket_code,
               t.status COLLATE utf8mb4_unicode_ci AS ticket_status,
               trd.redeemed_at AS used_at,
               NULL AS company_name,
               'urban' COLLATE utf8mb4_unicode_ci AS origin,
               'urban' COLLATE utf8mb4_unicode_ci AS destination
          FROM bookings b
          JOIN routes r ON r.id = b.route_id
          JOIN users  u ON u.id = b.user_id
          LEFT JOIN tickets t ON t.booking_id = b.id
          LEFT JOIN ticket_redemptions trd ON trd.ticket_id = t.id
         WHERE ${w.join(' AND ')}`,
      args: a
    });
  }

  /* ---------------- Intercity ---------------- */
  if (includeInter) {
    const w = ['1=1'];
    const a = [];
    if (status)    { w.push('b.status = ?');       a.push(status); }
    if (date_from) { w.push('b.created_at >= ?');  a.push(date_from + ' 00:00:00'); }
    if (date_to)   { w.push('b.created_at <= ?');  a.push(date_to + ' 23:59:59'); }
    if (q) {
      w.push(`(b.reference LIKE ? OR b.passenger_name LIKE ?
               OR r.origin_city LIKE ? OR r.destination_city LIKE ?
               OR u.email LIKE ?)`);
      const like = `%${q}%`;
      a.push(like, like, like, like, like);
    }
    parts.push({
      sql: `
        SELECT 'intercity' AS type,
               b.id, b.reference, b.status, b.amount_rwf AS amount,
               b.created_at, b.passenger_name, b.passenger_phone,
               b.seat_number, tr.departure_dt AS trip_departure,
               CONCAT(r.origin_city, ' → ', r.destination_city) COLLATE utf8mb4_unicode_ci AS route_code,
               r.destination_city COLLATE utf8mb4_unicode_ci AS route_name,
               '#10b981' COLLATE utf8mb4_unicode_ci AS route_color,
               u.email AS user_email,
               t.code COLLATE utf8mb4_unicode_ci AS ticket_code,
               t.status COLLATE utf8mb4_unicode_ci AS ticket_status,
               t.used_at,
               c.name AS company_name,
               r.origin_city COLLATE utf8mb4_unicode_ci AS origin,
               r.destination_city COLLATE utf8mb4_unicode_ci AS destination
          FROM intercity_bookings b
          JOIN intercity_trips tr ON tr.id = b.trip_id
          JOIN intercity_routes r ON r.id = tr.route_id
          JOIN intercity_companies c ON c.id = tr.company_id
          JOIN users u ON u.id = b.user_id
          LEFT JOIN intercity_tickets t ON t.booking_id = b.id
         WHERE ${w.join(' AND ')}`,
      args: a
    });
  }

  const unionSql = parts.map((p) => `(${p.sql})`).join(' UNION ALL ');
  const allArgs = parts.flatMap((p) => p.args);

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM (${unionSql}) AS combined`,
    allArgs
  );

  const [rows] = await pool.query(
    `SELECT * FROM (${unionSql}) AS combined
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
    [...allArgs, pageSize, offset]
  );

  return {
    total: Number(total),
    page,
    pageSize,
    rows: rows.map(normalise)
  };
}

function normalise(r) {
  return {
    type: r.type,
    id: r.id,
    reference: r.reference,
    status: r.status,
    amount_rwf: Number(r.amount) || 0,
    created_at: r.created_at,
    passenger_name: r.passenger_name,
    passenger_phone: r.passenger_phone,
    seat_number: r.seat_number,
    trip_departure: r.trip_departure,
    route_code: r.route_code,
    route_name: r.route_name,
    route_color: r.route_color || '#0ea5e9',
    user_email: r.user_email,
    ticket_code: r.ticket_code,
    ticket_status: r.ticket_status,
    used_at: r.used_at,
    company_name: r.company_name,
    origin: r.origin,
    destination: r.destination
  };
}

/* ================================================================== *
 *  Single booking detail                                              *
 * ================================================================== */
export async function getBooking({ type, id }) {
  if (type === 'urban') {
    const [rows] = await pool.query(
      `SELECT b.*,
              r.code AS route_code, r.name_en AS route_name, r.name_rw AS route_name_rw,
              r.color_hex AS route_color,
              u.email AS user_email, u.full_name AS user_name,
              s.name_en  AS from_stop_name,
              s2.name_en AS to_stop_name,
              t.code AS ticket_code, t.status AS ticket_status, t.qr_payload,
              t.issued_at, t.expires_at,
              trd.redeemed_at AS used_at
         FROM bookings b
         JOIN routes r ON r.id = b.route_id
         JOIN users  u ON u.id = b.user_id
         JOIN stops  s ON s.id = b.from_stop_id
         JOIN stops s2 ON s2.id = b.to_stop_id
         LEFT JOIN tickets t ON t.booking_id = b.id
         LEFT JOIN ticket_redemptions trd ON trd.ticket_id = t.id
        WHERE b.id = ?`,
      [id]
    );
    const b = rows[0];
    if (!b) return null;
    return {
      type: 'urban',
      booking: {
        id: b.id,
        reference: b.reference,
        status: b.status,
        amount_rwf: Number(b.amount_rwf),
        created_at: b.created_at,
        depart_at: b.depart_at,
        passenger_name: b.passenger_name,
        passenger_phone: b.passenger_phone,
        seat_number: null
      },
      route: {
        code: b.route_code,
        name_en: b.route_name,
        name_rw: b.route_name_rw,
        color: b.route_color,
        from_stop: b.from_stop_name,
        to_stop: b.to_stop_name
      },
      user: { email: b.user_email, name: b.user_name },
      ticket: b.ticket_code
        ? {
            code: b.ticket_code,
            status: b.ticket_status,
            qr_payload: b.qr_payload,
            issued_at: b.issued_at,
            expires_at: b.expires_at,
            used_at: b.used_at
          }
        : null
    };
  }

  if (type === 'intercity') {
    const [rows] = await pool.query(
      `SELECT b.*,
              t.departure_dt, t.plate_number, t.driver_name,
              t.seats_total, t.seats_booked,
              r.origin_city, r.origin_terminal,
              r.destination_city, r.destination_terminal,
              r.distance_km, r.duration_min, r.province,
              c.name AS company_name, c.phone AS company_phone,
              s.bus_type,
              u.email AS user_email, u.full_name AS user_name,
              tk.code AS ticket_code, tk.status AS ticket_status, tk.qr_payload,
              tk.issued_at, tk.used_at, tk.scanned_plate
         FROM intercity_bookings b
         JOIN intercity_trips t ON t.id = b.trip_id
         JOIN intercity_routes r ON r.id = t.route_id
         JOIN intercity_companies c ON c.id = t.company_id
         JOIN intercity_schedules s ON s.id = t.schedule_id
         JOIN users u ON u.id = b.user_id
         LEFT JOIN intercity_tickets tk ON tk.booking_id = b.id
        WHERE b.id = ?`,
      [id]
    );
    const b = rows[0];
    if (!b) return null;
    return {
      type: 'intercity',
      booking: {
        id: b.id,
        reference: b.reference,
        status: b.status,
        amount_rwf: Number(b.amount_rwf),
        created_at: b.created_at,
        passenger_name: b.passenger_name,
        passenger_phone: b.passenger_phone,
        passenger_email: b.passenger_email,
        passenger_id_no: b.passenger_id_no,
        seat_number: b.seat_number
      },
      trip: {
        departure_dt: b.departure_dt,
        plate_number: b.plate_number,
        driver_name: b.driver_name,
        seats_total: b.seats_total,
        seats_booked: b.seats_booked,
        bus_type: b.bus_type
      },
      route: {
        origin_city: b.origin_city,
        origin_terminal: b.origin_terminal,
        destination_city: b.destination_city,
        destination_terminal: b.destination_terminal,
        distance_km: b.distance_km,
        duration_min: b.duration_min,
        province: b.province
      },
      company: { name: b.company_name, phone: b.company_phone },
      user: { email: b.user_email, name: b.user_name },
      ticket: b.ticket_code
        ? {
            code: b.ticket_code,
            status: b.ticket_status,
            qr_payload: b.qr_payload,
            issued_at: b.issued_at,
            used_at: b.used_at,
            scanned_plate: b.scanned_plate
          }
        : null
    };
  }

  return null;
}