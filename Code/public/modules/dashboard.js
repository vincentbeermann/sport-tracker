// Dashboard module - calendar heatmap (last 90 days), streak, totals, last session per module.

window.DashboardModule = (function () {
  const MODULE_LABELS = { run: '🏃 Running', yoga: '🧘 Yoga', kb: '🔔 Kettlebell', gym: '🏋️ Gym' };
  const MODULE_COLORS = { run: '#47c8ff', yoga: '#a78bff', kb: '#ff7b47', gym: '#e8ff47' };

  function render() {
    const root = document.createElement('div');
    root.className = 'view';

    const placeholder = document.createElement('div');
    placeholder.className = 'card';
    placeholder.innerHTML = '<p class="muted">Lade Statistik...</p>';
    root.appendChild(placeholder);

    window.api.getStats().then(stats => {
      root.replaceChildren(...buildContent(stats));
    }).catch(e => {
      root.replaceChildren(errCard(e.message));
    });

    return root;
  }

  function buildContent(stats) {
    const out = [];

    // Streak + total summary
    const totalSessions = Object.values(stats.total).reduce((a, b) => a + b, 0);
    const summary = document.createElement('div');
    summary.className = 'card';
    summary.innerHTML = `
      <div class="dash-summary">
        <div>
          <div class="dash-stat">${stats.streak}</div>
          <div class="dash-label">Wochen Streak</div>
        </div>
        <div>
          <div class="dash-stat">${totalSessions}</div>
          <div class="dash-label">Sessions Total</div>
        </div>
        <div>
          <div class="dash-stat">${countLast7Days(stats.days)}</div>
          <div class="dash-label">Letzte 7 Tage</div>
        </div>
      </div>
    `;
    out.push(summary);

    // Calendar heatmap
    const cal = document.createElement('div');
    cal.className = 'card';
    cal.innerHTML = '<h3>Letzte 90 Tage</h3>';
    cal.appendChild(buildCalendar(stats.days));
    cal.appendChild(buildLegend());
    out.push(cal);

    // Per-module breakdown
    const breakdown = document.createElement('div');
    breakdown.className = 'card';
    breakdown.innerHTML = '<h3>Pro Modul</h3>';
    for (const m of ['run', 'yoga', 'kb', 'gym']) {
      const row = document.createElement('div');
      row.className = 'module-row';
      const last = stats.last[m];
      row.innerHTML = `
        <div class="module-row-head">
          <div class="module-dot" style="background:${MODULE_COLORS[m]};"></div>
          <span class="module-label">${MODULE_LABELS[m]}</span>
          <span class="module-total">${stats.total[m]}</span>
        </div>
        <div class="module-row-last muted">
          ${last ? `Zuletzt: ${formatDate(last.date)}${last.variant ? ' · Var ' + last.variant : ''}${summarizeSession(last)}` : 'Noch keine Session'}
        </div>
      `;
      breakdown.appendChild(row);
    }
    out.push(breakdown);

    // Reminders (push)
    out.push(buildRemindersCard());

    // Data management card (export / import / wipe)
    out.push(buildDataCard());

    return out;
  }

  function buildRemindersCard() {
    const card = document.createElement('div');
    card.className = 'card';
    const R = window.Reminders;
    const supported = R && R.supported;
    const perm = R ? R.permission() : 'unsupported';

    let statusLine;
    if (!supported) {
      statusLine = perm === 'unsupported'
        ? 'In diesem Browser nicht verfügbar.'
        : 'Nur in der installierten App (nicht im lokalen Dev).';
    } else if (perm === 'granted') {
      statusLine = 'Erinnerungen sind an. ✓';
    } else if (perm === 'denied') {
      statusLine = 'In den Browser-Einstellungen blockiert.';
    } else {
      statusLine = 'Tägliche Erinnerung, deine Einheit zu machen.';
    }

    card.innerHTML = `
      <h3>Erinnerungen</h3>
      <p class="muted" style="font-size:13px;">${statusLine}</p>
      <div class="data-actions">
        <button id="enable-reminders" class="secondary"${(!supported || perm === 'granted' || perm === 'denied') ? ' disabled' : ''}>Erinnerungen aktivieren</button>
      </div>
    `;

    const btn = card.querySelector('#enable-reminders');
    if (btn && supported && perm !== 'denied') {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Aktiviere…';
        const res = await window.Reminders.enable();
        if (res && res.ok) {
          if (window.showToast) window.showToast('Erinnerungen aktiviert');
        } else {
          if (window.showToast) window.showToast('Konnte nicht aktivieren');
        }
        document.getElementById('view').replaceChildren(render());
      });
    }
    return card;
  }

  function buildDataCard() {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>Daten</h3>
      <p class="muted" style="font-size:13px;">Über deinen Account geräteübergreifend synchronisiert. Export für ein lokales Backup.</p>
      <div class="data-actions">
        <button id="export-data" class="secondary">Export</button>
        <button id="import-data" class="secondary">Import</button>
        <button id="wipe-data" class="ghost">Alles löschen</button>
      </div>
      <input type="file" id="import-file" accept="application/json" style="display:none;">
    `;

    card.querySelector('#export-data').addEventListener('click', async () => {
      const data = await window.api.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sport-tracker-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.showToast(`${data.sessions.length} Sessions exportiert`);
    });

    const fileInput = card.querySelector('#import-file');
    card.querySelector('#import-data').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const mode = confirm(
          'Import-Modus:\n\n' +
          'OK = Merge (neue Sessions hinzufügen, vorhandene behalten)\n' +
          'Cancel = Replace (alles ersetzen)'
        ) ? 'merge' : 'replace';
        const result = await window.api.importAll(data, mode);
        window.showToast(`Import: +${result.added}, ${result.skipped} skipped`);
        // Re-render dashboard
        document.getElementById('view').replaceChildren(render());
      } catch (err) {
        alert('Import fehlgeschlagen: ' + err.message);
      }
      fileInput.value = '';
    });

    card.querySelector('#wipe-data').addEventListener('click', async () => {
      if (!confirm('Wirklich ALLE Sessions löschen? Das kann nicht rückgängig gemacht werden.')) return;
      if (!confirm('Wirklich wirklich? Letzte Warnung.')) return;
      await window.api.wipeAll();
      window.showToast('Alle Daten gelöscht');
      document.getElementById('view').replaceChildren(render());
    });

    return card;
  }

  function buildCalendar(days) {
    // 90 days, organize as columns of 7 (weeks).
    const cal = document.createElement('div');
    cal.className = 'cal-grid';

    // group days into weeks (Monday-first)
    const weeks = [];
    let week = [];
    days.forEach((d, i) => {
      const date = new Date(d.date);
      const weekday = (date.getDay() + 6) % 7; // 0=Mon
      if (i === 0 && weekday !== 0) {
        // pad with empty cells
        for (let j = 0; j < weekday; j++) week.push(null);
      }
      week.push(d);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    });
    if (week.length) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }

    for (const w of weeks) {
      const col = document.createElement('div');
      col.className = 'cal-col';
      for (const day of w) {
        const cell = document.createElement('div');
        cell.className = 'cal-cell';
        if (day) {
          if (day.modules.length > 0) {
            cell.classList.add('has-session');
            // pick first module's color
            cell.style.background = MODULE_COLORS[day.modules[0]] || 'var(--accent)';
            cell.title = `${day.date}: ${day.modules.join(', ')}`;
          } else {
            cell.title = day.date;
          }
        } else {
          cell.classList.add('empty');
        }
        col.appendChild(cell);
      }
      cal.appendChild(col);
    }
    return cal;
  }

  function buildLegend() {
    const wrap = document.createElement('div');
    wrap.className = 'cal-legend';
    for (const m of ['run', 'yoga', 'kb', 'gym']) {
      const item = document.createElement('div');
      item.innerHTML = `<span class="legend-dot" style="background:${MODULE_COLORS[m]};"></span>${MODULE_LABELS[m]}`;
      wrap.appendChild(item);
    }
    return wrap;
  }

  function countLast7Days(days) {
    const last7 = days.slice(-7);
    return last7.filter(d => d.modules.length > 0).length;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    const today = new Date(); today.setHours(0,0,0,0);
    const t = new Date(iso); t.setHours(0,0,0,0);
    const diff = Math.round((today - t) / 86400000);
    if (diff === 0) return 'heute';
    if (diff === 1) return 'gestern';
    if (diff < 7) return `vor ${diff} Tagen`;
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  }

  function summarizeSession(s) {
    if (s.module === 'gym' && s.sets && s.sets.length > 0) {
      return ` · ${s.sets.length} Sets`;
    }
    if (s.module === 'run') {
      const parts = [];
      if (s.duration) parts.push(`${s.duration}min`);
      if (s.distance) parts.push(`${s.distance}km`);
      return parts.length ? ' · ' + parts.join(' ') : '';
    }
    if (s.module === 'kb' || s.module === 'yoga') {
      return s.duration ? ` · ${s.duration}min` : '';
    }
    return '';
  }

  function errCard(msg) {
    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML = `<p style="color:var(--danger);">Fehler: ${msg}</p>`;
    return c;
  }

  return { render, reset: () => {} };
})();
