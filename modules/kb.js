// Kettlebell HIIT module - guided timer workout.
// Phases: variant-pick → workout (sequenced segments) → done (auto-log)
//
// A "segment" is { type: 'work'|'rest'|'ready', exercise, reps, duration, badge }.
// We build the full segment queue when the workout starts, then walk through it
// using a Date.now()-based timer (immune to setTimeout drift over 20+ minutes).

window.KbModule = (function () {
  let state = null;
  // {
  //   variant, segments, idx, startMs, pausedAccumMs, pauseStartMs, paused,
  //   workoutStartedAt, totalDurationS, rafId
  // }

  function render() {
    const root = document.createElement('div');
    root.className = 'view';
    if (!state) {
      root.appendChild(renderVariantPicker());
    } else if (state.idx >= state.segments.length) {
      root.appendChild(renderDone());
    } else {
      root.appendChild(renderActive());
    }
    return root;
  }

  function renderVariantPicker() {
    const wrap = document.createElement('div');
    const a = window.KB_WORKOUTS.A;
    const b = window.KB_WORKOUTS.B;
    wrap.innerHTML = `
      <div class="card">
        <h3>Wähle deine Session</h3>
        <p class="muted">Beide ~30 min (warm-up + main + core finisher).</p>
      </div>

      <div class="card option-card" data-variant="A">
        <div class="opt-head"><span class="opt-letter">A</span><h3>${a.name}</h3></div>
        <p class="muted">${a.description}</p>
        <p style="font-size:14px;margin-top:8px;">${a.main.map(e => e.name).join(' · ')}</p>
      </div>

      <div class="card option-card" data-variant="B">
        <div class="opt-head"><span class="opt-letter">B</span><h3>${b.name}</h3></div>
        <p class="muted">${b.description}</p>
        <p style="font-size:14px;margin-top:8px;">${b.main.map(e => e.name).join(' · ')}</p>
      </div>
    `;
    wrap.querySelectorAll('.option-card').forEach(card => {
      card.addEventListener('click', () => startWorkout(card.dataset.variant));
    });
    return wrap;
  }

  function buildSegments(variant) {
    const w = window.KB_WORKOUTS[variant];
    const segs = [];

    function addPhase(label, items, rounds = 1) {
      for (let r = 0; r < rounds; r++) {
        for (const item of items) {
          segs.push({
            type: 'ready',
            exercise: item.name,
            reps: item.reps,
            duration: 5,
            phase: label,
            round: rounds > 1 ? `${r + 1}/${rounds}` : null,
          });
          segs.push({
            type: 'work',
            exercise: item.name,
            reps: item.reps,
            duration: item.duration,
            phase: label,
            round: rounds > 1 ? `${r + 1}/${rounds}` : null,
          });
          if (item.rest && item.rest > 0) {
            segs.push({
              type: 'rest',
              exercise: 'Pause',
              reps: '',
              duration: item.rest,
              phase: label,
              round: rounds > 1 ? `${r + 1}/${rounds}` : null,
            });
          }
        }
      }
    }

    addPhase('Warm-up', w.warmup);
    addPhase('Main', w.main, w.mainRounds);
    addPhase('Finisher', w.finisher);
    return segs;
  }

  async function startWorkout(variant) {
    const segments = buildSegments(variant);
    const totalDurationS = segments.reduce((sum, s) => sum + s.duration, 0);
    state = {
      variant,
      segments,
      idx: 0,
      startMs: Date.now(),
      pausedAccumMs: 0,
      pauseStartMs: null,
      paused: false,
      workoutStartedAt: Date.now(),
      totalDurationS,
      rafId: null,
      sessionId: null,
    };
    rerender();
    tickLoop();
  }

  function currentSegment() {
    return state.segments[state.idx];
  }

  function elapsedInSegment() {
    if (state.paused) {
      return (state.pauseStartMs - state.startMs - state.pausedAccumMs) / 1000;
    }
    return (Date.now() - state.startMs - state.pausedAccumMs) / 1000;
  }

  function remainingInSegment() {
    return Math.max(0, currentSegment().duration - elapsedInSegment());
  }

  function nextSegment() {
    state.idx++;
    state.startMs = Date.now();
    state.pausedAccumMs = 0;
    if (state.idx >= state.segments.length) {
      finishWorkout();
      return;
    }
    beep(currentSegment().type === 'work' ? 880 : 440);
    refreshActiveView();
  }

  function tickLoop() {
    if (!state || state.paused) return;
    if (state.idx >= state.segments.length) return;

    if (remainingInSegment() <= 0) {
      nextSegment();
    } else {
      refreshActiveView();
    }
    state.rafId = requestAnimationFrame(tickLoop);
  }

  function pauseToggle() {
    if (state.paused) {
      // resume
      state.pausedAccumMs += Date.now() - state.pauseStartMs;
      state.pauseStartMs = null;
      state.paused = false;
      tickLoop();
    } else {
      state.paused = true;
      state.pauseStartMs = Date.now();
      cancelAnimationFrame(state.rafId);
    }
    refreshActiveView();
  }

  async function finishWorkout() {
    cancelAnimationFrame(state.rafId);
    const durationMin = Math.round((Date.now() - state.workoutStartedAt) / 60000);
    try {
      const session = await window.api.createSession({
        module: 'kb',
        variant: state.variant,
        duration: durationMin,
        notes: window.KB_WORKOUTS[state.variant].name,
      });
      state.sessionId = session.id;
    } catch (e) {
      console.warn('KB auto-log failed:', e);
    }
    rerender();
  }

  function refreshActiveView() {
    const view = document.getElementById('view');
    const existing = view.querySelector('.kb-active');
    if (!existing) return;
    existing.replaceWith(buildActiveContent());
  }

  function buildActiveContent() {
    const seg = currentSegment();
    const next = state.segments[state.idx + 1];
    const remain = Math.ceil(remainingInSegment());

    const wrap = document.createElement('div');
    wrap.className = 'kb-active';
    wrap.innerHTML = `
      <div class="kb-meta">
        <span>${seg.phase}${seg.round ? ' · ' + seg.round : ''}</span>
        <span>${state.idx + 1}/${state.segments.length}</span>
      </div>
      <div class="kb-stage kb-stage-${seg.type}">
        <div class="kb-type-badge">${seg.type === 'ready' ? 'GET READY' : seg.type === 'work' ? 'WORK' : 'REST'}</div>
        <div class="kb-exercise">${seg.exercise}</div>
        ${seg.reps ? `<div class="kb-reps">${seg.reps}</div>` : ''}
        <div class="kb-timer">${formatTime(remain)}</div>
      </div>
      <div class="kb-next">
        ${next ? `<span class="muted">Nächste:</span> <strong>${next.exercise}</strong> <span class="muted">${next.reps || ''}</span>` : '<span class="muted">Letzte Übung!</span>'}
      </div>
      <div class="kb-controls">
        <button class="ghost" id="kb-skip">Überspringen</button>
        <button id="kb-pause">${state.paused ? 'Weiter' : 'Pause'}</button>
        <button class="ghost" id="kb-end">Beenden</button>
      </div>
    `;

    wrap.querySelector('#kb-pause').addEventListener('click', pauseToggle);
    wrap.querySelector('#kb-skip').addEventListener('click', () => {
      cancelAnimationFrame(state.rafId);
      nextSegment();
      tickLoop();
    });
    wrap.querySelector('#kb-end').addEventListener('click', () => {
      if (confirm('Workout abbrechen? Wird trotzdem geloggt.')) {
        cancelAnimationFrame(state.rafId);
        finishWorkout();
      }
    });

    return wrap;
  }

  function renderActive() {
    return buildActiveContent();
  }

  function renderDone() {
    const wrap = document.createElement('div');
    const elapsedMin = Math.round((Date.now() - state.workoutStartedAt) / 60000);
    const w = window.KB_WORKOUTS[state.variant];
    wrap.innerHTML = `
      <div class="card" style="text-align:center;">
        <h3 style="color:var(--accent);">Done</h3>
        <p class="muted">${w.name}</p>
        <div style="font-family:'Barlow Condensed';font-size:48px;color:var(--accent);margin:16px 0;">${elapsedMin} min</div>
        <p class="muted">Auto-geloggt.</p>
      </div>
      <button id="kb-back">Zurück zum Dashboard</button>
    `;
    wrap.querySelector('#kb-back').addEventListener('click', () => {
      state = null;
      window.location.hash = '#dashboard';
    });
    return wrap;
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  let audioCtx = null;
  function beep(freq = 880, durationMs = 150) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.value = 0.15;
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + durationMs / 1000);
    } catch (e) {
      // audio context might be blocked until user interaction
    }
  }

  function rerender() {
    document.getElementById('view').replaceChildren(render());
  }

  return { render, reset: () => { if (state) cancelAnimationFrame(state.rafId); state = null; } };
})();
