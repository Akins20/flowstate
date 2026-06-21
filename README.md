# Skafld

An ADHD-friendly time, focus, and reminders app. Skafld keeps you on exactly one thing at a
time, makes time visible, and never shames you for a missed minute. It is an installable PWA with
an iOS-style interface, optional cross-device sync, and push reminders that reach you even when the
app is closed.

- **App:** https://flowstate-green.vercel.app
- **Push/sync API:** https://69-164-244-64.sslip.io:8444 (stopgap host until a DuckDNS subdomain is wired)

> The product is named **Skafld**. The git repo, deploy paths, and internal storage keys still use
> the original "flowstate" identifier on purpose, so existing data and infrastructure keep working.

## Why it exists

Built around evidence-informed ADHD design principles:

- **One thing now.** A `Now / Next / Later` spine replaces the endless flat list, so there is always
  a single obvious next action.
- **Time made visible.** Focus Mode shows a shrinking arc, not just a clock, to fight time blindness.
- **Forgiving, never shaming.** Nothing turns red or says "overdue". A missed item is just "still here",
  one tap to reschedule. Progress only ever counts up.
- **Low-friction capture.** Brain-dump by typing or voice; sort it out later.
- **Gentle dopamine.** Small, immediate, optional rewards on completion. No punishing streaks.

## Features

- **Today** - `Now / Next / Later`, quick capture, and an Inbox for unsorted thoughts.
- **Focus Mode** - full-screen shrinking-arc timer with a 2-minute wrap-up, alarm + vibration, and an
  end-of-session snapshot (keep going / break / done). The session survives a reload or tab close.
- **Capture sheet with speech-to-text** - tap the center Add button, then type or dictate (Web Speech API).
- **Calendar** - Month grid, a single-column **Day timeline** with a live "now" line, and an Agenda list.
- **Recurring tasks** - Never / Daily / Weekdays / Weekly. Completing a repeating item spawns only the
  next occurrence, so the list never floods.
- **Reminders** - in-app alarms plus optional Web Push so reminders fire when the app is closed; an
  optional lead-time "early heads-up" pre-alarm.
- **Multi-device sync** - link devices with a private sync code; last-write-wins with tombstones.
- **Item types** - call / email / form / note / task, as quiet optional icons.
- **iOS design** - bottom tab bar, large titles, grouped inset lists, material/blur chrome, system font,
  iOS-green switches, sheet grabbers, light / dark / system themes.
- **Accessible** - focus traps and restore in dialogs, ARIA live regions, visible focus rings, 44px
  targets, and a live `prefers-reduced-motion` switch.

## Tech stack

- **Client:** React 18, Vite 6, Tailwind CSS v4, lucide-react, canvas-confetti. Local-first via
  `localStorage`; installable PWA with a service worker.
- **Server:** a single Go binary (bbolt storage, Web Push via VAPID), behind nginx + Let's Encrypt.
- **Hosting:** the SPA on Vercel; the API on an Ubuntu VPS.

## Architecture

```
Browser (PWA)  --localStorage--  works fully offline, first-class
     |  fetch (HTTPS, bearer token = sync code)
     v
Go push server (multi-tenant, bbolt)
     |  Web Push (VAPID)
     v
Browser push service  -->  service worker  -->  notification
```

- **Local-first.** Everything works with no server: items live in `localStorage`. The server is purely
  additive (cross-device sync + reminders when the app is closed).
- **Sync.** The client pushes changed items and pulls on load / focus / every 45s, merging by
  `updatedAt` (last-write-wins). Deletes are **tombstones** (`deleted: true`) so they do not resurrect
  across devices.
- **Identity.** No accounts. Each device generates a long random token (the "sync code"); the server
  namespaces all data under `sha256(token)`. Paste a code onto another device to share a space.
- **Push.** The browser subscribes via VAPID and registers with the server; a 30s scheduler sends the
  reminder at the right minute. Reminders are timezone-proof: the client computes the epoch `dueAt`.
- **Single API entry point.** The endpoint is hardcoded in exactly one place, `src/api.js`, as a
  singleton. Nothing else builds a URL.

## Project structure

```
flowstate/
  index.html               PWA shell (manifest, theme-color, icons)
  src/
    main.jsx               entry
    App.jsx                root state, routing, sync wiring, focus-session lifecycle
    Shell.jsx              iOS large-title header
    TabBar.jsx             iOS bottom tab bar (Today / Calendar / Done + center Add)
    Home.jsx               Today body: QuickCapture, Inbox, Now / Next / Later
    Calendar.jsx           Month grid, Day timeline, Agenda
    FocusMode.jsx          full-screen timer + SnapshotModal
    CaptureSheet.jsx       capture sheet (text + mic)
    DoneView.jsx           calm progress tab
    sheets.jsx             EditSheet + SettingsSheet (grouped inset lists)
    ui.jsx                 BottomSheet, Toast, TypeIcon, CompleteButton, focus trap
    lib.js                 item model, storage/migration, time/zones, recurrence, copy
    hooks.js               useNow, useReward, useAlarmEngine (in-tab reminders)
    sync.js                item<->event mappers, last-write-wins merge
    push.js                service-worker registration + push subscription
    speech.js              Web Speech API hook (guarded for installed iOS)
    api.js                 the single hardcoded API entry point (singleton)
    audio.js               Web Audio chimes/alarm, vibration, confetti
  public/
    sw.js                  service worker (push + notification click)
    manifest.webmanifest   PWA manifest
    icons/                 PNG app icons (generated by scripts/gen-icons.mjs)
    .well-known/assetlinks.json   Play Store TWA verification (fill in before publishing)
  scripts/gen-icons.mjs    rasterizes the SVG logo to PNG icons
  server/                  Go push server (see server/README.md)
  docs/PLAY_STORE.md       Play Store (TWA) publishing guide
```

## Getting started

```bash
cd flowstate
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
npm run preview  # serve the production build
```

The dev app talks to the live API (CORS allows `localhost:5173/5174`). Browser push and the service
worker work on `localhost` because it counts as a secure context.

### Pointing at a different API

The API base URL lives in exactly one place: the top of `src/api.js`. Change that line, rebuild, and
update the server's CORS allowlist (`ALLOWED_ORIGIN` in `/etc/flowstate.env`) plus the
`assetlinks.json` domain if you publish to Play.

## The server

A self-contained Go service. See **`server/README.md`** for the data model, endpoints, and config.

```bash
# build + deploy without touching user data (swaps the binary, restarts, keeps the data dir):
VPS_PASS_FILE=/path/to/pwfile ./server/deploy.sh
```

Provisioned: systemd unit `flowstate.service`, nginx reverse proxy on `:8444` to `127.0.0.1:8091`,
Let's Encrypt cert (auto-renew). User data lives in `/opt/flowstate/data` and is never touched by an
update.

## Install as an app / Play Store

Skafld is installable from the browser ("Add to Home Screen" / Install). To ship it on the Google
Play Store as a Trusted Web Activity, follow **`docs/PLAY_STORE.md`** (PWABuilder -> Play Console),
then fill in `public/.well-known/assetlinks.json` with your package name and signing SHA-256.

Regenerate the icons after changing the logo:

```bash
npm i -D @resvg/resvg-js && node scripts/gen-icons.mjs
```

## Data and privacy

- Items live in your browser's `localStorage` and (if you sync) on your own server, namespaced by your
  private sync code. There are no accounts, ads, or third-party trackers.
- Voice dictation uses the browser's Web Speech API, which sends audio to the browser vendor's speech
  service (Apple/Google) only while you are actively dictating. Typing never leaves your device.

## Browser support notes

- Push + service worker require HTTPS (or `localhost`). Both hosts qualify.
- **Speech-to-text** works in Chrome, Edge, and Safari (the browser). It does **not** work inside an
  installed iOS home-screen PWA (Apple limitation), so the mic is hidden there and typing remains the
  always-on fallback.

## License

Skafld is open source under the **Apache License 2.0** - see [LICENSE](LICENSE) and [NOTICE](NOTICE).
Copyright 2026 Akins20. You may use, modify, and redistribute it (including commercially) under the
terms of that license, which also includes an explicit patent grant. All third-party dependencies are
permissive (MIT / ISC / BSD-3-Clause) and compatible.
