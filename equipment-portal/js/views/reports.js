/* ==========================================================================
   Звіти: щомісячний контроль місцезнаходження (п. 8), аналітика, строки.
   ========================================================================== */

import {
  all, get, settings, userName, holderLabel, locationLabel, statusName,
  categoryName, notify, persist, logAudit,
} from '../store.js';
import { can, currentUser } from '../auth.js';
import {
  pageHead, actionBtn, alertBox, dataTable, chip, statusChip, toast, tabs, dl, confirmDialog,
} from '../ui.js';
import {
  el, fmtDate, fmtDateTime, fmtMoney, fmtNum, downloadFile, toCSV, groupBy,
  workdaysSince, daysBetween, monthName, sortBy, plural,
} from '../util.js';
import { icon } from '../icons.js';
import { locationOverdue, confirmationOverdue } from '../workflow.js';
import { openEquipmentCard } from './equipment.js';

let tab = 'monthly';

export function render(root) {
  root.append(pageHead(
    'Звіти та контроль',
    'Щомісячний контроль місцезнаходження ТО, аналітика структури парку обладнання та контроль нормативних строків.',
    []
  ));

  root.append(tabs([
    { id: 'monthly', label: 'Щомісячний контроль' },
    { id: 'analytics', label: 'Аналітика парку' },
    { id: 'deadlines', label: 'Контроль строків' },
    { id: 'costs', label: 'Ремонти та списання' },
  ], tab, (t) => { tab = t; root.innerHTML = ''; render(root); }));

  const holder = el('div');
  root.append(holder);
  if (tab === 'monthly') monthly(holder);
  if (tab === 'analytics') analytics(holder);
  if (tab === 'deadlines') deadlines(holder);
  if (tab === 'costs') costs(holder);
}

/* ==========================================================================
   Щомісячний звіт (п. 8)
   ========================================================================== */
function monthly(root) {
  const st = settings();
  const now = new Date();
  const rows = all('equipment').filter((e) => ['at_client', 'at_distributor', 'in_transit', 'in_repair'].includes(e.status));

  root.append(alertBox(
    `Щомісяця до ${st.monthlyReportDay} числа менеджер із трейд-маркетингу формує звіт із BAS про місцезнаходження ТО та надсилає його визначеному переліку працівників. Відповідальні менеджери перевіряють дані та повідомляють про зміни протягом ${st.monthlyConfirmDays} робочих днів (п. 8.1–8.3).`,
    'info', 'calendar'));

  const head = el('div.row.wrap.gap8.mb16');
  head.append(el('h2', { text: `Звіт за ${monthName(now.getMonth())} ${now.getFullYear()}` }));
  head.append(el('span.grow'));
  head.append(actionBtn('Експорт CSV', 'download', () => exportMonthly(rows), 'sm'));
  head.append(actionBtn('Друк', 'print', () => window.print(), 'sm'));
  if (can('reports.view')) {
    head.append(actionBtn('Надіслати відповідальним', 'bell', async () => {
      const byMgr = groupBy(rows.filter((e) => e.responsibleManagerId), (e) => e.responsibleManagerId);
      if (!byMgr.size) { toast('Немає відповідальних менеджерів для розсилки', 'err'); return; }
      if (!await confirmDialog({
        title: 'Надіслати звіт?',
        text: `Сповіщення отримають ${byMgr.size} ${plural(byMgr.size, 'відповідальний менеджер', 'відповідальні менеджери', 'відповідальних менеджерів')}. Строк підтвердження — ${st.monthlyConfirmDays} робочих днів.`,
        okText: 'Надіслати',
      })) return;
      for (const [mgrId, items] of byMgr) {
        notify(mgrId, `Щомісячний звіт про місцезнаходження ТО за ${monthName(now.getMonth())}: ${items.length} ${plural(items.length, 'позиція', 'позиції', 'позицій')} потребують перевірки (п. 8.2)`, '#/equipment');
      }
      logAudit(currentUser().id, 'report', 'monthly', '', `Розіслано щомісячний звіт (${rows.length} позицій)`);
      persist();
      toast('Звіт надіслано відповідальним менеджерам', 'ok');
    }, 'sm primary'));
  }
  root.append(head);

  /* зведення за менеджерами */
  const byMgr = groupBy(rows, (e) => e.responsibleManagerId || 'none');
  const summary = el('div.grid.auto.mb16');
  for (const [mgrId, items] of byMgr) {
    const confirmed = items.filter((e) => e.lastConfirmedAt && daysBetween(e.lastConfirmedAt) <= 35).length;
    const c = el('div.card.card-pad');
    c.append(el('div.strong', { text: mgrId === 'none' ? 'Без відповідального' : userName(mgrId) }));
    c.append(el('div.small.muted', { text: `${items.length} ${plural(items.length, 'одиниця', 'одиниці', 'одиниць')} ТО` }));
    const pr = el('div.progress.mt8');
    pr.append(el('i', { style: `width:${items.length ? (confirmed / items.length) * 100 : 0}%` }));
    c.append(pr);
    c.append(el('div.xs.muted.mt8', { text: `Актуальні дані: ${confirmed} з ${items.length}` }));
    summary.append(c);
  }
  root.append(summary);

  root.append(dataTable({
    columns: [
      { label: 'Інв. номер', main: true, render: (e) => el('b.mono', { text: e.invNumber }) },
      { label: 'Найменування', render: (e) => e.name },
      { label: 'Статус', render: (e) => statusChip(e.status) },
      { label: 'Утримувач', render: (e) => holderLabel(e) },
      { label: 'Адреса', render: (e) => el('span.small', { text: locationLabel(e) }), hideMobile: true },
      { label: 'Відповідальний', render: (e) => e.responsibleManagerId ? userName(e.responsibleManagerId) : '—', hideMobile: true },
      {
        label: 'Підтверджено', render: (e) => {
          if (!e.lastConfirmedAt) return chip('Немає даних', 'red');
          const d = daysBetween(e.lastConfirmedAt);
          return chip(fmtDate(e.lastConfirmedAt), d > 365 ? 'red' : d > 60 ? 'amber' : 'green');
        }
      },
    ],
    rows: sortBy(rows, (e) => userName(e.responsibleManagerId)),
    onRow: (e) => openEquipmentCard(e.id),
    empty: 'Немає ТО поза складом',
    footer: el('span', { text: `Усього в звіті: ${rows.length}` }),
  }));
}

function exportMonthly(rows) {
  const data = rows.map((e) => [
    e.invNumber, e.serialNumber || '', e.name, categoryName(e.categoryId), statusName(e.status),
    holderLabel(e), locationLabel(e), e.responsibleManagerId ? userName(e.responsibleManagerId) : '',
    e.lastConfirmedAt ? fmtDate(e.lastConfirmedAt) : 'немає даних',
    e.transferredAt ? fmtDate(e.transferredAt) : '',
  ]);
  const now = new Date();
  downloadFile(`Звіт_місцезнаходження_ТО_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.csv`,
    toCSV(data, ['Інв. номер', 'Серійний номер', 'Найменування', 'Категорія', 'Статус', 'Утримувач', 'Адреса',
      'Відповідальний менеджер', 'Останнє підтвердження', 'Дата передачі']), 'text/csv;charset=utf-8');
  toast('Звіт експортовано', 'ok');
}

/* ==========================================================================
   Аналітика парку
   ========================================================================== */
function analytics(root) {
  const eq = all('equipment');
  const active = eq.filter((e) => e.status !== 'written_off');

  const k = el('div.grid.k4.mb16');
  k.append(kpiCard('Одиниць ТО', fmtNum(eq.length), 'разом у реєстрі'));
  k.append(kpiCard('Балансова база', fmtMoney(active.reduce((s, e) => s + (+e.initialCost || 0), 0)), 'первісна вартість активного ТО'));
  k.append(kpiCard('У клієнтів', fmtNum(eq.filter((e) => e.status === 'at_client').length), 'одиниць'));
  k.append(kpiCard('Списано', fmtNum(eq.filter((e) => e.status === 'written_off').length), 'за весь період'));
  root.append(k);

  root.append(breakdown('За категоріями', groupBy(active, (e) => categoryName(e.categoryId))));
  root.append(breakdown('За статусами', groupBy(eq, (e) => statusName(e.status))));
  root.append(breakdown('За містами', groupBy(active, (e) => {
    const cp = e.holderType === 'counterparty' ? get('counterparties', e.holderId) : null;
    const out = e.outletId ? get('outlets', e.outletId) : null;
    return (out && out.city) || (cp && cp.city) || (e.holderType === 'warehouse' ? 'Склад' : 'Інше');
  })));
  root.append(breakdown('За відповідальними менеджерами', groupBy(active.filter((e) => e.responsibleManagerId), (e) => userName(e.responsibleManagerId))));

  root.append(el('div.row.gap8.mt16', {}, [
    actionBtn('Експорт повного реєстру', 'download', () => {
      const rows = eq.map((e) => [
        e.invNumber, e.serialNumber || '', e.name, categoryName(e.categoryId), e.model || '', e.manufacturer || '',
        statusName(e.status), holderLabel(e), locationLabel(e),
        e.responsibleManagerId ? userName(e.responsibleManagerId) : '',
        fmtDate(e.purchaseDate), e.initialCost ?? '', e.lastConfirmedAt ? fmtDate(e.lastConfirmedAt) : '',
      ]);
      downloadFile(`Реєстр_ТО_повний_${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows,
        ['Інв. номер', 'Серійний номер', 'Найменування', 'Категорія', 'Модель', 'Виробник', 'Статус',
          'Утримувач', 'Адреса', 'Відповідальний', 'Дата придбання', 'Вартість', 'Останнє підтвердження']),
        'text/csv;charset=utf-8');
      toast('Реєстр експортовано', 'ok');
    }, 'sm'),
  ]));
}

function kpiCard(label, value, sub) {
  const c = el('div.card.card-pad');
  c.append(el('div.lbl.small.muted', { text: label }));
  c.append(el('div', { text: value, style: 'font-size:23px;font-weight:700;line-height:1.1;margin:3px 0' }));
  c.append(el('div.xs.muted', { text: sub }));
  return c;
}

function breakdown(title, map) {
  const card = el('div.card.mb16');
  card.append(el('div.card-head', {}, [el('h3', { text: title })]));
  const b = el('div.card-body');
  const entries = [...map.entries()].sort((a, b2) => b2[1].length - a[1].length);
  const max = Math.max(1, ...entries.map(([, v]) => v.length));
  for (const [k, v] of entries) {
    const row = el('div.bar-row');
    row.append(el('div.small', { text: k }));
    const track = el('div.bar-track');
    track.append(el('i', { style: `width:${(v.length / max) * 100}%` }));
    row.append(track, el('div.right.small.strong', { text: String(v.length) }));
    b.append(row);
  }
  if (!entries.length) b.append(el('div.small.muted', { text: 'Немає даних' }));
  card.append(b);
  return card;
}

/* ==========================================================================
   Контроль строків
   ========================================================================== */
function deadlines(root) {
  const st = settings();
  const loc = locationOverdue();
  const conf = confirmationOverdue();
  const noSerial = all('equipment').filter((e) => !e.serialNumber && e.status !== 'written_off');
  const oldRequests = all('requests').filter((r) => r.status === 'pending' && daysBetween(r.createdAt) > 3);
  const oldRepairs = all('repairs').filter((r) => r.status === 'new' && daysBetween(r.createdAt) > 3);

  const k = el('div.grid.k4.mb16');
  k.append(kpiCard('Без місцезнаходження', String(loc.length), `норматив ${st.locationDeadlineDays} р.д. (п. 6.1)`));
  k.append(kpiCard('Без підтвердження > року', String(conf.length), 'п. 12.1'));
  k.append(kpiCard('Заявки без погодження', String(oldRequests.length), 'понад 3 дні'));
  k.append(kpiCard('Ремонти без реакції', String(oldRepairs.length), 'понад 3 дні'));
  root.append(k);

  section('Не внесено фактичне місцезнаходження (п. 6.1)', loc, (e) =>
    chip(`${workdaysSince(e.transferredAt)} р.д. після передачі`, 'red'));
  section('Не підтверджено наявність понад рік (п. 12.1)', conf, (e) =>
    chip(e.lastConfirmedAt ? `${daysBetween(e.lastConfirmedAt)} дн. тому` : 'жодного разу', 'amber'));
  section('Не зафіксовано серійний номер (п. 2.3)', noSerial.slice(0, 50), () => chip('Немає S/N', 'grey'));

  function section(title, rows, badge) {
    root.append(el('h3.mt24.mb8', { text: `${title} — ${rows.length}` }));
    if (!rows.length) { root.append(el('div.small.muted.mb16', { text: 'Порушень немає' })); return; }
    root.append(dataTable({
      columns: [
        { label: 'Інв. номер', main: true, render: (e) => el('b.mono', { text: e.invNumber }) },
        { label: 'Найменування', render: (e) => e.name, hideMobile: true },
        { label: 'Утримувач', render: (e) => holderLabel(e) },
        { label: 'Відповідальний', render: (e) => e.responsibleManagerId ? userName(e.responsibleManagerId) : '—' },
        { label: 'Порушення', render: badge },
      ],
      rows,
      onRow: (e) => openEquipmentCard(e.id),
      empty: 'Порушень немає',
    }));
  }
}

/* ==========================================================================
   Ремонти та списання
   ========================================================================== */
function costs(root) {
  const year = new Date().getFullYear();
  const reps = all('repairs');
  const done = reps.filter((r) => r.status === 'done');
  const total = done.reduce((s, r) => s + (+r.cost || 0), 0);
  const unpaid = done.filter((r) => !r.approvedForPayment);
  const wos = all('writeoffs').filter((w) => w.status === 'approved');
  const woSum = wos.reduce((s, w) => s + w.equipmentIds.reduce((a, id) => a + (+(get('equipment', id) || {}).initialCost || 0), 0), 0);

  const k = el('div.grid.k4.mb16');
  k.append(kpiCard('Ремонтів завершено', String(done.length), `за весь період`));
  k.append(kpiCard('Витрати на ремонт', fmtMoney(total), 'за актами виконаних робіт'));
  k.append(kpiCard('Актів без погодження', String(unpaid.length), 'до оплати (п. 10.5)'));
  k.append(kpiCard('Списано на суму', fmtMoney(woSum), `${wos.length} ${plural(wos.length, 'документ', 'документи', 'документів')}`));
  root.append(k);

  root.append(el('h3.mt16.mb8', { text: 'Витрати на ремонт за обладнанням' }));
  const byEq = groupBy(done, (r) => r.equipmentId);
  const rows = [...byEq.entries()].map(([eid, list]) => ({
    eq: get('equipment', eid), count: list.length,
    sum: list.reduce((s, r) => s + (+r.cost || 0), 0),
  })).filter((r) => r.eq);
  root.append(dataTable({
    columns: [
      { label: 'Інв. номер', main: true, render: (r) => el('b.mono', { text: r.eq.invNumber }) },
      { label: 'Найменування', render: (r) => r.eq.name },
      { label: 'Первісна вартість', render: (r) => fmtMoney(r.eq.initialCost), hideMobile: true },
      { label: 'Ремонтів', render: (r) => String(r.count) },
      { label: 'Витрати', render: (r) => fmtMoney(r.sum) },
      {
        label: 'Частка від вартості', render: (r) => {
          const p = r.eq.initialCost ? Math.round((r.sum / r.eq.initialCost) * 100) : null;
          return p === null ? '—' : chip(p + '%', p > 50 ? 'red' : p > 25 ? 'amber' : 'green');
        }
      },
    ],
    rows: sortBy(rows, 'sum', -1),
    onRow: (r) => openEquipmentCard(r.eq.id),
    empty: 'Завершених ремонтів немає',
    footer: el('span', { text: `Разом: ${fmtMoney(total)}` }),
  }));
}
