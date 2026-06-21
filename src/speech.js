// Speech-to-text via the native Web Speech API (zero deps).
// Critical: recognition silently never fires inside an INSTALLED iOS standalone PWA
// (the constructor exists but nothing happens), so we report unsupported there and the
// UI keeps typing as the always-on fallback.
import { useState, useRef, useCallback, useEffect } from 'react';

function getSR() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function detectSupported() {
  if (!getSR()) return false; // Firefox + anything without the API
  const standalone =
    window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  const iOS = /iP(hone|ad|od)/.test(window.navigator.userAgent || '');
  if (standalone && iOS) return false; // installed iOS PWA: dead, hide the mic
  return true;
}

const ERRORS = {
  'not-allowed': 'Allow the microphone to dictate — you can still type.',
  'service-not-allowed': 'Allow the microphone to dictate — you can still type.',
  network: 'Voice needs a connection — type it instead.',
  'no-speech': 'Didn’t catch that — try again.',
};

// onText receives the running transcript (interim + final) so it can stream into an input.
export function useSpeechCapture(onText) {
  const [supported] = useState(detectSupported);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recRef = useRef(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const stop = useCallback(() => {
    try {
      recRef.current && recRef.current.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const start = useCallback(() => {
    const SR = getSR();
    if (!supported || !SR || recRef.current) return;
    const rec = new SR();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      onTextRef.current && onTextRef.current((finalText + interim).trim());
    };
    rec.onerror = (e) => setError(ERRORS[e.error] || 'Voice hiccupped — type it instead.');
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    recRef.current = rec;
    setError('');
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
      setListening(false);
    }
  }, [supported]);

  useEffect(
    () => () => {
      try {
        recRef.current && recRef.current.abort();
      } catch {
        /* ignore */
      }
    },
    []
  );

  return { supported, listening, error, start, stop };
}
