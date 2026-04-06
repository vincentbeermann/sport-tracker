# Sport Training Web App

Local training tracking web app for daily use. Not a product, just for Vincent.

## Tech Stack
- Node.js + Express server
- Vanilla HTML/CSS/JS frontend (no framework)
- JSON file for data persistence (./data/workouts.json)
- Runs on localhost:3000
- No external dependencies beyond express

## App Structure
Four training modules, each with different behavior:

---

### Running
**Before:** Show two structured options the user can read through:
- Option A: Steady State -- 5 min warm-up, 20-40 min at 65-75% max HR (nose breathing pace), 5 min cool-down + stretch
- Option B: Intervals -- 5 min warm-up, 6x3 min hard / 90 sec easy, 5 min cool-down

**During:** Nothing -- user goes for the run.

**After (Log screen):**
- Which option did they do? (A or B, tap to select)
- Duration (minutes, number input)
- Distance (km, optional)
- Free text note
- Save button -> writes to workouts.json

---

### Yoga
**Before:** Show a list of suggested poses/sequence (Cat-Cow, Downward Dog->Cobra, Warrior I&II, Pigeon Pose, Seated Forward Fold, Savasana) -- just for inspiration, not guided.

**After (Log screen):**
- Duration (minutes)
- Large free text field: "What did you do?" (e.g. class name, YouTube video, own practice)
- Save button -> writes to workouts.json

---

### Kettlebell HIIT (20kg)
**Before:** User picks Variant A or B.

- **Variant A -- Power & Push (EMOM x20):**
  Warm-up: Halo 2x10, Goblet Squat 2x10
  EMOM: KB Swing 15 reps / KB Clean & Press 6/side / Goblet Squat 10 / Renegade Row 6
  Core finisher: KB Windmill 3x5/side, KB Suitcase Carry 3 rounds

- **Variant B -- Grind & Carry (5 rounds, 40s work/20s rest):**
  Warm-up: Arm Bar 2x30s/side, KB Deadlift 2x10
  Circuit: KB Deadlift / One-Arm Row / Goblet Reverse Lunge / Push Press
  Core finisher: Dead Bug 3x8/side, Pallof Press 3x10/side

**During:** Fully guided timer workout.
- Shows current exercise name + what to do
- Countdown timer for work intervals
- Rest countdown between sets/exercises
- Auto-advances through all exercises
- Clear visual: big timer, current exercise, next exercise preview
- "Pause" button

**After:** Auto-logged when workout completes. Just show a summary + "Done" button.

---

### Gym -- Full Body (3x6, Compound)
**Before/During:** User sees the workout and can look up each exercise.

- **Variant A -- Squat Focus:**
  Main (3x6): Back Squat, Barbell Row, Chin-Up
  Accessory (3x8-10): Romanian Deadlift, DB Incline Press
  Core: Ab Wheel Rollout 3x8, Copenhagen Plank 3x20s/side

- **Variant B -- Deadlift Focus:**
  Main (3x6): Conventional Deadlift, Barbell Row, Chin-Up
  Accessory (3x8): Front Squat, Dips
  Core: Hanging Leg Raise 3x10, Suitcase Deadlift 3x6/side

**Exercise detail view:** Tapping any exercise opens a panel with:
- Coaching cues (2-4 bullet points, what to focus on)
- A simple CSS animation showing the movement pattern (no images/videos -- pure CSS animated SVG or div-based)

**Set Logger:** Next to each exercise, log each set:
- Weight (kg) + Reps -- one row per set
- "Add set" button
- Sets auto-save as you go (no explicit save button needed)

---

## Dashboard
A dedicated screen accessible from the main nav.

Show:
- A calendar/timeline view: which days had workouts, color-coded by module type
- Last 7 days at a glance
- Total sessions per module (all time)
- Last session per module (date + quick summary)
- Current weekly streak

---

## Design
- Dark theme, professional and sport-focused
- Font: Barlow Condensed for headings, Barlow for body (Google Fonts)
- Accent color: #e8ff47 (yellow-green)
- Secondary accent: #47c8ff (blue) for info/timers
- Clean, modular card layout
- Mobile-friendly (used on phone during workout)
- Smooth transitions between screens (no page reloads -- single page app feel)

---

## Data Model (workouts.json)

```
{
  "sessions": [
    {
      "id": "uuid",
      "date": "2026-04-05",
      "module": "gym",
      "variant": "A",
      "sets": [
        { "exercise": "Back Squat", "weight": 100, "reps": 6 }
      ],
      "notes": "",
      "duration": null
    }
  ]
}
```

---

## Build Order
1. Server setup (Express, JSON read/write endpoints)
2. Navigation shell (4 modules + Dashboard, single-page routing)
3. Gym module (exercise view, set logger, coaching cues, CSS animations)
4. Running module (info screens + log)
5. Yoga module (inspiration + log)
6. KB module (timer engine + guided workout)
7. Dashboard (calendar, stats)

---

## Architecture (v2: PWA)

The app is now a **Progressive Web App** that runs entirely on the phone. No server, no network needed during workouts. Data lives in browser `localStorage` on the phone. The Express server from v1 is kept under `Code/legacy/` in case you ever want sync.

## Install on iPhone (one-time)

1. On the Mac, in this folder:
   ```bash
   cd Code
   ./serve.sh
   ```
   It prints both a localhost URL and a phone URL like `http://192.168.0.148:3001`.

2. On the iPhone (same Wi-Fi as the Mac), open the phone URL in **Safari**.

3. Tap **Share** → **Add to Home Screen**. Confirm. The Sport Tracker icon now lives on your home screen.

4. **Stop the Mac server** (Ctrl+C). You're done. Open the app from the home screen — it runs offline, anywhere.

## Daily use

- Tap the Sport icon on your phone home screen
- App opens in fullscreen, like a native app
- All data stays on the phone

## Backups (do this monthly)

Phones get lost / wiped. From the Dashboard tab there's a **Daten** card with three buttons:

- **Export** - downloads a `sport-tracker-YYYY-MM-DD.json` to your phone. Email it to yourself, drop it in iCloud Drive, whatever.
- **Import** - upload a previously exported JSON. Choose Merge (add new sessions, keep existing) or Replace (wipe and use only the imported file).
- **Alles löschen** - wipe everything. Two confirmation dialogs.

## Project structure

```
Code/
  serve.sh           # one-line static server for first-time install
  public/            # everything that gets installed on the phone
    index.html       # SPA shell, manifest + SW registration
    manifest.webmanifest
    sw.js            # service worker (cache-first for offline)
    icon-192.png
    icon-512.png
    style.css
    storage.js       # localStorage-backed window.api (replaces v1 server)
    exercises.js     # coaching cues + animation keys + workout definitions
    app.js           # router + module registry + toast
    modules/
      gym.js         # variant pick → exercise list → set logger (auto-save)
      run.js         # info screens → log form
      yoga.js        # inspiration → free-text log
      kb.js          # variant pick → segment-based timer engine → auto-log
      dashboard.js   # streak + heatmap + per-module breakdown + data mgmt
  legacy/            # v1 Express + JSON file backend, no longer used
    server.js
    package.json
    Data/workouts.json
    README.md
```

## Why PWA instead of Mac server

v1 ran an Express server on the Mac. That meant: Mac had to be awake during the entire workout, phone had to be in the same Wi-Fi, and using it at the gym (different network) was impossible. The PWA fixes all of that — install once, then it works anywhere, offline.

The trade-off: data lives only on the phone. Hence the export/import flow for backups.

---

## Storage API (window.api)

Same shape as the v1 fetch-based API, just backed by `localStorage` instead of HTTP.

| Method | Purpose |
|---|---|
| `getSessions()`           | List all sessions, newest first |
| `getSession(id)`          | Get one |
| `createSession(input)`    | Create new session, returns session with generated id |
| `patchSession(id, patch)` | Update sets/notes/duration/distance/variant |
| `deleteSession(id)`       | Remove a session |
| `getStats()`              | Aggregated dashboard data: total per module, last per module, last 90 days, current weekly streak |
| `exportAll()`             | Returns `{ sessions: [...] }` for backup |
| `importAll(data, mode)`   | mode: `'merge'` (skip existing ids) or `'replace'` (wipe and replace) |
| `wipeAll()`               | Delete all sessions |

Data is persisted under `localStorage` key `sport-tracker-v1`.
