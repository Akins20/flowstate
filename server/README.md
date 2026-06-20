# FlowState push server

A tiny Go service that stores each user's events and delivers **Web Push** reminders at the
scheduled time — even when the app is closed. Single binary, no external database.

Live: `https://69-164-244-64.sslip.io:8444` (stopgap sslip.io host until DuckDNS is back).

## Design

- **Multi-tenant, no accounts.** The client sends a long random token as `Authorization: Bearer <token>`.
  The server namespaces all data under `sha256(token)`, so every user/device has an isolated dataset.
  Possession of the token is the only credential (treat it like a password / "sync code").
- **Storage:** [bbolt](https://github.com/etcd-io/bbolt) at `data/flowstate.db`.
  Layout: `users/<userKey>/{events,subs,fired}` and a server-wide `meta` bucket (VAPID keys).
- **Reminders are timezone-proof.** The client computes `dueAt` (epoch ms) from the local date+time;
  the scheduler just compares epochs. A 30s tick fires on-time + lead-time pre-alarms, with a
  persisted per-trigger guard so nothing double-fires, and a 2-minute window so an event from hours
  ago (e.g. after downtime) doesn't fire late.
- **Web Push** via VAPID ([webpush-go](https://github.com/SherClockHolmes/webpush-go)). The VAPID
  keypair is generated once and persisted in `meta`; dead subscriptions (404/410) are pruned.

## Data durability across updates

User data lives entirely in `/opt/flowstate/data/` — **separate from the binary**. Updating the
server only replaces the binary and restarts the service. Use `./deploy.sh`, which never touches the
data directory. Any future change to the on-disk shape must be an **additive migration**, never a wipe.

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET  | `/api/health` | – | liveness |
| GET  | `/api/config` | – | `{ vapidPublicKey }` for the browser to subscribe |
| GET  | `/api/events` | bearer | list this tenant's events |
| PUT  | `/api/events/{id}` | bearer | upsert an event |
| DELETE | `/api/events/{id}` | bearer | delete an event |
| POST | `/api/subscribe` | bearer | store a browser PushSubscription |
| POST | `/api/unsubscribe` | bearer | remove a PushSubscription |
| POST | `/api/test-push` | bearer | send a test notification to this tenant |

## Config (env)

| Var | Default | Notes |
|-----|---------|-------|
| `ADDR` | `127.0.0.1:8091` | bind address (nginx terminates TLS on `:8444`) |
| `DATA_DIR` | `./data` | bbolt location (prod: `/opt/flowstate/data`) |
| `ALLOWED_ORIGIN` | `*` | CORS origin; tighten to the Vercel URL once known |
| `VAPID_SUBJECT` | `mailto:admin@example.com` | `mailto:` or https URL sent to push services |

## Deployment (already provisioned)

- systemd unit `flowstate.service` (User=`flowstate`, `Restart=always`, env in `/etc/flowstate.env`).
- nginx site `flowstate` reverse-proxies `:8444` (TLS) → `127.0.0.1:8091`.
- Let's Encrypt cert for `69-164-244-64.sslip.io` (auto-renews via certbot timer).
- To switch to the DuckDNS subdomain later: issue a cert for it and change `server_name` +
  `ssl_certificate*` in `/etc/nginx/sites-available/flowstate` (one block), then `nginx -t && reload`.

### Update

```bash
VPS_PASS_FILE=/path/to/pwfile ./deploy.sh   # or set up an ssh key and just ./deploy.sh
```
