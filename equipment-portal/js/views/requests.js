/* ==========================================================================
   Заявки на передачу ТО (п. 3–5 Положення):
   створення → погодження Комерційним директором → планування ВАП →
   відвантаження складом → Акт приймання-передачі.
   ========================================================================== */

import {
  all, get, update, settings, userName, counterpartyName, statusName,
  TRANSFER_TYPES, holderLabel, categoryName,
} from '../store.js';
import { can, currentUser } from '../auth.js';
import {
  pageHead, actionBtn, alertBox, dataTable, dl, chip, statusChip, toast,
  formModal, openDrawer, openModal, confirmDialog, searchInput, selectFilter, stepper, tabs,
} from '../ui.js';
import { el, fmtDate, fmtDateTime, fmtDateInput, fmtMoney, matches, sortBy, plural } from '../util.js';
import { icon } from '../icons.js';
import { createRequest, approveRequest, planRequest, shipRequest, createAct, cancelRequest } from '../workflow.js';
import { navigate } from '../router.js';
import { openActView, openEquipmentCard } from './equipment.js';

const STATUS_META = {
  pending: { label: 'Очікує погодження', color: 'amber' },
  approved: { label: 'Погоджено', color: 'blue' },
  rejected: { label: 'Відхилено', color: 'red' },
  planned: { label: 'Заплановано', color: 'blue' },
  shipped: { label: 'Відвантажено', color: 'blue' },
  completed: { label: 'Завершено', color: 'green' },
  cancelled: { label: 'Скасовано', color: 'grey' },
};
export const reqStatus = (s) => STATUS_META[s] || { label: s, color: 'grey' };

const STEPS = ['Заявка', 'Погодження', 'Планування', 'Відвантаження', 'Акт'];
const stepIndex = (r) => ({
  pending: 1, rejected: 1, approved: 2, planned: 3, shipped: 4, completed: 5, cancelled: 1,
}[r.status] ?? 0);

const state = { q: '', status: '', type: '' };

export function render(root, params = {}) {
  root.append(pageHead(
    'Заявки на передачу торговельного обладнання',
    'Передача ТО здійснюється виключно на підставі заявки, погодженої Комерційним директором (п. 3.1, 3.3).',
    [can('request.create') && actionBtn('Створити заявку', 'plus', () => openRequestForm(() => rerender(root)), 'primary')]
  ));

  const filters = el('div.filters');
  filters.append(searchInput('Пошук за номером, отримувачем…', (v) => { state.q = v; refresh(); }, state.q));
  filters.append(selectFilter('Усі статуси', Object.entries(STATUS_META).map(([id, m]) => ({ id, name: m.label })),
    state.status, (v) => { state.status = v; refresh(); }));
  filters.append(selectFilter('Усі типи передачі', TRANSFER_TYPES, state.type, (v) => { state.type = v; refresh(); }));
  root.append(filters);

  const holder = el('div');
  root.append(holder);

  function refresh() {
    holder.innerHTML = '';
    let list = all('requests');
    if (state.status) list = list.filter((r) => r.status === state.status);
    if (state.type) list = list.filter((r) => r.transferType === state.type);
    if (state.q) list = list.filter((r) => matches(state.q, r.number, counterpartyName(r.recipientId), userName(r.createdBy), r.purpose));
    list = sortBy(list, 'createdAt', -1);

    holder.append(dataTable({
      columns: [
        {
          label: 'Номер', main: true, render: (r) => {
            const w = el('div');
            w.append(el('b.mono', { text: r.number }));
            w.append(el('div.small.muted', { text: fmtDate(r.createdAt) + ' · ' + userName(r.createdBy) }));
            return w;
          }
        },
        { label: 'Тип передачі', render: (r) => (TRANSFER_TYPES.find((t) => t.id === r.transferType) || {}).short || '—', hideMobile: true },
        { label: 'Отримувач', render: (r) => counterpartyName(r.recipientId) },
        { label: 'Позицій', render: (r) => String(r.equipmentIds.length), hideMobile: true },
        { label: 'Статус', render: (r) => chip(reqStatus(r.status).label, reqStatus(r.status).color) },
        { label: 'Планова дата', render: (r) => fmtDate(r.plannedDate), hideMobile: true },
      ],
      rows: list,
      onRow: (r) => openRequestCard(r.id, () => refresh()),
      empty: 'Заявок не знайдено',
      footer: el('span', { text: `Показано: ${list.length}` }),
    }));
  }
  refresh();

  if (params.open) openRequestCard(params.open, () => refresh());
}

function rerender(root) { root.innerHTML = ''; render(root); }

/* ==========================================================================
   Картка заявки
   ========================================================================== */
export function openRequestCard(id, onChange) {
  return openDrawer({
    title: 'Заявка на передачу',
    render: (body, api) => {
      const r = get('requests', id);
      if (!r) { body.append(el('div.empty', { text: 'Заявку не знайдено' })); return; }
      api.setTitle(r.number);
      const refresh = () => { api.refresh(); onChange && onChange(); };

      body.append(el('div.row.wrap.gap8.mb16', {}, [
        chip(reqStatus(r.status).label, reqStatus(r.status).color),
        chip((TRANSFER_TYPES.find((t) => t.id === r.transferType) || {}).name || '', 'grey'),
      ]));
      body.append(stepper(STEPS, stepIndex(r)));

      const recipient = get('counterparties', r.recipientId);
      const via = r.viaDistributorId ? get('counterparties', r.viaDistributorId) : null;
      body.append(dl([
        ['Ініціатор', userName(r.createdBy)],
        ['Створено', fmtDateTime(r.createdAt)],
        ['Отримувач', recipient ? `${recipient.name} (${recipient.type === 'distributor' ? 'дистриб’ютор' : 'клієнт'})` : '—'],
        ...(via ? [['Через дистриб’ютора', via.name + ' — реалізація продукції через цього дистриб’ютора (п. 5.4)']] : []),
        ['Торгова точка', r.outletId ? (get('outlets', r.outletId) || {}).name : null],
        ['Адреса доставки', r.deliveryAddress || (recipient ? recipient.address : null)],
        ['Обґрунтування', r.purpose],
        ['Бажана дата передачі', fmtDate(r.plannedDate)],
        ['Коментар', r.comment || null],
      ]));

      /* позиції заявки */
      body.append(el('div.section-title', { text: `Обладнання (${r.equipmentIds.length})` }));
      const list = el('div.col.gap6');
      for (const eid of r.equipmentIds) {
        const e = get('equipment', eid);
        if (!e) continue;
        const row = el('div.row.gap8', { style: 'padding:8px 10px;border:1px solid var(--line);border-radius:9px;cursor:pointer' });
        row.append(el('div.grow', {}, [
          el('b.mono', { text: e.invNumber }),
          el('div.small', { text: e.name }),
          el('div.xs.muted', { text: categoryName(e.categoryId) }),
        ]));
        row.append(statusChip(e.status));
        row.addEventListener('click', () => openEquipmentCard(e.id, refresh));
        list.append(row);
      }
      body.append(list);

      /* хід виконання */
      if (r.approval) {
        body.append(el('div.section-title', { text: 'Погодження' }));
        body.append(alertBox(
          `${r.approval.decision === 'approved' ? 'Погоджено' : 'Відхилено'} — ${userName(r.approval.userId)}, ${fmtDateTime(r.approval.at)}${r.approval.comment ? '. ' + r.approval.comment : ''}`,
          r.approval.decision === 'approved' ? 'ok' : 'err',
          r.approval.decision === 'approved' ? 'check' : 'x'));
      }
      if (r.planning) {
        body.append(el('div.section-title', { text: 'Планування передачі' }));
        body.append(dl([
          ['Опрацював', `${userName(r.planning.userId)} · ${fmtDateTime(r.planning.at)}`],
          ['Склад відвантаження', (get('warehouses', r.planning.warehouseId) || {}).name || '—'],
          ['Дата відвантаження', fmtDate(r.planning.shipDate)],
          ['ТТН', r.planning.ttn || null],
          ['Логістика', r.planning.logistics || null],
        ]));
      }
      if (r.shipment) {
        body.append(alertBox(`Відвантажено ${fmtDateTime(r.shipment.at)} — ${userName(r.shipment.userId)}`, 'info', 'truck'));
      }
      if (r.actId) {
        const act = get('acts', r.actId);
        body.append(el('div.section-title', { text: 'Акт приймання-передачі' }));
        const row = el('div.row.gap8', { style: 'padding:9px 11px;border:1px solid var(--line);border-radius:9px' });
        row.append(el('div.grow', {}, [el('b.mono', { text: act.number }), el('div.small.muted', { text: fmtDate(act.date) })]));
        row.append(actionBtn('Переглянути', 'eye', () => openActView(act), 'sm'));
        body.append(row);
      }

      /* дії */
      const acts = el('div.row.wrap.gap8.mt24');
      const u = currentUser();
      if (r.status === 'pending' && can('request.approve')) {
        acts.append(actionBtn('Погодити', 'check', async () => {
          const v = await formModal({
            title: `Погодження заявки ${r.number}`, submitText: 'Погодити', size: 'slim',
            fields: [{ name: 'comment', label: 'Коментар (необов’язково)', type: 'textarea', colspan: 2 }],
          });
          if (!v) return;
          approveRequest(r, u, 'approved', v.comment);
          toast('Заявку погоджено', 'ok'); refresh();
        }, 'success'));
        acts.append(actionBtn('Відхилити', 'x', async () => {
          const v = await formModal({
            title: `Відхилення заявки ${r.number}`, submitText: 'Відхилити', size: 'slim',
            fields: [{ name: 'comment', label: 'Причина відхилення', type: 'textarea', required: true, colspan: 2 }],
          });
          if (!v) return;
          approveRequest(r, u, 'rejected', v.comment);
          toast('Заявку відхилено'); refresh();
        }, 'danger'));
      }
      if (r.status === 'approved' && can('request.plan')) {
        acts.append(actionBtn('Запланувати передачу', 'truck', async () => {
          const v = await formModal({
            title: 'Планування та організація передачі',
            submitText: 'Зберегти план',
            intro: alertBox('ВАП взаємодіє зі складом, готує Акт приймання-передачі, ТТН та інші документи (п. 4.2).', 'info'),
            fields: [
              { name: 'warehouseId', label: 'Склад відвантаження', type: 'select', required: true, options: all('warehouses'), value: (all('warehouses')[0] || {}).id },
              { name: 'shipDate', label: 'Дата відвантаження', type: 'date', required: true, value: fmtDateInput(r.plannedDate) },
              { name: 'ttn', label: 'Номер ТТН' },
              { name: 'logistics', label: 'Логістика / перевізник' },
              { name: 'note', label: 'Примітка', type: 'textarea', colspan: 2 },
            ],
          });
          if (!v) return;
          planRequest(r, u, v);
          toast('Передачу заплановано', 'ok'); refresh();
        }, 'primary'));
      }
      if (r.status === 'planned' && can('request.ship')) {
        acts.append(actionBtn('Підтвердити відвантаження', 'warehouse', async () => {
          if (!await confirmDialog({
            title: 'Відвантаження', okText: 'Відвантажено',
            text: `Підтвердити фізичне відвантаження ${r.equipmentIds.length} ${plural(r.equipmentIds.length, 'одиниці', 'одиниць', 'одиниць')} за заявкою ${r.number}? Статус ТО зміниться на «В дорозі».`,
          })) return;
          shipRequest(r, u);
          toast('Відвантаження зафіксовано', 'ok'); refresh();
        }, 'primary'));
      }
      if (r.status === 'shipped' && can('request.act')) {
        acts.append(actionBtn('Оформити Акт приймання-передачі', 'fileText', () => openActForm(r, refresh), 'success'));
      }
      if (['pending', 'approved', 'planned'].includes(r.status) && (r.createdBy === u.id || can('request.plan'))) {
        acts.append(actionBtn('Скасувати заявку', 'x', async () => {
          const v = await formModal({
            title: 'Скасування заявки', submitText: 'Скасувати заявку', size: 'slim',
            fields: [{ name: 'reason', label: 'Причина', type: 'textarea', required: true, colspan: 2 }],
          });
          if (!v) return;
          cancelRequest(r, u, v.reason);
          toast('Заявку скасовано'); refresh();
        }, 'sm'));
      }
      if (acts.children.length) body.append(acts);
    },
  });
}

/* ==========================================================================
   Створення заявки
   ========================================================================== */
export async function openRequestForm(onDone) {
  const u = currentUser();
  const available = all('equipment').filter((e) => ['in_stock', 'returned'].includes(e.status));
  if (!available.length) { toast('Немає доступного обладнання на складі', 'err'); return; }

  let selected = new Set();

  const v = await formModal({
    title: 'Заявка на передачу торговельного обладнання',
    size: 'wide',
    submitText: 'Подати на погодження',
    intro: alertBox('Заявка передається на погодження Комерційному директору. Передача без погодженої заявки не допускається (п. 3.1, 3.3).', 'info'),
    fields: [
      {
        name: 'transferType', label: 'Тип передачі', type: 'select', required: true, placeholder: false,
        value: 'client', options: TRANSFER_TYPES.map((t) => ({ id: t.id, name: t.name })),
      },
      { name: 'recipientId', label: 'Отримувач', type: 'select', required: true, options: [] },
      { name: 'viaDistributorId', label: 'Дистриб’ютор (канал поставки)', type: 'select', options: all('counterparties').filter((c) => c.type === 'distributor') },
      { name: 'outletId', label: 'Торгова точка', type: 'select', options: [] },
      { name: 'deliveryAddress', label: 'Адреса доставки', colspan: 2 },
      { name: 'purpose', label: 'Обґрунтування потреби', type: 'textarea', required: true, colspan: 2, rows: 2 },
      { name: 'plannedDate', label: 'Бажана дата передачі', type: 'date', required: true, value: fmtDateInput(new Date(Date.now() + 7 * 864e5).toISOString()) },
      { name: 'responsibleManagerId', label: 'Відповідальний менеджер', type: 'select', required: true, value: u.role === 'responsible_manager' ? u.id : '', options: all('users').filter((x) => x.role === 'responsible_manager').map((x) => ({ id: x.id, name: x.fullName })) },
      { name: 'comment', label: 'Коментар', type: 'textarea', colspan: 2 },
    ],
    onRender: (inputs, form) => {
      const fillRecipients = () => {
        const type = inputs.transferType.value;
        const list = type === 'distributor'
          ? all('counterparties').filter((c) => c.type === 'distributor')
          : all('counterparties').filter((c) => c.type === 'client');
        inputs.recipientId.innerHTML = '<option value="">— оберіть —</option>' +
          list.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
        inputs.viaDistributorId.closest('.field').classList.toggle('hidden', type !== 'client_via_distributor');
        inputs.outletId.closest('.field').classList.toggle('hidden', type === 'distributor');
        fillOutlets();
      };
      const fillOutlets = () => {
        const list = all('outlets').filter((o) => o.counterpartyId === inputs.recipientId.value);
        inputs.outletId.innerHTML = '<option value="">— торгова точка —</option>' +
          list.map((o) => `<option value="${o.id}">${o.name} (${o.address})</option>`).join('');
      };
      inputs.transferType.addEventListener('change', fillRecipients);
      inputs.recipientId.addEventListener('change', () => {
        fillOutlets();
        const cp = get('counterparties', inputs.recipientId.value);
        if (cp && !inputs.deliveryAddress.value) inputs.deliveryAddress.value = cp.address || '';
      });
      inputs.outletId.addEventListener('change', () => {
        const o = get('outlets', inputs.outletId.value);
        if (o) inputs.deliveryAddress.value = o.address || '';
      });
      fillRecipients();

      /* вибір обладнання */
      const box = el('div.mt8');
      box.append(el('div.section-title', { text: 'Обладнання зі складу' }));
      const search = el('input.input.mb8', { type: 'search', placeholder: 'Пошук за інвентарним номером або назвою…' });
      const listBox = el('div.pick-list');
      const counter = el('div.small.muted.mt8', { text: 'Обрано: 0' });

      const paint = () => {
        const q = search.value;
        listBox.innerHTML = '';
        const rows = available.filter((e) => matches(q, e.invNumber, e.name, e.model)).slice(0, 120);
        for (const e of rows) {
          const it = el('label.it');
          const cb = el('input', { type: 'checkbox' });
          cb.checked = selected.has(e.id);
          cb.addEventListener('change', () => {
            cb.checked ? selected.add(e.id) : selected.delete(e.id);
            counter.textContent = `Обрано: ${selected.size}`;
          });
          it.append(cb, el('div.grow', {}, [
            el('b', { text: e.invNumber + ' — ' + e.name }),
            el('small', { text: `${categoryName(e.categoryId)} · ${holderLabel(e)} · ${fmtMoney(e.initialCost)}` }),
          ]));
          listBox.append(it);
        }
        if (!rows.length) listBox.append(el('div.empty.small', { text: 'Нічого не знайдено' }));
      };
      search.addEventListener('input', paint);
      paint();
      box.append(search, listBox, counter);
      form.append(box);
    },
    validate: (out) => {
      if (!selected.size) return 'Оберіть щонайменше одну одиницю обладнання.';
      if (out.transferType === 'client_via_distributor' && !out.viaDistributorId) return 'Вкажіть дистриб’ютора — канал поставки.';
      return null;
    },
  });
  if (!v) return;

  createRequest({
    transferType: v.transferType,
    recipientId: v.recipientId,
    viaDistributorId: v.transferType === 'client_via_distributor' ? v.viaDistributorId : null,
    outletId: v.outletId || null,
    deliveryAddress: v.deliveryAddress,
    purpose: v.purpose,
    plannedDate: v.plannedDate,
    responsibleManagerId: v.responsibleManagerId,
    comment: v.comment,
    equipmentIds: [...selected],
  }, u);
  toast('Заявку подано на погодження', 'ok');
  onDone && onDone();
}

/* ==========================================================================
   Оформлення Акта приймання-передачі
   ========================================================================== */
async function openActForm(r, onDone) {
  const outlets = all('outlets').filter((o) => o.counterpartyId === r.recipientId);
  const v = await formModal({
    title: `Акт приймання-передачі за заявкою ${r.number}`,
    size: 'wide',
    submitText: 'Оформити Акт',
    intro: alertBox('Акт формується із зазначенням отримувача, відповідального менеджера, інвентарних номерів, найменування та кількості (п. 5.2). Підпис відповідального менеджера обов’язковий (п. 5.5).', 'info'),
    fields: [
      { name: 'date', label: 'Дата Акта', type: 'date', required: true, value: fmtDateInput(new Date().toISOString()) },
      { name: 'outletId', label: 'Торгова точка встановлення', type: 'select', options: outlets, value: r.outletId || '' },
      {
        name: 'responsibleManagerId', label: 'Відповідальний менеджер', type: 'select', required: true,
        value: r.responsibleManagerId || r.createdBy,
        options: all('users').filter((x) => x.role === 'responsible_manager').map((x) => ({ id: x.id, name: x.fullName })),
      },
      { name: 'recipientSigner', label: 'ПІБ підписанта отримувача', required: true },
      { name: 'ttn', label: 'ТТН', value: r.planning?.ttn || '' },
      { name: 'managerSigned', label: 'Підпис відповідального менеджера Товариства отримано (п. 5.5)', type: 'checkbox' },
      { name: 'note', label: 'Примітка', type: 'textarea', colspan: 2 },
    ],
    validate: (o) => o.managerSigned ? null : 'Без підпису відповідального менеджера Акт не може бути оформлено (п. 5.5).',
  });
  if (!v) return;
  const act = createAct(r, currentUser(), v);
  toast(`Акт ${act.number} оформлено`, 'ok');
  onDone && onDone();
  openActView(act);
}
