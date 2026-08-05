/* ==========================================================================
   Демонстраційний набір даних. Заповнюється лише один раз — якщо сховище
   порожнє. У продуктивному середовищі замість цього виконується імпорт
   залишків з BAS (Адміністрування → Імпорт).
   ========================================================================== */

import { raw, persist, insert, ROLES, nextNumber } from './store.js';
import { hashPassword } from './auth.js';
import { uid, addDays, nowISO } from './util.js';

/* Простий детермінований генератор, щоб демо-дані були стабільними */
let _s = 20260705;
const rnd = () => ((_s = (_s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));

const CITIES = [
  { city: 'Львів', lat: 49.8397, lng: 24.0297 },
  { city: 'Трускавець', lat: 49.2778, lng: 23.5060 },
  { city: 'Дрогобич', lat: 49.3497, lng: 23.5051 },
  { city: 'Івано-Франківськ', lat: 48.9226, lng: 24.7111 },
  { city: 'Тернопіль', lat: 49.5535, lng: 25.5948 },
  { city: 'Луцьк', lat: 50.7472, lng: 25.3254 },
  { city: 'Рівне', lat: 50.6199, lng: 26.2516 },
  { city: 'Київ', lat: 50.4501, lng: 30.5234 },
  { city: 'Ужгород', lat: 48.6208, lng: 22.2879 },
  { city: 'Чернівці', lat: 48.2917, lng: 25.9352 },
];

const STREETS = ['вул. Стрийська', 'вул. Городоцька', 'просп. Свободи', 'вул. Шевченка', 'вул. Franka',
  'вул. Героїв УПА', 'вул. Сихівська', 'вул. Наукова', 'просп. Чорновола', 'вул. Зелена'];

export async function seedIfEmpty() {
  const db = raw();
  if (db.users.length) return false;

  /* ---------- Користувачі ---------- */
  const pwd = await hashPassword('demo1234');
  const users = [
    ['Адміністратор Порталу', 'admin', 'admin', 'ІТ-відділ'],
    ['Олена Ковальчук', 'kovalchuk', 'accountant', 'Бухгалтерія'],
    ['Андрій Мельник', 'melnyk', 'commercial_director', 'Комерційний департамент'],
    ['Ігор Бондаренко', 'bondarenko', 'responsible_manager', 'Відділ продажів — Захід'],
    ['Марія Гриценко', 'hrytsenko', 'responsible_manager', 'Відділ продажів — Центр'],
    ['Тарас Левченко', 'levchenko', 'responsible_manager', 'Відділ продажів — Південь'],
    ['Наталія Савчук', 'savchuk', 'sales_admin', 'Відділ адміністрування продажів'],
    ['Оксана Дмитрук', 'dmytruk', 'trade_marketing', 'Трейд-маркетинг'],
    ['Василь Панчук', 'panchuk', 'warehouse', 'Центральний склад'],
  ].map(([fullName, login, role, department], i) => insert('users', {
    id: 'usr_' + login,
    fullName, login, role, department,
    email: `${login}@truskavetska.example`,
    phone: `+380 (67) ${100 + i}-${10 + i}-${20 + i}`,
    passwordHash: pwd,
    mustChangePassword: false,
    active: true,
    extraPerms: [],
    deniedPerms: [],
  }, { silent: true }));

  const byRole = (r) => users.filter((u) => u.role === r);
  const managers = byRole('responsible_manager');
  const tm = byRole('trade_marketing')[0];
  const cd = byRole('commercial_director')[0];
  const sa = byRole('sales_admin')[0];
  const wh = byRole('warehouse')[0];
  const acc = byRole('accountant')[0];

  /* ---------- Довідники ---------- */
  const categories = [
    ['Холодильне обладнання', 'Холодильники, вітрини, морозильні скрині', 60],
    ['Стійки та стелажі', 'Торгові стійки, стелажі, дисплеї', 36],
    ['Меблі та пуфи', 'Пуфи, столики, лавки', 36],
    ['Парасолі та навіси', 'Парасолі, тенти, навіси', 24],
    ['Брендований посуд', 'Склянки, глеки, підноси', 12],
    ['Диспенсери та кулери', 'Кулери, диспенсери, помпи', 36],
  ].map(([name, desc, life]) => insert('categories', { id: uid('cat'), name, desc, usefulLifeMonths: life }, { silent: true }));

  const warehouses = [
    ['Центральний склад (Трускавець)', 'вул. Промислова, 12, Трускавець', 49.2801, 23.5122],
    ['Склад Львів', 'вул. Городоцька, 359, Львів', 49.8290, 23.9640],
    ['Склад Київ', 'вул. Полярна, 20, Київ', 50.5220, 30.4790],
  ].map(([name, address, lat, lng]) => insert('warehouses', { id: uid('wh'), name, address, geo: { lat, lng } }, { silent: true }));

  const services = [
    ['ТОВ «Холод-Сервіс»', 'Ремонт холодильного обладнання', '+380 (32) 245-11-22'],
    ['ФОП Кравець І.П.', 'Ремонт стійок, стелажів, меблів', '+380 (67) 331-88-04'],
    ['ТОВ «Технопрофі»', 'Комплексне сервісне обслуговування', '+380 (44) 501-77-10'],
  ].map(([name, spec, phone]) => insert('serviceCompanies', { id: uid('svc'), name, spec, phone, contractNo: 'Д-' + int(100, 999) + '/25' }, { silent: true }));

  /* ---------- Контрагенти ---------- */
  const distributors = [
    'ТОВ «Захід-Дистрибуція»', 'ТОВ «Волинь Трейд»', 'ТОВ «Карпати Логістик»', 'ТОВ «Столиця Напої»',
  ].map((name, i) => {
    const c = CITIES[i * 2 % CITIES.length];
    return insert('counterparties', {
      id: uid('cp'), type: 'distributor', name,
      edrpou: String(30000000 + int(100000, 999999)),
      city: c.city, address: `${pick(STREETS)}, ${int(1, 180)}, ${c.city}`,
      contactPerson: pick(['Сергій Іванчук', 'Юрій Панько', 'Ольга Ткач', 'Роман Сидір']),
      phone: `+380 (50) ${int(200, 999)}-${int(10, 99)}-${int(10, 99)}`,
      geo: { lat: +(c.lat + (rnd() - 0.5) * 0.03).toFixed(6), lng: +(c.lng + (rnd() - 0.5) * 0.03).toFixed(6) },
      active: true,
    }, { silent: true });
  });

  const clientNames = ['Мережа «Сільпо»', 'Мережа «АТБ»', 'Маркет «Рукавичка»', 'Готель «Женева»',
    'Ресторан «Криївка»', 'Кав’ярня «Світ кави»', 'Санаторій «Карпати»', 'Маркет «Близенько»',
    'Готель «Аркадія»', 'Ресторан «Панська»', 'Магазин «Наш Край»', 'Спа-готель «Ріксос»'];
  const clients = clientNames.map((name) => {
    const c = pick(CITIES);
    return insert('counterparties', {
      id: uid('cp'), type: 'client', name,
      edrpou: String(30000000 + int(100000, 999999)),
      city: c.city, address: `${pick(STREETS)}, ${int(1, 180)}, ${c.city}`,
      contactPerson: pick(['Ірина Гнатюк', 'Петро Данилюк', 'Марта Куліш', 'Богдан Хоми́н']),
      phone: `+380 (63) ${int(200, 999)}-${int(10, 99)}-${int(10, 99)}`,
      geo: { lat: +(c.lat + (rnd() - 0.5) * 0.04).toFixed(6), lng: +(c.lng + (rnd() - 0.5) * 0.04).toFixed(6) },
      active: true,
    }, { silent: true });
  });

  /* ---------- Торгові точки ---------- */
  const outlets = [];
  for (const cp of clients) {
    const n = int(1, 3);
    for (let i = 0; i < n; i++) {
      const base = CITIES.find((c) => c.city === cp.city) || CITIES[0];
      outlets.push(insert('outlets', {
        id: uid('out'), counterpartyId: cp.id,
        name: `${cp.name.replace(/^(Мережа |Маркет |Магазин )/, '')} №${i + 1}`,
        city: cp.city,
        address: `${pick(STREETS)}, ${int(1, 180)}, ${cp.city}`,
        geo: { lat: +(base.lat + (rnd() - 0.5) * 0.05).toFixed(6), lng: +(base.lng + (rnd() - 0.5) * 0.05).toFixed(6) },
        responsibleManagerId: pick(managers).id,
      }, { silent: true }));
    }
  }

  /* ---------- Обладнання ---------- */
  const models = {
    'Холодильне обладнання': ['Frigoglass ICOOL 650', 'Ubert SC-390', 'Liebherr FKv 4143', 'Frigorex FV400', 'Скриня Juka M400'],
    'Стійки та стелажі': ['Стійка промо L-1200', 'Стелаж 5-рівневий S-180', 'Дисплей кутовий D-90', 'Стійка касова C-60'],
    'Меблі та пуфи': ['Пуф брендований P-45', 'Столик літній T-70', 'Лавка садова B-150'],
    'Парасолі та навіси': ['Парасоля 3×3 «Трускавецька»', 'Парасоля 4×4 преміум', 'Навіс мобільний N-6'],
    'Брендований посуд': ['Комплект склянок (24 шт.)', 'Глек скляний 1.5 л', 'Піднос брендований'],
    'Диспенсери та кулери': ['Кулер підлоговий HotFrost V450', 'Диспенсер настільний D-20', 'Помпа механічна P-1'],
  };

  const statuses = ['in_stock', 'in_stock', 'at_client', 'at_client', 'at_client', 'at_distributor',
    'in_transit', 'in_repair', 'returned', 'to_write_off', 'written_off'];

  const equipment = [];
  for (let i = 1; i <= 78; i++) {
    const cat = pick(categories);
    const model = pick(models[cat.name]);
    const status = pick(statuses);
    const purchase = addDays(nowISO(), -int(30, 1200));
    const eq = {
      id: uid('eq'),
      invNumber: `ТО-${String(i).padStart(6, '0')}`,
      serialNumber: rnd() > 0.25 ? `SN${int(100000, 999999)}` : '',
      name: model,
      categoryId: cat.id,
      model,
      manufacturer: pick(['Frigoglass', 'Ubert', 'Liebherr', 'Juka', 'Локальний виробник', 'HotFrost']),
      purchaseDate: purchase,
      initialCost: int(1200, 48000),
      supplier: pick(['ТОВ «ТехноПостач»', 'ТОВ «Холод Груп»', 'ФОП Мазур О.В.']),
      status,
      holderType: null, holderId: null, outletId: null,
      responsibleManagerId: null,
      photos: [],
      lastConfirmedAt: null,
      lastGeo: null,
      note: '',
      createdAt: purchase,
      createdBy: acc.id,
    };

    if (status === 'in_stock' || status === 'returned' || status === 'to_write_off' || status === 'written_off') {
      eq.holderType = 'warehouse';
      eq.holderId = pick(warehouses).id;
    } else if (status === 'at_client' || status === 'in_transit') {
      const o = pick(outlets);
      eq.holderType = 'counterparty';
      eq.holderId = o.counterpartyId;
      eq.outletId = o.id;
      eq.responsibleManagerId = o.responsibleManagerId;
      eq.transferredAt = addDays(nowISO(), -int(5, 500));
      if (status === 'at_client') {
        eq.lastConfirmedAt = rnd() > 0.35 ? addDays(nowISO(), -int(5, 420)) : null;
        eq.lastGeo = eq.lastConfirmedAt ? { ...o.geo, acc: int(8, 60), ts: eq.lastConfirmedAt } : null;
      }
    } else if (status === 'at_distributor') {
      const d = pick(distributors);
      eq.holderType = 'counterparty';
      eq.holderId = d.id;
      eq.responsibleManagerId = pick(managers).id;
      eq.transferredAt = addDays(nowISO(), -int(5, 400));
      eq.lastConfirmedAt = rnd() > 0.5 ? addDays(nowISO(), -int(5, 300)) : null;
    } else if (status === 'in_repair') {
      eq.holderType = 'service';
      eq.holderId = pick(services).id;
      eq.responsibleManagerId = pick(managers).id;
    }
    equipment.push(insert('equipment', eq, { silent: true }));

    raw().movements.push({
      id: uid('mov'), equipmentId: eq.id, at: purchase, type: 'created',
      toStatus: 'in_stock', userId: acc.id,
      comment: 'Оприбуткування на підставі первинних документів постачальника (п. 2.1)',
    });
    if (eq.transferredAt) {
      raw().movements.push({
        id: uid('mov'), equipmentId: eq.id, at: eq.transferredAt, type: 'transfer',
        fromStatus: 'in_stock', toStatus: eq.status, userId: sa.id,
        comment: 'Передача за Актом приймання-передачі',
      });
    }
  }

  /* ---------- Заявки на передачу ---------- */
  const reqStates = ['pending', 'approved', 'planned', 'shipped', 'completed', 'completed', 'rejected'];
  for (let i = 0; i < 9; i++) {
    const state = reqStates[i % reqStates.length];
    const type = pick(['client', 'distributor', 'client_via_distributor']);
    const client = pick(clients);
    const dist = pick(distributors);
    const mgr = pick(managers);
    const items = [];
    const pool = equipment.filter((e) => e.status === 'in_stock');
    for (let k = 0, n = int(1, 3); k < n && pool.length; k++) items.push(pick(pool).id);
    const createdAt = addDays(nowISO(), -int(1, 60));
    const rec = {
      id: uid('req'),
      number: `ЗАЯВКА-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`,
      createdAt, createdBy: mgr.id,
      transferType: type,
      recipientId: type === 'distributor' ? dist.id : client.id,
      viaDistributorId: type === 'client_via_distributor' ? dist.id : null,
      outletId: type === 'distributor' ? null : (outlets.find((o) => o.counterpartyId === client.id) || {}).id || null,
      equipmentIds: [...new Set(items)],
      purpose: pick(['Відкриття нової торгової точки', 'Заміна зношеного обладнання',
        'Розширення представленості ТМ', 'Сезонна промо-активність']),
      plannedDate: addDays(createdAt, int(3, 15)),
      comment: '',
      status: state,
      approval: state === 'pending' ? null : {
        userId: cd.id, at: addDays(createdAt, 1),
        decision: state === 'rejected' ? 'rejected' : 'approved',
        comment: state === 'rejected' ? 'Недостатнє обґрунтування потреби. Уточніть очікуваний приріст продажів.' : '',
      },
      planning: ['planned', 'shipped', 'completed'].includes(state)
        ? { userId: sa.id, at: addDays(createdAt, 2), warehouseId: warehouses[0].id, shipDate: addDays(createdAt, 4), ttn: 'ТТН-' + int(100000, 999999) }
        : null,
      shipment: ['shipped', 'completed'].includes(state) ? { userId: wh.id, at: addDays(createdAt, 4) } : null,
      actId: null,
    };
    raw().requests.push(rec);
  }

  /* ---------- Заявки на ремонт ---------- */
  const repairStates = ['new', 'accepted', 'in_repair', 'done', 'new'];
  for (let i = 0; i < 6; i++) {
    const eq = pick(equipment.filter((e) => ['at_client', 'in_repair', 'at_distributor'].includes(e.status)));
    if (!eq) continue;
    const st = repairStates[i % repairStates.length];
    const createdAt = addDays(nowISO(), -int(1, 45));
    raw().repairs.push({
      id: uid('rep'),
      number: `РЕМ-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`,
      equipmentId: eq.id,
      createdAt, createdBy: pick(managers).id,
      problem: pick([
        'Не тримає температуру, компресор працює безперервно.',
        'Пошкоджено дверний ущільнювач, конденсат на склі.',
        'Зламано кріплення полиці, стійка хитається.',
        'Не працює підсвітка логотипа.',
        'Механічне пошкодження корпусу після переміщення.',
      ]),
      urgency: pick(['low', 'normal', 'high']),
      needsRelocation: rnd() > 0.5,
      status: st,
      photos: [],
      serviceCompanyId: st === 'new' ? null : pick(services).id,
      plannedDate: st === 'new' ? null : addDays(createdAt, int(2, 10)),
      completedAt: st === 'done' ? addDays(createdAt, int(5, 20)) : null,
      actNumber: st === 'done' ? 'АВР-' + int(1000, 9999) : '',
      cost: st === 'done' ? int(400, 8000) : null,
      approvedForPayment: st === 'done' && rnd() > 0.5,
      managerId: tm.id,
      log: [],
    });
  }

  /* ---------- Інвентаризація (річне підтвердження, п. 12) ---------- */
  const invItems = equipment
    .filter((e) => ['at_client', 'at_distributor'].includes(e.status))
    .map((e) => ({
      equipmentId: e.id,
      status: rnd() > 0.55 ? 'confirmed' : 'pending',
      method: 'visit',
      photoIds: [],
      geo: null,
      confirmedAt: null,
      userId: null,
      comment: '',
    }));
  for (const it of invItems) {
    if (it.status === 'confirmed') {
      const eq = equipment.find((e) => e.id === it.equipmentId);
      const o = eq.outletId ? outlets.find((x) => x.id === eq.outletId) : null;
      it.confirmedAt = addDays(nowISO(), -int(1, 25));
      it.userId = eq.responsibleManagerId || pick(managers).id;
      it.geo = o ? { ...o.geo, acc: int(6, 45), ts: it.confirmedAt } : null;
    }
  }
  raw().inventories.push({
    id: uid('inv'),
    number: `ІНВ-${new Date().getFullYear()}-01`,
    name: `Річне підтвердження наявності ТО ${new Date().getFullYear()}`,
    createdAt: addDays(nowISO(), -30),
    createdBy: tm.id,
    dueDate: addDays(nowISO(), 30),
    status: 'active',
    scope: { statuses: ['at_client', 'at_distributor'], managerIds: [] },
    items: invItems,
  });

  /* ---------- Кілька повідомлень про втрату ---------- */
  const lostEq = pick(equipment.filter((e) => e.status === 'to_write_off'));
  if (lostEq) {
    raw().incidents.push({
      id: uid('inc'),
      number: `ІНЦ-${new Date().getFullYear()}-0001`,
      equipmentId: lostEq.id,
      type: 'damage',
      createdAt: addDays(nowISO(), -12),
      createdBy: pick(managers).id,
      description: 'Обладнання пошкоджено внаслідок затоплення приміщення торгової точки.',
      photos: [],
      status: 'investigating',
      decision: '',
      decidedBy: null,
      decidedAt: null,
    });
  }

  raw().counters = { [`ЗАЯВКА-${new Date().getFullYear()}`]: 9, [`РЕМ-${new Date().getFullYear()}`]: 6, [`ІНЦ-${new Date().getFullYear()}`]: 1 };
  persist();
  return true;
}
