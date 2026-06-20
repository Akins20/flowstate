// Shared hooks: one app-wide clock, the reward primitive, and the corrected alarm engine.
import { useState, useEffect, useRef, useMemo } from 'react';
import { itemMs, loadFired, saveFired } from './lib';
import { playChime, playSoftBeep, playAlarm, vibrate, fireConfetti, unlockAudio } from './audio';

// A single shared "now" tick for the banner, countdown chips, and past-time detection.
export function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// Central reward primitive — reads settings before making any sound/motion.
// `reduced` is the effective reduced-motion (in-app setting OR OS preference).
export function useReward(settings, reduced) {
  return useMemo(() => {
    return {
      // any subtask / small check
      tick() {
        if (settings.sound) playChime(settings.salience);
        if (settings.vibration) vibrate(25);
      },
      // a whole task or a focus session finished
      complete() {
        if (settings.sound) playChime(settings.salience);
        if (settings.vibration) vibrate([25, 40, 60]);
        if (!reduced) fireConfetti();
      },
      // sorting an inbox item (assigning type/time)
      sorted() {
        if (settings.sound) playChime(settings.salience);
      },
    };
  }, [settings.sound, settings.vibration, settings.salience, reduced]);
}

function notify(item, kind) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const title =
        kind === 'pre'
          ? `Heads up — “${item.title}” soon`
          : `Now: ${item.title}`;
      new Notification(title, { body: kind === 'pre' ? 'Want to wrap up first?' : undefined });
    }
  } catch {
    /* notifications best-effort */
  }
}

// The corrected reminder engine. Replaces the old 60s exact-string match (which silently
// missed fires by up to a minute and double-fired under StrictMode).
//  - ticks every 15s
//  - evaluates on-time AND lead-time pre-alarm windows
//  - per-item per-trigger "last fired" guard so nothing fires twice
//  - 90s window so a stale item from hours ago never alarms on page load
export function useAlarmEngine(items, settings) {
  // Persisted { key -> firedAt } so a reload within the window doesn't re-fire.
  const firedRef = useRef(null);
  if (firedRef.current === null) firedRef.current = loadFired();
  // Keep the latest items/settings without re-subscribing the interval each render.
  const ref = useRef({ items, settings });
  ref.current = { items, settings };

  useEffect(() => {
    function fireIfDue(item, kind, triggerMs, schedMs, now) {
      const key = `${item.id}:${kind}:${schedMs}`;
      if (firedRef.current[key]) return;
      if (now >= triggerMs && now < triggerMs + 90000) {
        firedRef.current[key] = now;
        saveFired(firedRef.current);
        const s = ref.current.settings;
        if (s.sound) (kind === 'on' ? playAlarm : playSoftBeep)(s.salience);
        if (s.vibration) vibrate(kind === 'on' ? [120, 60, 120] : [80]);
        notify(item, kind === 'pre' ? 'pre' : 'on');
      }
    }

    function check() {
      const now = Date.now();
      for (const item of ref.current.items) {
        // Notes are reference, not reminders; tombstones/done don't alarm.
        if (item.completed || item.deleted || item.type === 'note') continue;
        const sched = itemMs(item);
        if (sched == null) continue;
        fireIfDue(item, 'on', sched, sched, now);
        if (item.preAlarmMin) {
          fireIfDue(item, 'pre', sched - item.preAlarmMin * 60000, sched, now);
        }
      }
    }

    const id = setInterval(check, 15000);
    check();
    return () => clearInterval(id);
  }, []); // one stable interval for the app's lifetime
}

export { unlockAudio };
