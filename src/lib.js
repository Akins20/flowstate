// Pure data + helpers: storage/migration, time, zones, type metadata, copy.
import { Phone, Mail, FileText, StickyNote, CheckSquare } from 'lucide-react';

export const STORAGE_KEY = 'tm-data';
export const SCHEMA_VERSION = 2;

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

// Local YYYY-MM-DD (NOT UTC — the old code used toISOString which drifts by a day).
export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export const DEFAULT_SETTINGS = {
  sound: true,
  vibration: true,
  motion: 'full', // 'full' | 'reduced'
  salience: 'normal', // 'less' | 'normal' | 'more'
  defaultFocusMin: 25,
  theme: 'system', // 'system' | 'light' | 'dark'
};

function defaultSettings() {
  return { ...DEFAULT_SETTINGS, motion: prefersReducedMotion() ? 'reduced' : 'full' };
}

function defaultProgress() {
  return { doneToday: 0, doneTodayDate: todayStr(), bestDay: 0 };
}

export function freshState() {
  return { version: SCHEMA_VERSION, items: [], settings: defaultSettings(), progress: defaultProgress() };
}

export function newItem(partial = {}) {
  return {
    id: uid(),
    title: '',
    type: null, // null = untyped (Inbox)
    date: null, // 'YYYY-MM-DD'
    time: null, // 'HH:MM'
    subtasks: [], // [{ id, text, done }]
    preAlarmMin: null, // lead-time pre-alarm in minutes
    completed: false,
    completedAt: null,
    createdAt: Date.now(),
    ...partial,
  };
}

function migrateOldItem(old) {
  const type = old.type === 'note' ? 'note' : 'task'; // old 'task' kept as task (now shown with CheckSquare, not Bell)
  const createdAt = typeof old.id === 'number' ? old.id : Date.now();
  return {
    id: String(old.id ?? uid()),
    title: old.title || '',
    type,
    date: old.date || null,
    time: old.time || null,
    subtasks: [],
    preAlarmMin: null,
    completed: !!old.completed,
    completedAt: old.completed ? Date.now() : null,
    createdAt,
  };
}

function normalizeItem(it) {
  return {
    id: String(it.id ?? uid()),
    title: it.title || '',
    type: it.type ?? null,
    date: it.date ?? null,
    time: it.time ?? null,
    subtasks: Array.isArray(it.subtasks)
      ? it.subtasks.map((s) => ({ id: String(s.id ?? uid()), text: s.text || '', done: !!s.done }))
      : [],
    preAlarmMin: it.preAlarmMin ?? null,
    completed: !!it.completed,
    completedAt: it.completedAt ?? null,
    createdAt: it.createdAt ?? Date.now(),
  };
}

// Accepts v1 (raw array) or v2 (object) and returns a normalized v2 state.
export function migrate(raw) {
  if (Array.isArray(raw)) {
    return { version: SCHEMA_VERSION, items: raw.map(migrateOldItem), settings: defaultSettings(), progress: defaultProgress() };
  }
  if (raw && typeof raw === 'object') {
    return {
      version: SCHEMA_VERSION,
      items: Array.isArray(raw.items) ? raw.items.map(normalizeItem) : [],
      settings: { ...defaultSettings(), ...(raw.settings || {}) },
      progress: { ...defaultProgress(), ...(raw.progress || {}) },
    };
  }
  return freshState();
}

export function rolloverProgress(state) {
  const today = todayStr();
  if (state.progress.doneTodayDate !== today) {
    return { ...state, progress: { ...state.progress, doneToday: 0, doneTodayDate: today } };
  }
  return state;
}

export function loadState() {
  try {
    const str = localStorage.getItem(STORAGE_KEY);
    if (!str) return freshState();
    return rolloverProgress(migrate(JSON.parse(str)));
  } catch (e) {
    // A corrupt key must never white-screen the app.
    console.warn('FlowState: could not read saved data, starting fresh.', e);
    return freshState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('FlowState: could not save data.', e);
  }
}

// ---- Time helpers ----
export function isScheduled(item) {
  return !!(item.date && item.time);
}

export function itemDate(item) {
  if (!isScheduled(item)) return null;
  const [y, m, d] = item.date.split('-').map(Number);
  const [hh, mm] = item.time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function itemMs(item) {
  const d = itemDate(item);
  return d ? d.getTime() : null;
}

export function isPast(item, nowMs) {
  const ms = itemMs(item);
  return ms != null && ms < nowMs;
}

// "in 25 min" / "in 2h 10m" / "in 3 days" — future only.
export function inLabel(targetMs, nowMs) {
  const diff = targetMs - nowMs;
  if (diff <= 30000) return 'now';
  const min = Math.round(diff / 60000);
  if (min < 60) return `in ${min} min`;
  if (min < 60 * 24) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `in ${h}h ${m}m` : `in ${h}h`;
  }
  const days = Math.round(min / (60 * 24));
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}

export function formatTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDateShort(date) {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const today = todayStr();
  const tomorrow = todayStr(new Date(Date.now() + 86400000));
  if (date === today) return 'Today';
  if (date === tomorrow) return 'Tomorrow';
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function mmss(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---- Zones: each item lives in exactly one place ----
export function computeZones(items, nowMs) {
  const active = items.filter((i) => !i.completed);
  const inbox = active.filter((i) => !isScheduled(i)).sort((a, b) => b.createdAt - a.createdAt);
  const scheduled = active.filter(isScheduled).sort((a, b) => itemMs(a) - itemMs(b));

  const past = scheduled.filter((i) => itemMs(i) < nowMs);
  const upcoming = scheduled.filter((i) => itemMs(i) >= nowMs);

  let now = upcoming[0] || null;
  let pool;
  if (now) {
    // Upcoming hero; past "still here" items sit gently at the top of NEXT.
    pool = [...past, ...upcoming.slice(1)];
  } else {
    // Nothing upcoming — promote the earliest "still here" item so there's always one clear thing.
    now = past[0] || null;
    pool = now ? past.slice(1) : [];
  }
  const next = pool.slice(0, 3);
  const later = pool.slice(3);
  return { inbox, now, next, later };
}

// ---- Item type metadata ----
export const TYPE_META = {
  call: { label: 'Call', Icon: Phone, tintBg: 'bg-sky-100 dark:bg-sky-950', tintText: 'text-sky-700 dark:text-sky-300', verb: 'Make the call' },
  email: { label: 'Email', Icon: Mail, tintBg: 'bg-violet-100 dark:bg-violet-950', tintText: 'text-violet-700 dark:text-violet-300', verb: 'Send the email' },
  form: { label: 'Form', Icon: FileText, tintBg: 'bg-teal-100 dark:bg-teal-950', tintText: 'text-teal-700 dark:text-teal-300', verb: 'Fill the form' },
  note: { label: 'Note', Icon: StickyNote, tintBg: 'bg-amber-100 dark:bg-amber-950', tintText: 'text-amber-700 dark:text-amber-300', verb: null },
  task: { label: 'Task', Icon: CheckSquare, tintBg: 'bg-indigo-100 dark:bg-indigo-950', tintText: 'text-indigo-700 dark:text-indigo-300', verb: null },
};
export const TYPE_ORDER = ['task', 'call', 'email', 'form', 'note'];

export function isActionable(item) {
  return item.type !== 'note'; // notes are reference text, not "started"
}

export function firstUnchecked(item) {
  return (item.subtasks || []).find((s) => !s.done) || null;
}

export function subtaskProgress(item) {
  const subs = item.subtasks || [];
  return { done: subs.filter((s) => s.done).length, total: subs.length };
}

// Contextual verb for the NOW card, falling back to the title.
export function nowLabel(item) {
  if (!item) return '';
  const meta = item.type ? TYPE_META[item.type] : null;
  if (meta && meta.verb) return meta.verb;
  return item.title;
}

// ---- Copy pools (cheap novelty, no persisted state) ----
const AFFIRMATIONS = [
  "Done. That's {n} today — nice.",
  'Nice — that’s one less thing.',
  'Boom. {n} done today.',
  'That counts — {n} today.',
  'Good one. {n} today.',
];
export function affirmation(n) {
  const pick = AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)];
  return pick.replace('{n}', n);
}

const SNAPSHOT_HEADLINES = [
  'Nice focus on “{task}”',
  'That was real focus on “{task}”',
  'Solid stretch on “{task}”',
];
export function snapshotHeadline(task) {
  const pick = SNAPSHOT_HEADLINES[Math.floor(Math.random() * SNAPSHOT_HEADLINES.length)];
  return pick.replace('{task}', task || 'your task');
}

export const PRE_ALARM_OPTIONS = [
  { value: null, label: 'No early heads-up' },
  { value: 5, label: '5 min before' },
  { value: 10, label: '10 min before' },
  { value: 15, label: '15 min before' },
  { value: 30, label: '30 min before' },
];

export const FOCUS_PRESETS = [5, 15, 25, 45];
