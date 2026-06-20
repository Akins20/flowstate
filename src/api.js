// The single, hardcoded entry point to the FlowState push server.
// EVERYTHING that talks to the backend goes through the exported `api` singleton.
// The base URL is defined exactly once (here); never build a server URL anywhere else.

const API_BASE = 'https://69-164-244-64.sslip.io:8444';
const TOKEN_KEY = 'fs-sync-token';

// A long random per-device token. It is both the auth credential and the "sync code":
// paste it into another device (api.setToken) to share the same space.
function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

class FlowStateApi {
  constructor(base) {
    this.base = base;
    this._token = null;
  }

  // Lazy so that importing this module has zero side effects (safe in SSR/tests).
  get token() {
    if (this._token) return this._token;
    let t = null;
    try {
      t = localStorage.getItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
    if (!t) {
      t = generateToken();
      try {
        localStorage.setItem(TOKEN_KEY, t);
      } catch {
        /* ignore */
      }
    }
    this._token = t;
    return t;
  }

  // Link this device to an existing space. Returns false if the code is too short.
  setToken(token) {
    const t = (token || '').trim();
    if (t.length < 20) return false;
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* ignore */
    }
    this._token = t;
    return true;
  }

  // The one place an HTTP request is actually made.
  async request(path, { method = 'GET', body, auth = true } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = new Error(`FlowState API ${method} ${path} → ${res.status}`);
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  }

  // ---- public surface (every backend call funnels through request) ----
  health() {
    return this.request('/api/health', { auth: false });
  }
  vapidPublicKey() {
    return this.request('/api/config', { auth: false }).then((c) => c.vapidPublicKey);
  }
  listEvents() {
    return this.request('/api/events');
  }
  putEvent(event) {
    return this.request(`/api/events/${encodeURIComponent(event.id)}`, { method: 'PUT', body: event });
  }
  deleteEvent(id) {
    return this.request(`/api/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
  subscribe(subscription) {
    return this.request('/api/subscribe', { method: 'POST', body: subscription });
  }
  unsubscribe(endpoint) {
    return this.request('/api/unsubscribe', { method: 'POST', body: { endpoint } });
  }
  testPush() {
    return this.request('/api/test-push', { method: 'POST' });
  }
}

// The singleton. Import this everywhere; it is the only entry point to the server.
export const api = new FlowStateApi(API_BASE);
export default api;
