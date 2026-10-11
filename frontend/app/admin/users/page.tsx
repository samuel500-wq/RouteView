'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import Modal from '@/components/Modal';
import { useConfirm } from '@/components/Confirm';
import { useAuth } from '@/lib/auth';

type Role = 'passenger' | 'operator' | 'admin';

type User = {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
  is_active: number | boolean;
  created_at: string;
};

const ROLES: { value: Role; label_rw: string; label_en: string; tone: string }[] = [
  { value: 'passenger', label_rw: 'Umugenzi',  label_en: 'Passenger', tone: 'sky' },
  { value: 'operator',  label_rw: 'Umukoresha', label_en: 'Operator',  tone: 'emerald' },
  { value: 'admin',     label_rw: 'Umuyobozi',  label_en: 'Admin',     tone: 'violet' }
];

export default function AdminUsersPage() {
  const { lang } = useI18n();
  const { user: currentUser } = useAuth();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);
  const confirm = useConfirm();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [stateFilter, setStateFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sort, setSort] = useState<'newest' | 'name' | 'role'>('newest');

  const [selected, setSelected] = useState<User | null>(null);
  const [editing, setEditing] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  /* ---------- Load ---------- */
  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const r = await api.adminUsers();
      setUsers(r.users);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  /* ---------- Stats ---------- */
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => Boolean(u.is_active)).length;
    const inactive = total - active;
    const passengers = users.filter((u) => u.role === 'passenger').length;
    const operators = users.filter((u) => u.role === 'operator').length;
    const admins = users.filter((u) => u.role === 'admin').length;
    // New this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const newThisMonth = users.filter((u) => new Date(u.created_at) >= monthStart).length;
    return { total, active, inactive, passengers, operators, admins, newThisMonth };
  }, [users]);

  /* ---------- Filter + sort ---------- */
  const filtered = useMemo(() => {
    let out = users;
    const needle = q.trim().toLowerCase();
    if (needle) {
      out = out.filter((u) =>
        `${u.email} ${u.full_name} ${u.phone || ''}`.toLowerCase().includes(needle)
      );
    }
    if (roleFilter !== 'all') out = out.filter((u) => u.role === roleFilter);
    if (stateFilter === 'active') out = out.filter((u) => Boolean(u.is_active));
    else if (stateFilter === 'inactive') out = out.filter((u) => !u.is_active);

    const sorted = [...out];
    if (sort === 'name') {
      sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
    } else if (sort === 'role') {
      const order: Record<Role, number> = { admin: 0, operator: 1, passenger: 2 };
      sorted.sort((a, b) => order[a.role] - order[b.role] || a.full_name.localeCompare(b.full_name));
    } else {
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return sorted;
  }, [users, q, roleFilter, stateFilter, sort]);

  /* ---------- Update ---------- */
  async function saveUser(patch: Partial<User>) {
    if (!editing) return;
    setBusy(true);
    try {
      await api.adminUpdateUser(editing.id, {
        role: patch.role,
        is_active: patch.is_active === undefined ? undefined : Boolean(patch.is_active),
        full_name: patch.full_name,
        phone: patch.phone
      });
      setToast({ kind: 'ok', msg: t('Byahinduwe.', 'User updated.') });
      setEditing(null);
      refresh();
    } catch (e: any) {
      const msg = String(e?.message || '');
      setToast({
        kind: 'err',
        msg: msg.includes('cannot_change_own_role')
          ? t('Ntushobora guhindura uruhare rwawe.', 'You cannot change your own role.')
          : msg.includes('cannot_deactivate_self')
          ? t('Ntushobora kwifunga.', 'You cannot deactivate your own account.')
          : msg
      });
    } finally {
      setBusy(false);
    }
  }

  async function quickRole(u: User, role: Role) {
    if (u.id === currentUser?.id && role !== 'admin') {
      setToast({ kind: 'err', msg: t('Ntushobora guhindura uruhare rwawe.', 'You cannot change your own role.') });
      return;
    }
    try {
      await api.adminUpdateUser(u.id, { role });
      setUsers((cur) => cur.map((x) => (x.id === u.id ? { ...x, role } : x)));
      setToast({ kind: 'ok', msg: t('Uruhare rwahinduwe.', 'Role changed.') });
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.message });
    }
  }

  async function toggleActive(u: User) {
    if (u.id === currentUser?.id) {
      setToast({ kind: 'err', msg: t('Ntushobora kwifunga.', 'You cannot deactivate yourself.') });
      return;
    }
    const target = !Boolean(u.is_active);
    const ok = target
      ? true
      : await confirm({
          title: t('Gufunga konti', 'Deactivate account'),
          message: t(
            `Gufunga konti ya ${u.full_name}? Ntazashobora kwinjira.`,
            `Deactivate ${u.full_name}'s account? They will not be able to sign in.`
          ),
          destructive: true,
          confirmLabel: t('Funga', 'Deactivate')
        });
    if (!ok) return;
    try {
      await api.adminUpdateUser(u.id, { is_active: target });
      setUsers((cur) => cur.map((x) => (x.id === u.id ? { ...x, is_active: target ? 1 : 0 } : x)));
      setToast({ kind: 'ok', msg: target ? t('Yafunguwe.', 'User activated.') : t('Yafunzwe.', 'User deactivated.') });
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.message });
    }
  }

  return (
    <div className="space-y-5">
      {/* ---------- Header ---------- */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('Abakoresha', 'Users')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(
              'Abagenzi, abakoresha n’abayobozi. Gusa abayobozi bashobora kureba iyi page.',
              'Passengers, operators and administrators. Only admins can view this page.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={refresh}
            className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-800 dark:text-slate-200"
          >
            {t('Vugurura', 'Refresh')}
          </button>
        </div>
      </header>

      {/* ---------- KPI strip ---------- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t('Abakoresha bose', 'Total users')}
          value={stats.total}
          hint={`${stats.newThisMonth} ${t('bashya uku kwezi', 'new this month')}`}
          tone="slate"
          icon={<Users />}
        />
        <StatTile
          label={t('Bakora', 'Active')}
          value={stats.active}
          hint={`${stats.inactive} ${t('bafunze', 'inactive')}`}
          tone="emerald"
          icon={<Check />}
        />
        <StatTile
          label={t('Abagenzi', 'Passengers')}
          value={stats.passengers}
          hint={t('Abakoresha urubuga', 'End users')}
          tone="sky"
          icon={<Person />}
        />
        <StatTile
          label={t('Abayobozi', 'Staff')}
          value={stats.operators + stats.admins}
          hint={`${stats.admins} admin · ${stats.operators} operator`}
          tone="violet"
          icon={<Shield />}
        />
      </div>

      {/* ---------- Role breakdown bar ---------- */}
      {stats.total > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('Ikwirakwizwa ry’uruhare', 'Role distribution')}
            </h2>
            <span className="text-[10px] text-slate-400">
              {stats.total} {t('abakoresha', 'users')}
            </span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            {stats.passengers > 0 && (
              <div
                className="h-full bg-sky-500 transition-all"
                style={{ width: `${(stats.passengers / stats.total) * 100}%` }}
                title={`${stats.passengers} passengers`}
              />
            )}
            {stats.operators > 0 && (
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${(stats.operators / stats.total) * 100}%` }}
                title={`${stats.operators} operators`}
              />
            )}
            {stats.admins > 0 && (
              <div
                className="h-full bg-violet-500 transition-all"
                style={{ width: `${(stats.admins / stats.total) * 100}%` }}
                title={`${stats.admins} admins`}
              />
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
            <Legend dot="bg-sky-500"     label={`${t('Abagenzi', 'Passengers')} · ${stats.passengers}`} />
            <Legend dot="bg-emerald-500" label={`${t('Abakoresha', 'Operators')} · ${stats.operators}`} />
            <Legend dot="bg-violet-500"  label={`${t('Abayobozi', 'Admins')} · ${stats.admins}`} />
          </div>
        </section>
      )}

      {/* ---------- Filters ---------- */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {t('Shakisha', 'Search')}
            </span>
            <div className="mt-1.5 flex items-center rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-400">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('Email cyangwa amazina…', 'Email or name…')}
                className="w-full bg-transparent px-2 py-2.5 text-sm outline-none dark:text-white"
              />
              {q && (
                <button onClick={() => setQ('')} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">✕</button>
              )}
            </div>
          </label>

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {t('Uruhare', 'Role')}
            </span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              <option value="all">{t('Bose', 'All roles')}</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {lang === 'rw' ? r.label_rw : r.label_en}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {t('Imimerere', 'State')}
            </span>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value as any)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              <option value="all">{t('Bose', 'All')}</option>
              <option value="active">{t('Bakora', 'Active')}</option>
              <option value="inactive">{t('Bafunze', 'Inactive')}</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {t('Gutondeka', 'Sort by')}
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              <option value="newest">{t('Bashya mbere', 'Newest first')}</option>
              <option value="name">{t('Amazina', 'Name')}</option>
              <option value="role">{t('Uruhare', 'Role')}</option>
            </select>
          </label>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {/* ---------- List ---------- */}
      {loading && users.length === 0 ? (
        <SkeletonTable />
      ) : filtered.length === 0 ? (
        <EmptyState
          t={t}
          hasFilters={q !== '' || roleFilter !== 'all' || stateFilter !== 'all'}
          onClear={() => { setQ(''); setRoleFilter('all'); setStateFilter('all'); }}
        />
      ) : (
        <>
          {/* Desktop table */}
          <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-widest text-slate-500 dark:bg-slate-950/40">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{t('Umukoresha', 'User')}</th>
                    <th className="px-4 py-3 font-semibold">{t('Email', 'Email')}</th>
                    <th className="px-4 py-3 font-semibold">{t('Telefone', 'Phone')}</th>
                    <th className="px-4 py-3 font-semibold">{t('Uruhare', 'Role')}</th>
                    <th className="px-4 py-3 font-semibold">{t('Imimerere', 'State')}</th>
                    <th className="px-4 py-3 font-semibold">{t('Byakozwe', 'Joined')}</th>
                    <th className="px-4 py-3 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => setSelected(u)}
                      className="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar user={u} size={36} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900 dark:text-white">
                              {u.full_name}
                              {u.id === currentUser?.id && (
                                <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                                  {t('wewe', 'you')}
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-slate-400">#{u.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                          {u.email}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                        {u.phone || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <RoleChip role={u.role} lang={lang} />
                      </td>
                      <td className="px-4 py-3">
                        <StateChip active={Boolean(u.is_active)} t={t} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(u.created_at).toLocaleDateString(undefined, {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setEditing(u)}
                            className="rounded-md px-2 py-1 text-[11px] font-semibold text-sky-600 transition hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/40"
                          >
                            {t('Hindura', 'Edit')}
                          </button>
                          {u.id !== currentUser?.id && (
                            <button
                              onClick={() => toggleActive(u)}
                              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                                u.is_active
                                  ? 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40'
                                  : 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
                              }`}
                            >
                              {u.is_active ? t('Funga', 'Disable') : t('Kora', 'Enable')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {filtered.map((u) => (
              <li key={u.id}>
                <div
                  onClick={() => setSelected(u)}
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 transition active:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:active:bg-slate-800/40"
                >
                  <div className="flex items-start gap-3">
                    <Avatar user={u} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900 dark:text-white">
                        {u.full_name}
                      </p>
                      <p className="truncate font-mono text-[11px] text-slate-500">{u.email}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <RoleChip role={u.role} lang={lang} />
                        <StateChip active={Boolean(u.is_active)} t={t} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setEditing(u)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                    >
                      {t('Hindura', 'Edit')}
                    </button>
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => toggleActive(u)}
                        className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition ${
                          u.is_active
                            ? 'border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-400'
                            : 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400'
                        }`}
                      >
                        {u.is_active ? t('Funga', 'Disable') : t('Kora', 'Enable')}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* ---------- Detail drawer ---------- */}
      {selected && (
        <UserDrawer
          user={selected}
          lang={lang}
          t={t}
          isSelf={selected.id === currentUser?.id}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditing(selected); setSelected(null); }}
          onQuickRole={(role) => quickRole(selected, role)}
          onToggleActive={() => toggleActive(selected)}
        />
      )}

      {/* ---------- Edit modal ---------- */}
      {editing && (
        <EditUserModal
          user={editing}
          setUser={setEditing}
          isSelf={editing.id === currentUser?.id}
          onSave={saveUser}
          onCancel={() => setEditing(null)}
          busy={busy}
          lang={lang}
          t={t}
        />
      )}

      {/* ---------- Toast ---------- */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-2xl ${
          toast.kind === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ================================================================== *
 *  Small components
 * ================================================================== */

function Avatar({ user, size = 36 }: { user: User; size?: number }) {
  const initials = user.full_name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const palettes: Record<Role, string> = {
    admin:     'from-violet-500 to-violet-700',
    operator:  'from-emerald-500 to-emerald-700',
    passenger: 'from-sky-500 to-sky-700'
  };

  return (
    <span
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white shadow-sm ${palettes[user.role]}`}
      style={{ width: size, height: size }}
    >
      {initials || 'U'}
    </span>
  );
}

function RoleChip({ role, lang }: { role: Role; lang: 'rw' | 'en' }) {
  const map: Record<Role, { bg: string; label_rw: string; label_en: string }> = {
    admin:     { bg: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300',  label_rw: 'Umuyobozi',  label_en: 'Admin' },
    operator:  { bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300', label_rw: 'Umukoresha', label_en: 'Operator' },
    passenger: { bg: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',              label_rw: 'Umugenzi',   label_en: 'Passenger' }
  };
  const r = map[role];
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${r.bg}`}>
      {lang === 'rw' ? r.label_rw : r.label_en}
    </span>
  );
}

function StateChip({ active, t }: { active: boolean; t: any }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
      active
        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
        : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
    }`}>
      {active ? t('Yemewe', 'Active') : t('Yafunzwe', 'Inactive')}
    </span>
  );
}

function StatTile({
  label, value, hint, tone, icon
}: {
  label: string;
  value: number;
  hint?: string;
  tone: 'slate' | 'emerald' | 'sky' | 'violet';
  icon?: React.ReactNode;
}) {
  const tones = {
    slate:   { fg: 'text-slate-900 dark:text-white',         bg: 'bg-slate-100 dark:bg-slate-800',        icon: 'text-slate-600 dark:text-slate-300' },
    emerald: { fg: 'text-emerald-600 dark:text-emerald-400',  bg: 'bg-emerald-50 dark:bg-emerald-950/40',  icon: 'text-emerald-600 dark:text-emerald-400' },
    sky:     { fg: 'text-sky-600 dark:text-sky-400',           bg: 'bg-sky-50 dark:bg-sky-950/40',          icon: 'text-sky-600 dark:text-sky-400' },
    violet:  { fg: 'text-violet-600 dark:text-violet-400',     bg: 'bg-violet-50 dark:bg-violet-950/40',    icon: 'text-violet-600 dark:text-violet-400' }
  }[tone];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
        {icon && (
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones.bg} ${tones.icon}`}>
            {icon}
          </span>
        )}
      </div>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${tones.fg}`}>{value.toLocaleString()}</p>
      {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function SkeletonTable() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
            <div className="h-4 w-40 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-4 w-32 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            <div className="ml-auto h-4 w-20 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ t, hasFilters, onClear }: any) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <Users />
      </div>
      <p className="mt-4 font-semibold text-slate-900 dark:text-white">
        {hasFilters ? t('Nta mukoresha uhuye n’ibisabwa', 'No users match your filters') : t('Nta bakoresha barahari', 'No users yet')}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {hasFilters
          ? t('Gerageza uhindure ibisabwa.', 'Try adjusting the filters.')
          : t('Abakoresha bazagaragara hano iyo biyandikishije.', 'Users appear here when they register.')}
      </p>
      {hasFilters && (
        <button
          onClick={onClear}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
        >
          {t('Siba filters', 'Clear filters')}
        </button>
      )}
    </div>
  );
}

/* ================================================================== *
 *  Detail drawer
 * ================================================================== */

function UserDrawer({
  user: u, lang, t, isSelf, onClose, onEdit, onQuickRole, onToggleActive
}: {
  user: User;
  lang: 'rw' | 'en';
  t: any;
  isSelf: boolean;
  onClose: () => void;
  onEdit: () => void;
  onQuickRole: (role: Role) => void;
  onToggleActive: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:max-w-lg">
        {/* Header */}
        <header className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 px-5 py-6 text-white">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-sky-500/20 blur-3xl" />
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="relative flex items-center gap-4">
            <Avatar user={u} size={56} />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{u.full_name}</p>
              <p className="truncate font-mono text-xs text-slate-300">{u.email}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <RoleChip role={u.role} lang={lang} />
                <StateChip active={Boolean(u.is_active)} t={t} />
                {isSelf && (
                  <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-200">
                    {t('wewe', 'you')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <Section title={t('Amakuru', 'Account')}>
            <Row label={t('ID', 'User ID')} value={`#${u.id}`} mono />
            <Row label={t('Email', 'Email')} value={u.email} mono />
            <Row label={t('Telefone', 'Phone')} value={u.phone || '—'} mono />
            <Row
              label={t('Byakozwe', 'Joined')}
              value={new Date(u.created_at).toLocaleString()}
            />
          </Section>

          <Section title={t('Uruhare', 'Role')}>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => onQuickRole(r.value)}
                  disabled={u.role === r.value || (isSelf && r.value !== 'admin')}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-2.5 transition disabled:cursor-not-allowed ${
                    u.role === r.value
                      ? 'border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800'
                      : 'border-slate-200 bg-white hover:border-slate-300 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-950'
                  }`}
                >
                  <span className={`inline-block h-2 w-2 rounded-full ${
                    r.value === 'admin' ? 'bg-violet-500'
                    : r.value === 'operator' ? 'bg-emerald-500'
                    : 'bg-sky-500'
                  }`} />
                  <span className="text-[11px] font-semibold text-slate-900 dark:text-white">
                    {lang === 'rw' ? r.label_rw : r.label_en}
                  </span>
                </button>
              ))}
            </div>
            {isSelf && (
              <p className="mt-2 text-[10px] text-slate-500">
                {t(
                  'Ntushobora guhindura uruhare rwawe bwite.',
                  'You cannot change your own role.'
                )}
              </p>
            )}
          </Section>

          <Section title={t('Umutekano', 'Security')}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {Boolean(u.is_active)
                    ? t('Konti irakora', 'Account is active')
                    : t('Konti yafunzwe', 'Account is deactivated')}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {Boolean(u.is_active)
                    ? t(
                        'Uyu mukoresha ashobora kwinjira mu rubuga.',
                        'This user can sign in to the platform.'
                      )
                    : t(
                        'Uyu mukoresha ntashobora kwinjira.',
                        'This user cannot sign in.'
                      )}
                </p>
              </div>
              {!isSelf && (
                <button
                  onClick={onToggleActive}
                  className={`flex-shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                    u.is_active
                      ? 'border border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950/40'
                      : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
                  }`}
                >
                  {u.is_active ? t('Funga konti', 'Deactivate') : t('Kora konti', 'Activate')}
                </button>
              )}
            </div>
          </Section>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-[10px] text-slate-400">
            {t('Kanda Escape kugira ngo ufunge.', 'Press Escape to close.')}
          </p>
          <button
            onClick={onEdit}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900"
          >
            {t('Hindura amakuru', 'Edit details')}
          </button>
        </footer>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{title}</p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ label, value, mono }: any) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="flex-shrink-0 text-xs text-slate-500">{label}</span>
      <span className={`truncate text-right font-medium text-slate-900 dark:text-white ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}

/* ================================================================== *
 *  Edit modal
 * ================================================================== */

function EditUserModal({
  user: u, setUser, isSelf, onSave, onCancel, busy, lang, t
}: any) {
  const [fullName, setFullName] = useState(u.full_name || '');
  const [phone, setPhone] = useState(u.phone || '');
  const [role, setRole] = useState<Role>(u.role);
  const [active, setActive] = useState(Boolean(u.is_active));

  return (
    <Modal
      open
      onClose={onCancel}
      title={t('Hindura umukoresha', 'Edit user')}
      wide
      footer={
        <>
          <button
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-800"
          >
            {t('Reka', 'Cancel')}
          </button>
          <button
            onClick={() => onSave({
              full_name: fullName.trim(),
              phone: phone.trim() || null,
              role,
              is_active: active
            })}
            disabled={busy || !fullName.trim()}
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            {busy ? t('Turabika…', 'Saving…') : t('Bika', 'Save')}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Preview */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {t('Igaragaza', 'Preview')}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Avatar user={{ ...u, full_name: fullName || u.full_name, role }} size={44} />
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900 dark:text-white">
                {fullName || u.full_name}
              </p>
              <p className="truncate font-mono text-[11px] text-slate-500">{u.email}</p>
            </div>
            <div className="ml-auto flex flex-col items-end gap-1">
              <RoleChip role={role} lang={lang} />
              <StateChip active={active} t={t} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Amazina yombi', 'Full name')} required>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              maxLength={120}
            />
          </Field>

          <Field label={t('Telefone', 'Phone')} hint={t('Bidategetswe', 'Optional')}>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              placeholder="+250 7XX XXX XXX"
              maxLength={30}
            />
          </Field>
        </div>

        {/* Email (read-only) */}
        <Field label={t('Email', 'Email')} hint={t('Ntushobora guhindura email', 'Email cannot be changed')}>
          <input
            value={u.email}
            readOnly
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 font-mono text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900"
          />
        </Field>

        {/* Role */}
        <div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {t('Uruhare', 'Role')} <span className="text-red-500">*</span>
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {ROLES.map((r) => {
              const disabled = isSelf && r.value !== 'admin';
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => !disabled && setRole(r.value)}
                  disabled={disabled}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    role === r.value
                      ? 'border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950'
                  }`}
                >
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${
                    r.value === 'admin' ? 'bg-violet-500'
                    : r.value === 'operator' ? 'bg-emerald-500'
                    : 'bg-sky-500'
                  }`} />
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    {lang === 'rw' ? r.label_rw : r.label_en}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active toggle */}
        <label className={`flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 ${
          isSelf ? 'opacity-60' : ''
        }`}>
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {t('Konti irakora', 'Account is active')}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {isSelf
                ? t('Ntushobora kwifunga.', 'You cannot deactivate your own account.')
                : t(
                    'Iyo ifunzwe, uyu mukoresha ntashobora kwinjira.',
                    'When disabled, this user cannot sign in.'
                  )}
            </p>
          </div>
          <button
            type="button"
            disabled={isSelf}
            onClick={() => setActive((a) => !a)}
            className={`relative h-6 w-11 flex-shrink-0 rounded-full transition disabled:cursor-not-allowed ${
              active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                active ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </label>
      </div>
    </Modal>
  );
}

function Field({ label, required, hint, children }: any) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
    </label>
  );
}

/* ================================================================== *
 *  Icons
 * ================================================================== */

function Users() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function Person() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
function Shield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}