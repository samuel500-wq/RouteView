const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('rv_token');
}
export function setToken(t: string | null) {
  if (typeof window === 'undefined') return;
  if (t) window.localStorage.setItem('rv_token', t);
  else window.localStorage.removeItem('rv_token');
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...((init.headers as Record<string, string>) || {})
  };
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...init, headers, cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

async function upload<T>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Health
  health: () => req<{ ok: boolean; db: string; ai_configured: boolean }>('/health'),

  // Transport (urban)
  listRoutes: (q = '') => req<{ routes: any[] }>(`/api/routes?q=${encodeURIComponent(q)}`),
  getRoute: (id: number) => req<any>(`/api/routes/${id}`),
  routeAnalytics: (id: number) => req<any>(`/api/routes/${id}/analytics`),
  listStops: (q = '') => req<{ stops: any[] }>(`/api/stops?q=${encodeURIComponent(q)}`),
  getStop: (id: number) => req<any>(`/api/stops/${id}`),
  nearestStops: (lat: number, lng: number, limit = 5) =>
    req<{ stops: any[] }>(`/api/stops/near?lat=${lat}&lng=${lng}&limit=${limit}`),
  plan: (fromStopId: number, toStopId: number) =>
    req<{ options: any[] }>('/api/journeys/plan', {
      method: 'POST', body: JSON.stringify({ fromStopId, toStopId })
    }),

  // Vehicles / live tracking
  vehicles: () => req<{ vehicles: any[] }>('/api/vehicles'),
  arrival: (vehicleId: number, stopId: number) =>
    req<any>(`/api/vehicles/${vehicleId}/arrival?stop_id=${stopId}`),
  simulatorStatus: () => req<any>('/api/simulator/status'),

  alerts: () => req<{ alerts: any[] }>('/api/alerts'),

  // Auth
  login: (email: string, password: string) =>
    req<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password })
    }),
  register: (payload: any) =>
    req<{ token: string; user: any }>('/api/auth/register', {
      method: 'POST', body: JSON.stringify(payload)
    }),

    registerStaff: (payload: {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: 'operator' | 'admin';
  invite_code: string;
}) =>
  req<{ token: string; user: any }>('/api/auth/register-staff', {
    method: 'POST', body: JSON.stringify(payload)
  }),
me: () => req<{ user: any }>('/api/auth/me'),

adminUpdateUser: (id: number, patch: {
  role?: 'passenger' | 'operator' | 'admin';
  is_active?: boolean;
  full_name?: string;
  phone?: string | null;
}) => req<{ ok: true }>(`/api/admin/users/${id}`, {
  method: 'PUT',
  body: JSON.stringify(patch)
}),



  // Urban bookings & tickets
  createBooking: (payload: any) =>
    req<{ booking: any }>('/api/bookings', { method: 'POST', body: JSON.stringify(payload) }),
  payDemo: (id: number) => req<any>(`/api/bookings/${id}/pay-demo`, { method: 'POST' }),
  myBookings: () => req<{ bookings: any[] }>('/api/bookings'),
  myTicket: (id: number) => req<{ ticket: any }>(`/api/bookings/${id}/ticket`),

  redeemTicket: (code: string) =>
    req<any>('/api/tickets/redeem', { method: 'POST', body: JSON.stringify({ code }) }),

  // AI
  aiStatus: () => req<{ configured: boolean }>('/api/ai/status'),
  aiChat: (payload: { sessionKey?: string; message: string; lang: 'rw' | 'en'; history: any[] }) =>
    req<any>('/api/ai/chat', { method: 'POST', body: JSON.stringify(payload) }),
  aiPlan: (payload: { query: string; lang: 'rw' | 'en' }) =>
    req<any>('/api/ai/plan', { method: 'POST', body: JSON.stringify(payload) }),

  // Places (AI-assisted)
  placesCategories: () => req<{ categories: any[] }>('/api/places/categories'),
  placesChat: (payload: {
    message: string;
    lang: 'rw' | 'en';
    history: { role: 'user' | 'assistant'; content: string }[];
    userLocation: { lat: number; lng: number } | null;
  }) => req<any>('/api/places/chat', { method: 'POST', body: JSON.stringify(payload) }),

  // Intercity
  intercityDestinations: (from?: string) =>
    req<{ origins: any[]; destinations: any[]; provinces: any[] }>(
      `/api/intercity/destinations${from ? `?from=${encodeURIComponent(from)}` : ''}`
    ),
  intercitySearch: (to: string, date?: string, from = 'Kigali') =>
    req<{ trips: any[] }>(
      `/api/intercity/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${date ? `&date=${date}` : ''}`
    ),
  intercityCreateBooking: (payload: any) =>
    req<{ booking: any }>('/api/intercity/bookings', { method: 'POST', body: JSON.stringify(payload) }),
  intercityPayDemo: (id: number) =>
    req<any>(`/api/intercity/bookings/${id}/pay-demo`, { method: 'POST' }),
  intercityMyBookings: () =>
    req<{ bookings: any[] }>('/api/intercity/bookings'),
  intercityTicket: (id: number) =>
    req<{ ticket: any }>(`/api/intercity/bookings/${id}/ticket`),
  intercityRedeem: (code: string, plateNumber?: string) =>
    req<any>('/api/intercity/redeem', {
      method: 'POST', body: JSON.stringify({ code, plateNumber })
    }),

  // Admin
  adminOverview: () => req<any>('/api/admin/overview'),
  adminReports: () => req<any>('/api/admin/reports/summary'),
  adminStatus: () => req<any>('/api/admin/status'),

  adminSystemStatus: () => req<any>('/api/admin/system/status'),
adminSystemIssues: (params: { level?: string; source?: string; only_unresolved?: boolean; limit?: number } = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  return req<{ issues: any[] }>(`/api/admin/system/issues?${qs.toString()}`);
},
adminResolveIssue: (id: string) =>
  req<{ ok: boolean; issue: any }>(`/api/admin/system/issues/${id}/resolve`, { method: 'PUT' }),
adminDiagnostics: () => req<any>('/api/admin/system/diagnostics'),
adminApplyFix: (kind: string, params?: any) =>
  req<{ ok: boolean; note: string; error?: string; data?: any }>('/api/admin/system/fix', {
    method: 'POST',
    body: JSON.stringify({ kind, params })
  }),

adminBookings: (params: {
  page?: number;
  pageSize?: number;
  status?: string;
  type?: 'urban' | 'intercity' | 'all';
  q?: string;
  date_from?: string;
  date_to?: string;
} = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  return req<any>(`/api/admin/bookings?${qs.toString()}`);
},

adminBookingDetail: (type: 'urban' | 'intercity', id: number) =>
  req<any>(`/api/admin/bookings/${type}/${id}`),

adminStopsAnalytics: () => req<any>('/api/admin/stops/analytics'),


  adminUsers: () => req<{ users: any[] }>('/api/admin/users'),
  adminListRoutes: () => req<{ routes: any[] }>('/api/admin/routes'),
  adminCreateRoute: (b: any) =>
    req<{ id: number }>('/api/admin/routes', { method: 'POST', body: JSON.stringify(b) }),
  adminUpdateRoute: (id: number, b: any) =>
    req('/api/admin/routes/' + id, { method: 'PUT', body: JSON.stringify(b) }),
  adminDeleteRoute: (id: number) => req('/api/admin/routes/' + id, { method: 'DELETE' }),
  adminListStops: () => req<{ stops: any[] }>('/api/stops'),
  adminCreateStop: (b: any) =>
    req<{ id: number }>('/api/admin/stops', { method: 'POST', body: JSON.stringify(b) }),
  adminUpdateStop: (id: number, b: any) =>
    req('/api/admin/stops/' + id, { method: 'PUT', body: JSON.stringify(b) }),
  adminDeleteStop: (id: number) => req('/api/admin/stops/' + id, { method: 'DELETE' }),
  adminListVehicles: () => req<{ vehicles: any[] }>('/api/admin/vehicles'),
  adminCreateVehicle: (b: any) =>
    req<{ id: number }>('/api/admin/vehicles', { method: 'POST', body: JSON.stringify(b) }),
  adminUpdateVehicle: (id: number, b: any) =>
    req('/api/admin/vehicles/' + id, { method: 'PUT', body: JSON.stringify(b) }),
  adminDeleteVehicle: (id: number) => req('/api/admin/vehicles/' + id, { method: 'DELETE' }),
  adminListAlerts: () => req<{ alerts: any[] }>('/api/admin/alerts'),
  adminDashboard: () => req<any>('/api/admin/dashboard'),
adminAiInsights: (lang: 'rw' | 'en' = 'en') =>
  req<{ source: 'ai' | 'rules'; insights: any[] }>(`/api/admin/ai-insights?lang=${lang}`),
  adminCreateAlert: (b: any) =>
    req<{ id: number }>('/api/admin/alerts', { method: 'POST', body: JSON.stringify(b) }),
  adminUpdateAlert: (id: number, b: any) =>
    req('/api/admin/alerts/' + id, { method: 'PUT', body: JSON.stringify(b) }),
  adminDeleteAlert: (id: number) => req('/api/admin/alerts/' + id, { method: 'DELETE' })
};

