// Sport tracker - SPA shell.
// Hash-based router. Each module is loaded as a separate file and registered here.

const view = document.getElementById('view');
const screenTitle = document.getElementById('screen-title');
const tabbar = document.getElementById('tabbar');

const views = {
  run: {
    title: 'Running',
    render: () => window.RunModule.render(),
    onLeave: () => window.RunModule.reset(),
  },
  yoga: {
    title: 'Yoga',
    render: () => window.YogaModule.render(),
    onLeave: () => window.YogaModule.reset(),
  },
  kb: {
    title: 'Kettlebell HIIT',
    render: () => window.KbModule.render(),
    onLeave: () => window.KbModule.reset(),
  },
  gym: {
    title: 'Gym - Full Body',
    render: () => window.GymModule.render(),
    onLeave: () => window.GymModule.reset(),
  },
  dashboard: {
    title: 'Dashboard',
    render: () => window.DashboardModule.render(),
    onLeave: () => {},
  },
};

const DEFAULT_ROUTE = 'dashboard';
let currentRouteName = null;

function navigate(route) {
  if (!views[route]) route = DEFAULT_ROUTE;

  // Run leave hook for previous module (so e.g. KB timer can stop)
  if (currentRouteName && currentRouteName !== route && views[currentRouteName]?.onLeave) {
    try { views[currentRouteName].onLeave(); } catch (e) { console.warn('onLeave error', e); }
  }

  currentRouteName = route;
  view.replaceChildren(views[route].render());
  screenTitle.textContent = views[route].title;

  tabbar.querySelectorAll('a').forEach(a => {
    a.classList.toggle('active', a.dataset.route === route);
  });

  if (window.location.hash !== `#${route}`) {
    history.replaceState(null, '', `#${route}`);
  }
}

function currentRoute() {
  return (window.location.hash || `#${DEFAULT_ROUTE}`).slice(1);
}

window.addEventListener('hashchange', () => {
  if (window.__booted) navigate(currentRoute());
});

// Boot is gated on authentication: firebase-init.js calls window.bootApp()
// once a user is signed in (and after the one-time localStorage migration).
// Until then the login overlay covers the app and nothing is rendered.
window.bootApp = function () {
  window.__booted = true;
  navigate(currentRoute());
  // Keep the push token alive (iOS tokens expire) — silent if not yet permitted.
  if (window.Reminders && window.Reminders.refresh) window.Reminders.refresh();
};

// window.api is provided by storage.js (Firestore-backed, offline-capable)

// Lightweight toast for save confirmations
window.showToast = function (msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 1800);
};
