// App shell: iOS large-title header + bottom tab bar (nav lives in the tab bar now).
import { Settings } from 'lucide-react';
import { FOCUS_RING, usePopOnIncrease } from './ui';
import TabBar from './TabBar';

const TITLES = { today: 'Today', calendar: 'Calendar', done: 'Done' };

export default function Shell({ view, onView, onAdd, progress, banner, onOpenSettings, reduced, syncState, children }) {
  const pop = usePopOnIncrease(progress.doneToday, reduced);
  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-20 bg-gray-50/80 dark:bg-gray-950/80 backdrop-blur-md">
        <div className="max-w-[600px] mx-auto px-4 pt-3 pb-2">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-[34px] leading-tight font-bold tracking-tight text-gray-900 dark:text-gray-50">{TITLES[view] || 'Today'}</h1>
            <div className="flex items-center gap-1.5 pt-2.5">
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
          {view === 'today' && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{banner}</p>}
        </div>
      </header>

      <main className="max-w-[600px] mx-auto px-4 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 84px)' }}>
        {children}
      </main>

      <TabBar view={view} onView={onView} onAdd={onAdd} />
    </div>
  );
}
