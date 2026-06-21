// Multi-device sync against the FlowState server (via the api singleton).
// Strategy: last-write-wins by updatedAt, with tombstones (deleted=true) so a delete
// on one device isn't resurrected by another. Local-first: every call is best-effort
// and swallows network errors so the app keeps working offline.
import { api } from './api';
import { itemMs } from './lib';

// Client item -> server Event. dueAt (epoch ms) is computed here so the server stays
// timezone-agnostic.
export function toServerEvent(item) {
  return {
    id: item.id,
    title: item.title,
    type: item.type ?? null,
    date: item.date ?? null,
    time: item.time ?? null,
    dueAt: itemMs(item), // null when unscheduled
    preAlarmMin: item.preAlarmMin ?? null,
    subtasks: item.subtasks ?? [],
    completed: !!item.completed,
    completedAt: item.completedAt ?? null,
    deleted: !!item.deleted,
    repeat: item.repeat ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

// Server Event -> client item (drop dueAt; the client recomputes from date+time).
export function fromServerEvent(e) {
  return {
    id: String(e.id),
    title: e.title || '',
    type: e.type ?? null,
    date: e.date ?? null,
    time: e.time ?? null,
    subtasks: Array.isArray(e.subtasks) ? e.subtasks : [],
    preAlarmMin: e.preAlarmMin ?? null,
    completed: !!e.completed,
    completedAt: e.completedAt ?? null,
    deleted: !!e.deleted,
    repeat: e.repeat ?? null,
    createdAt: e.createdAt ?? Date.now(),
    updatedAt: e.updatedAt ?? Date.now(),
  };
}

// Merge two item lists by id, keeping whichever was updated last.
export function mergeItems(local, remote) {
  const byId = new Map();
  for (const it of local) byId.set(it.id, it);
  for (const it of remote) {
    const cur = byId.get(it.id);
    if (!cur || (it.updatedAt || 0) >= (cur.updatedAt || 0)) byId.set(it.id, it);
  }
  return [...byId.values()];
}

// Fetch the server's events for this tenant, mapped to client items. null on failure.
export async function fetchRemote() {
  try {
    const remote = await api.listEvents();
    return (remote || []).map(fromServerEvent);
  } catch {
    return null;
  }
}

// Push a single item (upsert, incl. tombstones). Resolves true on success, false on failure
// so the caller can retry offline changes later.
export function pushItem(item) {
  return api
    .putEvent(toServerEvent(item))
    .then(() => true)
    .catch(() => false);
}
