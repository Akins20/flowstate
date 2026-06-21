# Publishing Skafld to the Google Play Store (TWA)

Skafld is a PWA, so it ships to Play as a **Trusted Web Activity (TWA)** — a thin native
Android shell that opens the live site full-screen (no URL bar), with its own icon and push
notifications. This is Google's official, supported path.

**App URL:** `https://flowstate-green.vercel.app`

The repo is already prepared:
- PNG icons (`public/icons/icon-192.png`, `icon-512.png`, maskable variants, `apple-touch-180.png`)
- Store-ready `public/manifest.webmanifest` (id, categories, shortcuts, maskable icons)
- `public/.well-known/assetlinks.json` scaffold (you fill in two values — step 3)
- Regenerate icons anytime: `npm i -D @resvg/resvg-js && node scripts/gen-icons.mjs`

---

## 0. One-time prerequisites (you)
- A **Google Play Developer account** — one-time **$25** at https://play.google.com/console/signup
- That's the only paid/owner step; everything else is free.

## 1. Generate the Android app — PWABuilder (easiest)
1. Go to **https://www.pwabuilder.com** and enter `https://flowstate-green.vercel.app`.
2. It scores the PWA and lets you **Package For Stores → Android → Google Play**.
3. Keep the defaults; note/choose the **Package ID** (e.g. `app.flowstate.twa`). Write it down.
4. Download the zip. It contains:
   - `app-release-bundle.aab` — what you upload to Play
   - a signing key (`.keystore`) + `signing-key-info.txt` — **back these up safely**
   - `assetlinks.json` — the fingerprints PWABuilder generated

> Alternative (CLI): `npx @bubblewrap/cli init --manifest https://flowstate-green.vercel.app/manifest.webmanifest`
> then `bubblewrap build`. Requires JDK + Android SDK.

## 2. Create the app in Play Console & upload
1. Play Console → **Create app** → name "Skafld", app, free.
2. **Test and release → Production** (or Internal testing first) → **Create new release** → upload the `.aab`.
3. Accept **Play App Signing** (recommended). Google now holds the real signing key.

## 3. Wire up Digital Asset Links (removes the URL bar) — I can finalize this
The TWA only goes full-screen if the site vouches for the app via `assetlinks.json`.
1. In Play Console → **Test and release → App integrity → App signing** → copy the
   **SHA-256 certificate fingerprint** of the **App signing key** (this is the one that matters
   with Play App Signing — not the upload key).
2. Edit `public/.well-known/assetlinks.json`:
   - `package_name` → your Package ID from step 1.3
   - `sha256_cert_fingerprints` → paste the SHA-256 (uppercase, colon-separated).
   - If you also do local/internal testing with the PWABuilder key, add **both** fingerprints
     to the array.
3. Commit + push → Vercel redeploys.
4. Verify it's live and correct:
   `curl https://flowstate-green.vercel.app/.well-known/assetlinks.json`
   and Google's tester:
   `https://developers.google.com/digital-asset-links/tools/generator`

> Hand me the package name + SHA-256 and I'll fill, commit, and push this for you.

## 4. Store listing (in Play Console)
- **Screenshots** (phone, min 2) — capture the running app (Today, Focus, Calendar). These are
  uploaded directly in Play Console; they don't live in the repo.
- Short description (≤80 chars), full description, the 512² icon, and a 1024×500 feature graphic.
- Content rating questionnaire, Data safety form (Skafld stores tasks on your own server;
  push subscriptions; no ads/trackers), privacy policy URL, target audience.

## 5. Submit → review
- Submit for review (usually ~1–3 days). Once the assetlinks match, the installed app opens
  with **no URL bar** — a clean full-screen app.

---

## Notes & gotchas
- **Push works in a TWA** — Android routes web push to the system; your existing service worker
  + VAPID flow is used as-is. The user grants notifications inside the app.
- **The "thin wrapper" rule:** Google rejects pure website shells. Skafld qualifies because it's
  an installable PWA with offline support, push reminders, and app-like UX.
- **HTTPS is required** end-to-end. The app (Vercel) and API (`…sslip.io:8444`) are both HTTPS. If
  you later move the API to your DuckDNS domain, update `src/api.js` (one line) and rebuild.
- **Keep the signing key / Play App Signing enrollment safe** — losing it complicates future updates.
- **iOS App Store** is a separate, stricter path (Apple discourages web wrappers); this guide is
  Play-only. The PWA still installs on iOS via Safari "Add to Home Screen".
