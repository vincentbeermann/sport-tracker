// Dashboard module - calendar heatmap (last 90 days), streak, totals, last session per module.

window.DashboardModule = (function () {
  const MODULE_LABELS = { run: '🏃 Running', yoga: '🧘 Yoga', kb: '🔔 Kettlebell', gym: '🏋️ Gym' };
  const MODULE_COLORS = { run: '#47c8ff', yoga: '#a78bff', kb: '#ff7b47', gym: '#e8ff47' };

  let unsub = null;

  function render() {
    const root = document.createElement('div');
    root.className = 'view';

    const placeholder = document.createElement('div');
    placeholder.className = 'card';
    placeholder.innerHTML = '<p class="muted">Lade Statistik...</p>';
    root.appendChild(placeholder);

    if (unsub) { unsub(); unsub = null; }
    if (window.api.subscribeStats) {
      // Live: re-render whenever Firestore data changes (any device).
      unsub = window.api.subscribeStats(stats => {
        root.replaceChildren(...buildContent(stats));
      });
    } else {
      window.api.getStats().then(stats => {
        root.replaceChildren(...buildContent(stats));
      }).catch(e => {
        root.replaceChildren(errCard(e.message));
      });
    }

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

    out.push(buildHeroCard());

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

    // Trend (weekly sessions) + personal bests
    out.push(buildTrendCard(stats));

    // Competence feedback (coach)
    var comp = buildCompetenceCard(stats);
    if (comp) out.push(comp);

    // Weekly plan (coach)
    out.push(buildPlanCard(stats));

    // Reminders (push)
    out.push(buildRemindersCard());

    // Settings
    out.push(buildSettingsCard());

    // Data management card (export / import / wipe)
    out.push(buildDataCard());

    return out;
  }

  function buildTrendCard(stats) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h3>Verlauf</h3>';

    const max = Math.max(1, ...stats.weekly.map(w => w.count));
    const chart = document.createElement('div');
    chart.className = 'weekly-chart';
    stats.weekly.forEach(w => {
      const col = document.createElement('div');
      col.className = 'weekly-col';
      const h = Math.round((w.count / max) * 100);
      col.innerHTML = `<div class="weekly-bar" style="height:${w.count > 0 ? Math.max(8, h) : 0}%;" title="${w.count} Einheiten"></div>`;
      chart.appendChild(col);
    });
    card.appendChild(chart);

    const cap = document.createElement('p');
    cap.className = 'muted';
    cap.style.cssText = 'font-size:11px;text-align:center;margin-top:6px;';
    cap.textContent = 'Einheiten/Woche · letzte 12 Wochen';
    card.appendChild(cap);

    const prKeys = Object.keys(stats.prs || {});
    if (prKeys.length) {
      const h = document.createElement('h3');
      h.textContent = 'Bestleistungen';
      h.style.marginTop = '18px';
      card.appendChild(h);
      const list = document.createElement('div');
      list.className = 'pr-list';
      prKeys.forEach(ex => {
        const pr = stats.prs[ex];
        const row = document.createElement('div');
        row.className = 'pr-row';
        row.innerHTML = `<span class="pr-ex">${ex}</span><span class="pr-val">${pr.weight} kg × ${pr.reps}</span>`;
        list.appendChild(row);
      });
      card.appendChild(list);
    }

    return card;
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

  // Lower the activation energy: one tap to start. If today has a planned
  // session, point the button straight at that workout type.
  function buildHeroCard() {
    var card = document.createElement('div');
    card.className = 'card hero-card';
    var btn = document.createElement('button');
    btn.className = 'hero-btn';
    btn.textContent = 'Jetzt starten';
    var route = '#gym';
    btn.addEventListener('click', function () { location.hash = route; });
    card.appendChild(btn);
    if (window.api.getPlan) {
      window.api.getPlan().then(function (p) {
        if (!p || !Array.isArray(p.items)) return;
        var wd = (new Date().getDay() + 6) % 7;
        var it = p.items.filter(function (i) { return i.day === wd; })
          .sort(function (a, b) { return String(a.time).localeCompare(String(b.time)); })[0];
        if (!it) return;
        var routes = { gym: '#gym', run: '#run', kb: '#kb', yoga: '#yoga' };
        var labels = { gym: 'Gym', run: 'Run', kb: 'Kettlebell', yoga: 'Yoga' };
        route = routes[it.type] || '#gym';
        btn.textContent = 'Jetzt: ' + (labels[it.type] || 'Training') + (it.time ? ' (' + it.time + ')' : '');
      }).catch(function () {});
    }
    return card;
  }

  // Competence feedback (SDT). Robust comparison only; silent when sparse.
  function buildCompetenceCard(stats) {
    if (!stats || !stats.weekly || stats.weekly.length < 2) return null;
    var weekly = stats.weekly;
    var cur = weekly[weekly.length - 1].count;
    var prior = weekly.slice(0, -1).map(function (w) { return w.count; }).filter(function (c) { return c > 0; });
    if (prior.length < 2) return null;
    var avg = prior.reduce(function (a, b) { return a + b; }, 0) / prior.length;
    var maxCount = Math.max.apply(null, weekly.map(function (w) { return w.count; }));
    var unit = cur === 1 ? 'Einheit' : 'Einheiten';
    var line;
    if (cur > 0 && cur === maxCount) {
      line = 'Diese Woche ' + cur + ' ' + unit + ' — deine stärkste Woche bisher. 💪';
    } else if (avg > 0 && cur >= avg) {
      var pct = Math.round((cur - avg) / avg * 100);
      line = 'Diese Woche ' + cur + ' ' + unit + ' — ' + pct + '% über deinem Schnitt.';
    } else {
      return null; // below average: stay silent, no discouraging comparison
    }
    var card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h3>Diese Woche</h3>';
    var p = document.createElement('p');
    p.className = 'comp-line';
    p.textContent = line;
    card.appendChild(p);
    return card;
  }

  function buildPlanCard(stats) {
    var card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h3>Wochenplan</h3><p class="plan-line muted">Lädt…</p>';
    var btn = document.createElement('button');
    btn.className = 'secondary';
    btn.textContent = 'Woche planen';
    btn.addEventListener('click', function () { if (window.PlanModule) window.PlanModule.open(); });
    card.appendChild(btn);
    if (window.api.getPlan) {
      window.api.getPlan().then(function (p) {
        var line = card.querySelector('.plan-line');
        if (!line) return;
        var done = stats ? (stats.weekCount || 0) : 0;
        if (p && Array.isArray(p.items) && p.items.length) {
          var target = p.target || p.items.length;
          line.classList.remove('muted');
          line.textContent = 'Diese Woche ' + done + ' / ' + target;
          var bar = document.createElement('div');
          bar.className = 'plan-progress';
          var fill = document.createElement('div');
          fill.className = 'plan-progress-fill';
          fill.style.width = (target ? Math.min(100, Math.round(done / target * 100)) : 0) + '%';
          bar.appendChild(fill);
          card.insertBefore(bar, btn);
          if (stats && stats.longestStreak) {
            var ins = document.createElement('p');
            ins.className = 'plan-insight muted';
            ins.textContent = 'Serie: ' + (stats.streak || 0) + ' Wo · längste: ' + stats.longestStreak + ' Wo';
            card.insertBefore(ins, btn);
          }
        } else {
          line.textContent = 'Noch kein Plan — leg deine Woche in 30 Sekunden fest.';
          btn.textContent = 'Woche planen →';
        }
      }).catch(function () {});
    }
    return card;
  }

  function buildToggle(label, key, def) {
    const row = document.createElement('label');
    row.className = 'settings-row';
    const on = window.Settings ? window.Settings.get(key, def) : def;
    row.innerHTML = `<span>${label}</span><input type="checkbox" ${on ? 'checked' : ''}>`;
    row.querySelector('input').addEventListener('change', e => {
      if (window.Settings) window.Settings.set(key, e.target.checked);
    });
    return row;
  }

  function buildSettingsCard() {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h3>Einstellungen</h3>';
    card.appendChild(buildToggle('Ton', 'sound', true));
    card.appendChild(buildToggle('Vibration', 'vibrate', true));

    const rest = document.createElement('div');
    rest.className = 'settings-row';
    const cur = window.Settings ? window.Settings.get('gymRest', 90) : 90;
    rest.innerHTML = `<span>Gym-Pause (Sek.)</span><input type="number" min="10" max="600" step="5" value="${cur}" style="width:84px;">`;
    rest.querySelector('input').addEventListener('change', e => {
      const v = Math.max(10, Math.min(600, parseInt(e.target.value, 10) || 90));
      e.target.value = v;
      if (window.Settings) window.Settings.set('gymRest', v);
    });
    card.appendChild(rest);
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
            // Split the cell across each distinct module's colour (honest about
            // multi-activity days instead of only showing the first).
            const uniq = [...new Set(day.modules)];
            const cols = uniq.map(m => MODULE_COLORS[m] || 'var(--accent)');
            if (cols.length === 1) {
              cell.style.background = cols[0];
            } else {
              const stops = cols.map((c, i) =>
                `${c} ${Math.round((i / cols.length) * 100)}% ${Math.round(((i + 1) / cols.length) * 100)}%`
              ).join(', ');
              cell.style.background = `linear-gradient(135deg, ${stops})`;
            }
            cell.title = `${day.date}: ${uniq.join(', ')}`;
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

  return { render, reset: () => { if (unsub) { unsub(); unsub = null; } } };
})();
