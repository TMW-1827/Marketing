/* ==========================================================================
   Адміністрування: користувачі та права, довідники, статуси, налаштування,
   журнал аудиту, резервні копії.
   ========================================================================== */

import {
  all, get, insert, update, remove, persist, settings, saveSettings, logAudit,
  ROLES, PERMISSIONS, ALL_PERMS, roleName, userName, statusName, exportJSON, importJSON, resetAll, photos,
} from '../store.js';
import { can, currentUser, hashPassword, permsOf } from '../auth.js';
import {
  pageHead, actionBtn, alertBox, dataTable, dl, chip, toast, formModal, openDrawer,
  openModal, confirmDialog, searchInput, selectFilter, tabs, buildField,
} from '../ui.js';
import { el, fmtDate, fmtDateTime, matches, sortBy, downloadFile, readFileAsText, initials, plural } from '../util.js';
import { icon } from '../icons.js';

let tab = 'users';

export function render(root) {
  root.append(pageHead(
    'Адміністрування порталу',
    'Керування користувачами та правами доступу, довідниками, статусами обладнання та налаштуваннями процесу.',
    []
  ));

  const items = [];
  if (can('admin.users')) items.push({ id: 'users', label: 'Користувачі та права' });
  if (can('admin.dicts')) items.push({ id: 'counterparties', label: 'Контрагенти' });
  if (can('admin.dicts')) items.push({ id: 'dicts', label: 'Довідники' });
  if (can('admin.dicts')) items.push({ id: 'statuses', label: 'Статуси ТО' });
  if (can('admin.settings')) items.push({ id: 'settings', label: 'Налаштування' });
  if (can('admin.audit')) items.push({ id: 'audit', label: 'Журнал аудиту' });
  if (can('admin.settings')) items.push({ id: 'data', label: 'Дані та резервні копії' });
  if (!items.length) { root.append(alertBox('Недостатньо прав для перегляду цього розділу.', 'warn', 'alert')); return; }
  if (!items.some((i) => i.id === tab)) tab = items[0].id;

  root.append(tabs(items, tab, (t) => { tab = t; rerender(root); }));
  const holder = el('div');
  root.append(holder);
  ({
    users: usersTab, counterparties: cpTab, dicts: dictsTab,
    statuses: statusesTab, settings: settingsTab, audit: auditTab, data: dataTab,
  }[tab])(holder, () => rerender(root));
}

function rerender(root) { root.innerHTML = ''; render(root); }

/* ==========================================================================
   Користувачі
   ========================================================================== */
const ustate = { q: '', role: '' };

function usersTab(root, onChange) {
  const filters = el('div.filters');
  filters.append(searchInput('Пошук за ПІБ, логіном, підрозділом…', (v) => { ustate.q = v; paint(); }, ustate.q));
  filters.append(selectFilter('Усі ролі', ROLES.map((r) => ({ id: r.id, name: r.name })), ustate.role, (v) => { ustate.role = v; paint(); }));
  filters.append(el('span.grow'));
  filters.append(actionBtn('Додати користувача', 'plus', () => openUserForm(null, onChange), 'primary'));
  root.append(filters);

  const box = el('div');
  root.append(box);

  function paint() {
    box.innerHTML = '';
    let list = all('users');
    if (ustate.role) list = list.filter((u) => u.role === ustate.role);
    if (ustate.q) list = list.filter((u) => matches(ustate.q, u.fullName, u.login, u.email, u.department));
    box.append(dataTable({
      columns: [
        {
          label: 'Користувач', main: true, render: (u) => {
            const w = el('div.row.gap8');
            w.append(el('div.avatar.sm', { text: initials(u.fullName) }));
            w.append(el('div', {}, [el('b', { text: u.fullName }), el('div.xs.muted', { text: '@' + u.login })]));
            return w;
          }
        },
        { label: 'Роль', render: (u) => chip(roleName(u.role), u.role === 'admin' ? 'red' : 'blue') },
        { label: 'Підрозділ', render: (u) => u.department || '—', hideMobile: true },
        { label: 'E-mail', render: (u) => el('span.small', { text: u.email || '—' }), hideMobile: true },
        { label: 'Прав', render: (u) => String(permsOf(u).length), hideMobile: true },
        { label: 'Стан', render: (u) => chip(u.active ? 'Активний' : 'Заблокований', u.active ? 'green' : 'grey') },
        { label: 'Останній вхід', render: (u) => u.lastLoginAt ? fmtDate(u.lastLoginAt) : '—', hideMobile: true },
      ],
      rows: sortBy(list, 'fullName'),
      onRow: (u) => openUserCard(u.id, () => { paint(); onChange(); }),
      empty: 'Користувачів не знайдено',
      footer: el('span', { text: `Усього: ${list.length}` }),
    }));
  }
  paint();

  /* довідка про ролі */
  root.append(el('h3.mt24.mb8', { text: 'Ролі та зони відповідальності (Додаток 4 — RACI)' }));
  const grid = el('div.grid.k2');
  for (const r of ROLES) {
    const c = el('div.card.card-pad');
    c.append(el('div.row.gap8', {}, [el('b', { text: r.name }), el('span.grow'),
      chip(`${r.perms.length} ${plural(r.perms.length, 'право', 'права', 'прав')}`, 'grey')]));
    c.append(el('div.small.muted.mt8', { text: r.desc }));
    c.append(el('div.xs.muted.mt8', { text: `Користувачів: ${all('users').filter((u) => u.role === r.id).length}` }));
    grid.append(c);
  }
  root.append(grid);
}

function openUserCard(id, onChange) {
  return openDrawer({
    title: 'Картка користувача',
    render: (body, api) => {
      const u = get('users', id);
      if (!u) return;
      api.setTitle(u.fullName);
      const me = currentUser();

      body.append(el('div.row.gap8.mb16', {}, [
        el('div.avatar', { text: initials(u.fullName), style: 'width:46px;height:46px;font-size:16px' }),
        el('div', {}, [el('b', { text: u.fullName }), el('div.small.muted', { text: roleName(u.role) })]),
      ]));
      body.append(dl([
        ['Логін', u.login],
        ['E-mail', u.email || null],
        ['Телефон', u.phone || null],
        ['Підрозділ', u.department || null],
        ['Стан', chip(u.active ? 'Активний' : 'Заблокований', u.active ? 'green' : 'grey')],
        ['Створено', fmtDate(u.createdAt)],
        ['Останній вхід', u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : null],
      ]));

      /* права */
      body.append(el('div.section-title', { text: `Права доступу (${permsOf(u).length})` }));
      const groups = new Map();
      for (const p of PERMISSIONS) {
        if (!groups.has(p.group)) groups.set(p.group, []);
        groups.get(p.group).push(p);
      }
      const effective = new Set(permsOf(u));
      for (const [g, list] of groups) {
        const wrap = el('div.mb8');
        wrap.append(el('div.xs.muted.strong', { text: g.toUpperCase() }));
        const row = el('div.row.wrap.gap4.mt8');
        for (const p of list) {
          const has = effective.has(p.id);
          row.append(chip(p.name, has ? 'green' : 'grey'));
        }
        wrap.append(row);
        body.append(wrap);
      }

      const acts = el('div.row.wrap.gap8.mt24');
      acts.append(actionBtn('Редагувати', 'edit', () => openUserForm(u, () => { api.refresh(); onChange(); }), 'sm'));
      acts.append(actionBtn('Права доступу', 'key', () => openPermsForm(u, () => { api.refresh(); onChange(); }), 'sm'));
      acts.append(actionBtn('Скинути пароль', 'shield', async () => {
        const v = await formModal({
          title: 'Скидання пароля', submitText: 'Встановити', size: 'slim',
          fields: [{ name: 'password', label: 'Новий пароль', required: true, colspan: 2, hint: 'Мінімум 8 символів' }],
          validate: (o) => o.password.length < 8 ? 'Пароль занадто короткий (мінімум 8 символів).' : null,
        });
        if (!v) return;
        update('users', u.id, { passwordHash: await hashPassword(v.password), mustChangePassword: true });
        logAudit(me.id, 'password', 'user', u.id, `Скинуто пароль користувача ${u.login}`);
        persist();
        toast('Пароль оновлено', 'ok');
      }, 'sm'));
      acts.append(actionBtn(u.active ? 'Заблокувати' : 'Розблокувати', u.active ? 'x' : 'check', async () => {
        if (u.id === me.id) { toast('Не можна заблокувати власний обліковий запис', 'err'); return; }
        update('users', u.id, { active: !u.active });
        logAudit(me.id, 'update', 'user', u.id, `${u.active ? 'Заблоковано' : 'Розблоковано'} ${u.login}`);
        persist();
        api.refresh(); onChange();
      }, 'sm' + (u.active ? ' danger' : '')));
      acts.append(actionBtn('Видалити', 'trash', async () => {
        if (u.id === me.id) { toast('Не можна видалити власний обліковий запис', 'err'); return; }
        const linked = all('equipment').filter((e) => e.responsibleManagerId === u.id).length;
        if (!await confirmDialog({
          title: 'Видалити користувача?', danger: true, okText: 'Видалити',
          text: linked ? `За користувачем закріплено ${linked} одиниць ТО. Після видалення їх потрібно переприв’язати.`
            : 'Обліковий запис буде видалено. Записи в журналі аудиту залишаться.',
        })) return;
        remove('users', u.id);
        logAudit(me.id, 'delete', 'user', u.id, `Видалено користувача ${u.login}`);
        persist();
        api.close(); onChange();
        toast('Користувача видалено');
      }, 'sm danger'));
      body.append(acts);
    },
  });
}

async function openUserForm(u, onDone) {
  const isNew = !u;
  const v = await formModal({
    title: isNew ? 'Новий користувач' : 'Редагування користувача',
    size: 'wide',
    submitText: isNew ? 'Створити' : 'Зберегти',
    fields: [
      { name: 'fullName', label: 'ПІБ', required: true, value: u?.fullName || '', colspan: 2 },
      { name: 'login', label: 'Логін', required: true, value: u?.login || '' },
      { name: 'role', label: 'Роль', type: 'select', required: true, options: ROLES.map((r) => ({ id: r.id, name: r.name })), value: u?.role || 'responsible_manager' },
      { name: 'email', label: 'E-mail', type: 'email', value: u?.email || '' },
      { name: 'phone', label: 'Телефон', value: u?.phone || '' },
      { name: 'department', label: 'Підрозділ', value: u?.department || '', colspan: 2 },
      ...(isNew ? [{ name: 'password', label: 'Початковий пароль', required: true, colspan: 2, hint: 'Мінімум 8 символів; користувач має змінити його після першого входу' }] : []),
      { name: 'active', label: 'Обліковий запис активний', type: 'checkbox', value: u ? u.active : true },
    ],
    validate: (o) => {
      if (all('users').some((x) => x.login.toLowerCase() === o.login.toLowerCase() && x.id !== u?.id)) return 'Такий логін уже використовується.';
      if (isNew && o.password.length < 8) return 'Пароль занадто короткий (мінімум 8 символів).';
      return null;
    },
  });
  if (!v) return;
  const me = currentUser();
  if (isNew) {
    const rec = insert('users', {
      fullName: v.fullName, login: v.login, role: v.role, email: v.email, phone: v.phone,
      department: v.department, active: v.active, extraPerms: [], deniedPerms: [],
      passwordHash: await hashPassword(v.password), mustChangePassword: true,
    }, { silent: true });
    logAudit(me.id, 'create', 'user', rec.id, `Створено користувача ${rec.login} (${roleName(rec.role)})`);
    persist();
    toast('Користувача створено', 'ok');
  } else {
    update('users', u.id, {
      fullName: v.fullName, login: v.login, role: v.role, email: v.email,
      phone: v.phone, department: v.department, active: v.active,
    });
    logAudit(me.id, 'update', 'user', u.id, `Оновлено користувача ${v.login}`);
    persist();
    toast('Зміни збережено', 'ok');
  }
  onDone && onDone();
}

/** Індивідуальні права: розширення або обмеження відносно ролі */
function openPermsForm(u, onDone) {
  const role = ROLES.find((r) => r.id === u.role) || { perms: [] };
  const rolePerms = new Set(role.perms);
  const extra = new Set(u.extraPerms || []);
  const denied = new Set(u.deniedPerms || []);

  const body = el('div');
  body.append(alertBox(`Базовий набір прав визначається роллю «${roleName(u.role)}». Тут можна надати додаткові права або відкликати окремі права для цього користувача.`, 'info'));

  const groups = new Map();
  for (const p of PERMISSIONS) {
    if (!groups.has(p.group)) groups.set(p.group, []);
    groups.get(p.group).push(p);
  }
  for (const [g, list] of groups) {
    body.append(el('div.section-title', { text: g }));
    for (const p of list) {
      const fromRole = rolePerms.has(p.id);
      const checked = fromRole ? !denied.has(p.id) : extra.has(p.id);
      const line = el('label.checkline');
      const cb = el('input', { type: 'checkbox' });
      cb.checked = checked;
      cb.addEventListener('change', () => {
        if (fromRole) { cb.checked ? denied.delete(p.id) : denied.add(p.id); }
        else { cb.checked ? extra.add(p.id) : extra.delete(p.id); }
      });
      line.append(cb, el('span', {}, [
        el('span', { text: p.name }),
        fromRole ? el('span.xs.muted', { text: ' · з ролі' }) : el('span.xs.muted', { text: ' · додатково' }),
      ]));
      body.append(line);
    }
  }

  const save = el('button.btn.primary', { type: 'button', text: 'Зберегти права' });
  const m = openModal({ title: `Права доступу — ${u.fullName}`, body, footer: save, size: 'wide' });
  save.addEventListener('click', () => {
    update('users', u.id, { extraPerms: [...extra], deniedPerms: [...denied] });
    logAudit(currentUser().id, 'perms', 'user', u.id, `Оновлено індивідуальні права (${extra.size} додано, ${denied.size} відкликано)`);
    persist();
    m.close();
    toast('Права оновлено', 'ok');
    onDone && onDone();
  });
}

/* ==========================================================================
   Контрагенти та торгові точки
   ========================================================================== */
const cstate = { q: '', type: '' };

function cpTab(root, onChange) {
  const filters = el('div.filters');
  filters.append(searchInput('Пошук за назвою, ЄДРПОУ, містом…', (v) => { cstate.q = v; paint(); }, cstate.q));
  filters.append(selectFilter('Усі типи', [{ id: 'client', name: 'Клієнти' }, { id: 'distributor', name: 'Дистриб’ютори' }], cstate.type, (v) => { cstate.type = v; paint(); }));
  filters.append(el('span.grow'));
  filters.append(actionBtn('Додати контрагента', 'plus', () => openCpForm(null, () => { paint(); onChange(); }), 'primary'));
  root.append(filters);
  const box = el('div');
  root.append(box);

  function paint() {
    box.innerHTML = '';
    let list = all('counterparties');
    if (cstate.type) list = list.filter((c) => c.type === cstate.type);
    if (cstate.q) list = list.filter((c) => matches(cstate.q, c.name, c.edrpou, c.city, c.address, c.contactPerson));
    box.append(dataTable({
      columns: [
        { label: 'Назва', main: true, render: (c) => el('div', {}, [el('b', { text: c.name }), el('div.xs.muted', { text: 'ЄДРПОУ ' + (c.edrpou || '—') })]) },
        { label: 'Тип', render: (c) => chip(c.type === 'distributor' ? 'Дистриб’ютор' : 'Клієнт', c.type === 'distributor' ? 'blue' : 'green') },
        { label: 'Місто', render: (c) => c.city || '—' },
        { label: 'Адреса', render: (c) => el('span.small', { text: c.address || '—' }), hideMobile: true },
        { label: 'Точок', render: (c) => String(all('outlets').filter((o) => o.counterpartyId === c.id).length) },
        { label: 'ТО', render: (c) => String(all('equipment').filter((e) => e.holderId === c.id).length) },
      ],
      rows: sortBy(list, 'name'),
      onRow: (c) => openCpCard(c.id, () => { paint(); onChange(); }),
      empty: 'Контрагентів не знайдено',
      footer: el('span', { text: `Усього: ${list.length}` }),
    }));
  }
  paint();
}

function openCpCard(id, onChange) {
  return openDrawer({
    title: 'Контрагент',
    render: (body, api) => {
      const c = get('counterparties', id);
      if (!c) return;
      api.setTitle(c.name);
      body.append(dl([
        ['Тип', c.type === 'distributor' ? 'Дистриб’ютор' : 'Клієнт'],
        ['ЄДРПОУ', c.edrpou || null],
        ['Місто', c.city || null],
        ['Адреса', c.address || null],
        ['Контактна особа', c.contactPerson || null],
        ['Телефон', c.phone || null],
        ['Координати', c.geo ? `${c.geo.lat}, ${c.geo.lng}` : null],
      ]));

      const outlets = all('outlets').filter((o) => o.counterpartyId === c.id);
      body.append(el('div.section-title', { text: `Торгові точки (${outlets.length})` }));
      for (const o of outlets) {
        const row = el('div.row.gap8', { style: 'padding:8px 10px;border:1px solid var(--line);border-radius:9px;margin-bottom:6px' });
        row.append(el('div.grow', {}, [
          el('b', { text: o.name }),
          el('div.small.muted', { text: o.address || '' }),
          el('div.xs.muted', { text: `ТО на точці: ${all('equipment').filter((e) => e.outletId === o.id).length}` }),
        ]));
        row.append(actionBtn('', 'edit', () => openOutletForm(c, o, () => { api.refresh(); onChange(); }), 'sm ghost'));
        body.append(row);
      }
      body.append(el('div.row.gap8.mt16', {}, [
        actionBtn('Додати точку', 'plus', () => openOutletForm(c, null, () => { api.refresh(); onChange(); }), 'sm'),
        actionBtn('Редагувати', 'edit', () => openCpForm(c, () => { api.refresh(); onChange(); }), 'sm'),
        actionBtn('Видалити', 'trash', async () => {
          const n = all('equipment').filter((e) => e.holderId === c.id).length;
          if (n) { toast(`Неможливо видалити: за контрагентом рахується ${n} од. ТО`, 'err'); return; }
          if (!await confirmDialog({ title: 'Видалити контрагента?', danger: true, okText: 'Видалити', text: c.name })) return;
          all('outlets').filter((o) => o.counterpartyId === c.id).forEach((o) => remove('outlets', o.id));
          remove('counterparties', c.id);
          logAudit(currentUser().id, 'delete', 'counterparty', c.id, `Видалено ${c.name}`);
          persist(); api.close(); onChange();
        }, 'sm danger'),
      ]));
    },
  });
}

async function openCpForm(c, onDone) {
  const v = await formModal({
    title: c ? 'Редагування контрагента' : 'Новий контрагент',
    size: 'wide',
    fields: [
      { name: 'name', label: 'Найменування', required: true, value: c?.name || '', colspan: 2 },
      { name: 'type', label: 'Тип', type: 'select', required: true, placeholder: false, value: c?.type || 'client', options: [{ id: 'client', name: 'Клієнт' }, { id: 'distributor', name: 'Дистриб’ютор' }] },
      { name: 'edrpou', label: 'ЄДРПОУ', value: c?.edrpou || '' },
      { name: 'city', label: 'Місто', value: c?.city || '' },
      { name: 'address', label: 'Адреса', value: c?.address || '' },
      { name: 'contactPerson', label: 'Контактна особа', value: c?.contactPerson || '' },
      { name: 'phone', label: 'Телефон', value: c?.phone || '' },
      { name: 'lat', label: 'Широта', type: 'number', value: c?.geo?.lat ?? '' },
      { name: 'lng', label: 'Довгота', type: 'number', value: c?.geo?.lng ?? '' },
    ],
  });
  if (!v) return;
  const geo = v.lat && v.lng ? { lat: v.lat, lng: v.lng } : (c?.geo || null);
  const data = { name: v.name, type: v.type, edrpou: v.edrpou, city: v.city, address: v.address, contactPerson: v.contactPerson, phone: v.phone, geo, active: true };
  if (c) update('counterparties', c.id, data); else insert('counterparties', data);
  logAudit(currentUser().id, c ? 'update' : 'create', 'counterparty', c?.id || '', v.name);
  persist();
  toast('Збережено', 'ok');
  onDone && onDone();
}

async function openOutletForm(cp, o, onDone) {
  const v = await formModal({
    title: o ? 'Редагування торгової точки' : `Нова торгова точка — ${cp.name}`,
    size: 'wide',
    fields: [
      { name: 'name', label: 'Назва точки', required: true, value: o?.name || '', colspan: 2 },
      { name: 'city', label: 'Місто', value: o?.city || cp.city || '' },
      { name: 'address', label: 'Адреса', required: true, value: o?.address || '' },
      { name: 'responsibleManagerId', label: 'Відповідальний менеджер', type: 'select', value: o?.responsibleManagerId || '', options: all('users').filter((u) => u.role === 'responsible_manager').map((u) => ({ id: u.id, name: u.fullName })) },
      { name: 'lat', label: 'Широта', type: 'number', value: o?.geo?.lat ?? '' },
      { name: 'lng', label: 'Довгота', type: 'number', value: o?.geo?.lng ?? '' },
    ],
  });
  if (!v) return;
  const geo = v.lat && v.lng ? { lat: v.lat, lng: v.lng } : (o?.geo || cp.geo || null);
  const data = { counterpartyId: cp.id, name: v.name, city: v.city, address: v.address, responsibleManagerId: v.responsibleManagerId || null, geo };
  if (o) update('outlets', o.id, data); else insert('outlets', data);
  persist();
  toast('Збережено', 'ok');
  onDone && onDone();
}

/* ==========================================================================
   Довідники
   ========================================================================== */
function dictsTab(root, onChange) {
  const grid = el('div.grid.k2');
  grid.append(dictCard('Категорії обладнання', 'categories', [
    { name: 'name', label: 'Найменування', required: true, colspan: 2 },
    { name: 'desc', label: 'Опис', colspan: 2 },
    { name: 'usefulLifeMonths', label: 'Строк корисного використання, міс.', type: 'number' },
  ], (x) => `${x.name}`, (x) => `${all('equipment').filter((e) => e.categoryId === x.id).length} од. ТО`, onChange));

  grid.append(dictCard('Склади', 'warehouses', [
    { name: 'name', label: 'Найменування', required: true, colspan: 2 },
    { name: 'address', label: 'Адреса', colspan: 2 },
    { name: 'lat', label: 'Широта', type: 'number' },
    { name: 'lng', label: 'Довгота', type: 'number' },
  ], (x) => x.name, (x) => x.address || '', onChange, (v, old) => ({
    name: v.name, address: v.address,
    geo: v.lat && v.lng ? { lat: v.lat, lng: v.lng } : (old?.geo || null),
  }), (x) => ({ name: x.name, address: x.address, lat: x.geo?.lat ?? '', lng: x.geo?.lng ?? '' })));

  grid.append(dictCard('Сервісні компанії', 'serviceCompanies', [
    { name: 'name', label: 'Найменування', required: true, colspan: 2 },
    { name: 'spec', label: 'Спеціалізація', colspan: 2 },
    { name: 'phone', label: 'Телефон' },
    { name: 'contractNo', label: 'Номер договору' },
  ], (x) => x.name, (x) => [x.spec, x.phone].filter(Boolean).join(' · '), onChange));

  root.append(grid);
}

function dictCard(title, coll, fields, titleFn, subFn, onChange, mapIn = null, mapOut = null) {
  const card = el('div.card');
  const head = el('div.card-head', {}, [el('h3', { text: title }), el('span.grow')]);
  head.append(actionBtn('Додати', 'plus', () => edit(null), 'sm'));
  card.append(head);
  const body = el('div.card-body');
  card.append(body);

  function paint() {
    body.innerHTML = '';
    const list = all(coll);
    if (!list.length) body.append(el('div.small.muted', { text: 'Записів немає' }));
    for (const x of list) {
      const row = el('div.row.gap8', { style: 'padding:8px 0;border-bottom:1px solid var(--line-soft)' });
      row.append(el('div.grow', {}, [el('b.small', { text: titleFn(x) }), el('div.xs.muted', { text: subFn(x) })]));
      row.append(actionBtn('', 'edit', () => edit(x), 'sm ghost'));
      row.append(actionBtn('', 'trash', async () => {
        if (!await confirmDialog({ title: 'Видалити запис?', danger: true, okText: 'Видалити', text: titleFn(x) })) return;
        remove(coll, x.id);
        paint(); onChange && onChange();
      }, 'sm ghost'));
      body.append(row);
    }
  }

  async function edit(x) {
    const values = x ? (mapOut ? mapOut(x) : x) : {};
    const v = await formModal({
      title: (x ? 'Редагування — ' : 'Новий запис — ') + title,
      fields: fields.map((f) => ({ ...f, value: values[f.name] ?? '' })),
    });
    if (!v) return;
    const data = mapIn ? mapIn(v, x) : v;
    if (x) update(coll, x.id, data); else insert(coll, data);
    logAudit(currentUser().id, x ? 'update' : 'create', coll, x?.id || '', titleFn(data));
    persist();
    paint(); onChange && onChange();
    toast('Збережено', 'ok');
  }

  paint();
  return card;
}

/* ==========================================================================
   Статуси ТО
   ========================================================================== */
function statusesTab(root, onChange) {
  root.append(alertBox('Перелік статусів відповідає п. 7.2 Положення та є орієнтовним — його можна доповнювати. Системні статуси використовуються у процесах передачі, ремонту та списання, тому їх не можна видалити.', 'info'));

  const box = el('div');
  root.append(box);
  const addBtn = actionBtn('Додати статус', 'plus', () => edit(null), 'primary');
  root.append(el('div.row.gap8.mt16', {}, [addBtn]));

  function paint() {
    box.innerHTML = '';
    box.append(dataTable({
      columns: [
        { label: 'Статус', main: true, render: (s) => el('span.chip.' + s.color, {}, [el('i.dot'), s.name]) },
        { label: 'Код', render: (s) => el('code.mono', { text: s.id }) },
        { label: 'Одиниць ТО', render: (s) => String(all('equipment').filter((e) => e.status === s.id).length) },
        { label: 'Тип', render: (s) => s.system ? chip('Системний', 'blue') : chip('Користувацький', 'grey') },
        {
          label: '', render: (s) => {
            const w = el('div.row.gap4');
            w.append(actionBtn('', 'edit', () => edit(s), 'sm ghost'));
            if (!s.system) w.append(actionBtn('', 'trash', async () => {
              const n = all('equipment').filter((e) => e.status === s.id).length;
              if (n) { toast(`Статус використовується для ${n} од. ТО`, 'err'); return; }
              if (!await confirmDialog({ title: 'Видалити статус?', danger: true, okText: 'Видалити', text: s.name })) return;
              remove('statuses', s.id);
              paint(); onChange();
            }, 'sm ghost'));
            return w;
          }
        },
      ],
      rows: sortBy(all('statuses'), 'order'),
      empty: 'Статусів немає',
    }));
  }

  async function edit(s) {
    const v = await formModal({
      title: s ? 'Редагування статусу' : 'Новий статус',
      fields: [
        { name: 'name', label: 'Назва', required: true, value: s?.name || '', colspan: 2 },
        { name: 'id', label: 'Код', required: true, value: s?.id || '', readonly: !!s, hint: 'Латиницею, без пробілів' },
        {
          name: 'color', label: 'Колір', type: 'select', placeholder: false, value: s?.color || 'grey', options: [
            { id: 'green', name: 'Зелений' }, { id: 'blue', name: 'Синій' }, { id: 'amber', name: 'Жовтий' },
            { id: 'red', name: 'Червоний' }, { id: 'slate', name: 'Сірий (темний)' }, { id: 'grey', name: 'Сірий' },
          ]
        },
        { name: 'order', label: 'Порядок', type: 'number', value: s?.order ?? all('statuses').length + 1 },
      ],
      validate: (o) => (!s && all('statuses').some((x) => x.id === o.id)) ? 'Статус із таким кодом уже існує.' : null,
    });
    if (!v) return;
    if (s) update('statuses', s.id, { name: v.name, color: v.color, order: v.order });
    else insert('statuses', { id: v.id, name: v.name, color: v.color, order: v.order, system: false });
    logAudit(currentUser().id, s ? 'update' : 'create', 'status', v.id, v.name);
    persist();
    paint(); onChange();
    toast('Збережено', 'ok');
  }
  paint();
}

/* ==========================================================================
   Налаштування
   ========================================================================== */
async function settingsTab(root, onChange) {
  const st = settings();
  const form = el('div.card.card-pad');
  const fields = [
    { name: 'companyName', label: 'Назва Товариства', value: st.companyName, colspan: 2 },
    { name: 'portalName', label: 'Назва порталу', value: st.portalName, colspan: 2 },
    { name: 'invPrefix', label: 'Префікс інвентарного номера', value: st.invPrefix },
    { name: 'locationDeadlineDays', label: 'Строк внесення місцезнаходження, роб. днів (п. 6.1)', type: 'number', value: st.locationDeadlineDays },
    { name: 'monthlyReportDay', label: 'День місяця для звіту (п. 8.1)', type: 'number', value: st.monthlyReportDay },
    { name: 'monthlyConfirmDays', label: 'Строк підтвердження звіту, роб. днів', type: 'number', value: st.monthlyConfirmDays },
    { name: 'inventoryPeriodMonths', label: 'Періодичність інвентаризації, міс. (п. 12.1)', type: 'number', value: st.inventoryPeriodMonths },
    { name: 'incidentReportDays', label: 'Строк повідомлення про втрату, роб. днів', type: 'number', value: st.incidentReportDays },
    { name: 'geoRadiusM', label: 'Допустиме відхилення геолокації, м', type: 'number', value: st.geoRadiusM },
    { name: 'requireGeoOnInventory', label: 'Вимагати геолокацію під час інвентаризації', type: 'checkbox', value: st.requireGeoOnInventory },
    { name: 'requirePhotoOnInventory', label: 'Вимагати фото під час інвентаризації', type: 'checkbox', value: st.requirePhotoOnInventory },
  ];
  const grid = el('div', { style: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px' });
  const inputs = {};
  for (const f of fields) {
    const w = buildField(f, f.value);
    inputs[f.name] = w._input;
    grid.append(w);
  }
  form.append(grid);
  const save = actionBtn('Зберегти налаштування', 'check', () => {
    const patch = {};
    for (const f of fields) {
      patch[f.name] = f.type === 'checkbox' ? inputs[f.name].checked
        : f.type === 'number' ? Number(inputs[f.name].value) : inputs[f.name].value.trim();
    }
    saveSettings(patch);
    logAudit(currentUser().id, 'update', 'settings', '', 'Оновлено налаштування порталу');
    persist();
    toast('Налаштування збережено', 'ok');
    onChange();
  }, 'primary');
  form.append(el('div.row.gap8.mt16', {}, [save]));
  root.append(form);
}

/* ==========================================================================
   Журнал аудиту
   ========================================================================== */
const astate = { q: '', entity: '' };

function auditTab(root) {
  const filters = el('div.filters');
  filters.append(searchInput('Пошук за користувачем, описом…', (v) => { astate.q = v; paint(); }, astate.q));
  filters.append(selectFilter('Усі об’єкти', [
    { id: 'equipment', name: 'Обладнання' }, { id: 'request', name: 'Заявки' }, { id: 'repair', name: 'Ремонт' },
    { id: 'inventory', name: 'Інвентаризація' }, { id: 'writeoff', name: 'Списання' }, { id: 'user', name: 'Користувачі' },
  ], astate.entity, (v) => { astate.entity = v; paint(); }));
  filters.append(el('span.grow'));
  filters.append(actionBtn('Експорт', 'download', () => {
    const rows = all('audit').map((a) => [fmtDateTime(a.at), userName(a.userId), a.action, a.entity, a.entityId, a.details]);
    downloadFile(`Журнал_аудиту_${new Date().toISOString().slice(0, 10)}.csv`,
      toCSVsafe(rows, ['Дата', 'Користувач', 'Дія', 'Об’єкт', 'ID', 'Опис']), 'text/csv;charset=utf-8');
  }, 'sm'));
  root.append(filters);
  const box = el('div');
  root.append(box);

  function paint() {
    box.innerHTML = '';
    let list = all('audit');
    if (astate.entity) list = list.filter((a) => a.entity === astate.entity);
    if (astate.q) list = list.filter((a) => matches(astate.q, userName(a.userId), a.details, a.action, a.entity));
    list = sortBy(list, 'at', -1).slice(0, 400);
    box.append(dataTable({
      columns: [
        { label: 'Дата', main: true, render: (a) => fmtDateTime(a.at) },
        { label: 'Користувач', render: (a) => userName(a.userId) },
        { label: 'Дія', render: (a) => chip(a.action, 'grey') },
        { label: 'Об’єкт', render: (a) => a.entity, hideMobile: true },
        { label: 'Опис', render: (a) => el('span.small', { text: a.details || '' }) },
      ],
      rows: list,
      empty: 'Записів немає',
      footer: el('span', { text: `Показано останні ${list.length} записів` }),
    }));
  }
  paint();
}

function toCSVsafe(rows, headers) {
  const q = (v) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [headers.map(q).join(';'), ...rows.map((r) => r.map(q).join(';'))].join('\r\n');
}

/* ==========================================================================
   Дані та резервні копії
   ========================================================================== */
async function dataTab(root, onChange) {
  const card = el('div.card.card-pad');
  card.append(alertBox('Портал працює на локальному сховищі браузера. Резервна копія у форматі JSON дозволяє перенести дані на інший пристрій або підготувати їх до завантаження в BAS.', 'info'));

  const stats = el('div.grid.k4.mb16');
  const counts = [
    ['Обладнання', all('equipment').length], ['Заявки', all('requests').length],
    ['Ремонти', all('repairs').length], ['Операції', all('movements').length],
  ];
  for (const [l, n] of counts) {
    const c = el('div.card.card-pad');
    c.append(el('div.xs.muted', { text: l }));
    c.append(el('div', { text: String(n), style: 'font-size:21px;font-weight:700' }));
    stats.append(c);
  }
  card.append(stats);
  const photoCount = el('div.small.muted.mb16', { text: 'Фотографій у сховищі: підрахунок…' });
  card.append(photoCount);
  photos.count().then((n) => { photoCount.textContent = `Фотографій у сховищі: ${n}`; }).catch(() => { photoCount.remove(); });

  const row = el('div.row.wrap.gap8');
  row.append(actionBtn('Експорт резервної копії', 'download', () => {
    downloadFile(`backup_портал_ТО_${new Date().toISOString().slice(0, 10)}.json`, exportJSON(), 'application/json');
    toast('Резервну копію збережено', 'ok');
  }, 'primary'));

  const fileInput = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    if (!f) return;
    if (!await confirmDialog({
      title: 'Відновити з резервної копії?', danger: true, okText: 'Відновити',
      text: 'Поточні дані порталу буде повністю замінено вмістом файлу.',
    })) { fileInput.value = ''; return; }
    try {
      importJSON(await readFileAsText(f));
      toast('Дані відновлено', 'ok');
      location.reload();
    } catch (e) {
      toast('Помилка імпорту: ' + e.message, 'err');
    }
  });
  const importBtn = actionBtn('Відновити з копії', 'upload', () => fileInput.click());
  row.append(importBtn, fileInput);

  row.append(actionBtn('Очистити всі дані', 'trash', async () => {
    if (!await confirmDialog({
      title: 'Видалити всі дані?', danger: true, okText: 'Видалити все',
      text: 'Реєстр обладнання, заявки, історія та користувачі будуть видалені. Дію неможливо скасувати. Рекомендуємо спершу зробити резервну копію.',
    })) return;
    resetAll();
    localStorage.removeItem('tmw_eq_session');
    location.reload();
  }, 'danger'));

  card.append(row);
  root.append(card);
}
