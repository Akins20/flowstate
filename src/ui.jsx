// Small shared presentational primitives.
import { useEffect, useState, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { TYPE_META } from './lib';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

export { FOCUS_RING };

export function TypeIcon({ type, size = 20 }) {
  const meta = type ? TYPE_META[type] : null;
  if (!meta) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"
        style={{ width: size + 16, height: size + 16 }}
        aria-hidden
      >
        <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500" />
      </span>
    );
  }
  const { Icon, tintBg, tintText } = meta;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg ${tintBg} ${tintText}`}
      style={{ width: size + 16, height: size + 16 }}
      aria-hidden
    >
      <Icon size={size} />
    </span>
  );
}

// Round complete-checkbox. Emerald when checked. >=44px hit area.
export function CompleteButton({ checked, onClick, label = 'Mark done', reduced }) {
  const [pop, setPop] = useState(false);
  const handle = () => {
    if (!checked) {
      setPop(true);
      setTimeout(() => setPop(false), 360);
    }
    onClick();
  };
  return (
    <button
      onClick={handle}
      aria-pressed={checked}
      aria-label={label}
      className={`shrink-0 grid place-items-center w-11 h-11 rounded-full transition-colors ${FOCUS_RING} ${
        checked ? 'bg-emerald-500 text-white' : 'border-2 border-gray-300 dark:border-gray-600 text-transparent hover:border-emerald-400 dark:hover:border-emerald-500'
      } ${pop && !reduced ? 'fs-pop' : ''}`}
    >
      <Check size={20} className={checked ? 'fs-check' : ''} strokeWidth={3} />
    </button>
  );
}

// Focus the first control on open, trap Tab within `ref`, and restore focus on close.
export function useFocusTrap(ref, active) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const node = ref.current;
    const opener = document.activeElement;
    const sel =
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusables = () => Array.from(node.querySelectorAll(sel)).filter((el) => el.offsetParent !== null);
    const first = focusables()[0];
    if (first) first.focus();
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (!f.length) return;
      const a = f[0];
      const b = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        b.focus();
      } else if (!e.shiftKey && document.activeElement === b) {
        e.preventDefault();
        a.focus();
      }
    };
    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('keydown', onKey);
      if (opener && opener.focus) opener.focus();
    };
  }, [active, ref]);
}

export function BottomSheet({ open, onClose, title, children }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  useFocusTrap(dialogRef, open);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-gray-900/30 fs-fade" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-xl p-5 sm:p-6 fs-sheet max-h-[88dvh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className={`p-2 -m-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg ${FOCUS_RING}`}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Brief acknowledgement toast. With an `action` (e.g. Undo) it stays put and is clickable.
export function Toast({ message, action }) {
  if (!message) return null;
  return (
    <div
      className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pointer-events-none"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={`${action ? 'fs-fade' : 'fs-toast'} pointer-events-auto bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 text-sm font-medium ${
          action ? 'pl-4 pr-2' : 'px-4'
        } py-2.5 rounded-full shadow-lg flex items-center gap-3`}
      >
        <span>{message}</span>
        {action && (
          <button
            onClick={action.onClick}
            className={`font-semibold text-indigo-300 dark:text-indigo-700 px-2.5 py-1 rounded-full hover:bg-white/10 dark:hover:bg-black/10 ${FOCUS_RING}`}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

// Detects an increment and briefly pops — used by the "Done today" pill.
export function usePopOnIncrease(value, reduced) {
  const [pop, setPop] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (value > prev.current && !reduced) {
      setPop(true);
      const id = setTimeout(() => setPop(false), 360);
      prev.current = value;
      return () => clearTimeout(id);
    }
    prev.current = value;
  }, [value, reduced]);
  return pop;
}
