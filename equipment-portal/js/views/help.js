/* ==========================================================================
   Довідка: схема процесу, статуси, матриця відповідальності (RACI),
   інструкція зі встановлення мобільної версії.
   ========================================================================== */

import { all, settings, roleName, ROLES } from '../store.js';
import { pageHead, tabs, chip, alertBox, dataTable, actionBtn } from '../ui.js';
import { el } from '../util.js';
import { icon } from '../icons.js';
import { scannerSupported } from '../scanner.js';

let tab = 'process';

export function render(root) {
  root.append(pageHead(
    'Положення та процес управління ТО',
    'Схема процесу, статуси, матриця відповідальності та інструкція для мобільної версії порталу.',
    []
  ));
  root.append(tabs([
    { id: 'process', label: 'Схема процесу' },
    { id: 'raci', label: 'Матриця відповідальності' },
    { id: 'statuses', label: 'Статуси і строки' },
    { id: 'mobile', label: 'Мобільна версія' },
  ], tab, (t) => { tab = t; root.innerHTML = ''; render(root); }));

  const box = el('div');
  root.append(box);
  ({ process: processTab, raci: raciTab, statuses: statusTab, mobile: mobileTab }[tab])(box);
}

/* ---------- Схема процесу ---------- */
const STEPS = [
  ['Придбання ТО', 'Закупівля торговельного обладнання, контроль якості та комплектності.', 'Склад', 'box'],
  ['Оприбуткування в BAS', 'Бухгалтерія оприбутковує ТО, присвоюється інвентарний номер, фіксується серійний номер, визначається первісна вартість (п. 2).', 'Бухгалтерія', 'fileText'],
  ['Заявка на передачу', 'Відповідальний менеджер створює заявку в електронній формі: ТО, кількість, отримувач, тип передачі (п. 3).', 'Відповідальний менеджер', 'edit'],
  ['Погодження заявки', 'Заявка погоджується Комерційним директором; після погодження передається у роботу (п. 3.3).', 'Комерційний директор', 'check'],
  ['Планування та організація передачі', 'ВАП планує передачу: узгодження зі складом, логістика з дистриб’ютором, підготовка документів (п. 4).', 'Відділ адміністрування продажів', 'truck'],
  ['Передача ТО та оформлення документів', 'Передача Клієнту, Дистриб’ютору або Клієнту через Дистриб’ютора; оформлюється Акт приймання-передачі (п. 5).', 'ВАП / Склад', 'clipboard'],
  ['Внесення місцезнаходження в BAS', 'Менеджер з трейд-маркетингу вносить місце розташування, присвоюється статус, визначається відповідальний менеджер (п. 6).', 'Трейд-маркетинг', 'pin'],
  ['Щомісячний контроль місцезнаходження', `До ${settings().monthlyReportDay}-го числа формується звіт; відповідальні менеджери підтверджують дані протягом ${settings().monthlyConfirmDays} робочих днів (п. 8).`, 'Трейд-маркетинг', 'calendar'],
  ['Переміщення ТО', 'Будь-яке переміщення — між точками, повернення на склад, передача іншому дистриб’ютору — лише за заявкою та документом (п. 9).', 'Відповідальний менеджер', 'arrows'],
  ['Ремонт ТО', 'Заявка на ремонт → сервісна компанія → повернення в експлуатацію → Акт виконаних робіт і погодження оплати (п. 10).', 'Трейд-маркетинг', 'wrench'],
  ['Інвентаризація (щорічне підтвердження)', 'Формується реєстр ТО; підтвердження — особистий огляд, фото/відео, підтвердження клієнта (п. 12).', 'Трейд-маркетинг / Відповідальні менеджери', 'clipboard'],
  ['Повернення ТО', 'Оформлюється Акт повернення; ТО повертається на склад або передається іншому отримувачу (п. 9).', 'ВАП / Склад', 'recycle'],
  ['Списання ТО', 'Підстави: зношення, недоцільність ремонту, безповоротне пошкодження, викрадення, невідоме місцезнаходження (п. 11.3).', 'Бухгалтерія / Комерційний директор', 'trash'],
  ['Втрата / пошкодження / викрадення', `Повідомлення протягом ${settings().incidentReportDays} робочих днів; розслідування; рішення: повернення, ремонт, компенсація, заміна або списання (п. 11).`, 'Відповідальний менеджер', 'alert'],
];

function processTab(root) {
  root.append(alertBox('Єдиною системою обліку торговельного обладнання є BAS. Портал забезпечує подання заявок, польову інвентаризацію та контроль строків, а всі операції виконуються на підставі первинних документів.', 'info'));
  const grid = el('div.grid.auto');
  STEPS.forEach(([title, desc, owner, ic], i) => {
    const c = el('div.card.card-pad');
    const head = el('div.row.gap8.mb8');
    const badge = el('div', {
      style: 'width:26px;height:26px;border-radius:50%;background:var(--green);color:#fff;display:grid;place-items:center;font-size:12px;font-weight:700;flex:0 0 auto',
      text: String(i + 1),
    });
    const ico = el('div', { html: icon(ic), style: 'width:20px;height:20px;color:var(--blue)' });
    head.append(badge, ico);
    c.append(head);
    c.append(el('b', { text: title, style: 'font-size:13.5px;text-transform:uppercase;letter-spacing:.02em' }));
    c.append(el('div.small.muted.mt8', { text: desc }));
    c.append(el('div.mt8', {}, [chip(owner, 'blue')]));
    grid.append(c);
  });
  root.append(grid);

  root.append(el('h3.mt24.mb8', { text: 'Типи передачі (п. 5.3)' }));
  const t = el('div.grid.k3');
  [['1', 'Клієнту', 'Передача безпосередньо клієнту.'],
  ['2', 'Дистриб’ютору', 'Передача дистриб’ютору, який є отримувачем обладнання.'],
  ['3', 'Клієнту через дистриб’ютора', 'Отримувач — клієнт; в Акті зазначається, що реалізація продукції здійснюється через відповідного дистриб’ютора (п. 5.4).']]
    .forEach(([n, name, desc]) => {
      const c = el('div.card.card-pad');
      c.append(el('div.row.gap8', {}, [
        el('div', { text: n, style: 'width:24px;height:24px;border-radius:50%;background:var(--green);color:#fff;display:grid;place-items:center;font-size:11.5px;font-weight:700' }),
        el('b', { text: name }),
      ]));
      c.append(el('div.small.muted.mt8', { text: desc }));
      t.append(c);
    });
  root.append(t);
}

/* ---------- RACI ---------- */
const RACI_ROLES = ['Бухгалтерія', 'Комерційний директор', 'Відповідальний менеджер', 'Відділ адміністрування продажів', 'Менеджер із трейд-маркетингу', 'Склад', 'Клієнт / Дистриб’ютор'];
const RACI = [
  ['Придбання ТО', 'I', 'I', 'I', 'I', 'I', 'R', 'I'],
  ['Оприбуткування ТО в BAS', 'R', 'I', 'I', 'I', 'I', 'I', 'I'],
  ['Заявка на передачу ТО', 'I', 'A', 'R', 'I', 'I', 'I', 'I'],
  ['Погодження заявки', 'I', 'A', 'I', 'I', 'I', 'I', 'I'],
  ['Планування та організація передачі', 'I', 'I', 'C', 'R', 'C', 'C', 'I'],
  ['Передача ТО та оформлення документів', 'I', 'I', 'C', 'R', 'C', 'R', 'C'],
  ['Повідомлення про місцезнаходження та внесення в BAS', 'I', 'I', 'R', 'I', 'R', 'I', 'I'],
  ['Щомісячний контроль місцезнаходження ТО', 'I', 'I', 'R', 'I', 'R', 'I', 'C'],
  ['Переміщення ТО', 'I', 'I', 'R', 'R', 'R', 'R', 'C'],
  ['Ремонт ТО', 'I', 'I', 'C', 'C', 'R', 'C', 'C'],
  ['Інвентаризація / підтвердження наявності', 'R', 'I', 'C', 'I', 'R', 'C', 'C'],
  ['Повернення ТО', 'I', 'I', 'R', 'R', 'R', 'R', 'C'],
  ['Списання ТО', 'R', 'A', 'C', 'C', 'C', 'I', 'I'],
];
const RACI_COLOR = { R: 'green', A: 'red', C: 'amber', I: 'grey' };

function raciTab(root) {
  root.append(alertBox('R — виконує; A — остаточно відповідає / погоджує; C — консультується / залучається; I — інформується (Додаток 4 Положення).', 'info'));
  const wrap = el('div.card');
  const scroll = el('div', { style: 'overflow-x:auto' });
  const table = el('table.tbl');
  const thead = el('thead');
  const tr = el('tr');
  tr.append(el('th', { text: 'Процес / дія', style: 'min-width:230px' }));
  RACI_ROLES.forEach((r) => tr.append(el('th', { text: r, style: 'min-width:110px;white-space:normal' })));
  thead.append(tr);
  const tb = el('tbody');
  for (const row of RACI) {
    const trr = el('tr');
    trr.append(el('td', { text: row[0], style: 'font-weight:600' }));
    for (let i = 1; i < row.length; i++) {
      const td = el('td.center');
      td.append(chip(row[i], RACI_COLOR[row[i]]));
      trr.append(td);
    }
    tb.append(trr);
  }
  table.append(thead, tb);
  scroll.append(table);
  wrap.append(scroll);
  root.append(wrap);

  root.append(el('h3.mt24.mb8', { text: 'Ролі порталу' }));
  const grid = el('div.grid.k2');
  for (const r of ROLES) {
    const c = el('div.card.card-pad');
    c.append(el('b', { text: r.name }));
    c.append(el('div.small.muted.mt8', { text: r.desc }));
    grid.append(c);
  }
  root.append(grid);
}

/* ---------- Статуси і строки ---------- */
function statusTab(root) {
  const st = settings();
  root.append(el('h3.mb8', { text: 'Статуси ТО (п. 7.2)' }));
  const grid = el('div.grid.auto.mb16');
  for (const s of all('statuses')) {
    const c = el('div.card.card-pad');
    c.append(el('span.chip.' + s.color, {}, [el('i.dot'), s.name]));
    c.append(el('div.xs.muted.mt8', { text: 'Код: ' + s.id }));
    c.append(el('div.small.mt8', { text: `${all('equipment').filter((e) => e.status === s.id).length} од. ТО` }));
    grid.append(c);
  }
  root.append(grid);

  root.append(el('h3.mt24.mb8', { text: 'Нормативні строки' }));
  root.append(dataTable({
    cards: false,
    columns: [
      { label: 'Норматив', render: (r) => r[0], main: true },
      { label: 'Значення', render: (r) => chip(r[1], 'blue') },
      { label: 'Пункт Положення', render: (r) => r[2] },
    ],
    rows: [
      ['Внесення фактичного місцезнаходження після передачі', `${st.locationDeadlineDays} робочих днів`, 'п. 6.1'],
      ['Формування щомісячного звіту', `до ${st.monthlyReportDay} числа`, 'п. 8.1'],
      ['Підтвердження даних звіту відповідальними менеджерами', `${st.monthlyConfirmDays} робочих днів`, 'п. 8.2'],
      ['Підтвердження наявності ТО (інвентаризація)', `не рідше 1 разу на ${st.inventoryPeriodMonths} міс.`, 'п. 12.1'],
      ['Повідомлення про втрату / пошкодження', `${st.incidentReportDays} робочі дні`, 'п. 11.1'],
    ],
    empty: '',
  }));
}

/* ---------- Мобільна версія ---------- */
function mobileTab(root) {
  root.append(alertBox('Портал є прогресивним вебзастосунком (PWA): він встановлюється на Android та iOS з браузера, працює у повноекранному режимі й доступний офлайн — дані зберігаються на пристрої та синхронізуються після відновлення зв’язку.', 'info'));

  const grid = el('div.grid.k2');
  grid.append(instr('Android (Chrome)', [
    'Відкрийте портал у Chrome.',
    'Меню «⋮» → «Встановити застосунок» / «Додати на головний екран».',
    'Підтвердіть встановлення — з’явиться іконка «Облік ТО».',
    'Під час першого сканування дозвольте доступ до камери та геолокації.',
  ]));
  grid.append(instr('iOS (Safari)', [
    'Відкрийте портал у Safari (Chrome на iOS не підтримує встановлення).',
    'Кнопка «Поділитися» → «На екран “Домівка”».',
    'Підтвердіть — застосунок відкриватиметься у повноекранному режимі.',
    'Дозвольте доступ до камери та геолокації у запиті системи.',
  ]));
  root.append(grid);

  root.append(el('h3.mt24.mb8', { text: 'Сценарій польової інвентаризації' }));
  const steps = [
    'Відкрийте застосунок і натисніть зелену кнопку «Скан» на нижній панелі.',
    'Наведіть камеру на етикетку зі штрих-кодом інвентарного номера — обладнання визначиться автоматично.',
    'Зробіть фото обладнання на місці встановлення (фотофіксація, п. 12.3).',
    'Натисніть «Визначити місцезнаходження» — координати порівнюються з обліковою адресою.',
    'За потреби зафіксуйте розбіжність (ТО відсутнє, переміщене, пошкоджене) та збережіть підтвердження.',
  ];
  const ol = el('div.card.card-pad');
  steps.forEach((s, i) => {
    ol.append(el('div.row.gap8', { style: 'padding:7px 0;align-items:flex-start' }, [
      el('div', { text: String(i + 1), style: 'width:22px;height:22px;border-radius:50%;background:var(--blue);color:#fff;display:grid;place-items:center;font-size:11px;font-weight:700;flex:0 0 auto' }),
      el('div.small', { text: s }),
    ]));
  });
  root.append(ol);

  root.append(el('h3.mt24.mb8', { text: 'Підтримка функцій на цьому пристрої' }));
  const caps = [
    ['Камера (фотофіксація)', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)],
    ['Автоматичне розпізнавання штрих-кодів', scannerSupported()],
    ['Геолокація', !!navigator.geolocation],
    ['Офлайн-режим (Service Worker)', 'serviceWorker' in navigator],
    ['Встановлення як застосунку', 'onbeforeinstallprompt' in window || /iPhone|iPad/.test(navigator.userAgent)],
  ];
  const capGrid = el('div.grid.k2');
  for (const [name, ok] of caps) {
    const c = el('div.card.card-pad.row.gap8');
    c.append(el('div.grow.small', { text: name }));
    c.append(chip(ok ? 'Підтримується' : 'Недоступно', ok ? 'green' : 'amber'));
    capGrid.append(c);
  }
  root.append(capGrid);
  root.append(el('div.small.muted.mt8', {
    text: 'Якщо автоматичне розпізнавання штрих-кодів недоступне (зокрема Safari на iOS), інвентарний номер вводиться вручну — фото та геолокація зберігаються так само.',
  }));
}

function instr(title, items) {
  const c = el('div.card.card-pad');
  c.append(el('b', { text: title }));
  const list = el('div.mt8');
  items.forEach((t, i) => {
    list.append(el('div.row.gap8', { style: 'padding:5px 0;align-items:flex-start' }, [
      el('div', { text: String(i + 1), style: 'width:20px;height:20px;border-radius:50%;background:var(--paper);border:1px solid var(--line);display:grid;place-items:center;font-size:10.5px;font-weight:700;flex:0 0 auto' }),
      el('div.small', { text: t }),
    ]));
  });
  c.append(list);
  return c;
}
