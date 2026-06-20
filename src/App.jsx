import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  loadState, saveState, newItem, computeZones, todayStr, itemMs, inLabel, affirmation,
  loadSession, saveSession, prefersReducedMotion,
} from './lib';
import { useNow, useReward, useAlarmEngine, unlockAudio } from './hooks';
import { fetchRemote, mergeItems, pushItem as syncPushItem } from './sync';
import { registerServiceWorker, refreshSubscription, listenForSubscriptionChange } from './push';
import Shell from './Shell';
import Home from './Home';
import Calendar from './Calendar';
import { FocusMode, SnapshotModal } from './FocusMode';
import { EditSheet, SettingsSheet } from './sheets';
import { Toast } from './ui';

const pad = (n) => String(n).padStart(2, '0');
const VIEW_KEY = 'tm-view';

function sameItems(a, b) {
  if (a.length !== b.length) return false;
  const m = new Map(a.map((i) => [i.id, i.updatedAt]));
  for (const it of b) if (m.get(it.id) !== it.updatedAt) return false;
  return true;
}

export default function App() {
  const [store, setStore] = useState(loadState);
  const [session, setSession] = useState(loadSession);
  const [route, setRoute] = useState(() => (session ? 'focus' : 'home'));
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem(VIEW_KEY) || 'today';
    } catch {
      return 'today';
    }
  });
  const [overlay, setOverlay] = useState({ kind: 'none', editItemId: null });
  const [draft, setDraft] = useState(null); // calendar "Add" item, committed only on Save
  const [toast, setToast] = useState(null); // { message, action }
  const [syncState, setSyncState] = useState('ok'); // 'ok' | 'offline'
  const [systemReduced, setSystemReduced] = useState(() => prefersReducedMotion());

  const { items, settings, progress } = store;
  const reducedMotion = settings.motion === 'reduced' || systemReduced;
  const nowMs = useNow(15000);
  const reward = useReward(settings, reducedMotion);
  useAlarmEngine(items, settings);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  // ---- persistence ----
  useEffect(() => saveState(store), [store]);
  useEffect(() => saveSession(session), [session]);
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  // theme (light/dark/system)
  useEffect(() => {
    const root = document.documentElement;
    const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && mq && mq.matches);
      root.classList.toggle('dark', !!dark);
    };
    apply();
    if (settings.theme === 'system' && mq) {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [settings.theme]);

  // live OS reduced-motion
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setSystemReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // ---- progress (derived from synced items so it agrees across devices) ----
  const doneToday = useMemo(() => {
    const t = todayStr();
    return items.filter((i) => i.completed && i.completedAt && todayStr(new Date(i.completedAt)) === t).length;
  }, [items]);
  useEffect(() => {
    if (doneToday > progress.bestDay) setStore((s) => ({ ...s, progress: { ...s.progress, bestDay: doneToday } }));
  }, [doneToday, progress.bestDay]);

  // ---- toast ----
  const toastTimer = useRef(null);
  const showToast = useCallback((message, action = null, duration = 1900) => {
    setToast({ message, action });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), duration);
  }, []);

  // ---- sync ----
  const lastSynced = useRef(new Map());
  useEffect(() => {
    for (const it of items) {
      if (lastSynced.current.get(it.id) !== it.updatedAt) {
        const u = it.updatedAt;
        syncPushItem(it).then((ok) => {
          if (ok) lastSynced.current.set(it.id, u);
          else setSyncState('offline');
        });
      }
    }
  }, [items]);

  const doPull = useCallback(async () => {
    const remoteItems = await fetchRemote();
    if (!remoteItems) {
      setSyncState('offline');
      return;
    }
    setSyncState('ok');
    for (const r of remoteItems) lastSynced.current.set(r.id, r.updatedAt);
    setStore((s) => {
      const merged = mergeItems(s.items, remoteItems);
      return sameItems(s.items, merged) ? s : { ...s, items: merged };
    });
  }, []);

  const onLinked = useCallback(() => {
    lastSynced.current = new Map(); // force all local items to re-push into the linked space
    doPull();
  }, [doPull]);

  useEffect(() => {
    registerServiceWorker();
    refreshSubscription();
    listenForSubscriptionChange();
    doPull();
    const id = setInterval(doPull, 45000);
    const onVisible = () => {
      if (!document.hidden) doPull();
    };
    window.addEventListener('focus', doPull);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', doPull);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [doPull]);

  // ---- item mutations (all stamp updatedAt) ----
  const patchItem = useCallback((id, patch) => {
    setStore((s) => ({ ...s, items: s.items.map((it) => (it.id === id ? { ...it, ...patch, updatedAt: Date.now() } : it)) }));
  }, []);

  const onCapture = useCallback((title) => {
    setStore((s) => ({ ...s, items: [newItem({ title }), ...s.items] }));
  }, []);

  const onComplete = useCallback(
    (item) => {
      if (item.completed) return;
      patchItem(item.id, { completed: true, completedAt: Date.now() });
      reward.complete();
      showToast(affirmation(doneToday + 1));
    },
    [patchItem, reward, showToast, doneToday]
  );

  const onToggleSubtask = useCallback(
    (item, subId) => {
      const sub = item.subtasks.find((s) => s.id === subId);
      if (!sub) return;
      const becomingDone = !sub.done;
      const subtasks = item.subtasks.map((s) => (s.id === subId ? { ...s, done: becomingDone } : s));
      const allDone = subtasks.length > 0 && subtasks.every((s) => s.done);

      if (becomingDone && allDone) {
        patchItem(item.id, { subtasks, completed: true, completedAt: Date.now() });
        reward.complete();
        showToast(affirmation(doneToday + 1));
      } else if (becomingDone) {
        patchItem(item.id, { subtasks });
        reward.tick();
      } else {
        patchItem(item.id, { subtasks });
      }

      if (becomingDone && session && session.itemId === item.id) {
        setSession((s) => (s ? { ...s, checked: s.checked + 1 } : s));
      }
    },
    [patchItem, reward, showToast, doneToday, session]
  );

  const onMoveToday = useCallback((item) => patchItem(item.id, { date: todayStr() }), [patchItem]);
  const onSnooze = useCallback(
    (item) => {
      const base = itemMs(item) ?? Date.now();
      const d = new Date(Math.max(base, Date.now()) + 3600000);
      patchItem(item.id, { date: todayStr(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` });
    },
    [patchItem]
  );

  // ---- overlays ----
  const onOpenEdit = useCallback((item) => setOverlay({ kind: 'edit', editItemId: item.id }), []);
  const onOpenSettings = useCallback(() => setOverlay({ kind: 'settings', editItemId: null }), []);
  const closeOverlay = useCallback(() => {
    setDraft(null); // discard an unsaved calendar-add draft (no ghost rows)
    setOverlay({ kind: 'none', editItemId: null });
  }, []);

  const onAddOnDate = useCallback((dateStr) => {
    const it = newItem({ date: dateStr });
    setDraft(it);
    setOverlay({ kind: 'edit', editItemId: it.id });
  }, []);

  const maybeRequestNotif = (it) => {
    try {
      if (it.date && it.time && it.type !== 'note' && typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch {
      /* ignore */
    }
  };

  const onSaveEdit = useCallback(
    (edited) => {
      const title = (edited.title || '').trim();
      const isDraft = draft && draft.id === edited.id;
      if (isDraft) {
        setDraft(null);
        if (!title) {
          setOverlay({ kind: 'none', editItemId: null });
          return; // discard a never-titled draft instead of leaving a blank row
        }
        const committed = { ...edited, title, updatedAt: Date.now() };
        setStore((s) => ({ ...s, items: [committed, ...s.items] }));
        setOverlay({ kind: 'none', editItemId: null });
        maybeRequestNotif(committed);
        return;
      }
      const original = items.find((it) => it.id === edited.id);
      const wasUnsorted = original && original.type == null && !(original.date && original.time);
      const nowSorted = edited.type != null || (edited.date && edited.time);
      patchItem(edited.id, { ...edited, title: title || (original ? original.title : '') });
      setOverlay({ kind: 'none', editItemId: null });
      if (wasUnsorted && nowSorted) {
        reward.sorted();
        showToast('Sorted — nice');
      }
      maybeRequestNotif(edited);
    },
    [draft, items, patchItem, reward, showToast]
  );

  const onDelete = useCallback(
    (id) => {
      patchItem(id, { deleted: true });
      closeOverlay();
      showToast(
        'Deleted',
        { label: 'Undo', onClick: () => { patchItem(id, { deleted: false }); setToast(null); } },
        6000
      );
    },
    [patchItem, closeOverlay, showToast]
  );

  const onChangeSettings = useCallback((next) => {
    setStore((s) => ({ ...s, settings: next }));
    unlockAudio();
  }, []);

  // ---- focus session ----
  const requestNotif = () => {
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission();
    } catch {
      /* ignore */
    }
  };

  const startSession = useCallback(
    (item, durationMin) => {
      const mins = durationMin || settings.defaultFocusMin;
      const totalMs = mins * 60000;
      unlockAudio();
      requestNotif();
      setSession({ gen: 1, itemId: item ? item.id : null, totalMs, endAt: Date.now() + totalMs, paused: false, remainingWhenPaused: totalMs, checked: 0 });
      setOverlay({ kind: 'none', editItemId: null });
      setRoute('focus');
    },
    [settings.defaultFocusMin]
  );
  const onStart = useCallback((item, durationMin) => startSession(item, durationMin), [startSession]);
  const onPause = useCallback(() => setSession((s) => (s ? { ...s, paused: true, remainingWhenPaused: Math.max(0, s.endAt - Date.now()) } : s)), []);
  const onResume = useCallback(() => {
    unlockAudio();
    setSession((s) => (s ? { ...s, paused: false, endAt: Date.now() + s.remainingWhenPaused } : s));
  }, []);
  const onAddTime = useCallback((min) => {
    setSession((s) => {
      if (!s) return s;
      const add = min * 60000;
      if (s.paused) return { ...s, totalMs: s.totalMs + add, remainingWhenPaused: s.remainingWhenPaused + add };
      return { ...s, totalMs: s.totalMs + add, endAt: s.endAt + add };
    });
  }, []);

  const openSnapshot = useCallback(() => {
    setSession((s) => (s ? { ...s, paused: true, remainingWhenPaused: Math.max(0, s.endAt - Date.now()) } : s));
    setOverlay({ kind: 'snapshot', editItemId: null });
  }, []);
  const onEndFocus = useCallback(() => openSnapshot(), [openSnapshot]);
  const onElapsed = useCallback(() => openSnapshot(), [openSnapshot]);

  const onKeepGoing = useCallback(() => {
    const add = 10 * 60000;
    setSession((s) => (s ? { ...s, gen: s.gen + 1, totalMs: s.totalMs + add, endAt: Date.now() + add, paused: false, remainingWhenPaused: add } : s));
    setOverlay({ kind: 'none', editItemId: null });
  }, []);
  const onBreak = useCallback(() => {
    const total = 5 * 60000;
    unlockAudio();
    setSession((s) => ({ gen: (s?.gen || 1) + 1, itemId: null, totalMs: total, endAt: Date.now() + total, paused: false, remainingWhenPaused: total, checked: 0 }));
    setOverlay({ kind: 'none', editItemId: null });
  }, []);
  const onDoneFocus = useCallback(() => {
    setSession(null);
    setOverlay({ kind: 'none', editItemId: null });
    setRoute('home');
  }, []);

  // ---- derived ----
  const zones = useMemo(() => computeZones(items, nowMs), [items, nowMs]);
  const banner = useMemo(() => {
    if (zones.now) {
      const ms = itemMs(zones.now);
      if (ms != null && ms < nowMs) return `Still here: ${zones.now.title} — whenever you’re ready`;
      return `Next: ${zones.now.title} — ${inLabel(ms, nowMs)}`;
    }
    if (zones.next.length) return 'A few things still here — pick what fits today';
    return 'Clear deck — nothing on the clock';
  }, [zones, nowMs]);

  const focusItem = session ? items.find((it) => it.id === session.itemId) || null : null;
  const editItem =
    overlay.kind === 'edit' ? (draft && draft.id === overlay.editItemId ? draft : items.find((it) => it.id === overlay.editItemId) || null) : null;
  const nextAfterFocus = useMemo(() => {
    if (zones.now && (!focusItem || zones.now.id !== focusItem.id)) return zones.now;
    return zones.next[0] || null;
  }, [zones, focusItem]);

  const progressForShell = { doneToday, bestDay: progress.bestDay };
  const localCount = useMemo(() => items.filter((i) => !i.deleted).length, [items]);
  const homeHandlers = { onCapture, onOpenEdit, onComplete, onToggleSubtask, onStart, onMoveToday, onSnooze };

  return (
    <>
      {route === 'focus' && session ? (
        <FocusMode
          key={session.gen}
          session={session}
          item={focusItem}
          settings={settings}
          reduced={reducedMotion}
          onPause={onPause}
          onResume={onResume}
          onAddTime={onAddTime}
          onEnd={onEndFocus}
          onElapsed={onElapsed}
          onToggleSubtask={onToggleSubtask}
        />
      ) : (
        <Shell view={view} onView={setView} progress={progressForShell} banner={banner} onOpenSettings={onOpenSettings} reduced={reducedMotion} syncState={syncState}>
          {view === 'today' ? (
            <Home zones={zones} settings={settings} reduced={reducedMotion} nowMs={nowMs} handlers={homeHandlers} />
          ) : (
            <Calendar items={items} onOpenEdit={onOpenEdit} onAddOnDate={onAddOnDate} onComplete={onComplete} />
          )}
        </Shell>
      )}

      {overlay.kind === 'snapshot' && session && (
        <SnapshotModal session={session} item={focusItem} nextItem={nextAfterFocus} onKeepGoing={onKeepGoing} onBreak={onBreak} onDone={onDoneFocus} />
      )}

      <EditSheet open={overlay.kind === 'edit'} item={editItem} onClose={closeOverlay} onSave={onSaveEdit} onDelete={onDelete} />
      <SettingsSheet open={overlay.kind === 'settings'} settings={settings} onClose={closeOverlay} onChange={onChangeSettings} onLinked={onLinked} localCount={localCount} />

      <Toast message={toast?.message} action={toast?.action} />
    </>
  );
}
