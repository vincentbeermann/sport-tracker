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

window.addEventListener('hashchange', () => navigate(currentRoute()));
window.addEventListener('DOMContentLoaded', () => navigate(currentRoute()));

// window.api is provided by storage.js (localStorage-backed PWA storage)

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
