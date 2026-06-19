// Gym module - main lifts, set logger with auto-save, exercise detail panels.
// Phases:
//   variant-pick: choose A (squat focus) or B (deadlift focus)
//   workout: render exercise list, log sets, optionally open detail panel

window.GymModule = (function () {
  let state = null;  // { sessionId, variant, sets: [...] }

  function render() {
    const root = document.createElement('div');
    root.className = 'view';
    if (!state) {
      root.appendChild(renderVariantPicker());
    } else {
      root.appendChild(renderWorkout());
    }
    return root;
  }

  function renderVariantPicker() {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="card">
        <h3>Wähle deinen Fokus</h3>
        <p class="muted">Full Body 3x6, compound. Picke einen.</p>
      </div>
      <div class="tile-grid" id="variant-tiles">
        <button class="tile variant-tile" data-variant="A">
          <span class="label">Variante A</span>
          <span class="value">Squat</span>
          <span class="muted" style="font-size:13px;">Back Squat / Row / Chin-Up + RDL + Incline</span>
        </button>
        <button class="tile variant-tile" data-variant="B">
          <span class="label">Variante B</span>
          <span class="value">Deadlift</span>
          <span class="muted" style="font-size:13px;">Deadlift / Row / Chin-Up + Front Squat + Dips</span>
        </button>
      </div>
    `;
    wrap.querySelectorAll('.variant-tile').forEach(btn => {
      btn.addEventListener('click', () => startWorkout(btn.dataset.variant));
    });
    return wrap;
  }

  async function startWorkout(variant) {
    const session = await window.api.createSession({ module: 'gym', variant, sets: [] });
    state = { sessionId: session.id, variant, sets: [], lastByExercise: {} };
    rerender();
    // Load "last time" per exercise from previous gym sessions (non-blocking).
    try {
      const { sessions } = await window.api.getSessions();
      state.lastByExercise = computeLastByExercise(sessions, session.id);
      if (state) rerender();
    } catch (e) { /* ignore */ }
  }

  // For each exercise, the sets from the most recent PRIOR gym session that
  // included it. getSessions() returns newest-first, so the first hit wins.
  function computeLastByExercise(sessions, currentId) {
    const map = {};
    for (const s of sessions) {
      if (s.module !== 'gym' || s.id === currentId || !Array.isArray(s.sets)) continue;
      const byEx = {};
      for (const set of s.sets) {
        if (!set || !set.exercise) continue;
        (byEx[set.exercise] = byEx[set.exercise] || []).push(set);
      }
      for (const ex in byEx) {
        if (!map[ex]) map[ex] = { date: s.date, sets: byEx[ex] };
      }
    }
    return map;
  }

  function renderWorkout() {
    const wrap = document.createElement('div');
    const workout = window.GYM_WORKOUTS[state.variant];

    const header = document.createElement('div');
    header.className = 'card';
    header.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <div>
          <h3 style="margin:0;">Variante ${state.variant}</h3>
          <span class="muted">${workout.name}</span>
        </div>
        <button class="ghost" id="end-workout">Beenden</button>
      </div>
    `;
    header.querySelector('#end-workout').addEventListener('click', () => {
      if (confirm('Workout beenden? Sets bleiben gespeichert.')) {
        discardIfEmpty();
        stopRest(false);
        state = null;
        rerender();
      }
    });
    wrap.appendChild(header);

    wrap.appendChild(renderSection('Hauptübungen', workout.main));
    wrap.appendChild(renderSection('Accessory', workout.accessory));
    wrap.appendChild(renderSection('Core', workout.core));
    return wrap;
  }

  function renderSection(title, exercises) {
    const sec = document.createElement('div');
    sec.className = 'card';
    const h = document.createElement('h3');
    h.textContent = title;
    sec.appendChild(h);

    for (const ex of exercises) {
      sec.appendChild(renderExerciseRow(ex));
    }
    return sec;
  }

  function renderExerciseRow(ex) {
    const row = document.createElement('div');
    row.className = 'exercise';

    const head = document.createElement('div');
    head.className = 'exercise-head';
    head.innerHTML = `
      <div class="exercise-name">
        <span class="name">${ex.exercise}</span>
        <span class="muted">${ex.sets}x${ex.reps}</span>
      </div>
      <button class="info-btn" aria-label="Coaching cues">?</button>
    `;
    row.appendChild(head);

    const detail = document.createElement('div');
    detail.className = 'exercise-detail collapsed';
    row.appendChild(detail);
    let detailBuilt = false;

    head.querySelector('.info-btn').addEventListener('click', () => {
      // Build the (continuously-animated) coaching panel lazily on first open,
      // so collapsed exercises don't run animations off-screen.
      if (!detailBuilt) { detail.appendChild(renderDetailContent(ex.exercise)); detailBuilt = true; }
      detail.classList.toggle('collapsed');
    });

    row.appendChild(renderSetLogger(ex));
    return row;
  }

  function renderDetailContent(exerciseName) {
    const data = window.EXERCISES[exerciseName];
    const wrap = document.createElement('div');
    if (!data) {
      wrap.innerHTML = '<p class="muted">Keine Details verfügbar.</p>';
      return wrap;
    }

    wrap.innerHTML = `
      <div class="anim anim-${data.anim}" aria-hidden="true">
        <div class="anim-stage"></div>
      </div>
      <ul class="cues">
        ${data.cues.map(c => `<li>${c}</li>`).join('')}
      </ul>
    `;
    return wrap;
  }

  function renderSetLogger(ex) {
    const wrap = document.createElement('div');
    wrap.className = 'set-logger';

    // "Last time" reference from the previous gym session.
    const last = state.lastByExercise && state.lastByExercise[ex.exercise];
    if (last && last.sets.length) {
      const lastLine = document.createElement('div');
      lastLine.className = 'exercise-last';
      lastLine.textContent = 'Letztes Mal: ' + last.sets.map(s => `${s.weight}×${s.reps}`).join(' · ');
      wrap.appendChild(lastLine);
    }

    const list = document.createElement('div');
    list.className = 'set-list';

    const existing = state.sets.filter(s => s.exercise === ex.exercise);

    function rerenderList() {
      list.innerHTML = '';
      const current = state.sets.filter(s => s.exercise === ex.exercise);
      current.forEach((s, idx) => {
        const row = document.createElement('div');
        row.className = 'set-row logged';
        row.innerHTML = `
          <span class="set-num">#${idx + 1}</span>
          <span class="set-val">${s.weight} kg</span>
          <span class="set-x">×</span>
          <span class="set-val">${s.reps}</span>
          <button class="set-del" aria-label="Set löschen">×</button>
        `;
        row.querySelector('.set-del').addEventListener('click', () => {
          // remove this exercise's nth occurrence from state.sets
          let count = -1;
          state.sets = state.sets.filter(s2 => {
            if (s2.exercise !== ex.exercise) return true;
            count++;
            return count !== idx;
          });
          saveSets();
          rerenderList();
        });
        list.appendChild(row);
      });
    }

    rerenderList();
    wrap.appendChild(list);

    // Input row for adding the next set
    const input = document.createElement('div');
    input.className = 'set-row input';
    input.innerHTML = `
      <input type="number" class="weight-in" placeholder="kg" step="2.5" min="0" max="1000" inputmode="decimal">
      <span class="set-x">×</span>
      <input type="number" class="reps-in" placeholder="reps" min="1" max="100" inputmode="numeric">
      <button class="add-set">+</button>
    `;
    const weightIn = input.querySelector('.weight-in');
    const repsIn   = input.querySelector('.reps-in');
    const addBtn   = input.querySelector('.add-set');

    // Pre-fill the weight: this session's last set, else last time's top set.
    if (existing.length > 0) {
      weightIn.value = existing[existing.length - 1].weight;
    } else if (last && last.sets.length) {
      weightIn.value = last.sets[last.sets.length - 1].weight;
    }

    function commitSet() {
      const w = parseFloat(weightIn.value);
      const r = parseInt(repsIn.value, 10);
      // Reject empty / negative / absurd values silently.
      if (isNaN(w) || w < 0 || w > 1000 || isNaN(r) || r <= 0 || r > 100) return;
      state.sets.push({ exercise: ex.exercise, weight: w, reps: r });
      saveSets();
      rerenderList();
      startRest(window.Settings ? window.Settings.get('gymRest', 90) : 90); // rest timer
      // keep weight, clear reps for the next set
      repsIn.value = '';
      repsIn.focus();
    }

    addBtn.addEventListener('click', commitSet);
    repsIn.addEventListener('keydown', e => { if (e.key === 'Enter') commitSet(); });
    weightIn.addEventListener('keydown', e => { if (e.key === 'Enter') repsIn.focus(); });

    wrap.appendChild(input);
    return wrap;
  }

  // Auto-save current sets (debounced).
  let saveTimer = null;
  function saveSets() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await window.api.patchSession(state.sessionId, { sets: state.sets });
      } catch (e) {
        console.warn('Set save failed:', e);
      }
    }, 250);
  }

  function rerender() {
    document.getElementById('view').replaceChildren(render());
  }

  // ---------- rest timer (floating bar) ----------

  let audioCtx = null;
  function beep(freq, ms) {
    if (window.Settings && !window.Settings.soundOn()) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = freq; o.type = 'sine';
      const n = audioCtx.currentTime;
      g.gain.setValueAtTime(0, n);
      g.gain.linearRampToValueAtTime(0.2, n + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, n + ms / 1000);
      o.connect(g).connect(audioCtx.destination);
      o.start(n); o.stop(n + ms / 1000 + 0.05);
    } catch (e) {}
  }
  function vibrate(ms) {
    if (window.Settings && !window.Settings.vibrateOn()) return;
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  }

  let restEndMs = 0, restTimer = null;

  function getRestBar() {
    let bar = document.getElementById('rest-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'rest-bar';
      bar.innerHTML = `
        <span class="rest-label">Pause</span>
        <span class="rest-time">0:00</span>
        <button type="button" class="rest-add">+30s</button>
        <button type="button" class="rest-skip">Skip</button>
      `;
      bar.querySelector('.rest-add').addEventListener('click', () => { restEndMs += 30000; paintRest(); });
      bar.querySelector('.rest-skip').addEventListener('click', () => stopRest(false));
      document.body.appendChild(bar);
    }
    return bar;
  }
  function paintRest() {
    const bar = getRestBar();
    const remaining = Math.max(0, Math.round((restEndMs - Date.now()) / 1000));
    bar.querySelector('.rest-time').textContent = Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2, '0');
  }
  function startRest(seconds) {
    restEndMs = Date.now() + seconds * 1000;
    getRestBar().classList.add('show');
    paintRest();
    clearInterval(restTimer);
    restTimer = setInterval(() => {
      if (Date.now() >= restEndMs) { stopRest(true); return; }
      paintRest();
    }, 250);
  }
  function stopRest(rang) {
    clearInterval(restTimer); restTimer = null;
    const bar = document.getElementById('rest-bar');
    if (!bar) return;
    if (rang) {
      bar.querySelector('.rest-time').textContent = 'fertig';
      beep(880, 260); vibrate(140);
      setTimeout(() => bar.classList.remove('show'), 1600);
    } else {
      bar.classList.remove('show');
    }
  }

  // Discard a gym session that was opened but never had a set logged, so empty
  // workouts don't pollute the calendar/stats.
  function discardIfEmpty() {
    if (state && state.sessionId && (!state.sets || state.sets.length === 0)) {
      window.api.deleteSession(state.sessionId).catch(() => {});
    }
  }

  return {
    render,
    reset: () => { discardIfEmpty(); stopRest(false); state = null; },
  };
})();
