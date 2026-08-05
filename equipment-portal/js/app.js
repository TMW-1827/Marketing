/* ==========================================================================
   Точка входу: автентифікація, каркас інтерфейсу, маршрутизація.
   ========================================================================== */

import { load, all, get, settings, onChange, notificationsFor, update, persist, roleName } from './store.js';
import { seedIfEmpty } from './seed.js';
import { currentUser, login, loginAs, logout, can, canAny, refreshCurrent } from './auth.js';
import { startRouter, onRouteChange, parseHash, navigate } from './router.js';
import { el, $, initials, isMobile, fmtDateTime, plural } from './util.js';
import { icon } from './icons.js';
import { toast, openModal, confirmDialog, openDrawer } from './ui.js';

const NAV = [
  { id: 'dashboard', label: 'Головна', icon: 'home', group: 'Робота', mobile: 1 },
  { id: 'equipment', label: 'Обладнання', icon: 'box', perm: 'equipment.view', group: 'Робота', mobile: 2 },
  { id: 'requests', label: 'Заявки на передачу', icon: 'fileText', perm: 'request.view', group: 'Процеси' },
  { id: 'repairs', label: 'Ремонт', icon: 'wrench', perm: 'repair.view', group: 'Процеси' },
  { id: 'inventory', label: 'Інвентаризація', icon: 'clipboard', perm: 'inventory.view', group: 'Процеси', mobile: 4 },
  { id: 'operations', label: 'Операції та списання', icon: 'arrows', perms: ['ops.move', 'ops.return', 'ops.incident', 'ops.writeoff', 'ops.writeoff.approve'], group: 'Процеси' },
  { id: 'reports', label: 'Звіти', icon: 'chart', perm: 'reports.view', group: 'Аналітика' },
  { id: 'admin', label: 'Адміністрування', icon: 'settings', perms: ['admin.users', 'admin.dicts', 'admin.audit', 'admin.settings'], group: 'Система' },
  { id: 'help', label: 'Положення та процес', icon: 'info', group: 'Система' },
];

const VIEWS = {
  dashboard: () => import('./views/dashboard.js'),
  equipment: () => import('./views/equipment.js'),
  requests: () => import('./views/requests.js'),
  repairs: () => import('./views/repairs.js'),
  inventory: () => import('./views/inventory.js'),
  operations: () => import('./views/operations.js'),
  reports: () => import('./views/reports.js'),
  admin: () => import('./views/admin.js'),
  help: () => import('./views/help.js'),
};

const visibleNav = () => NAV.filter((n) => {
  if (n.perm) return can(n.perm);
  if (n.perms) return canAny(...n.perms);
  return true;
});

/* ==========================================================================
   Екран входу
   ========================================================================== */
function renderLogin() {
  const root = $('#root');
  root.innerHTML = '';
  const wrap = el('div.login-wrap');
  const card = el('div.login-card');

  const logo = el('div.login-logo');
  logo.innerHTML = `<div class="mark">${icon('box')}</div>
    <div><h1>${settings().portalName}</h1><span>${settings().companyName}</span></div>`;
  card.append(logo);

  const form = el('form');
  const loginF = el('input.input', { type: 'text', placeholder: 'Логін', autocomplete: 'username', required: true });
  const passF = el('input.input', { type: 'password', placeholder: 'Пароль', autocomplete: 'current-password', required: true });
  form.append(
    el('div.field', {}, [el('label', { text: 'Логін' }), loginF]),
    el('div.field', {}, [el('label', { text: 'Пароль' }), passF]),
  );
  const err = el('div.alert.err.hidden');
  form.append(err);
  form.append(el('button.btn.primary.block.lg', { type: 'submit', text: 'Увійти' }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.classList.add('hidden');
    try {
      await login(loginF.value, passF.value);
      boot();
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove('hidden');
    }
  });
  card.append(form);

  /* швидкий вхід демо-користувачами */
  const demo = el('div.login-demo');
  demo.append(el('div.small.muted.mb8', { text: 'Демонстраційний доступ — оберіть роль (пароль для всіх: demo1234):' }));
  for (const u of all('users').filter((x) => x.active)) {
    const b = el('button.demo-user', { type: 'button' });
    b.append(el('div.avatar', { text: initials(u.fullName) }));
    b.append(el('div', {}, [el('b', { text: u.fullName }), el('small', { text: roleName(u.role) })]));
    b.addEventListener('click', () => { loginAs(u.id); boot(); });
    demo.append(b);
  }
  card.append(demo);
  wrap.append(card);
  root.append(wrap);
}

/* ==========================================================================
   Каркас
   ========================================================================== */
function renderShell() {
  const root = $('#root');
  root.innerHTML = '';
  const user = currentUser();
  const app = el('div.app.ready');

  /* --- бічне меню --- */
  const sidebar = el('aside.sidebar');
  const brand = el('div.brand');
  brand.innerHTML = `<div class="mark">${icon('box')}</div>
    <div><b>Облік ТО</b><span>${settings().companyName}</span></div>`;
  sidebar.append(brand);

  const navlist = el('div.navlist');
  let lastGroup = null;
  for (const n of visibleNav()) {
    if (n.group !== lastGroup) { navlist.append(el('div.navgroup', { text: n.group })); lastGroup = n.group; }
    const item = el('button.navitem', { type: 'button', 'data-nav': n.id });
    item.innerHTML = icon(n.icon);
    item.append(el('span', { text: n.label }));
    const b = badgeFor(n.id);
    if (b) item.append(el('span.badge', { text: String(b) }));
    item.addEventListener('click', () => { navigate('#/' + n.id); closeSidebar(); });
    navlist.append(item);
  }
  sidebar.append(navlist);
  sidebar.append(el('div.foot', { text: `Єдина система обліку — BAS. Портал v1.0` }));

  /* --- шапка --- */
  const main = el('main.main');
  const topbar = el('header.topbar');
  const burger = el('button.burger', { type: 'button', html: icon('menu'), 'aria-label': 'Меню' });
  burger.addEventListener('click', () => sidebar.classList.toggle('open'));
  const title = el('h1', { text: '' });
  topbar.append(burger, title, el('div.grow'));

  const bell = el('button.btn-icon', { type: 'button', html: icon('bell'), title: 'Сповіщення' });
  const unread = notificationsFor(user.id).filter((n) => !n.read).length;
  if (unread) {
    bell.style.position = 'relative';
    bell.append(el('span', {
      text: String(unread),
      style: 'position:absolute;top:-5px;right:-5px;background:var(--red);color:#fff;font-size:9.5px;font-weight:700;min-width:16px;height:16px;border-radius:9px;display:grid;place-items:center;padding:0 4px',
    }));
  }
  bell.addEventListener('click', openNotifications);
  topbar.append(bell);

  const chipBtn = el('button.userchip', { type: 'button' });
  chipBtn.append(el('div.avatar', { text: initials(user.fullName) }));
  chipBtn.append(el('div.who', {}, [el('b', { text: user.fullName }), el('span', { text: roleName(user.role) })]));
  chipBtn.addEventListener('click', openUserMenu);
  topbar.append(chipBtn);

  const content = el('div.content', { id: 'view' });
  main.append(topbar, content);

  /* --- нижня навігація --- */
  const tabbar = el('nav.tabbar');
  const mobileItems = visibleNav().filter((n) => n.mobile).sort((a, b) => a.mobile - b.mobile);
  const addTab = (n) => {
    const b = el('button', { type: 'button', 'data-tab': n.id });
    b.innerHTML = icon(n.icon);
    b.append(el('span', { text: n.short || n.label.split(' ')[0] }));
    const bd = badgeFor(n.id);
    if (bd) b.append(el('span.badge', { text: String(bd) }));
    b.addEventListener('click', () => navigate('#/' + n.id));
    tabbar.append(b);
  };
  mobileItems.slice(0, 2).forEach(addTab);
  if (can('inventory.confirm')) {
    const fab = el('button.fab', { type: 'button', title: 'Сканувати обладнання' });
    fab.innerHTML = `<span class="ic">${icon('scan')}</span>`;
    fab.append(el('span', { text: 'Скан' }));
    fab.addEventListener('click', async () => {
      const m = await import('./views/inventory.js');
      m.quickScan();
    });
    tabbar.append(fab);
  }
  mobileItems.slice(2).forEach(addTab);
  const more = el('button', { type: 'button' });
  more.innerHTML = icon('menu');
  more.append(el('span', { text: 'Ще' }));
  more.addEventListener('click', () => sidebar.classList.toggle('open'));
  tabbar.append(more);

  app.append(sidebar, main, tabbar);
  root.append(app);

  function closeSidebar() { sidebar.classList.remove('open'); }
  main.addEventListener('click', () => { if (isMobile()) closeSidebar(); }, { capture: false });

  return { title, content, sidebar, app };
}

function badgeFor(id) {
  const u = currentUser();
  if (!u) return 0;
  if (id === 'requests' && can('request.approve')) return all('requests').filter((r) => r.status === 'pending').length;
  if (id === 'requests' && can('request.plan')) return all('requests').filter((r) => r.status === 'approved').length;
  if (id === 'requests' && can('request.ship')) return all('requests').filter((r) => r.status === 'planned').length;
  if (id === 'repairs' && can('repair.manage')) return all('repairs').filter((r) => r.status === 'new').length;
  if (id === 'inventory' && can('inventory.confirm')) {
    return all('inventories').filter((i) => i.status === 'active')
      .reduce((s, inv) => s + inv.items.filter((it) => {
        if (it.status !== 'pending') return false;
        const eq = get('equipment', it.equipmentId);
        return !eq || !eq.responsibleManagerId || eq.responsibleManagerId === u.id || can('inventory.manage');
      }).length, 0);
  }
  if (id === 'operations' && can('ops.writeoff.approve')) return all('writeoffs').filter((w) => w.status === 'pending').length;
  return 0;
}

/* ---------- меню користувача ---------- */
function openUserMenu() {
  const u = currentUser();
  const body = el('div');
  body.append(el('div.row.gap8.mb16', {}, [
    el('div.avatar', { text: initials(u.fullName), style: 'width:44px;height:44px;font-size:15px' }),
    el('div', {}, [
      el('b', { text: u.fullName }),
      el('div.small.muted', { text: roleName(u.role) }),
      el('div.xs.muted', { text: u.email || '' }),
    ]),
  ]));
  body.append(el('div.small.muted', { text: `Підрозділ: ${u.department || '—'}` }));
  body.append(el('div.small.muted', { text: `Останній вхід: ${fmtDateTime(u.lastLoginAt)}` }));

  const out = el('button.btn.danger', { type: 'button', text: 'Вийти' });
  const close = el('button.btn', { type: 'button', text: 'Закрити' });
  const m = openModal({ title: 'Профіль', body, footer: el('div.row.gap8', {}, [close, out]), size: 'slim' });
  close.addEventListener('click', () => m.close());
  out.addEventListener('click', () => { logout(); m.close(); boot(); });
}

function openNotifications() {
  const u = currentUser();
  const list = notificationsFor(u.id);
  const body = el('div');
  if (!list.length) body.append(el('div.empty', { text: 'Сповіщень немає' }));
  for (const n of list.slice(0, 40)) {
    const row = el('div', {
      style: `padding:9px 11px;border:1px solid var(--line);border-radius:9px;margin-bottom:7px;${n.read ? 'opacity:.6' : 'background:var(--blue-soft)'}`,
    });
    row.append(el('div.small', { text: n.text }));
    row.append(el('div.xs.muted', { text: fmtDateTime(n.at) }));
    if (n.link) {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => { update('notifications', n.id, { read: true }); m.close(); navigate(n.link); });
    }
    body.append(row);
  }
  const markAll = el('button.btn', { type: 'button', text: 'Позначити всі як прочитані' });
  markAll.addEventListener('click', () => {
    list.forEach((n) => update('notifications', n.id, { read: true }, { silent: true }));
    persist(); m.close(); boot();
  });
  const m = openModal({ title: 'Сповіщення', body, footer: markAll });
}

/* ==========================================================================
   Запуск
   ========================================================================== */
let shell = null;

async function renderRoute(r) {
  if (!shell) return;
  /* закриваємо відкриті панелі та модальні вікна під час переходу */
  document.querySelectorAll('.drawer-scrim, .scrim').forEach((n) => n.remove());
  document.body.style.overflow = '';
  const nav = visibleNav().find((n) => n.id === r.route) || visibleNav()[0];
  shell.title.textContent = nav.label;
  document.title = `${nav.label} — ${settings().portalName}`;
  for (const b of document.querySelectorAll('[data-nav]')) b.classList.toggle('active', b.dataset.nav === nav.id);
  for (const b of document.querySelectorAll('[data-tab]')) b.classList.toggle('active', b.dataset.tab === nav.id);
  shell.content.innerHTML = '<div class="empty">Завантаження…</div>';
  try {
    const mod = await (VIEWS[nav.id] || VIEWS.dashboard)();
    shell.content.innerHTML = '';
    mod.render(shell.content, { open: r.param, rest: r.rest });
    shell.content.scrollTop = 0;
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    shell.content.innerHTML = '';
    shell.content.append(el('div.alert.err', { text: 'Не вдалося відкрити розділ: ' + e.message }));
  }
}

export function boot() {
  refreshCurrent();
  if (!currentUser()) { renderLogin(); return; }
  shell = renderShell();
  renderRoute(parseHash());
}

let routerStarted = false;

async function init() {
  load();
  await seedIfEmpty();
  onRouteChange((r) => renderRoute(r));
  boot();
  if (!routerStarted) { startRouter(); routerStarted = true; }

  /* службові індикатори */
  const offline = el('div.offline-bar.hidden', { text: 'Немає підключення до мережі — дані зберігаються локально та будуть синхронізовані пізніше' });
  document.body.append(offline);
  const syncOnline = () => offline.classList.toggle('hidden', navigator.onLine);
  window.addEventListener('online', syncOnline);
  window.addEventListener('offline', syncOnline);
  syncOnline();

  /* оновлення бейджів після змін даних */
  onChange(() => {
    if (!shell) return;
    for (const b of document.querySelectorAll('[data-nav],[data-tab]')) {
      const id = b.dataset.nav || b.dataset.tab;
      const old = b.querySelector('.badge');
      const n = badgeFor(id);
      if (old) old.remove();
      if (n) b.append(el('span.badge', { text: String(n) }));
    }
  });

  /* реєстрація service worker (офлайн-режим, встановлення як застосунку) */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
  }
}

init();
