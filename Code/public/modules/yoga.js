// Yoga module - inspiration list, then a free-text log.

window.YogaModule = (function () {
  function render() {
    const root = document.createElement('div');
    root.className = 'view view-center';

    const inspire = document.createElement('div');
    inspire.className = 'card';
    inspire.innerHTML = `
      <h3>Inspiration</h3>
      <p class="muted">Eigene Praxis, Klasse, oder Video. Hier ein paar Vorschläge:</p>
      <ul class="cues">
        ${window.YOGA_POSES.map(p => `<li><strong>${p.name}</strong> - <span class="muted">${p.hint}</span></li>`).join('')}
      </ul>
    `;
    root.appendChild(inspire);

    const log = document.createElement('div');
    log.className = 'card stack';
    log.innerHTML = `
      <h3>Loggen</h3>
      <div>
        <label class="muted">Dauer (Minuten)</label>
        <input type="number" id="yoga-duration" placeholder="z.B. 45" inputmode="numeric">
      </div>
      <div>
        <label class="muted">Was hast du gemacht?</label>
        <textarea id="yoga-what" rows="5" placeholder="Klasse / YouTube / eigene Sequenz / Schwerpunkt..."></textarea>
      </div>
      <button id="save-yoga">Speichern</button>
    `;

    log.querySelector('#save-yoga').addEventListener('click', async () => {
      const duration = parseInt(log.querySelector('#yoga-duration').value, 10);
      const notes = log.querySelector('#yoga-what').value;
      if (isNaN(duration) || duration <= 0) {
        alert('Bitte Dauer angeben.');
        return;
      }
      try {
        await window.api.createSession({
          module: 'yoga',
          duration,
          notes,
        });
        showToast('Yoga gespeichert');
        log.querySelector('#yoga-duration').value = '';
        log.querySelector('#yoga-what').value = '';
        window.location.hash = '#dashboard';
      } catch (e) {
        alert('Speichern fehlgeschlagen: ' + e.message);
      }
    });

    root.appendChild(log);
    return root;
  }

  return { render, reset: () => {} };
})();
