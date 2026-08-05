/* ==========================================================================
   Ремонт торговельного обладнання (п. 10 Положення).
   ========================================================================== */

import { all, get, update, userName, holderLabel, settings } from '../store.js';
import { can, currentUser } from '../auth.js';
import {
  pageHead, actionBtn, alertBox, dataTable, dl, chip, statusChip, toast,
  formModal, openDrawer, confirmDialog, searchInput, selectFilter, photoPicker, stepper,
} from '../ui.js';
import { el, fmtDate, fmtDateTime, fmtDateInput, fmtMoney, matches, sortBy, daysBetween } from '../util.js';
import { updateRepair, startRepair, finishRepair, createRepair } from '../workflow.js';
import { openEquipmentCard, openRepairForm } from './equipment.js';

const RSTATUS = {
  new: { label: 'Нова', color: 'amber' },
  accepted: { label: 'Прийнято в роботу', color: 'blue' },
  in_repair: { label: 'У ремонті', color: 'blue' },
  done: { label: 'Завершено', color: 'green' },
  rejected: { label: 'Відхилено', color: 'grey' },
};
const URGENCY = { low: { label: 'Низька', color: 'grey' }, normal: { label: 'Звичайна', color: 'blue' }, high: { label: 'Висока', color: 'red' } };
const STEPS = ['Заявка', 'Сервіс', 'Ремонт', 'Повернення'];
const stepIdx = (r) => ({ new: 1, accepted: 2, in_repair: 3, done: 4, rejected: 1 }[r.status] ?? 0);

const state = { q: '', status: '', urgency: '' };

export function render(root, params = {}) {
  root.append(pageHead(
    'Ремонт торговельного обладнання',
    'Заявки на ремонт опрацьовує менеджер із трейд-маркетингу: організовує сервісну компанію, координує переміщення та контролює повернення в експлуатацію (п. 10).',
    [can('repair.create') && actionBtn('Заявка на ремонт', 'plus', () => pickEquipmentForRepair(() => rerender(root)), 'primary')]
  ));

  const filters = el('div.filters');
  filters.append(searchInput('Пошук за номером, ТО, описом…', (v) => { state.q = v; refresh(); }, state.q));
  filters.append(selectFilter('Усі статуси', Object.entries(RSTATUS).map(([id, m]) => ({ id, name: m.label })), state.status, (v) => { state.status = v; refresh(); }));
  filters.append(selectFilter('Будь-яка терміновість', Object.entries(URGENCY).map(([id, m]) => ({ id, name: m.label })), state.urgency, (v) => { state.urgency = v; refresh(); }));
  root.append(filters);

  const holder = el('div');
  root.append(holder);

  function refresh() {
    holder.innerHTML = '';
    let list = all('repairs');
    if (state.status) list = list.filter((r) => r.status === state.status);
    if (state.urgency) list = list.filter((r) => r.urgency === state.urgency);
    if (state.q) list = list.filter((r) => {
      const eq = get('equipment', r.equipmentId) || {};
      return matches(state.q, r.number, eq.invNumber, eq.name, r.problem);
    });
    list = sortBy(list, 'createdAt', -1);

    holder.append(dataTable({
      columns: [
        {
          label: 'Заявка', main: true, render: (r) => {
            const eq = get('equipment', r.equipmentId) || {};
            const w = el('div');
            w.append(el('b.mono', { text: r.number }));
            w.append(el('div.small', { text: `${eq.invNumber || '—'} · ${eq.name || ''}` }));
            return w;
          }
        },
        { label: 'Несправність', render: (r) => el('span.small', { text: (r.problem || '').slice(0, 90) }), hideMobile: true },
        { label: 'Терміновість', render: (r) => chip(URGENCY[r.urgency]?.label || '—', URGENCY[r.urgency]?.color || 'grey') },
        { label: 'Статус', render: (r) => chip(RSTATUS[r.status]?.label || r.status, RSTATUS[r.status]?.color || 'grey') },
        { label: 'Сервіс', render: (r) => r.serviceCompanyId ? (get('serviceCompanies', r.serviceCompanyId) || {}).name : '—', hideMobile: true },
        { label: 'Створено', render: (r) => fmtDate(r.createdAt), hideMobile: true },
      ],
      rows: list,
      onRow: (r) => openRepairCard(r.id, () => refresh()),
      empty: 'Заявок на ремонт немає',
      footer: el('span', { text: `Показано: ${list.length}` }),
    }));

    /* витрати на ремонт за поточний рік */
    const year = new Date().getFullYear();
    const cost = all('repairs').filter((r) => r.status === 'done' && new Date(r.completedAt || r.createdAt).getFullYear() === year)
      .reduce((s, r) => s + (+r.cost || 0), 0);
    if (cost) holder.append(el('div.small.muted.mt8', { text: `Витрати на ремонт за ${year} рік: ${fmtMoney(cost)}` }));
  }
  refresh();

  if (params.open) openRepairCard(params.open, () => refresh());
}

function rerender(root) { root.innerHTML = ''; render(root); }

async function pickEquipmentForRepair(onDone) {
  const list = all('equipment').filter((e) => !['written_off', 'in_repair'].includes(e.status));
  const v = await formModal({
    title: 'Оберіть обладнання',
    submitText: 'Далі',
    size: 'slim',
    fields: [{
      name: 'equipmentId', label: 'Обладнання', type: 'select', required: true,
      options: list.map((e) => ({ id: e.id, name: `${e.invNumber} — ${e.name}` })),
    }],
  });
  if (!v) return;
  const eq = get('equipment', v.equipmentId);
  openRepairForm(eq, onDone);
}

/* ==========================================================================
   Картка заявки на ремонт
   ========================================================================== */
export function openRepairCard(id, onChange) {
  return openDrawer({
    title: 'Заявка на ремонт',
    render: (body, api) => {
      const r = get('repairs', id);
      if (!r) { body.append(el('div.empty', { text: 'Заявку не знайдено' })); return; }
      const eq = get('equipment', r.equipmentId);
      api.setTitle(r.number);
      const refresh = () => { api.refresh(); onChange && onChange(); };
      const u = currentUser();

      body.append(el('div.row.wrap.gap8.mb16', {}, [
        chip(RSTATUS[r.status]?.label || r.status, RSTATUS[r.status]?.color || 'grey'),
        chip('Терміновість: ' + (URGENCY[r.urgency]?.label || '—'), URGENCY[r.urgency]?.color || 'grey'),
        r.needsRelocation ? chip('Потрібне переміщення', 'amber') : null,
      ].filter(Boolean)));
      body.append(stepper(STEPS, stepIdx(r)));

      if (r.status === 'new' && daysBetween(r.createdAt) > 3) {
        body.append(alertBox(`Заявка без реакції ${daysBetween(r.createdAt)} дн. Потрібно організувати сервіс (п. 10.2).`, 'warn', 'alert'));
      }

      body.append(dl([
        ['Обладнання', eq ? el('a', { href: 'javascript:void(0)', text: `${eq.invNumber} — ${eq.name}`, onclick: () => openEquipmentCard(eq.id, refresh) }) : '—'],
        ['Поточний стан ТО', eq ? statusChip(eq.status) : null],
        ['Місцезнаходження', eq ? holderLabel(eq) : null],
        ['Заявник', `${userName(r.createdBy)} · ${fmtDateTime(r.createdAt)}`],
        ['Опис несправності', r.problem],
        ['Контакт на місці', r.contact || null],
        ['Сервісна компанія', r.serviceCompanyId ? (get('serviceCompanies', r.serviceCompanyId) || {}).name : null],
        ['Планова дата', r.plannedDate ? fmtDate(r.plannedDate) : null],
        ['Завершено', r.completedAt ? fmtDateTime(r.completedAt) : null],
        ['Акт виконаних робіт', r.actNumber || null],
        ['Вартість ремонту', r.cost ? fmtMoney(r.cost) : null],
        ['Погоджено до оплати', r.status === 'done' ? (r.approvedForPayment ? 'Так' : 'Ні') : null],
      ]));

      if (r.photos && r.photos.length) {
        body.append(photoPicker(r.photos, null, { label: 'Фото несправності', readonly: true }));
      }

      if (r.log && r.log.length) {
        body.append(el('div.section-title', { text: 'Хід опрацювання' }));
        const tl = el('div.timeline');
        for (const l of [...r.log].reverse()) {
          tl.append(el('div.tl-item', {}, [
            el('div.tl-t', { text: `${fmtDateTime(l.at)} · ${userName(l.userId)}` }),
            el('div.tl-b', { text: l.text }),
          ]));
        }
        body.append(tl);
      }

      /* дії */
      const acts = el('div.row.wrap.gap8.mt24');
      if (can('repair.manage')) {
        if (r.status === 'new') {
          acts.append(actionBtn('Призначити сервіс', 'wrench', async () => {
            const v = await formModal({
              title: 'Організація ремонту',
              submitText: 'Прийняти в роботу',
              intro: alertBox('Менеджер із трейд-маркетингу організовує ремонт через сервісну компанію: виїзд фахівця або переміщення обладнання (п. 10.2–10.3).', 'info'),
              fields: [
                { name: 'serviceCompanyId', label: 'Сервісна компанія', type: 'select', required: true, options: all('serviceCompanies') },
                { name: 'plannedDate', label: 'Планова дата робіт', type: 'date', required: true, value: fmtDateInput(new Date(Date.now() + 3 * 864e5).toISOString()) },
                { name: 'mode', label: 'Спосіб', type: 'select', placeholder: false, value: 'onsite', options: [{ id: 'onsite', name: 'Виїзд фахівця на місце' }, { id: 'pickup', name: 'Переміщення обладнання до сервісу' }] },
                { name: 'note', label: 'Коментар', type: 'textarea', colspan: 2 },
              ],
            });
            if (!v) return;
            updateRepair(r, u, { status: 'accepted', ...v }, `Призначено сервіс: ${(get('serviceCompanies', v.serviceCompanyId) || {}).name}, спосіб — ${v.mode === 'onsite' ? 'виїзд фахівця' : 'переміщення до сервісу'}`);
            toast('Заявку прийнято в роботу', 'ok'); refresh();
          }, 'primary'));
          acts.append(actionBtn('Відхилити', 'x', async () => {
            const v = await formModal({ title: 'Відхилення заявки', submitText: 'Відхилити', size: 'slim', fields: [{ name: 'reason', label: 'Причина', type: 'textarea', required: true, colspan: 2 }] });
            if (!v) return;
            updateRepair(r, u, { status: 'rejected' }, `Відхилено: ${v.reason}`);
            toast('Заявку відхилено'); refresh();
          }, 'sm'));
        }
        if (r.status === 'accepted') {
          acts.append(actionBtn('Передано в ремонт', 'truck', async () => {
            if (!await confirmDialog({ title: 'Передача в ремонт', text: `Статус ТО ${eq?.invNumber} буде змінено на «У ремонті».`, okText: 'Підтвердити' })) return;
            startRepair(r, u);
            toast('Обладнання в ремонті', 'ok'); refresh();
          }, 'primary'));
        }
        if (r.status === 'in_repair') {
          acts.append(actionBtn('Завершити ремонт', 'check', async () => {
            const v = await formModal({
              title: 'Завершення ремонту',
              submitText: 'Завершити',
              intro: alertBox('За підсумками місяця Акт виконаних робіт перевіряється та погоджується для бухгалтерії й оплати рахунку (п. 10.5).', 'info'),
              fields: [
                { name: 'actNumber', label: 'Номер Акта виконаних робіт', required: true },
                { name: 'cost', label: 'Вартість, ₴', type: 'number', required: true },
                { name: 'resultStatus', label: 'Результат', type: 'select', placeholder: false, value: 'repaired', options: [
                  { id: 'repaired', name: 'Відремонтовано — повернення в експлуатацію' },
                  { id: 'written_off', name: 'Ремонт недоцільний — на списання' },
                ] },
                { name: 'returnTo', label: 'Куди повертається', type: 'select', placeholder: false, value: 'holder', options: [
                  { id: 'holder', name: 'До попереднього утримувача' },
                  { id: 'warehouse', name: 'На склад' },
                ] },
                { name: 'comment', label: 'Опис виконаних робіт', type: 'textarea', colspan: 2 },
              ],
            });
            if (!v) return;
            finishRepair(r, u, v);
            toast('Ремонт завершено', 'ok'); refresh();
          }, 'success'));
        }
        if (r.status === 'done' && !r.approvedForPayment) {
          acts.append(actionBtn('Погодити до оплати', 'check', () => {
            updateRepair(r, u, { approvedForPayment: true }, 'Акт виконаних робіт погоджено для бухгалтерії та оплати (п. 10.5)');
            toast('Погоджено до оплати', 'ok'); refresh();
          }, 'sm'));
        }
      }
      if (acts.children.length) body.append(acts);
    },
  });
}
