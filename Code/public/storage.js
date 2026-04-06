// Local storage layer - replaces the Express server.
// Persists in localStorage under the key STORAGE_KEY as { sessions: [...] }.
// Mirrors the original window.api shape so module code stays unchanged.

(function () {
  const STORAGE_KEY = 'sport-tracker-v1';

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { sessions: [] };
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.sessions)) return { sessions: [] };
      return parsed;
    } catch (e) {
      console.warn('storage load failed, starting empty:', e);
      return { sessions: [] };
    }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // ISO week key (year + week number) for streak calculation
  function isoWeekKey(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }

  function computeStats(sessions) {
    const modules = ['run', 'yoga', 'kb', 'gym'];
    const total = {};
    const last = {};

    for (const m of modules) {
      const mine = sessions.filter(s => s.module === m);
      total[m] = mine.length;
      if (mine.length > 0) {
        const sorted = [...mine].sort((a, b) => (a.date < b.date ? 1 : -1));
        last[m] = sorted[0];
      } else {
        last[m] = null;
      }
    }

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

    return { total, last, days, streak };
  }

  // Public API - same shape as the old fetch-based window.api
  window.api = {
    async getSessions() {
      const data = load();
      const sorted = [...data.sessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      return { sessions: sorted };
    },

    async getSession(id) {
      const data = load();
      return data.sessions.find(s => s.id === id) || null;
    },

    async createSession(input) {
      const data = load();
      const session = {
        id: uuid(),
        date: input.date || todayISO(),
        module: input.module,
        variant: input.variant ?? null,
        sets: input.sets ?? [],
        notes: input.notes ?? '',
        duration: input.duration ?? null,
        distance: input.distance ?? null,
      };
      data.sessions.push(session);
      save(data);
      return session;
    },

    async patchSession(id, patch) {
      const data = load();
      const idx = data.sessions.findIndex(s => s.id === id);
      if (idx === -1) throw new Error(`session ${id} not found`);
      const allowed = ['sets', 'notes', 'duration', 'distance', 'variant'];
      for (const key of allowed) {
        if (key in patch) data.sessions[idx][key] = patch[key];
      }
      save(data);
      return data.sessions[idx];
    },

    async deleteSession(id) {
      const data = load();
      const before = data.sessions.length;
      data.sessions = data.sessions.filter(s => s.id !== id);
      if (data.sessions.length === before) throw new Error(`session ${id} not found`);
      save(data);
    },

    async getStats() {
      const { sessions } = load();
      return computeStats(sessions);
    },

    // Bulk operations for export / import
    async exportAll() {
      return load();
    },

    async importAll(data, mode = 'merge') {
      // mode: 'merge' (add new, keep existing by id) or 'replace' (wipe and replace)
      if (!data || !Array.isArray(data.sessions)) {
        throw new Error('invalid data: expected { sessions: [...] }');
      }
      if (mode === 'replace') {
        save({ sessions: data.sessions });
        return { added: data.sessions.length, skipped: 0, total: data.sessions.length };
      }
      const current = load();
      const existingIds = new Set(current.sessions.map(s => s.id));
      let added = 0;
      let skipped = 0;
      for (const s of data.sessions) {
        if (existingIds.has(s.id)) {
          skipped++;
        } else {
          current.sessions.push(s);
          added++;
        }
      }
      save(current);
      return { added, skipped, total: current.sessions.length };
    },

    async wipeAll() {
      save({ sessions: [] });
    },
  };
})();
