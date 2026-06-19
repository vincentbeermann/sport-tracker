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

function craftMessage(stats, slot) {
  if (stats.trainedToday) return null; // already trained — don't nag

  if (slot === 'morning') {
    if (stats.count === 0) {
      return { title: '🏋️ Los geht’s', body: 'Erste Einheit eintragen — der Anfang zählt.' };
    }
    if (stats.daysSince != null && stats.daysSince >= 3) {
      return { title: '🏋️ Zeit zu trainieren', body: `${stats.daysSince} Tage Pause — heute eine Einheit?` };
    }
    return { title: '🏋️ Guten Morgen', body: 'Heute schon eine Einheit geplant?' };
  }

  // evening
  if (stats.streak > 0) {
    return { title: '🌙 Noch nichts heute?', body: `Halte deinen ${stats.streak}-Wochen-Streak — kurze Einheit?` };
  }
  return { title: '🌙 Tag fast vorbei', body: 'Eine kurze Einheit ginge noch.' };
}

async function main() {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FCM_SERVICE_ACCOUNT env var is missing');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  const db = admin.firestore();
  const messaging = admin.messaging();

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
    const msg = craftMessage(summarize(sessions), slot);
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
