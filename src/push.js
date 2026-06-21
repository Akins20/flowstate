// Web Push wiring: register the service worker, subscribe via VAPID, and hand the
// subscription to the server (so reminders fire even when the app is closed).
import { api } from './api';

const SW_URL = '/sw.js';

export function pushSupported() {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(SW_URL);
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function isPushEnabled() {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

// Must be called from a user gesture (button click) - it asks for notification permission.
export async function enablePush() {
  if (!pushSupported()) throw new Error('Push notifications are not supported on this browser.');
  const reg = (await registerServiceWorker()) || (await navigator.serviceWorker.ready);
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notification permission was not granted.');

  const vapidKey = await api.vapidPublicKey();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }
  await api.subscribe(sub.toJSON());
  return true;
}

// Re-POST the current subscription to the server (idempotent), and recreate it if the
// browser rotated/dropped it. Safe to call on every app start. Does nothing if the user
// never enabled push or permission isn't granted.
export async function refreshSubscription() {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const vapidKey = await api.vapidPublicKey();
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }
    await api.subscribe(sub.toJSON());
  } catch {
    /* best-effort */
  }
}

// Wire SW "subscription rotated" messages to a refresh.
export function listenForSubscriptionChange() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'pushsubscriptionchange') refreshSubscription();
  });
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api.unsubscribe(sub.endpoint).catch(() => {});
      await sub.unsubscribe();
    }
  } catch {
    /* ignore */
  }
}
