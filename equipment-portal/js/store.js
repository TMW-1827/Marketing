/* ==========================================================================
   Шар даних: локальне сховище (localStorage) + IndexedDB для фотографій.

   Уся структура даних відповідає «Положенню про порядок обліку та управління
   торговельним обладнанням». Модуль ізолює доступ до даних, тому заміна
   локального сховища на REST API до BAS зводиться до заміни функцій
   read()/write() та реалізації adapters у sync.js.
   ========================================================================== */

import { uid, nowISO } from './util.js';

const KEY = 'tmw_eq_portal_v1';
const SCHEMA_VERSION = 1;

/* ---------- Довідник статусів (п. 7 Положення) ---------- */
export const STATUSES = [
  { id: 'in_stock', name: 'На складі', color: 'slate', order: 1, system: true },
  { id: 'in_transit', name: 'В дорозі', color: 'amber', order: 2, system: true },
  { id: 'at_client', name: 'У клієнта', color: 'green', order: 3, system: true },
  { id: 'at_distributor', name: 'У дистриб’ютора', color: 'blue', order: 4, system: true },
  { id: 'in_repair', name: 'У ремонті', color: 'amber', order: 5, system: true },
  { id: 'returned', name: 'Повернено', color: 'slate', order: 6, system: true },
  { id: 'to_write_off', name: 'На списанні', color: 'red', order: 7, system: true },
  { id: 'written_off', name: 'Списано', color: 'grey', order: 8, system: true },
];

/* ---------- Типи передачі (п. 5.3) ---------- */
export const TRANSFER_TYPES = [
  { id: 'client', name: 'Клієнту', short: 'Клієнту' },
  { id: 'distributor', name: 'Дистриб’ютору', short: 'Дистриб’ютору' },
  { id: 'client_via_distributor', name: 'Клієнту через дистриб’ютора', short: 'Через дистриб’ютора' },
];

/* ---------- Ролі та права (Додаток 4, RACI) ---------- */
export const PERMISSIONS = [
  { id: 'equipment.view', group: 'Обладнання', name: 'Перегляд реєстру обладнання' },
  { id: 'equipment.create', group: 'Обладнання', name: 'Оприбуткування (створення картки)' },
  { id: 'equipment.edit', group: 'Обладнання', name: 'Редагування картки обладнання' },
  { id: 'equipment.status', group: 'Обладнання', name: 'Зміна статусу обладнання' },
  { id: 'equipment.import', group: 'Обладнання', name: 'Імпорт обладнання та залишків' },
  { id: 'equipment.delete', group: 'Обладнання', name: 'Видалення картки обладнання' },
  { id: 'request.view', group: 'Заявки на передачу', name: 'Перегляд заявок' },
  { id: 'request.create', group: 'Заявки на передачу', name: 'Створення заявки' },
  { id: 'request.approve', group: 'Заявки на передачу', name: 'Погодження заявки' },
  { id: 'request.plan', group: 'Заявки на передачу', name: 'Планування та організація передачі' },
  { id: 'request.ship', group: 'Заявки на передачу', name: 'Відвантаження зі складу' },
  { id: 'request.act', group: 'Заявки на передачу', name: 'Оформлення Акта приймання-передачі' },
  { id: 'repair.view', group: 'Ремонт', name: 'Перегляд заявок на ремонт' },
  { id: 'repair.create', group: 'Ремонт', name: 'Подання заявки на ремонт' },
  { id: 'repair.manage', group: 'Ремонт', name: 'Опрацювання ремонту та сервісні компанії' },
  { id: 'inventory.view', group: 'Інвентаризація', name: 'Перегляд інвентаризацій' },
  { id: 'inventory.manage', group: 'Інвентаризація', name: 'Створення та закриття інвентаризації' },
  { id: 'inventory.confirm', group: 'Інвентаризація', name: 'Підтвердження наявності обладнання' },
  { id: 'ops.move', group: 'Операції', name: 'Переміщення обладнання' },
  { id: 'ops.return', group: 'Операції', name: 'Повернення на склад' },
  { id: 'ops.incident', group: 'Операції', name: 'Повідомлення про втрату / пошкодження' },
  { id: 'ops.writeoff', group: 'Операції', name: 'Ініціювання списання' },
  { id: 'ops.writeoff.approve', group: 'Операції', name: 'Затвердження списання' },
  { id: 'reports.view', group: 'Звіти', name: 'Перегляд звітів' },
  { id: 'admin.users', group: 'Адміністрування', name: 'Керування користувачами та правами' },
  { id: 'admin.dicts', group: 'Адміністрування', name: 'Керування довідниками' },
  { id: 'admin.audit', group: 'Адміністрування', name: 'Журнал аудиту' },
  { id: 'admin.settings', group: 'Адміністрування', name: 'Налаштування системи' },
];

export const ALL_PERMS = PERMISSIONS.map((p) => p.id);

export const ROLES = [
  {
    id: 'admin', name: 'Адміністратор системи',
    desc: 'Повний доступ до порталу, адміністрування користувачів та довідників.',
    perms: [...ALL_PERMS],
  },
  {
    id: 'accountant', name: 'Бухгалтерія',
    desc: 'Оприбуткування ТО, контроль облікових даних, участь в інвентаризації, списання (п. 13).',
    perms: ['equipment.view', 'equipment.create', 'equipment.edit', 'equipment.import', 'request.view',
      'repair.view', 'inventory.view', 'ops.writeoff', 'reports.view'],
  },
  {
    id: 'commercial_director', name: 'Комерційний директор',
    desc: 'Погодження передачі ТО та рішення у нестандартних ситуаціях (п. 3.3, 11.2).',
    perms: ['equipment.view', 'request.view', 'request.approve', 'repair.view', 'inventory.view',
      'ops.writeoff.approve', 'reports.view'],
  },
  {
    id: 'responsible_manager', name: 'Відповідальний менеджер',
    desc: 'Ініціювання передачі, контроль місцезнаходження, інвентаризація на місцях (п. 6.1, 12.3).',
    perms: ['equipment.view', 'request.view', 'request.create', 'repair.view', 'repair.create',
      'inventory.view', 'inventory.confirm', 'ops.move', 'ops.incident', 'reports.view'],
  },
  {
    id: 'sales_admin', name: 'Відділ адміністрування продажів',
    desc: 'Організація відвантаження, оформлення документів, взаємодія зі складом (п. 4).',
    perms: ['equipment.view', 'request.view', 'request.plan', 'request.ship', 'request.act',
      'repair.view', 'ops.move', 'ops.return', 'inventory.view', 'reports.view'],
  },
  {
    id: 'trade_marketing', name: 'Менеджер із трейд-маркетингу',
    desc: 'Адміністрування даних, щомісячний контроль, координація ремонту та інвентаризації (п. 6.2, 8, 10).',
    perms: ['equipment.view', 'equipment.edit', 'equipment.status', 'equipment.import', 'request.view',
      'repair.view', 'repair.create', 'repair.manage', 'inventory.view', 'inventory.manage',
      'inventory.confirm', 'ops.move', 'ops.return', 'ops.incident', 'ops.writeoff',
      'reports.view', 'admin.dicts'],
  },
  {
    id: 'warehouse', name: 'Склад',
    desc: 'Збереження обладнання до передачі та фізичне відвантаження (п. 4.3).',
    perms: ['equipment.view', 'equipment.status', 'request.view', 'request.ship', 'ops.return',
      'inventory.view', 'inventory.confirm', 'reports.view'],
  },
];

export const roleName = (id) => (ROLES.find((r) => r.id === id) || {}).name || id;

/* ---------- Структура сховища ---------- */
const COLLECTIONS = [
  'users', 'counterparties', 'outlets', 'categories', 'warehouses', 'serviceCompanies',
  'statuses', 'equipment', 'requests', 'acts', 'repairs', 'movements', 'inventories',
  'writeoffs', 'incidents', 'audit', 'notifications',
];

function emptyDB() {
  const o = { __v: SCHEMA_VERSION, settings: defaultSettings(), counters: {} };
  for (const c of COLLECTIONS) o[c] = [];
  o.statuses = STATUSES.map((s) => ({ ...s }));
  return o;
}

function defaultSettings() {
  return {
    companyName: 'ТОВ «Трускавецька»',
    portalName: 'Портал обліку торговельного обладнання',
    locationDeadlineDays: 10,       // п. 6.1 — 10 робочих днів
    monthlyReportDay: 5,            // п. 8.1 — до 5 числа
    monthlyConfirmDays: 5,          // 5 робочих днів на підтвердження
    inventoryPeriodMonths: 12,      // п. 12.1 — не рідше 1 разу на рік
    incidentReportDays: 3,          // повідомлення про втрату — 3 робочі дні
    geoRadiusM: 300,                // допустиме відхилення геолокації від адреси
    requireGeoOnInventory: true,
    requirePhotoOnInventory: true,
    invPrefix: 'ТО',
  };
}

/* ---------- Читання / запис ---------- */
let _db = null;
const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const base = emptyDB();
    // м'яка міграція: додаємо відсутні колекції та налаштування
    for (const c of COLLECTIONS) if (!Array.isArray(parsed[c])) parsed[c] = base[c];
    parsed.settings = { ...base.settings, ...(parsed.settings || {}) };
    parsed.counters = parsed.counters || {};
    if (!parsed.statuses.length) parsed.statuses = base.statuses;
    return parsed;
  } catch (e) {
    console.error('Не вдалося прочитати сховище:', e);
    return null;
  }
}

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(_db));
  } catch (e) {
    console.error('Помилка збереження:', e);
    if (String(e).includes('Quota')) {
      alert('Локальне сховище переповнене. Видаліть частину фотографій або експортуйте дані.');
    }
  }
}

export function load() {
  _db = read() || emptyDB();
  return _db;
}
export function raw() {
  if (!_db) load();
  return _db;
}
export function persist() {
  write();
  listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
}
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ---------- CRUD ---------- */
export const all = (coll) => raw()[coll] || [];
export const get = (coll, id) => all(coll).find((x) => x.id === id) || null;
export function find(coll, pred) { return all(coll).filter(pred); }

export function insert(coll, obj, { silent = false } = {}) {
  const rec = { id: obj.id || uid(coll.slice(0, 3)), createdAt: nowISO(), ...obj };
  raw()[coll].push(rec);
  if (!silent) persist();
  return rec;
}
export function update(coll, id, patch, { silent = false } = {}) {
  const arr = raw()[coll];
  const i = arr.findIndex((x) => x.id === id);
  if (i === -1) return null;
  arr[i] = { ...arr[i], ...patch, updatedAt: nowISO() };
  if (!silent) persist();
  return arr[i];
}
export function remove(coll, id) {
  const arr = raw()[coll];
  const i = arr.findIndex((x) => x.id === id);
  if (i === -1) return false;
  arr.splice(i, 1);
  persist();
  return true;
}

export const settings = () => raw().settings;
export function saveSettings(patch) {
  raw().settings = { ...raw().settings, ...patch };
  persist();
  return raw().settings;
}

/* ---------- Нумерація документів ---------- */
export function nextNumber(prefix) {
  const y = new Date().getFullYear();
  const key = `${prefix}-${y}`;
  const c = raw().counters;
  c[key] = (c[key] || 0) + 1;
  persist();
  return `${prefix}-${y}-${String(c[key]).padStart(4, '0')}`;
}

/** Наступний інвентарний номер (п. 2.2) */
export function nextInvNumber() {
  const pref = settings().invPrefix || 'ТО';
  const nums = all('equipment')
    .map((e) => {
      const m = new RegExp(`^${pref}-(\\d+)$`).exec(e.invNumber || '');
      return m ? +m[1] : 0;
    });
  const max = nums.length ? Math.max(...nums) : 0;
  return `${pref}-${String(max + 1).padStart(6, '0')}`;
}

export function invNumberExists(num, exceptId = null) {
  return all('equipment').some((e) => e.invNumber === num && e.id !== exceptId);
}

/* ---------- Журнал аудиту ---------- */
export function logAudit(userId, action, entity, entityId, details = '') {
  raw().audit.push({
    id: uid('aud'), at: nowISO(), userId, action, entity, entityId, details,
  });
  // тримаємо журнал у розумних межах
  if (raw().audit.length > 4000) raw().audit.splice(0, raw().audit.length - 4000);
}

/* ---------- Історія руху обладнання ---------- */
export function addMovement(m) {
  const rec = { id: uid('mov'), at: nowISO(), ...m };
  raw().movements.push(rec);
  return rec;
}
export const equipmentHistory = (equipmentId) =>
  all('movements').filter((m) => m.equipmentId === equipmentId).sort((a, b) => new Date(b.at) - new Date(a.at));

/* ---------- Сповіщення ---------- */
export function notify(userIds, text, link = null) {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  for (const uidTo of ids.filter(Boolean)) {
    raw().notifications.push({ id: uid('ntf'), userId: uidTo, text, link, at: nowISO(), read: false });
  }
}
export const notificationsFor = (userId) =>
  all('notifications').filter((n) => n.userId === userId).sort((a, b) => new Date(b.at) - new Date(a.at));

/* ---------- Довідкові хелпери ---------- */
export const statusById = (id) => all('statuses').find((s) => s.id === id) || { id, name: id, color: 'grey' };
export const statusName = (id) => statusById(id).name;
export const userName = (id) => (get('users', id) || {}).fullName || '—';
export const counterpartyName = (id) => (get('counterparties', id) || {}).name || '—';
export const categoryName = (id) => (get('categories', id) || {}).name || '—';
export const warehouseName = (id) => (get('warehouses', id) || {}).name || '—';
export const outletName = (id) => (get('outlets', id) || {}).name || '—';

/** Поточний власник/утримувач обладнання у зручному вигляді */
export function holderLabel(eq) {
  if (!eq) return '—';
  if (eq.holderType === 'warehouse') return `Склад: ${warehouseName(eq.holderId)}`;
  if (eq.holderType === 'counterparty') {
    const c = get('counterparties', eq.holderId);
    const o = eq.outletId ? get('outlets', eq.outletId) : null;
    return c ? (o ? `${c.name} — ${o.name}` : c.name) : '—';
  }
  if (eq.holderType === 'service') return `Сервіс: ${(get('serviceCompanies', eq.holderId) || {}).name || '—'}`;
  return '—';
}

/** Фактична адреса розташування обладнання */
export function locationLabel(eq) {
  if (!eq) return '—';
  if (eq.outletId) {
    const o = get('outlets', eq.outletId);
    if (o) return `${o.address || ''}${o.city ? ', ' + o.city : ''}`.replace(/^, /, '') || o.name;
  }
  if (eq.holderType === 'warehouse') return (get('warehouses', eq.holderId) || {}).address || '—';
  if (eq.holderType === 'counterparty') return (get('counterparties', eq.holderId) || {}).address || '—';
  return '—';
}

/* ---------- Експорт / імпорт / скидання ---------- */
export function exportJSON() {
  return JSON.stringify({ ...raw(), __exportedAt: nowISO() }, null, 2);
}
export function importJSON(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || !Array.isArray(data.equipment)) {
    throw new Error('Файл не схожий на резервну копію порталу');
  }
  const base = emptyDB();
  for (const c of COLLECTIONS) if (!Array.isArray(data[c])) data[c] = base[c];
  data.settings = { ...base.settings, ...(data.settings || {}) };
  data.counters = data.counters || {};
  _db = data;
  persist();
}
export function resetAll() {
  localStorage.removeItem(KEY);
  _db = emptyDB();
  write();
}

/* ==========================================================================
   IndexedDB — фотографії (dataURL). Окремо від localStorage, щоб не впертись
   у ліміт 5 МБ.
   ========================================================================== */
const IDB_NAME = 'tmw_eq_photos';
let _idb = null;

function idb() {
  if (_idb) return _idb;
  _idb = new Promise((resolve, reject) => {
    const rq = indexedDB.open(IDB_NAME, 1);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos');
    };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
  return _idb;
}

export const photos = {
  async put(dataUrl, meta = {}) {
    const id = uid('ph');
    const db = await idb();
    await new Promise((res, rej) => {
      const tx = db.transaction('photos', 'readwrite');
      tx.objectStore('photos').put({ dataUrl, meta, at: nowISO() }, id);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    return id;
  },
  async get(id) {
    if (!id) return null;
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction('photos', 'readonly');
      const rq = tx.objectStore('photos').get(id);
      rq.onsuccess = () => res(rq.result || null);
      rq.onerror = () => rej(rq.error);
    });
  },
  async del(id) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction('photos', 'readwrite');
      tx.objectStore('photos').delete(id);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  },
  async count() {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction('photos', 'readonly');
      const rq = tx.objectStore('photos').count();
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
  },
};
