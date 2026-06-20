import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  loadState,
  saveState,
  newItem,
  computeZones,
  todayStr,
  itemMs,
  isScheduled,
  inLabel,
  affirmation,
} from './lib';
import { useNow, useReward, useAlarmEngine, unlockAudio } from './hooks';
import Home from './Home';
import { FocusMode, SnapshotModal } from './FocusMode';
import { EditSheet, SettingsSheet } from './sheets';
import { Toast } from './ui';

const pad = (n) => String(n).padStart(2, '0');

export default function App() {
  const [store, setStore] = useState(loadState);
  const [route, setRoute] = useState('home'); // 'home' | 'focus'
  const [overlay, setOverlay] = useState({ kind: 'none', editItemId: null });
  const [session, setSession] = useState(null);
  const [toast, setToast] = useState(null);

  const { items, settings, progress } = store;
  const nowMs = useNow(15000);
  const reward = useReward(settings);
  useAlarmEngine(items, settings);

  // Persist on every change.
  useEffect(() => saveState(store), [store]);

  // Apply light/dark theme; follow the system when set to "system".
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

  // Day rollover for the "Done today" count (a date check, never a decaying meter).
  useEffect(() => {
    const today = todayStr();
    if (progress.doneTodayDate !== today) {
      setStore((s) => ({ ...s, progress: { ...s.progress, doneToday: 0, doneTodayDate: today } }));
    }
  }, [nowMs, progress.doneTodayDate]);

  const toastTimer = useRef(null);
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1900);
  }, []);

  // ---- item mutations ----
  const patchItem = useCallback((id, patch) => {
    setStore((s) => ({ ...s, items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  }, []);

  const bumpDone = useCallback((n = 1) => {
    setStore((s) => {
      const doneToday = s.progress.doneToday + n;
      return { ...s, progress: { ...s.progress, doneToday, doneTodayDate: todayStr(), bestDay: Math.max(s.progress.bestDay, doneToday) } };
    });
  }, []);

  const onCapture = useCallback((title) => {
    setStore((s) => ({ ...s, items: [newItem({ title }), ...s.items] }));
  }, []);

  const onComplete = useCallback(
    (item) => {
      if (item.completed) return;
      patchItem(item.id, { completed: true, completedAt: Date.now() });
      reward.complete();
      bumpDone(1);
      showToast(affirmation(progress.doneToday + 1));
    },
    [patchItem, reward, bumpDone, showToast, progress.doneToday]
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
        reward.complete(); // last step finishes the task
        bumpDone(1);
        showToast(affirmation(progress.doneToday + 1));
      } else if (becomingDone) {
        patchItem(item.id, { subtasks });
        reward.tick();
        bumpDone(1);
      } else {
        patchItem(item.id, { subtasks }); // unchecking never subtracts progress
      }

      if (becomingDone && session && session.itemId === item.id) {
        setSession((s) => (s ? { ...s, checked: s.checked + 1 } : s));
      }
    },
    [patchItem, reward, bumpDone, showToast, progress.doneToday, session]
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
  const closeOverlay = useCallback(() => setOverlay({ kind: 'none', editItemId: null }), []);

  const onSaveEdit = useCallback(
    (draft) => {
      const original = items.find((it) => it.id === draft.id);
      const wasUnsorted = original && original.type == null && !isScheduled(original);
      const nowSorted = draft.type != null || isScheduled(draft);
      patchItem(draft.id, draft);
      closeOverlay();
      if (wasUnsorted && nowSorted) {
        reward.sorted();
        showToast('Sorted — nice');
      }
    },
    [items, patchItem, closeOverlay, reward, showToast]
  );

  const onDelete = useCallback(
    (id) => {
      setStore((s) => ({ ...s, items: s.items.filter((it) => it.id !== id) }));
      closeOverlay();
    },
    [closeOverlay]
  );

  const onChangeSettings = useCallback((next) => {
    setStore((s) => ({ ...s, settings: next }));
    unlockAudio(); // toggling settings is a gesture — good time to unlock audio
  }, []);

  // ---- focus session ----
  const requestNotif = () => {
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
      }
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
      setSession({
        gen: 1,
        itemId: item ? item.id : null,
        totalMs,
        endAt: Date.now() + totalMs,
        paused: false,
        remainingWhenPaused: totalMs,
        checked: 0,
      });
      setOverlay({ kind: 'none', editItemId: null });
      setRoute('focus');
    },
    [settings.defaultFocusMin]
  );

  const onStart = useCallback((item, durationMin) => startSession(item, durationMin), [startSession]);

  const onPause = useCallback(
    () => setSession((s) => (s ? { ...s, paused: true, remainingWhenPaused: Math.max(0, s.endAt - Date.now()) } : s)),
    []
  );
  const onResume = useCallback(() => {
    unlockAudio();
    setSession((s) => (s ? { ...s, paused: false, endAt: Date.now() + s.remainingWhenPaused } : s));
  }, []);
  const onAddTime = useCallback((min) => {
    setSession((s) => {
      if (!s) return s;
      const add = min * 60000;
      const base = s.paused ? Date.now() + s.remainingWhenPaused : s.endAt;
      return { ...s, totalMs: s.totalMs + add, endAt: base + add, paused: false, remainingWhenPaused: s.remainingWhenPaused + add };
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
  const editItem = overlay.kind === 'edit' ? items.find((it) => it.id === overlay.editItemId) || null : null;
  const nextAfterFocus = useMemo(() => {
    if (zones.now && (!focusItem || zones.now.id !== focusItem.id)) return zones.now;
    return zones.next[0] || null;
  }, [zones, focusItem]);

  return (
    <>
      {route === 'home' && (
        <Home
          zones={zones}
          progress={progress}
          banner={banner}
          settings={settings}
          nowMs={nowMs}
          handlers={{ onCapture, onOpenEdit, onOpenSettings, onStart, onComplete, onToggleSubtask, onMoveToday, onSnooze }}
        />
      )}

      {route === 'focus' && session && (
        <FocusMode
          key={session.gen}
          session={session}
          item={focusItem}
          settings={settings}
          onPause={onPause}
          onResume={onResume}
          onAddTime={onAddTime}
          onEnd={onEndFocus}
          onElapsed={onElapsed}
          onToggleSubtask={onToggleSubtask}
        />
      )}

      {overlay.kind === 'snapshot' && session && (
        <SnapshotModal
          session={session}
          item={focusItem}
          nextItem={nextAfterFocus}
          onKeepGoing={onKeepGoing}
          onBreak={onBreak}
          onDone={onDoneFocus}
          reduced={settings.motion === 'reduced'}
        />
      )}

      <EditSheet open={overlay.kind === 'edit'} item={editItem} onClose={closeOverlay} onSave={onSaveEdit} onDelete={onDelete} />
      <SettingsSheet open={overlay.kind === 'settings'} settings={settings} onClose={closeOverlay} onChange={onChangeSettings} />

      <Toast message={toast} />
    </>
  );
}
