// iOS-style bottom tab bar: 3 destinations + a prominent center Add (capture) button.
// Material/blur is reserved for this floating chrome, never content rows.
import { ListTodo, CalendarDays, CircleCheck, Plus } from 'lucide-react';
import { FOCUS_RING } from './ui';

const TABS = [
  { k: 'today', label: 'Today', Icon: ListTodo },
  { k: 'calendar', label: 'Calendar', Icon: CalendarDays },
  { k: 'done', label: 'Done', Icon: CircleCheck },
];

function Tab({ tab, view, onView }) {
  const active = view === tab.k;
  const { Icon, label } = tab;
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={() => onView(tab.k)}
      className={`flex flex-col items-center justify-center min-h-[52px] gap-0.5 ${FOCUS_RING} ${
        active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'
      }`}
    >
      <Icon size={24} strokeWidth={active ? 2.4 : 2} />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

export default function TabBar({ view, onView, onAdd }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 bg-white/75 dark:bg-gray-950/75 backdrop-blur-xl backdrop-saturate-150 border-t border-black/5 dark:border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-[600px] mx-auto grid grid-cols-4 px-2">
        <Tab tab={TABS[0]} view={view} onView={onView} />
        <Tab tab={TABS[1]} view={view} onView={onView} />
        <button onClick={onAdd} aria-label="Capture" className={`flex flex-col items-center justify-start pt-1.5 gap-0.5 ${FOCUS_RING}`}>
          <span className="w-12 h-12 -mt-4 rounded-full bg-indigo-600 text-white grid place-items-center shadow-lg shadow-indigo-600/30">
            <Plus size={26} />
          </span>
          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">Add</span>
        </button>
        <Tab tab={TABS[2]} view={view} onView={onView} />
      </div>
    </nav>
  );
}
