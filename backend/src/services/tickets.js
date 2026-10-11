import { customAlphabet } from 'nanoid';
import QRCode from 'qrcode';
import { pool, tx } from '../db/pool.js';
import { ApiError } from '../middleware/error.js';

const ref = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);
const code = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 24);

export async function createBooking({ userId, routeId, fromStopId, toStopId, departAt, passengerName, passengerPhone, amountRwf }) {
  return tx(async (conn) => {
    const reference = ref();
    const [r] = await conn.execute(
      `INSERT INTO bookings
        (reference,user_id,route_id,from_stop_id,to_stop_id,depart_at,
         passenger_name,passenger_phone,amount_rwf,status)
       VALUES (?,?,?,?,?,?,?,?,?, 'pending')`,
      [reference, userId, routeId, fromStopId, toStopId, departAt, passengerName, passengerPhone || null, amountRwf]
    );
    const bookingId = r.insertId;
    return { id: bookingId, reference, amount_rwf: amountRwf, status: 'pending' };
  });
}

export async function confirmDemoPayment({ bookingId, userId }) {
  return tx(async (conn) => {
    const [rows] = await conn.execute('SELECT * FROM bookings WHERE id=? FOR UPDATE', [bookingId]);
    const b = rows[0];
    if (!b || b.user_id !== userId) throw new ApiError(404, 'booking_not_found');
    if (b.status === 'paid') return { status: 'paid', ticket: await loadTicket(conn, bookingId) };
    if (b.status !== 'pending') throw new ApiError(409, 'booking_not_pending');

    await conn.execute(
      "UPDATE bookings SET status='paid', payment_ref=? WHERE id=?",
      [`demo-${Date.now()}`, bookingId]
    );

    const ticketCode = code();
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const qrPayload = `routeview://ticket/${ticketCode}`;
    await conn.execute(
      `INSERT INTO tickets (booking_id, code, qr_payload, expires_at, status)
       VALUES (?,?,?,?, 'issued')`,
      [bookingId, ticketCode, qrPayload, expiresAt]
    );
    return { status: 'paid', ticket: await loadTicket(conn, bookingId) };
  });
}

async function loadTicket(conn, bookingId) {
  const [rows] = await conn.execute(
    `SELECT t.id, t.code, t.qr_payload, t.status, t.issued_at, t.expires_at,
            b.reference, b.amount_rwf, b.depart_at,
            r.code AS route_code, r.name_rw, r.name_en
       FROM tickets t JOIN bookings b ON b.id = t.booking_id
       JOIN routes r ON r.id = b.route_id
      WHERE t.booking_id = ?`,
    [bookingId]
  );
  const t = rows[0];
  if (!t) return null;
  const qrDataUrl = await QRCode.toDataURL(t.qr_payload, { margin: 1, width: 320 });
  return { ...t, qr_data_url: qrDataUrl };
}

export async function listUserBookings(userId) {
  const [rows] = await pool.query(
    `SELECT b.*, t.code AS ticket_code, t.status AS ticket_status
       FROM bookings b LEFT JOIN tickets t ON t.booking_id = b.id
      WHERE b.user_id = ? ORDER BY b.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function getTicketWithQr(bookingId, userId) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT b.user_id FROM bookings b WHERE b.id=?`, [bookingId]
    );
    if (!rows[0] || rows[0].user_id !== userId) throw new ApiError(404, 'booking_not_found');
    return loadTicket(conn, bookingId);
  } finally {
    conn.release();
  }
}

export async function redeemTicket({ codeOrPayload, operatorUserId }) {
  const ticketCode = codeOrPayload.startsWith('routeview://ticket/')
    ? codeOrPayload.replace('routeview://ticket/', '')
    : codeOrPayload;

  return tx(async (conn) => {
    const [rows] = await conn.execute(
      `SELECT t.*, b.status AS booking_status, b.id AS booking_id
         FROM tickets t JOIN bookings b ON b.id=t.booking_id
        WHERE t.code = ? FOR UPDATE`,
      [ticketCode]
    );
    const t = rows[0];
    if (!t) throw new ApiError(404, 'ticket_not_found');
    if (t.booking_status === 'cancelled') throw new ApiError(409, 'booking_cancelled');
    if (t.status === 'redeemed')         throw new ApiError(409, 'already_redeemed');
    if (t.status === 'cancelled')        throw new ApiError(409, 'ticket_cancelled');
    if (new Date(t.expires_at).getTime() < Date.now()) {
      await conn.execute("UPDATE tickets SET status='expired' WHERE id=?", [t.id]);
      throw new ApiError(409, 'ticket_expired');
    }

    // UNIQUE constraint on ticket_id guarantees no double redemption under race
    await conn.execute(
      'INSERT INTO ticket_redemptions (ticket_id, redeemed_by) VALUES (?,?)',
      [t.id, operatorUserId]
    );
    await conn.execute("UPDATE tickets SET status='redeemed' WHERE id=?", [t.id]);
    return { ok: true, ticket_id: t.id, code: t.code, redeemed_at: new Date() };
  });
}