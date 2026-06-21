// App shell: sticky header with the Today/Calendar toggle, progress, and settings.
import { Clock, Settings, ListTodo, CalendarDays } from 'lucide-react';
import { FOCUS_RING, usePopOnIncrease } from './ui';

function Segmented({ view, onView }) {
  const tabs = [
    { k: 'today', label: 'Today', Icon: ListTodo },
    { k: 'calendar', label: 'Calendar', Icon: CalendarDays },
  ];
  return (
    <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
      {tabs.map(({ k, label, Icon }) => (
        <button
          key={k}
          onClick={() => onView(k)}
          aria-pressed={view === k}
          className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg ${FOCUS_RING} ${
            view === k ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-50 shadow-sm' : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          <Icon size={15} /> {label}
        </button>
      ))}
    </div>
  );
}

export default function Shell({ view, onView, progress, banner, onOpenSettings, reduced, syncState, children }) {
  const pop = usePopOnIncrease(progress.doneToday, reduced);
  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-20 bg-gray-50/80 dark:bg-gray-950/80 backdrop-blur-md">
        <div className="max-w-[600px] mx-auto px-4 pt-3.5 pb-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-50 flex items-center gap-2">
              <Clock size={20} className="text-indigo-600 dark:text-indigo-400" />
              Skafld
            </h1>
            <div className="flex items-center gap-1.5">
              {syncState === 'offline' && (
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300" role="status" title="Saved on this device; will sync when you’re back online">
                  Offline
                </span>
              )}
              <span
                className={`text-sm font-medium text-emerald-700 dark:text-emerald-300 ${pop ? 'fs-pop' : ''}`}
                title={progress.bestDay ? `Best day: ${progress.bestDay}` : undefined}
              >
                {progress.doneToday} done
              </span>
              <button
                onClick={onOpenSettings}
                aria-label="Settings"
                className={`p-2 -mr-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg ${FOCUS_RING}`}
              >
                <Settings size={20} />
              </button>
            </div>
          </div>
          <div className="mt-2.5">
            <Segmented view={view} onView={onView} />
          </div>
          {view === 'today' && <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{banner}</p>}
        </div>
      </header>
      <main className="max-w-[600px] mx-auto px-4 pb-20 pt-3">{children}</main>
    </div>
  );
}
