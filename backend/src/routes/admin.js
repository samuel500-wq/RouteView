import { Router } from 'express';
import { stopAnalytics } from '../services/stopAnalytics.js';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { customAlphabet } from 'nanoid';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { config } from '../config.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ah, ApiError } from '../middleware/error.js';
import {
  fullStatus,
  runDiagnostics,
  applyFix,
  getIssueLog,
  resolve
} from '../services/systemStatus.js';
import {
  adminOverview,
  bookingsTrend,
  topRoutes,
  bookingsByHour,
  bookingsByProvince,
  recentActivity,
  fleetSnapshot,
  ruleBasedInsights
} from '../services/adminAnalytics.js';
import { listBookings, getBooking } from '../services/adminBookings.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('operator', 'admin'));

/* ================================================================== *
 *  Dashboard                                                          *
 * ================================================================== */
adminRouter.get('/dashboard', ah(async (_req, res) => {
  const [overview, trend, routes, hours, provinces, activity, fleet] =
    await Promise.all([
      adminOverview(),
      bookingsTrend(),
      topRoutes(),
      bookingsByHour(),
      bookingsByProvince(),
      recentActivity(12),
      fleetSnapshot()
    ]);

  const insights = ruleBasedInsights({ overview, trend, routes, provinces, hours });

  res.json({
    overview,
    trend,
    top_routes: routes,
    bookings_by_hour: hours,
    bookings_by_province: provinces,
    recent_activity: activity,
    fleet,
    insights
  });
}));

/* ================================================================== *
 *  AI insights                                                        *
 * ================================================================== */
adminRouter.get('/ai-insights', ah(async (req, res) => {
  const lang = req.query.lang === 'en' ? 'en' : 'rw';

  const [overview, trend, routes, provinces, hours] = await Promise.all([
    adminOverview(),
    bookingsTrend(),
    topRoutes(),
    bookingsByProvince(),
    bookingsByHour()
  ]);

  const fallback = ruleBasedInsights({ overview, trend, routes, provinces, hours });

  if (!config.ai.key) {
    return res.json({ source: 'rules', insights: fallback });
  }

  const payload = {
    period: 'last 30 days',
    totals: {
      revenue_rwf: overview.revenue_30d,
      revenue_change_pct: overview.revenue_change_pct,
      bookings: overview.bookings_30d,
      bookings_change_pct: overview.bookings_change_pct,
      redemptions: overview.redemptions_30d,
      active_vehicles: overview.active_vehicles,
      total_vehicles: overview.total_vehicles,
      active_alerts: overview.active_alerts,
      total_users: overview.total_users
    },
    top_routes: routes.slice(0, 5).map((r) => ({
      code: r.label,
      type: r.type,
      bookings: r.bookings,
      revenue_rwf: r.revenue
    })),
    provinces: provinces.map((p) => ({ name: p.label, bookings: p.value })),
    peak_hours: hours
      .filter((h) => h.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((h) => ({ hour: `${String(h.hour).padStart(2, '0')}:00`, bookings: h.count }))
  };

  const systemPrompt = lang === 'rw'
    ? `Uri umusesenguzi w'ubwikorezi. Uhabwa imibare y'urubuga rwa RouteView
ku mezi 30 ashize. Andika insighiti 3-5 NGUFI mu Kinyarwanda gusa.

Amabwiriza:
- Buri nsi yigire ku MIBARE gusa. Ntukavuge ibintu utabifitiye.
- Subiza nka JSON: {"insights":[{"tone":"positive"|"info"|"warning","title":"...","body":"..."}]}
- "title" = interuro ngufi cyane (max 8 words).
- "body" = interuro imwe (max 20 words).
- Tone:
  - "positive" ibyo byazamutse cyangwa ni byiza
  - "warning" ibibazo cyangwa ibitazamutse
  - "info" ibindi byose
- Ntukoreshe markdown.`
    : `You are a transport analytics assistant. You receive RouteView
metrics for the last 30 days. Write 3-5 SHORT insights in English only.

Rules:
- Every insight must be grounded in the numbers provided.
- Reply as JSON: {"insights":[{"tone":"positive"|"info"|"warning","title":"...","body":"..."}]}
- "title" = very short headline (max 8 words).
- "body" = one sentence (max 20 words).
- Tone:
  - "positive" for gains or good signals
  - "warning" for issues or declines
  - "info" for neutral observations
- No markdown.`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.ai.timeoutMs);

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
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(payload) }
        ],
        temperature: 0.3
      }),
      signal: ctrl.signal
    });

    if (!r.ok) throw new Error(`openrouter_${r.status}`);
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || '';
    const clean = content.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed.insights) && parsed.insights.length > 0) {
      return res.json({ source: 'ai', insights: parsed.insights.slice(0, 6) });
    }
    throw new Error('empty_insights');
  } catch (e) {
    console.warn('[admin/ai-insights] AI failed, using rules:', e.message);
    return res.json({ source: 'rules', insights: fallback });
  } finally {
    clearTimeout(timer);
  }
}));

/* ================================================================== *
 *  Overview                                                           *
 * ================================================================== */
adminRouter.get('/overview', ah(async (_req, res) => {
  const data = await adminOverview();
  res.json({
    vehicles: data.total_vehicles,
    active_positions: data.active_vehicles,
    bookings_today: data.bookings_30d,
    tickets_redeemed_today: data.redemptions_30d,
    active_alerts: data.active_alerts,
    note: 'Urban + intercity metrics over the last 30 days.'
  });
}));

/* ================================================================== *
 *  Bookings — combined urban + intercity, filterable, paginated       *
 * ================================================================== */
adminRouter.get('/bookings', ah(async (req, res) => {
  const out = await listBookings({
    page: req.query.page,
    pageSize: req.query.pageSize,
    status: req.query.status ? String(req.query.status) : null,
    type: req.query.type ? String(req.query.type) : 'all',
    q: req.query.q ? String(req.query.q) : null,
    date_from: req.query.date_from ? String(req.query.date_from) : null,
    date_to: req.query.date_to ? String(req.query.date_to) : null
  });
  res.json(out);
}));

adminRouter.get('/bookings/:type/:id', ah(async (req, res) => {
  const { type, id } = req.params;
  if (type !== 'urban' && type !== 'intercity') {
    throw new ApiError(400, 'invalid_type');
  }
  const detail = await getBooking({ type, id: Number(id) });
  if (!detail) throw new ApiError(404, 'booking_not_found');
  res.json(detail);
}));

/* ================================================================== *
 *  Stops                                                              *
 * ================================================================== */
const stopSchema = z.object({
  code:    z.string().min(2).max(30),
  name_rw: z.string().min(2).max(160),
  name_en: z.string().min(2).max(160),
  lat:     z.number().gte(-90).lte(90),
  lng:     z.number().gte(-180).lte(180),
  is_active: z.boolean().default(true)
});

adminRouter.post('/stops', ah(async (req, res) => {
  const b = stopSchema.parse(req.body);
  const [r] = await pool.execute(
    `INSERT INTO stops (code, name_rw, name_en, lat, lng, is_active)
     VALUES (?,?,?,?,?,?)`,
    [b.code, b.name_rw, b.name_en, b.lat, b.lng, b.is_active ? 1 : 0]
  );
  res.status(201).json({ id: r.insertId });
}));

adminRouter.put('/stops/:id', ah(async (req, res) => {
  const b = stopSchema.partial().parse(req.body);
  const fields = [], args = [];
  for (const k of Object.keys(b)) {
    fields.push(`${k}=?`);
    args.push(k === 'is_active' ? (b[k] ? 1 : 0) : b[k]);
  }
  if (!fields.length) throw new ApiError(400, 'empty');
  args.push(Number(req.params.id));
  await pool.execute(`UPDATE stops SET ${fields.join(',')} WHERE id=?`, args);
  res.json({ ok: true });
}));

adminRouter.delete('/stops/:id', requireRole('admin'), ah(async (req, res) => {
  await pool.execute('DELETE FROM stops WHERE id=?', [Number(req.params.id)]);
  res.json({ ok: true });
}));

/* ------------------------------------------------------------------ *
 *  Stop analytics — insights for the admin stops page                 *
 * ------------------------------------------------------------------ */
adminRouter.get('/stops/analytics', ah(async (_req, res) => {
  const data = await stopAnalytics();
  res.json(data);
}));

/* ================================================================== *
 *  Routes                                                             *
 * ================================================================== */
const routeSchema = z.object({
  code:            z.string().min(1).max(20),
  name_rw:         z.string().min(2).max(160),
  name_en:         z.string().min(2).max(160),
  direction_label: z.string().min(2).max(160),
  color_hex:       z.string().regex(/^#[0-9a-fA-F]{6}$/),
  is_active:       z.boolean().default(true)
});

adminRouter.get('/routes', ah(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT r.*,
            (SELECT COUNT(*) FROM route_stops WHERE route_id = r.id) AS stop_count
       FROM routes r
      ORDER BY code`
  );
  res.json({ routes: rows });
}));

adminRouter.post('/routes', ah(async (req, res) => {
  const b = routeSchema.parse(req.body);
  const [r] = await pool.execute(
    `INSERT INTO routes (code, name_rw, name_en, direction_label, color_hex, is_active)
     VALUES (?,?,?,?,?,?)`,
    [b.code, b.name_rw, b.name_en, b.direction_label, b.color_hex, b.is_active ? 1 : 0]
  );
  res.status(201).json({ id: r.insertId });
}));

adminRouter.put('/routes/:id', ah(async (req, res) => {
  const b = routeSchema.partial().parse(req.body);
  const fields = [], args = [];
  for (const k of Object.keys(b)) {
    fields.push(`${k}=?`);
    args.push(k === 'is_active' ? (b[k] ? 1 : 0) : b[k]);
  }
  if (!fields.length) throw new ApiError(400, 'empty');
  args.push(Number(req.params.id));
  await pool.execute(`UPDATE routes SET ${fields.join(',')} WHERE id=?`, args);
  res.json({ ok: true });
}));

adminRouter.delete('/routes/:id', requireRole('admin'), ah(async (req, res) => {
  await pool.execute('DELETE FROM routes WHERE id=?', [Number(req.params.id)]);
  res.json({ ok: true });
}));

/* ================================================================== *
 *  Vehicles                                                           *
 * ================================================================== */
const vehicleSchema = z.object({
  plate:    z.string().min(2).max(30),
  label:    z.string().min(1).max(80),
  capacity: z.coerce.number().int().positive().max(200).default(30),
  status:   z.enum(['active', 'idle', 'maintenance', 'offline']).default('idle')
});

adminRouter.get('/vehicles', ah(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT v.*,
            (SELECT MAX(recorded_at) FROM vehicle_positions WHERE vehicle_id = v.id) AS last_seen
       FROM vehicles v
      ORDER BY plate`
  );
  res.json({ vehicles: rows });
}));

adminRouter.post('/vehicles', ah(async (req, res) => {
  const b = vehicleSchema.parse(req.body);
  const [r] = await pool.execute(
    'INSERT INTO vehicles (plate, label, capacity, status) VALUES (?,?,?,?)',
    [b.plate, b.label, b.capacity, b.status]
  );
  res.status(201).json({ id: r.insertId });
}));

adminRouter.put('/vehicles/:id', ah(async (req, res) => {
  const b = vehicleSchema.partial().parse(req.body);
  const fields = [], args = [];
  for (const k of Object.keys(b)) { fields.push(`${k}=?`); args.push(b[k]); }
  if (!fields.length) throw new ApiError(400, 'empty');
  args.push(Number(req.params.id));
  await pool.execute(`UPDATE vehicles SET ${fields.join(',')} WHERE id=?`, args);
  res.json({ ok: true });
}));

adminRouter.delete('/vehicles/:id', requireRole('admin'), ah(async (req, res) => {
  await pool.execute('DELETE FROM vehicles WHERE id=?', [Number(req.params.id)]);
  res.json({ ok: true });
}));

/* ================================================================== *
 *  Alerts                                                             *
 * ================================================================== */
const alertSchema = z.object({
  route_id:  z.number().int().positive().nullable().optional(),
  severity:  z.enum(['info', 'warning', 'critical']).default('info'),
  title_rw:  z.string().min(2).max(180),
  title_en:  z.string().min(2).max(180),
  body_rw:   z.string().min(2),
  body_en:   z.string().min(2),
  starts_at: z.string().optional(),
  ends_at:   z.string().nullable().optional(),
  is_active: z.boolean().default(true)
});

adminRouter.get('/alerts', ah(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT a.*, r.code AS route_code
       FROM service_alerts a
       LEFT JOIN routes r ON r.id = a.route_id
      ORDER BY a.starts_at DESC`
  );
  res.json({ alerts: rows });
}));

adminRouter.post('/alerts', ah(async (req, res) => {
  const b = alertSchema.parse(req.body);
  const [r] = await pool.execute(
    `INSERT INTO service_alerts
       (route_id, severity, title_rw, title_en, body_rw, body_en,
        starts_at, ends_at, is_active, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      b.route_id ?? null, b.severity, b.title_rw, b.title_en, b.body_rw, b.body_en,
      b.starts_at ? new Date(b.starts_at) : new Date(),
      b.ends_at   ? new Date(b.ends_at)   : null,
      b.is_active ? 1 : 0, req.user.id
    ]
  );
  res.status(201).json({ id: r.insertId });
}));

adminRouter.put('/alerts/:id', ah(async (req, res) => {
  const b = alertSchema.partial().parse(req.body);
  const fields = [], args = [];
  for (const k of Object.keys(b)) {
    if (k === 'is_active') {
      fields.push(`${k}=?`); args.push(b[k] ? 1 : 0);
    } else if (k === 'starts_at' || k === 'ends_at') {
      fields.push(`${k}=?`); args.push(b[k] ? new Date(b[k]) : null);
    } else {
      fields.push(`${k}=?`); args.push(b[k]);
    }
  }
  if (!fields.length) throw new ApiError(400, 'empty');
  args.push(Number(req.params.id));
  await pool.execute(`UPDATE service_alerts SET ${fields.join(',')} WHERE id=?`, args);
  res.json({ ok: true });
}));

adminRouter.delete('/alerts/:id', requireRole('admin'), ah(async (req, res) => {
  await pool.execute('DELETE FROM service_alerts WHERE id=?', [Number(req.params.id)]);
  res.json({ ok: true });
}));

/* ================================================================== *
 *  Users                                                              *
 * ================================================================== */
adminRouter.get('/users', requireRole('admin'), ah(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT id, email, full_name, phone, role, is_active, created_at
       FROM users
      ORDER BY created_at DESC
      LIMIT 500`
  );
  res.json({ users: rows });
}));

/* ------------------------------------------------------------------ *
 *  Update a user — role and/or active status                          *
 *  Only an admin can call this.                                       *
 * ------------------------------------------------------------------ */
const userUpdateSchema = z.object({
  role: z.enum(['passenger', 'operator', 'admin']).optional(),
  is_active: z.boolean().optional(),
  full_name: z.string().min(2).max(120).optional(),
  phone: z.string().max(30).nullable().optional()
});

adminRouter.put('/users/:id', requireRole('admin'), ah(async (req, res) => {
  const targetId = Number(req.params.id);
  if (!targetId) throw new ApiError(400, 'invalid_id');

  // Cannot demote or deactivate yourself
  if (targetId === req.user.id) {
    const patch = userUpdateSchema.parse(req.body);
    if (patch.role && patch.role !== 'admin') {
      throw new ApiError(409, 'cannot_change_own_role');
    }
    if (patch.is_active === false) {
      throw new ApiError(409, 'cannot_deactivate_self');
    }
  }

  const b = userUpdateSchema.parse(req.body);
  const fields = [], args = [];
  for (const k of Object.keys(b)) {
    if (k === 'is_active') {
      fields.push('is_active = ?');
      args.push(b[k] ? 1 : 0);
    } else if (k === 'phone') {
      fields.push('phone = ?');
      args.push(b[k] || null);
    } else {
      fields.push(`${k} = ?`);
      args.push(b[k]);
    }
  }
  if (!fields.length) throw new ApiError(400, 'empty');

  args.push(targetId);
  const [result] = await pool.execute(
    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
    args
  );
  if (result.affectedRows === 0) throw new ApiError(404, 'user_not_found');
  res.json({ ok: true });
}));

/* ================================================================== *
 *  Press resources                                                    *
 * ================================================================== */
adminRouter.get('/press', ah(async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM press_resources ORDER BY created_at DESC'
  );
  res.json({ resources: rows });
}));

const uploadsDir = path.resolve('uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/svg+xml', 'image/webp',
  'application/pdf', 'application/zip',
  'video/mp4',
  'text/plain', 'text/csv'
]);

const storage = multer.diskStorage({
  destination: (_r, _f, cb) => cb(null, uploadsDir),
  filename: (_r, file, cb) => {
    const safe = path.basename(file.originalname)
      .replace(/[^\w.\-]+/g, '_')
      .slice(0, 80);
    cb(null, `${customAlphabet('0123456789abcdef', 12)()}_${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_r, file, cb) =>
    ALLOWED_MIME.has(file.mimetype) ? cb(null, true) : cb(new Error('unsupported_mime'))
});

const pressSchema = z.object({
  title:        z.string().min(2).max(200),
  category:     z.enum(['logo','press_release','factsheet','image','video','document','mediakit']),
  description:  z.string().max(2000).optional(),
  external_url: z.string().url().max(500).optional(),
  is_published: z.coerce.boolean().default(false)
});

adminRouter.post('/press', upload.single('file'), ah(async (req, res) => {
  const b = pressSchema.parse(req.body);
  const slug =
    b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 100) +
    '-' + customAlphabet('0123456789abcdef', 4)();

  const filePath = req.file ? req.file.filename : null;
  const size     = req.file ? req.file.size     : null;
  const mime     = req.file ? req.file.mimetype : null;

  const [r] = await pool.execute(
    `INSERT INTO press_resources
       (slug, title, category, description, file_path, external_url,
        file_size_bytes, mime_type, is_published, published_at, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      slug, b.title, b.category, b.description || null, filePath,
      b.external_url || null, size, mime,
      b.is_published ? 1 : 0,
      b.is_published ? new Date() : null,
      req.user.id
    ]
  );
  res.status(201).json({ id: r.insertId, slug });
}));

adminRouter.put('/press/:id/publish', ah(async (req, res) => {
  const pub = z.object({ is_published: z.boolean() }).parse(req.body).is_published;
  await pool.execute(
    `UPDATE press_resources SET is_published=?, published_at=? WHERE id=?`,
    [pub ? 1 : 0, pub ? new Date() : null, Number(req.params.id)]
  );
  res.json({ ok: true });
}));

adminRouter.delete('/press/:id', requireRole('admin'), ah(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT file_path FROM press_resources WHERE id=?',
    [Number(req.params.id)]
  );
  const fp = rows[0]?.file_path;
  await pool.execute('DELETE FROM press_resources WHERE id=?', [Number(req.params.id)]);
  if (fp) {
    try { fs.unlinkSync(path.resolve(uploadsDir, fp)); } catch { /* ignore */ }
  }
  res.json({ ok: true });
}));

/* ================================================================== *
 *  Reports                                                            *
 * ================================================================== */
adminRouter.get('/reports/summary', ah(async (_req, res) => {
  const [daily] = await pool.query(
    `SELECT DATE(created_at) AS d,
            COUNT(*) AS bookings,
            SUM(amount_rwf) AS revenue_rwf
       FROM bookings
      WHERE status IN ('paid') AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY d`
  );
  const [routes] = await pool.query(
    `SELECT r.code, COUNT(b.id) AS bookings
       FROM routes r
       LEFT JOIN bookings b ON b.route_id = r.id AND b.status IN ('paid')
      GROUP BY r.id
      ORDER BY bookings DESC`
  );
  const [redemptions] = await pool.query(
    `SELECT DATE(redeemed_at) AS d, COUNT(*) AS c
       FROM ticket_redemptions
      WHERE redeemed_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(redeemed_at)
      ORDER BY d`
  );
  res.json({
    daily_bookings: daily,
    bookings_per_route: routes,
    daily_redemptions: redemptions
  });
}));

/* ================================================================== *
 *  System status                                                      *
 * ================================================================== */
adminRouter.get('/status', ah(async (_req, res) => {
  let db = 'ok';
  try { await pool.query('SELECT 1'); } catch { db = 'error'; }

  let ml = 'unknown';
  try {
    const r = await fetch(`${config.ml.url}/health`);
    const j = await r.json();
    ml = j.ok ? 'ok' : 'degraded';
  } catch { ml = 'down'; }

  const [[veh]] = await pool.query(
    `SELECT COUNT(DISTINCT vehicle_id) AS c FROM vehicle_positions
      WHERE recorded_at > DATE_SUB(NOW(), INTERVAL 3 MINUTE)`
  );
  const [[sim]] = await pool.query(
    `SELECT COUNT(*) AS c FROM vehicle_positions
      WHERE source='simulator' AND recorded_at > DATE_SUB(NOW(), INTERVAL 3 MINUTE)`
  );

  res.json({
    db,
    ml,
    ai_configured: !!config.ai.key,
    openrouter_model: config.ai.model,
    active_vehicles_last_3min: veh.c,
    simulated_vehicles_last_3min: sim.c,
    uptime_seconds: Math.round(process.uptime())
  });
  /* ------------------------------------------------------------------ *
 *  Extended system status (dashboard-ready)                           *
 * ------------------------------------------------------------------ */
adminRouter.get('/system/status', ah(async (_req, res) => {
  res.json(await fullStatus());
}));

/* ------------------------------------------------------------------ *
 *  Error log                                                          *
 * ------------------------------------------------------------------ */
adminRouter.get('/system/issues', ah(async (req, res) => {
  const filter = {
    level: req.query.level ? String(req.query.level) : null,
    source: req.query.source ? String(req.query.source) : null,
    only_unresolved: req.query.only_unresolved === 'true',
    limit: Math.min(200, Math.max(1, Number(req.query.limit) || 100))
  };
  res.json({ issues: getIssueLog(filter) });
}));

adminRouter.put('/system/issues/:id/resolve', ah(async (req, res) => {
  const out = await resolve(req.params.id, { fix: 'manual' });
  if (!out) throw new ApiError(404, 'issue_not_found');
  res.json({ ok: true, issue: out });
}));

/* ------------------------------------------------------------------ *
 *  Diagnostics + fixes                                                *
 * ------------------------------------------------------------------ */
adminRouter.get('/system/diagnostics', ah(async (_req, res) => {
  res.json(await runDiagnostics());
}));

adminRouter.post('/system/fix', ah(async (req, res) => {
  const body = z.object({
    kind: z.string().min(2).max(60),
    params: z.any().optional()
  }).parse(req.body);
  const out = await applyFix(body.kind, body.params || {});
  res.json(out);
}));
}));