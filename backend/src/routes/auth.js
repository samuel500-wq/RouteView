import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { sign } from '../middleware/auth.js';
import { ah, ApiError } from '../middleware/error.js';
import { authLimiter } from '../middleware/rateLimit.js';

export const authRouter = Router();

/* ================================================================== *
 *  Passenger self-service register                                    *
 * ================================================================== */
const creds = z.object({
  email: z.string().email().max(190),
  password: z.string().min(6).max(120)
});

authRouter.post('/register', authLimiter, ah(async (req, res) => {
  const body = creds.extend({
    full_name: z.string().min(2).max(120),
    phone: z.string().max(30).optional(),
    preferred_lang: z.enum(['rw', 'en']).default('rw')
  }).parse(req.body);

  const [exists] = await pool.query('SELECT id FROM users WHERE email=?', [body.email]);
  if (exists.length) throw new ApiError(409, 'email_taken');

  const hash = await bcrypt.hash(body.password, 10);
  const [r] = await pool.execute(
    `INSERT INTO users (email, password_hash, full_name, phone, role, preferred_lang)
     VALUES (?,?,?,?, 'passenger', ?)`,
    [body.email, hash, body.full_name, body.phone || null, body.preferred_lang]
  );
  const token = sign({ id: r.insertId, email: body.email, role: 'passenger' });
  res.json({
    token,
    user: {
      id: r.insertId,
      email: body.email,
      role: 'passenger',
      full_name: body.full_name,
      preferred_lang: body.preferred_lang
    }
  });
}));

/* ================================================================== *
 *  Admin / operator registration (invite code protected)              *
 * ================================================================== */
const ADMIN_INVITE_CODE = process.env.ADMIN_INVITE_CODE || 'ROUTEVIEW2024';

const adminRegisterSchema = creds.extend({
  full_name: z.string().min(2).max(120),
  phone: z.string().max(30).optional(),
  role: z.enum(['operator', 'admin']).default('operator'),
  invite_code: z.string().min(4).max(60)
});

authRouter.post('/register-staff', authLimiter, ah(async (req, res) => {
  const body = adminRegisterSchema.parse(req.body);

  if (body.invite_code !== ADMIN_INVITE_CODE) {
    throw new ApiError(403, 'invalid_invite_code');
  }

  const [exists] = await pool.query('SELECT id FROM users WHERE email=?', [body.email]);
  if (exists.length) throw new ApiError(409, 'email_taken');

  const hash = await bcrypt.hash(body.password, 10);
  const [r] = await pool.execute(
    `INSERT INTO users (email, password_hash, full_name, phone, role, preferred_lang)
     VALUES (?,?,?,?,?, 'en')`,
    [body.email, hash, body.full_name, body.phone || null, body.role]
  );
  const token = sign({ id: r.insertId, email: body.email, role: body.role });
  res.json({
    token,
    user: {
      id: r.insertId,
      email: body.email,
      role: body.role,
      full_name: body.full_name
    }
  });
}));

/* ================================================================== *
 *  Login (works for any role)                                         *
 * ================================================================== */
authRouter.post('/login', authLimiter, ah(async (req, res) => {
  const body = creds.parse(req.body);
  const [rows] = await pool.query(
    'SELECT id, email, password_hash, role, full_name, preferred_lang FROM users WHERE email=? AND is_active=1',
    [body.email]
  );
  const u = rows[0];
  if (!u) throw new ApiError(401, 'invalid_credentials');
  const ok = await bcrypt.compare(body.password, u.password_hash);
  if (!ok) throw new ApiError(401, 'invalid_credentials');
  const token = sign({ id: u.id, email: u.email, role: u.role });
  res.json({
    token,
    user: {
      id: u.id,
      email: u.email,
      role: u.role,
      full_name: u.full_name,
      preferred_lang: u.preferred_lang
    }
  });
}));

/* ================================================================== *
 *  Who am I (used by the admin console to confirm role)               *
 * ================================================================== */
authRouter.get('/me', ah(async (req, res) => {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'auth_required' });

  const { verify } = await import('../middleware/auth.js');
  let payload;
  try { payload = verify(token); }
  catch { return res.status(401).json({ error: 'invalid_token' }); }

  const [rows] = await pool.query(
    'SELECT id, email, role, full_name, preferred_lang FROM users WHERE id=? AND is_active=1',
    [payload.id]
  );
  if (!rows[0]) return res.status(401).json({ error: 'user_not_found' });
  res.json({ user: rows[0] });
}));