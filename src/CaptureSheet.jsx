// Capture sheet opened by the center Add: pre-focused text input + a guarded mic.
// Typed Enter and dictated text both flow through the same onCapture.
import { useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { BottomSheet, FOCUS_RING } from './ui';
import { useSpeechCapture } from './speech';

export default function CaptureSheet({ open, onClose, onCapture, reduced }) {
  const [text, setText] = useState('');
  const speech = useSpeechCapture(setText);

  const close = () => {
    speech.stop();
    setText('');
    onClose();
  };
  const submit = (e) => {
    if (e) e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onCapture(t);
    close();
  };
  const toggleMic = () => (speech.listening ? speech.stop() : speech.start());

  if (!open) return null;
  return (
    <BottomSheet open title="Capture" onClose={close}>
      <form onSubmit={submit} className="space-y-3">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Brain dump — type it, hit enter, sort it later"
          aria-label="Capture"
          className={`w-full text-[17px] bg-gray-100 dark:bg-gray-800 rounded-xl px-3.5 py-3 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 ${FOCUS_RING}`}
        />
        <div className="flex items-center gap-2">
          {speech.supported && (
            <button
              type="button"
              onClick={toggleMic}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium ${FOCUS_RING} ${
                speech.listening
                  ? `bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300 ${reduced ? '' : 'animate-pulse'}`
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
              }`}
            >
              {speech.listening ? <Square size={16} /> : <Mic size={16} />}
              {speech.listening ? 'Listening… tap to stop' : 'Tap to talk'}
            </button>
          )}
          <button
            type="submit"
            disabled={!text.trim()}
            className={`ml-auto text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-4 py-2.5 rounded-xl ${FOCUS_RING}`}
          >
            Add
          </button>
        </div>
        {speech.error && <p className="text-xs text-amber-700 dark:text-amber-300">{speech.error}</p>}
        {!speech.supported && (
          <p className="text-xs text-gray-500 dark:text-gray-400">Voice capture works in Safari, not the installed app on iPhone — typing still works great.</p>
        )}
      </form>
    </BottomSheet>
  );
}
