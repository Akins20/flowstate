// Full-screen Focus Mode: shrinking-arc timer, 2-min wrap-up, alarm + vibration, end Snapshot.
import { useState, useEffect, useRef } from 'react';
import { Pause, Play, Plus, Square, Check, Coffee, ArrowRight } from 'lucide-react';
import { mmss, firstUnchecked, snapshotHeadline } from './lib';
import { playSoftBeep, playAlarm, vibrate } from './audio';
import { FOCUS_RING } from './ui';

const WRAP_MS = 120000; // 2-minute wrap-up window

function TimerArc({ remainingMs, totalMs, reduced, label, sub }) {
  const r = 120;
  const sw = 16;
  const C = 2 * Math.PI * r;
  let frac = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  if (reduced) frac = Math.ceil(frac * 12) / 12; // discrete stepped depletion
  const offset = C * (1 - frac);
  return (
    <div className="relative w-[clamp(220px,72vw,280px)] aspect-square">
      <svg viewBox="0 0 280 280" className="w-full h-full" aria-hidden>
        <defs>
          <linearGradient id="fsArc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <circle cx="140" cy="140" r={r} fill="none" stroke="var(--fs-track)" strokeWidth={sw} />
        <circle
          cx="140"
          cy="140"
          r={r}
          fill="none"
          stroke="url(#fsArc)"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          transform="rotate(-90 140 140)"
          style={{ transition: reduced ? 'none' : 'stroke-dashoffset 0.3s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[clamp(2.75rem,13vw,3.75rem)] font-semibold tnums text-gray-900 dark:text-gray-50">{label}</div>
        {sub && <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 px-6 text-center">{sub}</div>}
      </div>
    </div>
  );
}

export function FocusMode({ session, item, settings, onPause, onResume, onAddTime, onEnd, onElapsed, onToggleSubtask }) {
  const reduced = settings.motion === 'reduced';
  const [now, setNow] = useState(() => Date.now());
  const wrapBeeped = useRef(false);
  const elapsedFired = useRef(false);

  const remaining = session.paused ? session.remainingWhenPaused : session.endAt - now;
  const inWrap = remaining > 0 && remaining <= WRAP_MS;

  useEffect(() => {
    if (session.paused) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [session.paused, session.endAt]);

  useEffect(() => {
    if (inWrap && !wrapBeeped.current) {
      wrapBeeped.current = true;
      if (settings.sound) playSoftBeep(settings.salience);
      if (settings.vibration) vibrate(60);
    }
    if (remaining > WRAP_MS) wrapBeeped.current = false;
  }, [inWrap, remaining, settings]);

  useEffect(() => {
    if (!session.paused && remaining <= 0 && !elapsedFired.current) {
      elapsedFired.current = true;
      if (settings.sound) playAlarm(settings.salience);
      if (settings.vibration) vibrate([120, 80, 120, 80, 200]);
      onElapsed();
    }
  }, [remaining, session.paused, settings, onElapsed]);

  const sub = item ? firstUnchecked(item) : null;

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-gray-950 flex flex-col">
      <div className="max-w-[600px] w-full mx-auto px-5 py-5 flex-1 flex flex-col">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
            Focus is live in this tab
          </span>
          <button
            onClick={onEnd}
            className={`text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${FOCUS_RING}`}
          >
            <Square size={15} /> End
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-7 py-6">
          <TimerArc
            remainingMs={Math.max(0, remaining)}
            totalMs={session.totalMs}
            reduced={reduced}
            label={mmss(Math.max(0, remaining))}
            sub={inWrap ? 'Wrapping up — good spot to pause?' : null}
          />

          <div className="text-center max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Focusing on</p>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mt-1">{item ? item.title : 'Break'}</h2>
          </div>

          {sub && (
            <button
              onClick={() => onToggleSubtask(item, sub.id)}
              className={`flex items-center gap-3 bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl px-4 py-3 max-w-sm w-full ${FOCUS_RING}`}
            >
              <span className="w-6 h-6 shrink-0 grid place-items-center rounded-md border-2 border-gray-300 dark:border-gray-600 text-transparent">
                <Check size={14} strokeWidth={3} />
              </span>
              <span className="text-left text-gray-700 dark:text-gray-200">{sub.text}</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 pb-2">
          {session.paused ? (
            <button
              onClick={onResume}
              className={`flex-1 max-w-[180px] inline-flex items-center justify-center gap-2 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-3.5 rounded-xl ${FOCUS_RING}`}
            >
              <Play size={18} /> Resume
            </button>
          ) : (
            <button
              onClick={onPause}
              className={`flex-1 max-w-[180px] inline-flex items-center justify-center gap-2 text-base font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800 px-4 py-3.5 rounded-xl ${FOCUS_RING}`}
            >
              <Pause size={18} /> Pause
            </button>
          )}
          <button
            onClick={() => onAddTime(10)}
            className={`inline-flex items-center justify-center gap-1.5 text-base font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-4 py-3.5 rounded-xl ${FOCUS_RING}`}
          >
            <Plus size={18} /> 10 min
          </button>
        </div>
      </div>
    </div>
  );
}

export function SnapshotModal({ session, item, nextItem, onKeepGoing, onBreak, onDone }) {
  const minutes = Math.max(1, Math.round(session.totalMs / 60000));
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-gray-900/40 fs-fade" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-xl p-6 fs-sheet"
      >
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
          {snapshotHeadline(item ? item.title : null)} — {minutes} min in.
        </h2>
        <div className="mt-4 space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
          <p>⏱️ Focused for {minutes} minutes.</p>
          {session.checked > 0 && <p>✅ Checked off {session.checked} step{session.checked === 1 ? '' : 's'} this session.</p>}
          {nextItem ? (
            <p className="text-gray-600 dark:text-gray-400">
              Next up: <span className="font-medium text-gray-800 dark:text-gray-100">{nextItem.title}</span>
            </p>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">Nothing else on the clock — nice and clear.</p>
          )}
        </div>
        <div className="mt-6 grid gap-2">
          <button
            onClick={onKeepGoing}
            className={`inline-flex items-center justify-center gap-2 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-3.5 rounded-xl ${FOCUS_RING}`}
          >
            <ArrowRight size={18} /> Keep going (+10 min)
          </button>
          <button
            onClick={onBreak}
            className={`inline-flex items-center justify-center gap-2 text-base font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 px-4 py-3.5 rounded-xl ${FOCUS_RING}`}
          >
            <Coffee size={18} /> Take a 5-min break
          </button>
          <button
            onClick={onDone}
            className={`text-base font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 px-4 py-2.5 rounded-xl ${FOCUS_RING}`}
          >
            I’m done
          </button>
        </div>
      </div>
    </div>
  );
}
