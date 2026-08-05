/* Головна сторінка: показники, персональні задачі, контроль строків */

import { all, get, settings, statusName, userName, holderLabel } from '../store.js';
import { can, currentUser } from '../auth.js';
import { pageHead, actionBtn, alertBox, statusChip, chip, dataTable } from '../ui.js';
import { el, fmtDate, fmtMoney, workdaysSince, daysBetween, monthName, plural } from '../util.js';
import { icon } from '../icons.js';
import { locationOverdue, confirmationOverdue, monthlyControlDue } from '../workflow.js';
import { navigate } from '../router.js';
import { openEquipmentCard } from './equipment.js';

export function render(root) {
  const u = currentUser();
  root.append(pageHead(
    `Вітаємо, ${u.fullName.split(' ')[0]}!`,
    'Оперативний стан торговельного обладнання та ваші задачі за процесом управління ТО.',
    [actionBtn('Оновити', 'refresh', () => { root.innerHTML = ''; render(root); }, 'sm')]
  ));

  /* ---------- Строки за Положенням ---------- */
  if (monthlyControlDue() && can('reports.view')) {
    const d = settings().monthlyReportDay;
    root.append(alertBox(
      `Період щомісячного контролю: до ${d} числа менеджер із трейд-маркетингу формує звіт про місцезнаходження ТО, відповідальні менеджери підтверджують дані протягом ${settings().monthlyConfirmDays} робочих днів (п. 8).`,
      'info', 'calendar'));
  }

  /* ---------- KPI ---------- */
  const eq = all('equipment');
  const byStatus = (s) => eq.filter((e) => e.status === s).length;
  const overdueLoc = locationOverdue();
  const overdueConf = confirmationOverdue();

  const kpis = el('div.grid.k4');
  kpis.append(kpi('Усього одиниць ТО', eq.length, `Загальна вартість ${fmtMoney(eq.reduce((s, e) => s + (+e.initialCost || 0), 0))}`, 'info', () => navigate('#/equipment')));
  kpis.append(kpi('У клієнтів і дистриб’юторів', byStatus('at_client') + byStatus('at_distributor'), 'Обладнання в експлуатації', 'ok', () => navigate('#/equipment')));
  kpis.append(kpi('На складі', byStatus('in_stock') + byStatus('returned'), 'Доступне до передачі', '', () => navigate('#/equipment')));
  kpis.append(kpi('Потребує уваги', overdueLoc.length + overdueConf.length,
    `${overdueLoc.length} без місцезнаходження · ${overdueConf.length} без підтвердження`, 'warn', () => navigate('#/reports')));
  root.append(kpis);

  /* ---------- Мої задачі ---------- */
  const tasks = collectTasks(u);
  const grid = el('div.grid.k2.mt16');

  const tasksCard = el('div.card');
  tasksCard.append(el('div.card-head', {}, [el('h3', { text: 'Мої задачі' }),
    el('span.grow'), chip(`${tasks.length}`, tasks.length ? 'red' : 'green')]));
  const tb = el('div.card-body');
  if (!tasks.length) {
    tb.append(el('div.empty', {}, [el('div', { html: icon('check') }), el('b', { text: 'Задач немає' }),
      el('div.small', { text: 'Усі дії за вашою роллю виконано.' })]));
  } else {
    for (const t of tasks.slice(0, 12)) {
      const row = el('button', {
        type: 'button',
        style: 'display:flex;gap:11px;align-items:flex-start;width:100%;text-align:left;padding:10px;border:1px solid var(--line);background:#fff;border-radius:10px;margin-bottom:7px;cursor:pointer',
      });
      const ic = el('div', { html: icon(t.icon), style: `width:32px;height:32px;border-radius:8px;flex:0 0 auto;display:grid;place-items:center;background:${t.urgent ? 'var(--red-soft)' : 'var(--blue-soft)'};color:${t.urgent ? 'var(--red)' : 'var(--blue)'}` });
      ic.firstElementChild.style.width = '16px';
      ic.firstElementChild.style.height = '16px';
      row.append(ic);
      row.append(el('div.grow', {}, [
        el('b', { text: t.title, style: 'font-size:13.5px' }),
        el('div.small.muted', { text: t.desc }),
      ]));
      row.append(el('div', { html: icon('chevronRight'), style: 'color:var(--ink-mute);width:16px' }));
      row.addEventListener('click', t.action);
      tb.append(row);
    }
    if (tasks.length > 12) tb.append(el('div.small.muted.center', { text: `…та ще ${tasks.length - 12}` }));
  }
  tasksCard.append(tb);
  grid.append(tasksCard);

  /* ---------- Розподіл за статусами ---------- */
  const statCard = el('div.card');
  statCard.append(el('div.card-head', {}, [el('h3', { text: 'Розподіл за статусами' })]));
  const sb = el('div.card-body');
  const max = Math.max(1, ...all('statuses').map((s) => byStatus(s.id)));
  for (const s of all('statuses')) {
    const n = byStatus(s.id);
    const row = el('div.bar-row');
    row.append(el('div.small', { text: s.name }));
    const track = el('div.bar-track');
    const fill = el('i', { style: `width:${(n / max) * 100}%;background:${barColor(s.color)}` });
    track.append(fill);
    row.append(track, el('div.right.small.strong', { text: String(n) }));
    row.addEventListener('click', () => navigate('#/equipment'));
    row.style.cursor = 'pointer';
    sb.append(row);
  }
  statCard.append(sb);
  grid.append(statCard);
  root.append(grid);

  /* ---------- Прострочені строки ---------- */
  if (overdueLoc.length || overdueConf.length) {
    root.append(el('h2.mt24.mb8', { text: 'Контроль строків' }));
    const rows = [...overdueLoc.map((e) => ({ e, kind: 'loc' })), ...overdueConf.map((e) => ({ e, kind: 'conf' }))]
      .filter((v, i, a) => a.findIndex((x) => x.e.id === v.e.id) === i)
      .slice(0, 25);
    root.append(dataTable({
      columns: [
        { label: 'Інв. номер', main: true, render: (r) => el('b.mono', { text: r.e.invNumber }) },
        { label: 'Найменування', render: (r) => r.e.name, hideMobile: true },
        { label: 'Утримувач', render: (r) => holderLabel(r.e) },
        { label: 'Відповідальний', render: (r) => r.e.responsibleManagerId ? userName(r.e.responsibleManagerId) : '—', hideMobile: true },
        {
          label: 'Порушення', render: (r) => r.kind === 'loc'
            ? chip(`Місцезнаходження: ${workdaysSince(r.e.transferredAt)} р.д. (норма ${settings().locationDeadlineDays})`, 'red')
            : chip(`Не підтверджено ${r.e.lastConfirmedAt ? daysBetween(r.e.lastConfirmedAt) + ' дн.' : 'жодного разу'}`, 'amber')
        },
      ],
      rows,
      onRow: (r) => openEquipmentCard(r.e.id),
      empty: 'Порушень немає',
    }));
  }
}

function barColor(c) {
  return ({ green: 'var(--green)', red: 'var(--red)', amber: '#D9A400', blue: 'var(--blue)', slate: '#7A8BA0', grey: '#A9B4BF' })[c] || 'var(--blue)';
}

function kpi(label, value, sub, cls, onClick) {
  const b = el('button.kpi' + (cls ? '.' + cls : ''), { type: 'button' });
  b.append(el('div.lbl', { text: label }), el('div.val', { text: String(value) }), el('div.sub', { text: sub }));
  b.addEventListener('click', onClick);
  return b;
}

/* ---------- Формування персональних задач ---------- */
function collectTasks(u) {
  const t = [];
  const reqs = all('requests');

  if (can('request.approve')) {
    for (const r of reqs.filter((x) => x.status === 'pending')) {
      t.push({
        icon: 'fileText', urgent: true,
        title: `Погодити заявку ${r.number}`,
        desc: `${userName(r.createdBy)} · ${r.equipmentIds.length} ${plural(r.equipmentIds.length, 'одиниця', 'одиниці', 'одиниць')} · ${fmtDate(r.createdAt)}`,
        action: () => navigate(`#/requests/${r.id}`),
      });
    }
  }
  if (can('request.plan')) {
    for (const r of reqs.filter((x) => x.status === 'approved')) {
      t.push({
        icon: 'truck', title: `Запланувати передачу за заявкою ${r.number}`,
        desc: 'Заявку погоджено — потрібно організувати відвантаження (п. 4)',
        action: () => navigate(`#/requests/${r.id}`),
      });
    }
  }
  if (can('request.ship')) {
    for (const r of reqs.filter((x) => x.status === 'planned')) {
      t.push({
        icon: 'warehouse', title: `Відвантажити за заявкою ${r.number}`,
        desc: `Планова дата: ${fmtDate(r.planning?.shipDate)}`,
        action: () => navigate(`#/requests/${r.id}`),
      });
    }
  }
  if (can('request.act')) {
    for (const r of reqs.filter((x) => x.status === 'shipped')) {
      t.push({
        icon: 'fileText', title: `Оформити Акт приймання-передачі (${r.number})`,
        desc: 'Обладнання відвантажено — потрібен універсальний Акт (п. 5)',
        action: () => navigate(`#/requests/${r.id}`),
      });
    }
  }
  if (can('repair.manage')) {
    for (const r of all('repairs').filter((x) => x.status === 'new')) {
      t.push({
        icon: 'wrench', urgent: r.urgency === 'high',
        title: `Опрацювати заявку на ремонт ${r.number}`,
        desc: (get('equipment', r.equipmentId) || {}).invNumber + ' · ' + fmtDate(r.createdAt),
        action: () => navigate(`#/repairs/${r.id}`),
      });
    }
  }
  if (can('ops.writeoff.approve')) {
    for (const w of all('writeoffs').filter((x) => x.status === 'pending')) {
      t.push({
        icon: 'recycle', title: `Затвердити списання ${w.number}`,
        desc: `${w.equipmentIds.length} ${plural(w.equipmentIds.length, 'одиниця', 'одиниці', 'одиниць')}`,
        action: () => navigate('#/operations'),
      });
    }
  }
  if (can('inventory.confirm')) {
    for (const inv of all('inventories').filter((i) => i.status === 'active')) {
      const mine = inv.items.filter((it) => {
        if (it.status !== 'pending') return false;
        const eq = get('equipment', it.equipmentId);
        return eq && (!eq.responsibleManagerId || eq.responsibleManagerId === u.id);
      });
      if (mine.length) {
        t.push({
          icon: 'clipboard', urgent: new Date(inv.dueDate) < new Date(),
          title: `Підтвердити наявність ТО (${inv.number})`,
          desc: `${mine.length} ${plural(mine.length, 'позиція', 'позиції', 'позицій')} · строк до ${fmtDate(inv.dueDate)}`,
          action: () => navigate('#/inventory'),
        });
      }
    }
  }
  /* відповідальний менеджер: ТО без внесеного місцезнаходження */
  const mine = locationOverdue().filter((e) => e.responsibleManagerId === u.id);
  for (const e of mine.slice(0, 6)) {
    t.push({
      icon: 'pin', urgent: true,
      title: `Внести місцезнаходження ${e.invNumber}`,
      desc: `Минуло ${workdaysSince(e.transferredAt)} робочих днів після передачі (норматив ${settings().locationDeadlineDays})`,
      action: () => openEquipmentCard(e.id),
    });
  }
  return t;
}
