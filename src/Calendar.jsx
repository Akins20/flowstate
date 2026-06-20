// TimeTree-style calendar: month grid + agenda, sharing the app's item model.
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, CalendarDays, List } from 'lucide-react';
import { todayStr, formatTime, formatDateShort, nowLabel } from './lib';
import { TypeIcon, CompleteButton, FOCUS_RING } from './ui';

const DOT = {
  call: 'bg-sky-500',
  email: 'bg-violet-500',
  form: 'bg-teal-500',
  note: 'bg-amber-500',
  task: 'bg-indigo-500',
};
const dotFor = (type) => DOT[type] || 'bg-gray-400';
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function groupByDate(items) {
  const map = new Map();
  for (const it of items) {
    if (!it.date || it.deleted) continue;
    if (!map.has(it.date)) map.set(it.date, []);
    map.get(it.date).push(it);
  }
  for (const list of map.values()) list.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  return map;
}

function MonthGrid({ items, onOpenEdit, onAddOnDate, onComplete }) {
  const today = todayStr();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { y, m: m - 1 }; // m 0-based
  });
  const [selected, setSelected] = useState(today);

  const byDate = useMemo(() => groupByDate(items), [items]);

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const start = new Date(cursor.y, cursor.m, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [cursor]);

  const step = (delta) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const goToday = () => {
    const [y, m] = today.split('-').map(Number);
    setCursor({ y, m: m - 1 });
    setSelected(today);
  };

  const selectedItems = (byDate.get(selected) || []).filter((i) => !i.completed);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          {MONTHS[cursor.m]} {cursor.y}
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={goToday} className={`text-sm font-medium text-indigo-700 dark:text-indigo-300 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 ${FOCUS_RING}`}>Today</button>
          <button onClick={() => step(-1)} aria-label="Previous month" className={`p-2 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 ${FOCUS_RING}`}><ChevronLeft size={18} /></button>
          <button onClick={() => step(1)} aria-label="Next month" className={`p-2 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 ${FOCUS_RING}`}><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const ds = todayStr(d);
          const inMonth = d.getMonth() === cursor.m;
          const isToday = ds === today;
          const isSel = ds === selected;
          const dayItems = (byDate.get(ds) || []).filter((i) => !i.completed);
          return (
            <button
              key={ds}
              onClick={() => setSelected(ds)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-start pt-1.5 gap-1 ${FOCUS_RING} ${
                isSel ? 'bg-indigo-50 dark:bg-indigo-500/15 ring-1 ring-indigo-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <span
                className={`text-sm grid place-items-center w-7 h-7 rounded-full ${
                  isToday ? 'bg-indigo-600 text-white font-semibold' : inMonth ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600'
                }`}
              >
                {d.getDate()}
              </span>
              <span className="flex gap-0.5 h-1.5">
                {dayItems.slice(0, 4).map((it) => (
                  <span key={it.id} className={`w-1.5 h-1.5 rounded-full ${dotFor(it.type)}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected-day agenda */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">{formatDateShort(selected)}</h3>
          <button
            onClick={() => onAddOnDate(selected)}
            className={`inline-flex items-center gap-1 text-sm font-medium text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 ${FOCUS_RING}`}
          >
            <Plus size={15} /> Add
          </button>
        </div>
        {selectedItems.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">Nothing scheduled. Tap “Add” to put something here.</p>
        ) : (
          <div className="space-y-1.5">
            {selectedItems.map((it) => (
              <EventRow key={it.id} item={it} onOpenEdit={onOpenEdit} onComplete={onComplete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventRow({ item, onOpenEdit, onComplete }) {
  return (
    <div className="flex items-center gap-2.5 bg-white dark:bg-gray-900 rounded-xl px-2 py-1.5">
      {onComplete && item.type !== 'note' && (
        <CompleteButton checked={false} onClick={() => onComplete(item)} label={`Done: ${item.title}`} />
      )}
      <button onClick={() => onOpenEdit(item)} className={`flex-1 min-w-0 flex items-center gap-2.5 text-left rounded-lg ${FOCUS_RING}`}>
        <TypeIcon type={item.type} size={16} />
        <span className="flex-1 min-w-0 truncate text-gray-800 dark:text-gray-100">{nowLabel(item)}</span>
      </button>
      {item.time && <span className="text-xs font-medium text-gray-500 dark:text-gray-400 tnums shrink-0 pr-1">{formatTime(item.time)}</span>}
    </div>
  );
}

function Agenda({ items, onOpenEdit, onComplete }) {
  const today = todayStr();
  const grouped = useMemo(() => {
    // date-only items belong here too (they show on the month grid); not just date+time.
    const scheduled = items.filter((i) => i.date && !i.deleted && !i.completed && i.date >= today);
    const map = groupByDate(scheduled);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items, today]);

  if (grouped.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 py-10 text-center">Nothing on the calendar yet.</p>;
  }
  return (
    <div className="space-y-5">
      {grouped.map(([date, list]) => (
        <div key={date}>
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{formatDateShort(date)}</h3>
          <div className="space-y-1.5">
            {list.map((it) => (
              <EventRow key={it.id} item={it} onOpenEdit={onOpenEdit} onComplete={onComplete} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Calendar({ items, onOpenEdit, onAddOnDate, onComplete }) {
  const [mode, setMode] = useState('month'); // 'month' | 'agenda'
  return (
    <div>
      <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mb-4">
        {[
          { k: 'month', label: 'Month', Icon: CalendarDays },
          { k: 'agenda', label: 'Agenda', Icon: List },
        ].map(({ k, label, Icon }) => (
          <button
            key={k}
            onClick={() => setMode(k)}
            className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg ${FOCUS_RING} ${
              mode === k ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-50 shadow-sm' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      {mode === 'month' ? (
        <MonthGrid items={items} onOpenEdit={onOpenEdit} onAddOnDate={onAddOnDate} onComplete={onComplete} />
      ) : (
        <Agenda items={items} onOpenEdit={onOpenEdit} onComplete={onComplete} />
      )}
    </div>
  );
}
