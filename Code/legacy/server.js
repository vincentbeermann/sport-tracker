const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, '..', 'Data', 'workouts.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ sessions: [] }, null, 2));
}

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(express.static(PUBLIC_DIR));

// List all sessions (newest first)
app.get('/api/sessions', (req, res) => {
  const data = readData();
  const sorted = [...data.sessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  res.json({ sessions: sorted });
});

// Get a single session by id
app.get('/api/sessions/:id', (req, res) => {
  const data = readData();
  const session = data.sessions.find(s => s.id === req.params.id);
  if (!session) return res.status(404).json({ error: 'not found' });
  res.json(session);
});

// Create a new session
app.post('/api/sessions', (req, res) => {
  const data = readData();
  const session = {
    id: crypto.randomUUID(),
    date: req.body.date || todayISO(),
    module: req.body.module,
    variant: req.body.variant ?? null,
    sets: req.body.sets ?? [],
    notes: req.body.notes ?? '',
    duration: req.body.duration ?? null,
    distance: req.body.distance ?? null,
  };
  data.sessions.push(session);
  writeData(data);
  res.status(201).json(session);
});

// Patch an existing session (used by Gym set logger auto-save)
app.patch('/api/sessions/:id', (req, res) => {
  const data = readData();
  const idx = data.sessions.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });

  const allowed = ['sets', 'notes', 'duration', 'distance', 'variant'];
  for (const key of allowed) {
    if (key in req.body) data.sessions[idx][key] = req.body[key];
  }
  writeData(data);
  res.json(data.sessions[idx]);
});

// Delete a session (in case of mistakes)
app.delete('/api/sessions/:id', (req, res) => {
  const data = readData();
  const before = data.sessions.length;
  data.sessions = data.sessions.filter(s => s.id !== req.params.id);
  if (data.sessions.length === before) return res.status(404).json({ error: 'not found' });
  writeData(data);
  res.status(204).end();
});

// Aggregated stats for the dashboard
app.get('/api/stats', (req, res) => {
  const { sessions } = readData();
  const modules = ['run', 'yoga', 'kb', 'gym'];

  const total = {};
  const last = {};
  for (const m of modules) {
    const mine = sessions.filter(s => s.module === m);
    total[m] = mine.length;
    if (mine.length > 0) {
      mine.sort((a, b) => (a.date < b.date ? 1 : -1));
      last[m] = mine[0];
    } else {
      last[m] = null;
    }
  }

  // Days with at least one session, last 90 days
  const today = new Date(todayISO());
  const dayMap = {};
  for (const s of sessions) {
    if (!dayMap[s.date]) dayMap[s.date] = [];
    dayMap[s.date].push(s.module);
  }

  const days = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push({ date: iso, modules: dayMap[iso] || [] });
  }

  // Current weekly streak (consecutive ISO weeks with at least one session, ending this week)
  function isoWeekKey(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // Thursday of current ISO week
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }

  const weekSet = new Set(sessions.map(s => isoWeekKey(s.date)));
  let streak = 0;
  let cursor = new Date(today);
  while (true) {
    if (weekSet.has(isoWeekKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 7);
    } else {
      break;
    }
  }

  res.json({ total, last, days, streak });
});

app.listen(PORT, () => {
  console.log(`Sport tracker running at http://localhost:${PORT}`);
});
