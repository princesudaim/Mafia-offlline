# NIGHTFALL — Mafia Party Game (PWA)

An offline, single-device (**pass-and-play**) social deduction game. One phone, 4–12 players, zero mercy.
No accounts, no servers, no tracking — 100% client-side.

## Stack ($0)

- **React 19 + Vite + Tailwind CSS v4**
- **localStorage** — settings, saved names & the local Hall of Legends
- **Hand-rolled PWA** — `manifest.webmanifest` + `sw.js` (no plugins), fully installable & offline after first visit
- **Lucide icons** — free SVG icon set
- **Google Fonts CDN** — Unbounded + Space Grotesk
- **Zero media files** — all juice is pure CSS keyframes, a Canvas particle engine, and WebAudio-synthesized SFX

## The Rules (default)

- **4–12 players** — dynamic roster, host picks imposter count (1–3)
- **Any number of each town power** — 0–4 Doctors, Detectives and Sheriffs, each with its own **spawn chance** (25/50/75/100%). Every slot rolls independently, so "2 Doctors at 50%" might deal 0, 1 or 2. Leftover seats become Crewmates; fill every seat and nobody is a plain Crewmate
- **Imposters** — each sees their partner(s) on their role card. At night, Agent 1 marks a target; Agent 2 sees the mark and picks. Same mark = guaranteed elimination · split marks = **50/50 coin flip** · solo imposter = guaranteed
- **Doctor** — one shield per night. Self-heal allowed **once per game** (configurable). Any doctor covering the marked player fully neutralizes the kill
- **Detective** — inspect one player per night → instant **IMPOSTER / INNOCENT**
- **Sheriff** — night bullet. Hit an imposter and they die. Hit an innocent and the **sheriff dies of guilt** (1 bullet per game by default; per-night mode available)
- **Leak-proof audio** — every role reveal and night action plays the *same* sound and haptic, so nobody can identify the imposter by ear. All role flavour is visual only (the holder is the only one looking at the screen)
- **Day Phase** — configurable deliberation timer (default 2:00), then a host-locked verdict panel: eject or skip
- **Reveals** — ejected players' roles stay classified by default; night deaths reveal. Both toggleable
- **Win** — Town: eliminate every imposter · Imposters: reach parity with the town

Everything above is live-configurable in **Settings** — even mid-match from the pause menu.

## Run it

```bash
npm install
npm run dev      # local dev
npm run build    # outputs static site to dist/
```

## Deploy to GitHub Pages (free hosting)

```bash
git init
git add .
git commit -m "feat: NIGHTFALL — offline pass-and-play mafia PWA"
git branch -M main
git remote add origin https://github.com/<you>/nightfall.git
git push -u origin main
```

Then either:

- **GitHub Actions (recommended):** add a workflow that runs `npm run build` and publishes `dist/` to Pages, or
- **Manual:** `npm run build`, then push `dist/` to a `gh-pages` branch (`npx gh-pages -d dist`),
- In **Settings → Pages**, pick your source branch. Done — HTTPS + PWA installability for $0.

> If hosting under `https://<you>.github.io/nightfall/` set `base: './'` in `vite.config.ts` before building so asset URLs resolve relatively.

## Security note

Never commit GitHub tokens into a repo or client bundle — if a personal access token has been pasted anywhere public, revoke it and mint a new one at **GitHub → Settings → Developer settings → Tokens**.
