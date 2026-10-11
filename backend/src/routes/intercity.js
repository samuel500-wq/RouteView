import { Router } from 'express';
import { z } from 'zod';
import { ah, ApiError } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  searchTrips,
  listDestinations,
  listOriginCities,
  listProvinces,
  createBooking,
  payDemo,
  listUserBookings,
  getTicket,
  redeemTicket
} from '../services/intercity.js';

export const intercityRouter = Router();

/* -------- Public: origins/destinations -------- */
intercityRouter.get('/destinations', ah(async (req, res) => {
  const from = req.query.from ? String(req.query.from) : null;
  res.json({
    origins: await listOriginCities(),
    destinations: await listDestinations(from),
    provinces: await listProvinces()
  });
}));

/* -------- Public: search -------- */
const searchSchema = z.object({
  from: z.string().min(2).max(80).default('Kigali'),
  to: z.string().min(2).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

intercityRouter.get('/search', ah(async (req, res) => {
  const q = searchSchema.parse(req.query);
  res.json({ trips: await searchTrips(q) });
}));

/* -------- Auth: bookings -------- */
const bookingSchema = z.object({
  tripId: z.number().int().positive(),
  passengerName: z.string().min(2).max(120),
  passengerPhone: z.string().max(30).optional(),
  passengerEmail: z.string().email().max(190).optional(),
  passengerIdNo: z.string().max(30).optional()
});

intercityRouter.post('/bookings', requireAuth, ah(async (req, res) => {
  const b = bookingSchema.parse(req.body);
  const booking = await createBooking({ userId: req.user.id, ...b });
  res.status(201).json({ booking });
}));

intercityRouter.post('/bookings/:id/pay-demo', requireAuth, ah(async (req, res) => {
  const out = await payDemo({
    bookingId: Number(req.params.id),
    userId: req.user.id
  });
  res.json(out);
}));

intercityRouter.get('/bookings', requireAuth, ah(async (req, res) => {
  res.json({ bookings: await listUserBookings(req.user.id) });
}));

intercityRouter.get('/bookings/:id/ticket', requireAuth, ah(async (req, res) => {
  const t = await getTicket(Number(req.params.id), req.user.id);
  if (!t) throw new ApiError(404, 'ticket_not_found');
  res.json({ ticket: t });
}));

/* -------- Operator/admin: redeem -------- */
const redeemSchema = z.object({
  code: z.string().min(6).max(255),
  plateNumber: z.string().max(30).optional()
});

intercityRouter.post('/redeem',
  requireAuth, requireRole('operator', 'admin'),
  ah(async (req, res) => {
    const b = redeemSchema.parse(req.body);
    try {
      const out = await redeemTicket({
        codeOrPayload: b.code,
        operatorUserId: req.user.id,
        plateNumber: b.plateNumber
      });
      res.json(out);
    } catch (e) {
      if (e instanceof ApiError) return res.status(e.status).json({ error: e.code });
      throw e;
    }
  })
);