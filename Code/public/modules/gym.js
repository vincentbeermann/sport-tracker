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
    state = { sessionId: session.id, variant, sets: [] };
    rerender();
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
    detail.appendChild(renderDetailContent(ex.exercise));
    row.appendChild(detail);

    head.querySelector('.info-btn').addEventListener('click', () => {
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
      <input type="number" class="weight-in" placeholder="kg" step="2.5" inputmode="decimal">
      <span class="set-x">×</span>
      <input type="number" class="reps-in" placeholder="reps" inputmode="numeric">
      <button class="add-set">+</button>
    `;
    const weightIn = input.querySelector('.weight-in');
    const repsIn   = input.querySelector('.reps-in');
    const addBtn   = input.querySelector('.add-set');

    // Pre-fill with last set's weight for convenience
    if (existing.length > 0) {
      const last = existing[existing.length - 1];
      weightIn.value = last.weight;
    }

    function commitSet() {
      const w = parseFloat(weightIn.value);
      const r = parseInt(repsIn.value, 10);
      if (isNaN(w) || isNaN(r) || r <= 0) return;
      state.sets.push({ exercise: ex.exercise, weight: w, reps: r });
      saveSets();
      rerenderList();
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

  return { render, reset: () => { state = null; } };
})();
