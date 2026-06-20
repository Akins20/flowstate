// Sound (Web Audio), haptics (Vibration API), and confetti.
// All gentle, all gated by settings at the call sites in hooks.js.
import confetti from 'canvas-confetti';

let ctx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  return ctx;
}

// Must be called from inside a user gesture (Start / enter Focus / toggle sound),
// otherwise autoplay policy silently drops every beep.
export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

function tone(freq, start, dur, peak = 0.15, type = 'sine') {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(c.destination);
  const t0 = c.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function peakFor(salience) {
  return salience === 'more' ? 0.22 : salience === 'less' ? 0.07 : 0.14;
}

// 3-4 pleasant rising two-note variants for novelty.
const CHIMES = [
  [523.25, 783.99],
  [587.33, 880.0],
  [659.25, 987.77],
  [493.88, 739.99],
];

export function playChime(salience = 'normal') {
  unlockAudio();
  const v = CHIMES[Math.floor(Math.random() * CHIMES.length)];
  const peak = peakFor(salience);
  tone(v[0], 0, 0.18, peak);
  tone(v[1], 0.085, 0.22, peak);
}

export function playSoftBeep(salience = 'normal') {
  unlockAudio();
  tone(440, 0, 0.25, peakFor(salience) * 0.9, 'sine');
}

// End-of-session / on-time alarm: a gentle rising three-note, played twice. Never a harsh buzzer.
export function playAlarm(salience = 'normal') {
  unlockAudio();
  const peak = peakFor(salience) * 1.3;
  const seq = [659.25, 783.99, 1046.5];
  seq.forEach((f, i) => tone(f, i * 0.16, 0.22, peak));
  seq.forEach((f, i) => tone(f, 0.62 + i * 0.16, 0.22, peak));
}

export function vibrate(pattern) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* no-op */
  }
}

export function fireConfetti() {
  try {
    confetti({
      particleCount: 70,
      spread: 72,
      startVelocity: 34,
      gravity: 0.9,
      ticks: 160,
      origin: { y: 0.72 },
      colors: ['#4f46e5', '#7c3aed', '#10b981', '#f59e0b', '#0ea5e9'],
      disableForReducedMotion: true,
    });
  } catch {
    /* canvas-confetti unavailable — silently skip */
  }
}
