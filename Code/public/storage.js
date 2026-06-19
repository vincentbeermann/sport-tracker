// Storage layer — Firestore-backed, with offline cache via the Firebase SDK.
// Exposes the SAME window.api shape the modules already use, so no module code
// changes. Sessions live at: users/{uid}/sessions/{sessionId}.
//
// Offline: the Firebase SDK (firebase-init.js enables persistence) serves reads
// from a local cache and queues writes while offline, syncing on reconnect.
//
// Migration: the previous build persisted to localStorage under
// 'sport-tracker-v1'. On first sign-in we copy any such sessions into Firestore
// once (idempotent, guarded by a flag), then leave localStorage untouched as a
// backup.

(function () {
  var LEGACY_KEY = 'sport-tracker-v1';
  var MIGRATED_FLAG = 'sport-tracker-migrated-to-firestore';

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  // ---- Firestore helpers --------------------------------------------------

  function sessionsCol() {
    var uid = window.fb && window.fb.uid;
    if (!uid) throw new Error('not authenticated');
    return window.fb.db.collection('users').doc(uid).collection('sessions');
  }

  function planDoc() {
    var uid = window.fb && window.fb.uid;
    if (!uid) throw new Error('not authenticated');
    return window.fb.db.collection('users').doc(uid).collection('meta').doc('plan');
  }

  async function loadSessions() {
    var snap = await sessionsCol().get();
    return snap.docs.map(function (d) {
      var data = d.data();
      data.id = d.id;
      return data;
    });
  }

  // ---- Stats (unchanged logic, now over Firestore-loaded sessions) --------

  function isoWeekKey(date) {
    var d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    var yearStart = new Date(d.getFullYear(), 0, 1);
    var weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return d.getFullYear() + '-W' + String(weekNum).padStart(2, '0');
  }

  function computeStats(sessions) {
    var modules = ['run', 'yoga', 'kb', 'gym'];
    var total = {};
    var last = {};

    for (var i = 0; i < modules.length; i++) {
      var m = modules[i];
      var mine = sessions.filter(function (s) { return s.module === m; });
      total[m] = mine.length;
      if (mine.length > 0) {
        var sorted = mine.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
        last[m] = sorted[0];
      } else {
        last[m] = null;
      }
    }

    var today = new Date(todayISO());
    var dayMap = {};
    for (var j = 0; j < sessions.length; j++) {
      var s = sessions[j];
      if (!dayMap[s.date]) dayMap[s.date] = [];
      dayMap[s.date].push(s.module);
    }

    var days = [];
    for (var k = 89; k >= 0; k--) {
      var d = new Date(today);
      d.setDate(d.getDate() - k);
      var iso = d.toISOString().slice(0, 10);
      days.push({ date: iso, modules: dayMap[iso] || [] });
    }

    var weekSet = new Set(sessions.map(function (s) { return isoWeekKey(s.date); }));
    var streak = 0;
    var cursor = new Date(today);
    while (true) {
      if (weekSet.has(isoWeekKey(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 7);
      } else {
        break;
      }
    }

    // Sessions in the current ISO week (for the weekly-goal progress).
    var currentWeekKey = isoWeekKey(todayISO());
    var thisWeekCount = sessions.filter(function (s) { return isoWeekKey(s.date) === currentWeekKey; }).length;

    // Longest run of consecutive active weeks ever (insight, not a trophy).
    var longestStreak = 0;
    var sortedDates = sessions.map(function (s) { return s.date; }).filter(Boolean).sort();
    if (sortedDates.length) {
      var run = 0;
      var walk = new Date(sortedDates[0]);
      while (walk <= today) {
        if (weekSet.has(isoWeekKey(walk.toISOString().slice(0, 10)))) {
          run++; if (run > longestStreak) longestStreak = run;
        } else { run = 0; }
        walk.setDate(walk.getDate() + 7);
      }
    }

    // Weekly session counts (last 12 ISO weeks).
    var weekCount = {};
    for (var wi = 0; wi < sessions.length; wi++) {
      var wk0 = isoWeekKey(sessions[wi].date);
      weekCount[wk0] = (weekCount[wk0] || 0) + 1;
    }
    var weekly = [];
    for (var w = 11; w >= 0; w--) {
      var dW = new Date(today);
      dW.setDate(dW.getDate() - w * 7);
      var key = isoWeekKey(dW.toISOString().slice(0, 10));
      weekly.push({ week: key, count: weekCount[key] || 0 });
    }

    // Personal bests per gym exercise (heaviest set; reps at that weight).
    var prs = {};
    for (var pi = 0; pi < sessions.length; pi++) {
      var ps = sessions[pi];
      if (ps.module !== 'gym' || !Array.isArray(ps.sets)) continue;
      for (var sx = 0; sx < ps.sets.length; sx++) {
        var set = ps.sets[sx];
        if (!set || !set.exercise || typeof set.weight !== 'number') continue;
        if (!prs[set.exercise] || set.weight > prs[set.exercise].weight) {
          prs[set.exercise] = { weight: set.weight, reps: set.reps, date: ps.date };
        }
      }
    }

    return { total: total, last: last, days: days, streak: streak, weekly: weekly, prs: prs, weekCount: thisWeekCount, longestStreak: longestStreak };
  }

  // ---- Public API — same shape as before ----------------------------------

  window.api = {
    async getSessions() {
      var sessions = await loadSessions();
      sessions.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
      return { sessions: sessions };
    },

    async getSession(id) {
      var doc = await sessionsCol().doc(id).get();
      if (!doc.exists) return null;
      var data = doc.data();
      data.id = doc.id;
      return data;
    },

    async createSession(input) {
      var session = {
        date: input.date || todayISO(),
        module: input.module,
        variant: input.variant != null ? input.variant : null,
        sets: input.sets != null ? input.sets : [],
        notes: input.notes != null ? input.notes : '',
        duration: input.duration != null ? input.duration : null,
        distance: input.distance != null ? input.distance : null,
      };
      var id = uuid();
      await sessionsCol().doc(id).set(session);
      session.id = id;
      return session;
    },

    async patchSession(id, patch) {
      var ref = sessionsCol().doc(id);
      var allowed = ['sets', 'notes', 'duration', 'distance', 'variant'];
      var update = {};
      for (var i = 0; i < allowed.length; i++) {
        var key = allowed[i];
        if (key in patch) update[key] = patch[key];
      }
      await ref.set(update, { merge: true });
      var doc = await ref.get();
      if (!doc.exists) throw new Error('session ' + id + ' not found');
      var data = doc.data();
      data.id = doc.id;
      return data;
    },

    async deleteSession(id) {
      await sessionsCol().doc(id).delete();
    },

    async getStats() {
      var sessions = await loadSessions();
      return computeStats(sessions);
    },

    // Live subscriptions (Firestore onSnapshot) — return an unsubscribe fn.
    subscribeStats(cb) {
      try {
        return sessionsCol().onSnapshot(function (snap) {
          var sessions = snap.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; });
          cb(computeStats(sessions));
        }, function (e) { console.warn('subscribeStats failed:', e); });
      } catch (e) { return function () {}; }
    },

    subscribeSessions(cb) {
      try {
        return sessionsCol().onSnapshot(function (snap) {
          var sessions = snap.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; });
          sessions.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
          cb({ sessions: sessions });
        }, function (e) { console.warn('subscribeSessions failed:', e); });
      } catch (e) { return function () {}; }
    },

    // ---- Weekly plan (coach) — doc at users/{uid}/meta/plan ----------------
    async getPlan() {
      try { var d = await planDoc().get(); return d.exists ? d.data() : null; }
      catch (e) { return null; }
    },
    async setPlan(plan) {
      await planDoc().set(plan, { merge: false });
      return plan;
    },
    subscribePlan(cb) {
      try {
        return planDoc().onSnapshot(function (d) { cb(d.exists ? d.data() : null); },
          function (e) { console.warn('subscribePlan failed:', e); });
      } catch (e) { return function () {}; }
    },

    async exportAll() {
      var sessions = await loadSessions();
      return { sessions: sessions };
    },

    async importAll(data, mode) {
      mode = mode || 'merge';
      if (!data || !Array.isArray(data.sessions)) {
        throw new Error('invalid data: expected { sessions: [...] }');
      }
      var col = sessionsCol();

      if (mode === 'replace') {
        await this.wipeAll();
      }

      var existingIds = new Set();
      if (mode !== 'replace') {
        var snap = await col.get();
        snap.docs.forEach(function (d) { existingIds.add(d.id); });
      }

      var added = 0;
      var skipped = 0;
      var batch = window.fb.db.batch();
      var ops = 0;

      for (var i = 0; i < data.sessions.length; i++) {
        var s = Object.assign({}, data.sessions[i]);
        var id = s.id || uuid();
        delete s.id;
        if (mode !== 'replace' && existingIds.has(id)) { skipped++; continue; }
        batch.set(col.doc(id), s);
        added++;
        ops++;
        if (ops >= 400) { await batch.commit(); batch = window.fb.db.batch(); ops = 0; }
      }
      if (ops > 0) await batch.commit();

      return { added: added, skipped: skipped, total: added + skipped };
    },

    async wipeAll() {
      var col = sessionsCol();
      var snap = await col.get();
      var batch = window.fb.db.batch();
      var ops = 0;
      for (var i = 0; i < snap.docs.length; i++) {
        batch.delete(snap.docs[i].ref);
        ops++;
        if (ops >= 400) { await batch.commit(); batch = window.fb.db.batch(); ops = 0; }
      }
      if (ops > 0) await batch.commit();
    },

    // One-time migration from the old localStorage build. Idempotent.
    async _migrateFromLocalStorage() {
      try {
        if (localStorage.getItem(MIGRATED_FLAG)) return;
        var raw = localStorage.getItem(LEGACY_KEY);
        if (!raw) { localStorage.setItem(MIGRATED_FLAG, '1'); return; }
        var parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.sessions) || parsed.sessions.length === 0) {
          localStorage.setItem(MIGRATED_FLAG, '1');
          return;
        }
        var res = await this.importAll({ sessions: parsed.sessions }, 'merge');
        localStorage.setItem(MIGRATED_FLAG, '1');
        console.info('[migration] imported', res.added, 'session(s) from localStorage');
        if (window.showToast && res.added > 0) {
          window.showToast(res.added + ' Einheiten aus lokalem Speicher übernommen');
        }
      } catch (e) {
        console.warn('localStorage migration error:', e);
      }
    },
  };

  // Weekly-planner config (coach). Sport has multiple session types.
  window.PLAN_CONFIG = {
    calName: 'Sport Tracker',
    prodId: '-//Sport//Coach//DE',
    defaultTime: '18:00',
    types: [
      { key: 'gym',  label: 'Gym',        emoji: '🏋️', duration: 45 },
      { key: 'run',  label: 'Run',        emoji: '🏃', duration: 30 },
      { key: 'kb',   label: 'Kettlebell', emoji: '🔔', duration: 20 },
      { key: 'yoga', label: 'Yoga',       emoji: '🧘', duration: 30 },
    ],
  };
})();
