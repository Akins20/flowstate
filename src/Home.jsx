// The "Today" body: QuickCapture, Inbox, Now / Next / Later.
// The header/shell (title, Today/Calendar toggle, settings) lives in Shell.jsx.
import { useState } from 'react';
import { Play, Plus, ChevronRight, ChevronDown, CalendarPlus, AlarmClockOff } from 'lucide-react';
import {
  isPast,
  inLabel,
  formatTime,
  formatDateShort,
  firstUnchecked,
  subtaskProgress,
  nowLabel,
  isActionable,
  FOCUS_PRESETS,
} from './lib';
import { TypeIcon, CompleteButton, FOCUS_RING } from './ui';

const sectionLabel = 'text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2';

function QuickCapture({ onCapture }) {
  const [text, setText] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onCapture(t);
    setText('');
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-1.5 bg-white dark:bg-gray-900 rounded-2xl shadow-sm px-3 py-1.5">
      <Plus size={18} className="text-gray-400 dark:text-gray-500 shrink-0" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Brain dump — type it, hit enter, sort it later"
        aria-label="Quick capture"
        className={`flex-1 min-w-0 text-base bg-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100 px-1 py-2.5 rounded-lg ${FOCUS_RING}`}
      />
      {text.trim() && (
        <button
          type="submit"
          className={`shrink-0 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-xl ${FOCUS_RING}`}
        >
          Add
        </button>
      )}
    </form>
  );
}

function StillHere({ item, onMoveToday, onSnooze }) {
  return (
    <div className="mt-2">
      <p className="text-sm text-amber-700 dark:text-amber-300">Still here whenever you’re ready — was set for {formatTime(item.time)}.</p>
      <div className="flex flex-wrap gap-2 mt-2">
        <button
          onClick={() => onMoveToday(item)}
          className={`inline-flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-200 bg-amber-100/80 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 px-3 py-2 rounded-lg ${FOCUS_RING}`}
        >
          <CalendarPlus size={15} /> Move to today
        </button>
        <button
          onClick={() => onSnooze(item)}
          className={`inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 px-3 py-2 rounded-lg ${FOCUS_RING}`}
        >
          <AlarmClockOff size={15} /> Snooze 1h
        </button>
      </div>
    </div>
  );
}

function Inbox({ items, onOpenEdit, onComplete, reduced }) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const shown = expanded ? items : items.slice(0, 5);
  return (
    <section className="mt-6">
      <h2 className={sectionLabel}>Inbox · {items.length}</h2>
      <div className="space-y-1.5">
        {shown.map((item) => (
          <div key={item.id} className="flex items-center gap-2.5 bg-white dark:bg-gray-900 rounded-xl pl-2 pr-2.5 py-1.5">
            <CompleteButton checked={false} onClick={() => onComplete(item)} reduced={reduced} label={`Done: ${item.title}`} />
            <button onClick={() => onOpenEdit(item)} className={`flex-1 min-w-0 flex items-center gap-2.5 text-left rounded-lg py-1 ${FOCUS_RING}`}>
              <TypeIcon type={item.type} size={16} />
              <span className="truncate text-gray-800 dark:text-gray-100">{item.title}</span>
            </button>
            <button
              onClick={() => onOpenEdit(item)}
              className={`shrink-0 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 px-2.5 py-1.5 rounded-lg ${FOCUS_RING}`}
            >
              Sort
            </button>
          </div>
        ))}
      </div>
      {items.length > 5 && (
        <button onClick={() => setExpanded((v) => !v)} className={`mt-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded ${FOCUS_RING}`}>
          {expanded ? 'Show less' : `and ${items.length - 5} more`}
        </button>
      )}
    </section>
  );
}

// "in X" from the item's own timestamp.
function nowMsFor(item) {
  const [y, m, d] = item.date.split('-').map(Number);
  const [hh, mm] = item.time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();
}

function NowCard({ item, nowMs, settings, onStart, onComplete, onToggleSubtask, onOpenEdit, onMoveToday, onSnooze, reduced }) {
  const [showPresets, setShowPresets] = useState(false);
  if (!item) {
    return (
      <section className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-2">Now</p>
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm px-5 py-8 text-center">
          <p className="text-gray-800 dark:text-gray-100 font-medium">Clear deck.</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Capture one thing — you can sort it out later.</p>
        </div>
      </section>
    );
  }

  const past = isPast(item, nowMs);
  const sub = firstUnchecked(item);
  const { done, total } = subtaskProgress(item);
  const actionable = isActionable(item);
  const primaryLabel = sub ? `Just start: ${sub.text}` : 'Start 5 min';
  const primaryDuration = sub ? settings.defaultFocusMin : 5;

  return (
    <section className="mt-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-2">Now</p>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm ring-1 ring-indigo-500/15 dark:ring-indigo-400/20 p-5">
        <div className="flex items-start gap-3">
          <TypeIcon type={item.type} size={22} />
          <button onClick={() => onOpenEdit(item)} className={`flex-1 min-w-0 text-left rounded-lg ${FOCUS_RING}`}>
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 leading-snug">{nowLabel(item)}</h3>
            {nowLabel(item) !== item.title && <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 truncate">{item.title}</p>}
          </button>
          <CompleteButton checked={false} onClick={() => onComplete(item)} reduced={reduced} label={`Done: ${item.title}`} />
        </div>

        {past ? (
          <StillHere item={item} onMoveToday={onMoveToday} onSnooze={onSnooze} />
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {formatDateShort(item.date)} · {formatTime(item.time)} · {inLabel(nowMsFor(item), nowMs)}
          </p>
        )}

        {total > 0 && (
          <button
            onClick={() => sub && onToggleSubtask(item, sub.id)}
            className={`mt-3 w-full flex items-center gap-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2.5 text-left ${FOCUS_RING}`}
          >
            <span className="w-6 h-6 shrink-0 grid place-items-center rounded-md border-2 border-gray-300 dark:border-gray-600" aria-hidden />
            <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{sub ? sub.text : 'All steps done'}</span>
            <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 tnums shrink-0">{done}/{total}</span>
          </button>
        )}

        {actionable && (
          <div className="mt-4">
            <button
              onClick={() => onStart(item, primaryDuration)}
              className={`w-full text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-3.5 rounded-xl flex items-center justify-center gap-2 ${FOCUS_RING}`}
            >
              <Play size={18} /> <span className="truncate">{primaryLabel}</span>
            </button>
            <button onClick={() => setShowPresets((v) => !v)} className={`mt-1.5 w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 py-2 rounded-lg ${FOCUS_RING}`}>
              Start full focus
            </button>
            {showPresets && (
              <div className="mt-1 flex flex-wrap gap-2 justify-center fs-fade">
                {FOCUS_PRESETS.map((m) => (
                  <button
                    key={m}
                    onClick={() => onStart(item, m)}
                    className={`text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-3.5 py-2 rounded-lg ${FOCUS_RING}`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ItemRow({ item, nowMs, onOpenEdit, onComplete, onStart, onMoveToday, onSnooze, reduced }) {
  const past = isPast(item, nowMs);
  const actionable = isActionable(item);
  return (
    <div className={`rounded-xl px-2 py-1.5 ${past ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-white dark:bg-gray-900'}`}>
      <div className="flex items-center gap-2.5">
        <CompleteButton checked={false} onClick={() => onComplete(item)} reduced={reduced} label={`Done: ${item.title}`} />
        <button onClick={() => onOpenEdit(item)} className={`flex-1 min-w-0 flex items-center gap-2.5 text-left rounded-lg ${FOCUS_RING}`}>
          <TypeIcon type={item.type} size={16} />
          <span className="truncate text-gray-800 dark:text-gray-100">{nowLabel(item)}</span>
        </button>
        {past ? (
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300 shrink-0 pr-1">Still here</span>
        ) : (
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 tnums shrink-0 pr-1">{inLabel(nowMsFor(item), nowMs)}</span>
        )}
        {actionable && !past && (
          <button onClick={() => onStart(item)} aria-label={`Focus on ${item.title}`} className={`shrink-0 p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg ${FOCUS_RING}`}>
            <Play size={16} />
          </button>
        )}
      </div>
      {past && (
        <div className="pl-[2.6rem] pb-1">
          <StillHere item={item} onMoveToday={onMoveToday} onSnooze={onSnooze} />
        </div>
      )}
    </div>
  );
}

function NextList({ items, ...rest }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className={sectionLabel}>Next</h2>
      <div className="space-y-1.5">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} {...rest} />
        ))}
      </div>
    </section>
  );
}

function LaterDisclosure({ items, ...rest }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <section className="mt-6">
      <button onClick={() => setOpen((v) => !v)} className={`flex items-center gap-1.5 ${sectionLabel} mb-0 hover:text-gray-900 dark:hover:text-gray-100 rounded ${FOCUS_RING}`}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Later · {items.length}
      </button>
      {open && (
        <div className="space-y-1.5 mt-2 fs-fade">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} {...rest} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function Home({ zones, settings, reduced, handlers, nowMs }) {
  const rowHandlers = {
    nowMs,
    onOpenEdit: handlers.onOpenEdit,
    onComplete: handlers.onComplete,
    onStart: handlers.onStart,
    onMoveToday: handlers.onMoveToday,
    onSnooze: handlers.onSnooze,
    reduced,
  };
  return (
    <>
      <QuickCapture onCapture={handlers.onCapture} />
      <Inbox items={zones.inbox} onOpenEdit={handlers.onOpenEdit} onComplete={handlers.onComplete} reduced={reduced} />
      <NowCard
        item={zones.now}
        nowMs={nowMs}
        settings={settings}
        onStart={handlers.onStart}
        onComplete={handlers.onComplete}
        onToggleSubtask={handlers.onToggleSubtask}
        onOpenEdit={handlers.onOpenEdit}
        onMoveToday={handlers.onMoveToday}
        onSnooze={handlers.onSnooze}
        reduced={reduced}
      />
      <NextList items={zones.next} {...rowHandlers} />
      <LaterDisclosure items={zones.later} {...rowHandlers} />
    </>
  );
}
