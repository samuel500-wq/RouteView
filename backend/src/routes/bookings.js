import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ah, ApiError } from '../middleware/error.js';
import {
  createBooking, confirmDemoPayment, listUserBookings,
  getTicketWithQr, redeemTicket
} from '../services/tickets.js';

export const bookingsRouter = Router();

const createSchema = z.object({
  routeId: z.number().int().positive(),
  fromStopId: z.number().int().positive(),
  toStopId: z.number().int().positive(),
  departAt: z.string().datetime(),
  passengerName: z.string().min(2).max(120),
  passengerPhone: z.string().max(30).optional(),
  amountRwf: z.number().int().positive().max(100_000)
});

bookingsRouter.use(requireAuth);

bookingsRouter.post('/', ah(async (req, res) => {
  const b = createSchema.parse(req.body);
  const booking = await createBooking({ userId: req.user.id, ...b });
  res.status(201).json({ booking });
}));

bookingsRouter.post('/:id/pay-demo', ah(async (req, res) => {
  const result = await confirmDemoPayment({
    bookingId: Number(req.params.id), userId: req.user.id
  });
  res.json(result);
}));

bookingsRouter.get('/', ah(async (req, res) => {
  res.json({ bookings: await listUserBookings(req.user.id) });
}));

bookingsRouter.get('/:id/ticket', ah(async (req, res) => {
  const t = await getTicketWithQr(Number(req.params.id), req.user.id);
  if (!t) throw new ApiError(404, 'ticket_not_found');
  res.json({ ticket: t });
}));

/** Operator-only: validate / redeem ticket */
export const ticketsRouter = Router();
ticketsRouter.post('/redeem',
  requireAuth, requireRole('operator', 'admin'),
  ah(async (req, res) => {
    const { code } = z.object({ code: z.string().min(6).max(255) }).parse(req.body);
    try {
      const out = await redeemTicket({ codeOrPayload: code, operatorUserId: req.user.id });
      res.json(out);
    } catch (e) {
      if (e instanceof ApiError) return res.status(e.status).json({ error: e.code });
      throw e;
    }
  })
);