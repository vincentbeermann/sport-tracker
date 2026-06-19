// Daily sport reminder sender — runs in GitHub Actions on a cron.
//
// Reads every user's push tokens + their training history from Firestore,
// crafts a data-aware nudge (skips anyone who already trained today), and sends
// it via FCM Web Push. Stale tokens are pruned automatically.
//
// Auth: a Firebase service-account JSON via the FCM_SERVICE_ACCOUNT env var
// (a GitHub Actions secret). Never commit the key.

import admin from 'firebase-admin';

const APP_URL = 'https://sport-tracker-vb.web.app';
const ICON = APP_URL + '/icon-192.png';

function todayISO(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function isoWeekKey(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function summarize(sessions) {
  const today = todayISO();
  const trainedToday = sessions.some((s) => s.date === today);
  const dates = sessions.map((s) => s.date).filter(Boolean).sort();
  const lastDate = dates.length ? dates[dates.length - 1] : null;
  const daysSince = lastDate ? Math.round((new Date(today) - new Date(lastDate)) / 86400000) : null;
  const weeks = new Set(sessions.map((s) => isoWeekKey(s.date)));
  let streak = 0;
  const cur = new Date(today);
  while (weeks.has(isoWeekKey(todayISO(cur)))) { streak++; cur.setDate(cur.getDate() - 7); }
  // sessions this week
  const thisWeek = isoWeekKey(today);
  const weekCount = sessions.filter((s) => isoWeekKey(s.date) === thisWeek).length;
  return { trainedToday, daysSince, streak, weekCount, count: sessions.length };
}

const TYPE_LABELS = { gym: 'Gym 🏋️', run: 'Run 🏃', kb: 'Kettlebell 🔔', yoga: 'Yoga 🧘' };

// The session planned for today (Mon=0..Sun=6), earliest first, or null.
function plannedToday(plan) {
  if (!plan || !Array.isArray(plan.items)) return null;
  const wd = (new Date(todayISO()).getDay() + 6) % 7;
  const items = plan.items.filter((i) => i.day === wd);
  if (!items.length) return null;
  items.sort((a, b) => String(a.time).localeCompare(String(b.time)));
  return items[0];
}

// Data-aware: reads the weekly plan + history. Feedback/insight tone, not
// gamified pressure (Vincent's design rule).
function craftMessage(stats, slot, plan) {
  if (stats.trainedToday) return null; // already trained — don't nag

  const today = plannedToday(plan);
  const target = plan && plan.target ? plan.target : null;
  const wc = stats.weekCount;
  const left = target ? Math.max(0, target - wc) : null;
  const label = today ? (TYPE_LABELS[today.type] || 'Einheit') : null;

  // never miss twice — gentle re-entry after exactly one missed day.
  if (stats.daysSince === 1) {
    const t = slot === 'morning' ? '🏋️ Guten Morgen' : '🌙 Noch nichts heute?';
    return { title: t, body: 'Gestern Pause — heute wieder rein, damit es kein Muster wird.' };
  }

  if (slot === 'morning') {
    if (stats.count === 0) {
      return { title: '🏋️ Los geht’s', body: 'Erste Einheit eintragen — der Anfang zählt.' };
    }
    if (today) {
      const goal = target ? ` · ${wc}/${target} diese Woche` : '';
      return { title: '🏋️ Heute geplant', body: `${label} um ${today.time}${goal}.` };
    }
    if (left != null && left > 0) {
      return { title: '🏋️ Guten Morgen', body: `${wc}/${target} diese Woche — eine Einheit bringt dich auf Kurs.` };
    }
    if (stats.daysSince != null && stats.daysSince >= 3) {
      return { title: '🏋️ Zeit zu trainieren', body: `${stats.daysSince} Tage Pause — heute eine Einheit?` };
    }
    return { title: '🏋️ Guten Morgen', body: 'Heute schon eine Einheit geplant?' };
  }

  // evening
  if (today) {
    return { title: '🌙 Noch nichts heute?', body: `${label} war für ${today.time} geplant — geht noch.` };
  }
  if (left != null && left > 0) {
    return { title: '🌙 Noch nichts heute?', body: `Noch ${left} bis zum Wochenziel — kurze Einheit?` };
  }
  if (stats.streak > 0) {
    return { title: '🌙 Noch nichts heute?', body: `Halte deine ${stats.streak}-Wochen-Serie — kurze Einheit?` };
  }
  return { title: '🌙 Tag fast vorbei', body: 'Eine kurze Einheit ginge noch.' };
}

async function main() {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FCM_SERVICE_ACCOUNT env var is missing');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  const db = admin.firestore();
  const messaging = admin.messaging();

  // Random jitter (0–12 min) on SCHEDULED runs only: varies the send time daily
  // and keeps clear of the meditation app's slot (:05) so they never pile up.
  // Manual (workflow_dispatch) runs stay instant.
  if (process.env.GITHUB_EVENT_NAME === 'schedule') {
    const jitterMs = Math.floor(Math.random() * 12 * 60000);
    console.log(`[reminders] jitter ${Math.round(jitterMs / 60000)} min`);
    await new Promise((r) => setTimeout(r, jitterMs));
  }

  const slot = new Date().getUTCHours() < 12 ? 'morning' : 'evening';
  console.log(`[reminders] slot=${slot} utc=${new Date().toISOString()}`);

  const tokenSnap = await db.collectionGroup('pushTokens').get();
  const byUser = new Map();
  tokenSnap.forEach((doc) => {
    const uid = doc.ref.parent.parent.id;
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid).push(doc.ref);
  });
  console.log(`[reminders] users with tokens: ${byUser.size}`);

  let sent = 0, skipped = 0, pruned = 0;
  for (const [uid, tokenRefs] of byUser) {
    const sessSnap = await db.collection('users').doc(uid).collection('sessions').get();
    const sessions = sessSnap.docs.map((d) => d.data());
    const planSnap = await db.collection('users').doc(uid).collection('meta').doc('plan').get();
    const plan = planSnap.exists ? planSnap.data() : null;
    const msg = craftMessage(summarize(sessions), slot, plan);
    if (!msg) { skipped++; continue; }

    for (const ref of tokenRefs) {
      try {
        // Data-only: the SW's onBackgroundMessage renders exactly one
        // notification. A `notification` block would auto-display AND fire
        // onBackgroundMessage → two notifications for one reminder.
        await messaging.send({
          token: ref.id,
          data: {
            title: msg.title,
            body: msg.body,
            tag: 'sport-reminder',
            url: APP_URL + '/',
          },
        });
        sent++;
      } catch (e) {
        const code = e && e.errorInfo && e.errorInfo.code;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument') {
          await ref.delete().catch(() => {});
          pruned++;
        } else {
          console.warn(`[reminders] send failed for ${uid}:`, code || e.message);
        }
      }
    }
  }
  console.log(`[reminders] done. sent=${sent} skipped=${skipped} prunedTokens=${pruned}`);
}

main().catch((e) => { console.error('[reminders] fatal:', e); process.exit(1); });
