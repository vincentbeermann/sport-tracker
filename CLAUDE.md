# side-sport-webapp

## Overview

Local training tracking web app for personal daily use. Not a product -- just for Vincent. Tracks 4x/week training across four modules: Running, Yoga, Kettlebell HIIT (20kg, at home), and Gym (full body, compound lifts). Generates weekly reflection insights and a dashboard view of training history.

See `README.md` for the full feature spec / briefing.

## Status

- **Phase:** v2 built (PWA, 2026-04-06) -- ready for first install + real use
- **Priority:** medium
- **Target users:** Vincent (single-user, on-phone only)
- **Deadline:** none

## v2 = Progressive Web App (2026-04-06)

The app is now a **client-only PWA**. No server, no network, runs on the phone offline. Replaced v1's Express + JSON-file architecture because Vincent needed to use it at the gym (where the Mac isn't reachable).

- **Storage:** `localStorage` under key `sport-tracker-v1`. `Code/public/storage.js` provides the same `window.api` shape as the old fetch-based version (createSession, patchSession, getStats, exportAll, importAll, wipeAll, etc.) so module code didn't have to change.
- **Service Worker:** `Code/public/sw.js` cache-first for app shell, network-first for navigation. Cache version key `sport-v1`.
- **Manifest:** `Code/public/manifest.webmanifest`, standalone display, dark theme, 192/512 icons.
- **Install flow:** Run `Code/serve.sh` once on the Mac (in same Wi-Fi as phone), open phone URL in Safari, Add to Home Screen. After that the app runs offline forever.
- **Backups:** Dashboard has a Daten card with Export (downloads JSON), Import (merge or replace), Wipe (with two confirms).
- **Legacy v1 server:** Kept under `Code/legacy/` (server.js, package.json, node_modules, old Data/workouts.json). README in legacy/ explains how to resurrect it for sync.

## What's built (all of v1 + v2 changes)

All 7 build steps complete in one autonomous session, then refactored to PWA in a follow-up session.

- **Frontend shell (Code/public/):** Hash router, dark theme, Barlow / Barlow Condensed, accent #e8ff47, secondary #47c8ff, mobile-first with safe-area-insets, bottom tab bar, fade transitions, toast helper, PWA-installable.
- **Gym module:** Variant A (squat focus) / B (deadlift focus) picker. Per-exercise expandable detail panel with 2-4 coaching cues + a CSS-only movement animation (squat / deadlift / row / pullup / press / dip / rollout / leg-raise / plank). Set logger with auto-save (debounced 250ms), per-set delete, weight pre-fill from previous set.
- **Running module:** Two info cards (Steady State / Intervals) you tap to select, then a log form with duration / distance / notes.
- **Yoga module:** Inspiration list (Cat-Cow → Savasana) + duration + free-text log.
- **Kettlebell HIIT module:** Variant A (Power & Push EMOM) or B (Grind & Carry intervals). Builds a segment queue (`ready` → `work` → `rest`) covering warm-up + main rounds + finisher (~33 min total per workout). Date.now()-based timer (drift-free over 30+ min). Pause/skip/end controls. Web Audio beep on transitions. Auto-logs on completion.
- **Dashboard:** Default route. Streak count, total sessions, last 7 days. 90-day calendar heatmap (color-coded by module). Per-module breakdown with last session summary. Data management card (export / import / wipe).

## Smoke tests done

- All static asset routes return 200 from `python3 -m http.server` (14 files including SW, manifest, icons)
- All JS files pass `node --check` (9 files including storage.js, sw.js)
- Cross-check: every exercise referenced in GYM_WORKOUTS has an entry in EXERCISES (12 / 12)
- KB segment builder produces 70 / 90 segments for variants A / B (~33 min each)
- Full E2E test of storage layer with mocked localStorage: create, patch, get stats, export, wipe, import (replace), import (merge with skip), wipe (verified `node` reproduction)
- Verified no remaining `fetch('/api/...')` calls in production code; only SW retains fetch (correctly)

## Not tested in v2

- **Actual install on iPhone Safari** -- requires manual user action (Vincent has not run serve.sh yet)
- **Service Worker behavior on http:// LAN IP** -- iOS Safari may refuse SW install on non-https, non-localhost. Fallback if so: GitHub Pages.
- Visual / responsive layout on actual phone
- Long-running KB timer in real workout (>30 min)
- localStorage quota limits (probably 5-10 MB on Safari, plenty for years of session data)
- Backup/restore round-trip in real Safari (tested only via node mock)

## Tech Stack

- **Server:** Node.js + Express
- **Frontend:** Vanilla HTML/CSS/JS (no framework, single-page-app feel)
- **Persistence:** JSON file (`./Data/workouts.json`)
- **Runtime:** localhost:3000
- **Dependencies:** express only -- keep it minimal
- **Design:** Dark theme, Barlow / Barlow Condensed (Google Fonts), accent #e8ff47, secondary #47c8ff
- **Mobile-friendly:** used on phone during workouts

## Goals

- **Daily-use friction-free tracking:** open app, pick module, log session in seconds
- **Module-specific UX:** each training type gets the screens it needs (timer for HIIT, set logger for gym, free text for yoga, structured options for running)
- **Reflection:** dashboard surfaces weekly streak, sessions per module, last session per module, calendar timeline
- **Local-first:** no cloud, no auth, no accounts -- just one JSON file
- **Calendar integration:** training schedule planned into Sport calendar each week (Diane sends Sunday heads-up)

## Modules

1. **Running** -- info screens (steady state vs. intervals) + log screen
2. **Yoga** -- inspiration list + free-text log
3. **Kettlebell HIIT** -- guided timer workout (Variant A: Power & Push EMOM, Variant B: Grind & Carry intervals), auto-logged
4. **Gym** -- compound full body 3x6 (Variant A: squat focus, Variant B: deadlift focus), set logger, exercise detail panels with coaching cues + CSS-animated movement patterns

## Build Order

1. Server setup (Express + JSON read/write endpoints)
2. Navigation shell (4 modules + Dashboard, SPA routing)
3. Gym module (most complex -- exercise view, set logger, animations)
4. Running module
5. Yoga module
6. KB module (timer engine)
7. Dashboard (calendar, stats, streak)

## Notes

- This is a side project, not research. No publication, no co-authors.
- Build when there's appetite -- not on a deadline.
- All exercise programming has been pre-spec'd in README -- no need to redesign workouts during build.
- `~/Documents` is symlinked from `~/Library/Mobile Documents/com~apple~CloudDocs/Documents` (iCloud Drive sync). Both paths point to the same files. Always use the canonical `~/Documents/...` path -- there is only one copy.
