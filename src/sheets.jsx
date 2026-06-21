// Bottom sheets: EditSheet (all categorization lives here) and SettingsSheet.
// iOS grouped-inset style: white cards on the sheet's grouped-gray background.
import { useState, useEffect } from 'react';
import { Trash2, Plus, X, Bell, Copy, Link2, Send } from 'lucide-react';
import { TYPE_META, TYPE_ORDER, PRE_ALARM_OPTIONS, REPEAT_OPTIONS, FOCUS_PRESETS, uid } from './lib';
import { BottomSheet, FOCUS_RING } from './ui';
import { api } from './api';
import { pushSupported, isPushEnabled, enablePush, disablePush } from './push';

const groupCls = 'rounded-2xl bg-white dark:bg-gray-900 overflow-hidden';
const rowCls = 'flex items-center justify-between gap-3 px-4 py-3 min-h-[44px]';
const rowLabelCls = 'text-[15px] text-gray-700 dark:text-gray-300 shrink-0';
const trailCls = `bg-transparent text-[15px] text-gray-600 dark:text-gray-300 text-right outline-none ${FOCUS_RING} rounded`;
const sectionCls = 'text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2';
const noteCls = 'text-xs text-gray-500 dark:text-gray-400 px-1';

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

  const isNote = draft.type === 'note';
  const save = () => onSave({ ...draft, title: draft.title.trim() || item.title });

  return (
    <BottomSheet open title="Edit" onClose={onClose}>
      <div className="space-y-5">
        {/* Title */}
        <div className={groupCls}>
          <div className="px-4 py-3">
            <input
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Title"
              className={`w-full bg-transparent text-[17px] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none ${FOCUS_RING} rounded`}
            />
          </div>
        </div>

        {/* Type */}
        <div className={groupCls}>
          <div className="px-4 py-3">
            <p className={sectionCls}>Type</p>
            <div className="flex flex-wrap gap-2">
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
        </div>

        {/* Scheduling */}
        <div className={`${groupCls} divide-y divide-gray-100 dark:divide-gray-800`}>
          <div className={rowCls}>
            <span className={rowLabelCls}>Date</span>
            <input type="date" value={draft.date || ''} onChange={(e) => set({ date: e.target.value || null })} className={trailCls} />
          </div>
          {!isNote && (
            <div className={rowCls}>
              <span className={rowLabelCls}>Time</span>
              <input type="time" value={draft.time || ''} onChange={(e) => set({ time: e.target.value || null })} className={trailCls} />
            </div>
          )}
          <div className={rowCls}>
            <span className={rowLabelCls}>Repeat</span>
            <select value={draft.repeat ?? ''} onChange={(e) => set({ repeat: e.target.value || null })} className={trailCls}>
              {REPEAT_OPTIONS.map((o) => (
                <option key={String(o.value)} value={o.value ?? ''}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {!isNote && (
            <div className={rowCls}>
              <span className={rowLabelCls}>Early heads-up</span>
              <select value={draft.preAlarmMin ?? ''} onChange={(e) => set({ preAlarmMin: e.target.value === '' ? null : Number(e.target.value) })} className={trailCls}>
                {PRE_ALARM_OPTIONS.map((o) => (
                  <option key={String(o.value)} value={o.value ?? ''}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {isNote && <p className={noteCls}>Notes don’t ring - they just sit on your calendar for reference.</p>}

        {/* Steps */}
        <div className={groupCls}>
          <div className="px-4 py-3">
            <p className={sectionCls}>Steps</p>
            <div className="space-y-2">
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
        </div>

        <p className={noteCls}>Reminders fire while this tab is open - keep Skafld open during focus.</p>

        <div className="flex items-center gap-2">
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
        <span className="block text-[15px] text-gray-800 dark:text-gray-100">{label}</span>
        {hint && <span className="block text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${FOCUS_RING} ${checked ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`}
      >
        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${checked ? 'translate-x-5' : ''}`} />
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

function PushSync({ onLinked, localCount = 0 }) {
  const supported = pushSupported();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [pendingLink, setPendingLink] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    isPushEnabled().then(setEnabled);
  }, []);

  const togglePush = async () => {
    setBusy(true);
    setMsg('');
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
      } else {
        await enablePush();
        setEnabled(true);
        setMsg('Reminders on - they’ll reach you even when Skafld is closed.');
      }
    } catch (e) {
      setMsg(e.message || 'Could not turn on reminders.');
    }
    setBusy(false);
  };

  const sendTest = async () => {
    setBusy(true);
    setMsg('');
    try {
      await api.testPush();
      setMsg('Test sent - check your notifications.');
    } catch {
      setMsg('Test failed - turn reminders on first.');
    }
    setBusy(false);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(api.token);
      setMsg('Sync code copied.');
    } catch {
      setRevealed(true);
    }
  };

  const requestLink = () => {
    const t = code.trim();
    if (t.length < 20) {
      setMsg('That sync code looks too short.');
      return;
    }
    setMsg('');
    setPendingLink(t);
  };
  const confirmLink = () => {
    if (api.setToken(pendingLink)) {
      setPendingLink('');
      setCode('');
      setMsg('Linked - your items here are combined with that space (nothing is replaced).');
      onLinked && onLinked();
    }
  };
  const startFresh = () => {
    api.newToken();
    setMsg('Started a new private space on this device.');
    onLinked && onLinked();
  };

  const masked = api.token.slice(0, 6) + '••••••••' + api.token.slice(-4);

  return (
    <div className="py-3 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <span>
          <span className="flex items-center gap-1.5 text-[15px] text-gray-800 dark:text-gray-100"><Bell size={16} /> Reminders when closed</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">Push notifications so reminders reach you even when the app is shut.</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={!supported || busy}
          onClick={togglePush}
          className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${FOCUS_RING} ${enabled ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'} ${!supported || busy ? 'opacity-50' : ''}`}
        >
          <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${enabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {!supported && <p className="text-xs text-amber-700 dark:text-amber-300">This browser doesn’t support push. Reminders will still fire while the app is open.</p>}

      {enabled && (
        <button onClick={sendTest} disabled={busy} className={`inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-3 py-2 rounded-lg ${FOCUS_RING}`}>
          <Send size={15} /> Send a test
        </button>
      )}

      <div className="pt-1">
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sync code</span>
        <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Use this on another device to share the same items. Keep it private.</span>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate text-sm bg-gray-100 dark:bg-gray-800 rounded-lg px-2.5 py-2 text-gray-700 dark:text-gray-200">{revealed ? api.token : masked}</code>
          <button onClick={() => setRevealed((v) => !v)} className={`text-xs font-medium text-gray-600 dark:text-gray-300 px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 ${FOCUS_RING}`}>{revealed ? 'Hide' : 'Show'}</button>
          <button onClick={copyCode} aria-label="Copy sync code" className={`p-2 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 ${FOCUS_RING}`}><Copy size={16} /></button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste a sync code to link this device"
            className={`flex-1 min-w-0 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg px-2.5 py-2 text-gray-900 dark:text-gray-100 ${FOCUS_RING}`}
          />
          <button onClick={requestLink} className={`inline-flex items-center gap-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg ${FOCUS_RING}`}><Link2 size={15} /> Link</button>
        </div>
        {pendingLink && (
          <div className="mt-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-sm text-amber-800 dark:text-amber-200">
            Combine your {localCount} item{localCount === 1 ? '' : 's'} here with that space? Nothing is replaced.
            <div className="flex gap-2 mt-2">
              <button onClick={confirmLink} className={`text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg ${FOCUS_RING}`}>Combine &amp; link</button>
              <button onClick={() => setPendingLink('')} className={`text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg ${FOCUS_RING}`}>Cancel</button>
            </div>
          </div>
        )}
        <button onClick={startFresh} className={`mt-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded ${FOCUS_RING}`}>
          Use a new private space
        </button>
      </div>

      {msg && <p className="text-xs text-gray-600 dark:text-gray-400">{msg}</p>}
    </div>
  );
}

export function SettingsSheet({ open, settings, onClose, onChange, onLinked, localCount }) {
  const set = (patch) => onChange({ ...settings, ...patch });
  return (
    <BottomSheet open={open} title="Settings" onClose={onClose}>
      <div className={`${groupCls} divide-y divide-gray-100 dark:divide-gray-800 px-4`}>
        <div className="py-3">
          <span className="block text-[15px] text-gray-800 dark:text-gray-100">Theme</span>
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
        <PushSync onLinked={onLinked} localCount={localCount} />
        <Toggle label="Sound" hint="Gentle chimes & alarms" checked={settings.sound} onChange={(v) => set({ sound: v })} />
        <Toggle label="Vibration" hint="Buzz on mobile (while tab is open)" checked={settings.vibration} onChange={(v) => set({ vibration: v })} />
        <Toggle
          label="Reduced motion"
          hint="Stepped timer, no confetti"
          checked={settings.motion === 'reduced'}
          onChange={(v) => set({ motion: v ? 'reduced' : 'full' })}
        />
        <div className="py-3">
          <span className="block text-[15px] text-gray-800 dark:text-gray-100">Salience</span>
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
          <span className="block text-[15px] text-gray-800 dark:text-gray-100">Default focus length</span>
          <ChipRow
            value={settings.defaultFocusMin}
            onChange={(v) => set({ defaultFocusMin: v })}
            options={FOCUS_PRESETS.map((m) => ({ value: m, label: `${m} min` }))}
          />
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 px-1">Alarms and buzzes work while this tab is open.</p>
    </BottomSheet>
  );
}
