// Bottom sheets: EditSheet (all categorization lives here) and SettingsSheet.
import { useState } from 'react';
import { Trash2, Plus, X } from 'lucide-react';
import { TYPE_META, TYPE_ORDER, PRE_ALARM_OPTIONS, FOCUS_PRESETS, uid } from './lib';
import { BottomSheet, FOCUS_RING } from './ui';

const fieldCls = `w-full text-base text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2.5 ${FOCUS_RING}`;
const labelCls = 'text-sm font-medium text-gray-700 dark:text-gray-300';

export function EditSheet({ open, item, onClose, onSave, onDelete }) {
  if (!open || !item) return null;
  return <EditForm key={item.id} item={item} onClose={onClose} onSave={onSave} onDelete={onDelete} />;
}

function EditForm({ item, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState(() => ({ ...item, subtasks: item.subtasks.map((s) => ({ ...s })) }));
  const [newSub, setNewSub] = useState('');

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const addSub = () => {
    const t = newSub.trim();
    if (!t) return;
    set({ subtasks: [...draft.subtasks, { id: uid(), text: t, done: false }] });
    setNewSub('');
  };
  const updateSub = (id, patch) => set({ subtasks: draft.subtasks.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const removeSub = (id) => set({ subtasks: draft.subtasks.filter((s) => s.id !== id) });

  const save = () => onSave({ ...draft, title: draft.title.trim() || item.title });

  return (
    <BottomSheet open title="Edit" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Title</label>
          <input value={draft.title} onChange={(e) => set({ title: e.target.value })} className={`${fieldCls} mt-1`} placeholder="What is it?" />
        </div>

        <div>
          <label className={labelCls}>Type</label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {TYPE_ORDER.map((t) => {
              const meta = TYPE_META[t];
              const Icon = meta.Icon;
              const active = draft.type === t;
              return (
                <button
                  key={t}
                  onClick={() => set({ type: active ? null : t })}
                  className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg ${FOCUS_RING} ${
                    active ? `${meta.tintBg} ${meta.tintText}` : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon size={16} /> {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" value={draft.date || ''} onChange={(e) => set({ date: e.target.value || null })} className={`${fieldCls} mt-1`} />
          </div>
          <div>
            <label className={labelCls}>Time</label>
            <input type="time" value={draft.time || ''} onChange={(e) => set({ time: e.target.value || null })} className={`${fieldCls} mt-1`} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Early heads-up</label>
          <select
            value={draft.preAlarmMin ?? ''}
            onChange={(e) => set({ preAlarmMin: e.target.value === '' ? null : Number(e.target.value) })}
            className={`${fieldCls} mt-1`}
          >
            {PRE_ALARM_OPTIONS.map((o) => (
              <option key={String(o.value)} value={o.value ?? ''}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Steps</label>
          <div className="space-y-2 mt-1.5">
            {draft.subtasks.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <button
                  onClick={() => updateSub(s.id, { done: !s.done })}
                  aria-label={s.done ? 'Uncheck step' : 'Check step'}
                  className={`w-6 h-6 shrink-0 grid place-items-center rounded-md border-2 ${FOCUS_RING} ${
                    s.done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                <input
                  value={s.text}
                  onChange={(e) => updateSub(s.id, { text: e.target.value })}
                  className={`flex-1 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg px-2.5 py-2 ${FOCUS_RING} ${
                    s.done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'
                  }`}
                />
                <button onClick={() => removeSub(s.id)} aria-label="Remove step" className={`p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 rounded-lg ${FOCUS_RING}`}>
                  <X size={16} />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSub())}
                placeholder="Break it into one tiny step…"
                className={`flex-1 text-sm text-gray-900 dark:text-gray-100 bg-transparent border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-2 ${FOCUS_RING}`}
              />
              <button onClick={addSub} aria-label="Add step" className={`p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg ${FOCUS_RING}`}>
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">Reminders fire while this tab is open — keep FlowState open during focus.</p>

        <div className="flex items-center gap-2 pt-1">
          <button onClick={save} className={`flex-1 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-3 rounded-xl ${FOCUS_RING}`}>
            Save
          </button>
          <button
            onClick={() => onDelete(item.id)}
            aria-label="Delete"
            className={`inline-flex items-center justify-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 px-4 py-3 rounded-xl ${FOCUS_RING}`}
          >
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 py-3 cursor-pointer">
      <span>
        <span className="block text-base text-gray-800 dark:text-gray-100">{label}</span>
        {hint && <span className="block text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${FOCUS_RING} ${checked ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'}`}
      >
        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  );
}

function ChipRow({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`text-sm font-medium px-3 py-1.5 rounded-lg ${FOCUS_RING} ${
            value === o.value
              ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsSheet({ open, settings, onClose, onChange }) {
  const set = (patch) => onChange({ ...settings, ...patch });
  return (
    <BottomSheet open={open} title="Settings" onClose={onClose}>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        <div className="py-3">
          <span className="block text-base text-gray-800 dark:text-gray-100">Theme</span>
          <ChipRow
            value={settings.theme}
            onChange={(v) => set({ theme: v })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
        <Toggle label="Sound" hint="Gentle chimes & alarms" checked={settings.sound} onChange={(v) => set({ sound: v })} />
        <Toggle label="Vibration" hint="Buzz on mobile (while tab is open)" checked={settings.vibration} onChange={(v) => set({ vibration: v })} />
        <Toggle
          label="Reduced motion"
          hint="Stepped timer, no confetti"
          checked={settings.motion === 'reduced'}
          onChange={(v) => set({ motion: v ? 'reduced' : 'full' })}
        />
        <div className="py-3">
          <span className="block text-base text-gray-800 dark:text-gray-100">Salience</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">How loud should the good moments feel?</span>
          <ChipRow
            value={settings.salience}
            onChange={(v) => set({ salience: v })}
            options={[
              { value: 'less', label: 'Calmer' },
              { value: 'normal', label: 'Normal' },
              { value: 'more', label: 'More' },
            ]}
          />
        </div>
        <div className="py-3">
          <span className="block text-base text-gray-800 dark:text-gray-100">Default focus length</span>
          <ChipRow
            value={settings.defaultFocusMin}
            onChange={(v) => set({ defaultFocusMin: v })}
            options={FOCUS_PRESETS.map((m) => ({ value: m, label: `${m} min` }))}
          />
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">Alarms and buzzes work while this tab is open.</p>
    </BottomSheet>
  );
}
