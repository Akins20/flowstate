// The calm "Done" tab — relocates the existing counters, no charts/streaks/shame.
export default function DoneView({ doneToday, bestDay }) {
  return (
    <div className="mt-12 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Done today</p>
      <p className="text-[72px] leading-none font-bold text-emerald-600 dark:text-emerald-400 tnums mt-3">{doneToday}</p>
      <p className="text-gray-600 dark:text-gray-400 mt-4">
        {doneToday === 0 ? 'A fresh start — finish one small thing.' : 'That counts. Nice work today.'}
      </p>
      {bestDay > 0 && <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Best day so far: {bestDay}.</p>}
    </div>
  );
}
