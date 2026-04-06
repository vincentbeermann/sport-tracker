// Running module - pre-screen with two options, then a log form.

window.RunModule = (function () {
  let state = { phase: 'info', selected: null };

  function render() {
    const root = document.createElement('div');
    root.className = 'view';
    if (state.phase === 'info') {
      root.appendChild(renderInfo());
    } else {
      root.appendChild(renderLog());
    }
    return root;
  }

  function renderInfo() {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="card">
        <h3>Wähle deinen Run</h3>
        <p class="muted">Beide Optionen starten mit 5 min warm-up und enden mit 5 min cool-down + stretch.</p>
      </div>

      <div class="card option-card" data-opt="A">
        <div class="opt-head"><span class="opt-letter">A</span><h3>Steady State</h3></div>
        <ul class="cues">
          <li>5 min warm-up (locker traben)</li>
          <li>20-40 min bei 65-75% max HR (Nasenatmung-Tempo)</li>
          <li>5 min cool-down + stretch</li>
        </ul>
        <p class="muted" style="margin-top:12px;">Du kannst Nasenatmen ohne keuchen → richtiges Tempo.</p>
      </div>

      <div class="card option-card" data-opt="B">
        <div class="opt-head"><span class="opt-letter">B</span><h3>Intervals</h3></div>
        <ul class="cues">
          <li>5 min warm-up</li>
          <li>6 × 3 min hard / 90 sec easy</li>
          <li>5 min cool-down + stretch</li>
        </ul>
        <p class="muted" style="margin-top:12px;">Hard = du kannst nicht sprechen, nur Wörter rausquetschen.</p>
      </div>

      <div style="display:flex;gap:12px;">
        <button class="primary" id="start-run" disabled>Bin gelaufen → loggen</button>
      </div>
    `;
    let selected = null;
    const startBtn = wrap.querySelector('#start-run');

    wrap.querySelectorAll('.option-card').forEach(card => {
      card.addEventListener('click', () => {
        selected = card.dataset.opt;
        wrap.querySelectorAll('.option-card').forEach(c => c.classList.toggle('selected', c === card));
        startBtn.disabled = false;
      });
    });

    startBtn.addEventListener('click', () => {
      if (!selected) return;
      state.selected = selected;
      state.phase = 'log';
      rerender();
    });

    return wrap;
  }

  function renderLog() {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="card">
        <h3>Run loggen</h3>
        <p class="muted">Variante ${state.selected === 'A' ? 'A - Steady State' : 'B - Intervals'}</p>
      </div>

      <div class="card stack">
        <div>
          <label class="muted">Dauer (Minuten)</label>
          <input type="number" id="run-duration" placeholder="z.B. 35" inputmode="numeric">
        </div>
        <div>
          <label class="muted">Distanz (km, optional)</label>
          <input type="number" id="run-distance" placeholder="z.B. 6.5" step="0.1" inputmode="decimal">
        </div>
        <div>
          <label class="muted">Notiz (optional)</label>
          <textarea id="run-notes" rows="3" placeholder="Wie war's? Wetter? Pace?"></textarea>
        </div>
        <div style="display:flex;gap:12px;">
          <button class="ghost" id="back">Zurück</button>
          <button id="save-run" style="flex:1;">Speichern</button>
        </div>
      </div>
    `;

    wrap.querySelector('#back').addEventListener('click', () => {
      state.phase = 'info';
      rerender();
    });

    wrap.querySelector('#save-run').addEventListener('click', async () => {
      const duration = parseInt(wrap.querySelector('#run-duration').value, 10);
      const distance = parseFloat(wrap.querySelector('#run-distance').value);
      const notes = wrap.querySelector('#run-notes').value;

      if (isNaN(duration) || duration <= 0) {
        alert('Bitte Dauer angeben.');
        return;
      }

      try {
        await window.api.createSession({
          module: 'run',
          variant: state.selected,
          duration,
          distance: isNaN(distance) ? null : distance,
          notes,
        });
        state = { phase: 'info', selected: null };
        showToast('Run gespeichert');
        window.location.hash = '#dashboard';
      } catch (e) {
        alert('Speichern fehlgeschlagen: ' + e.message);
      }
    });

    return wrap;
  }

  function rerender() {
    document.getElementById('view').replaceChildren(render());
  }

  return { render, reset: () => { state = { phase: 'info', selected: null }; } };
})();
