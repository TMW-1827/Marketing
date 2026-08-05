/* ==========================================================================
   Операції: переміщення, повернення, втрата/пошкодження, списання
   (п. 9, 11 Положення).
   ========================================================================== */

import { all, get, userName, holderLabel, statusName, settings } from '../store.js';
import { can, currentUser } from '../auth.js';
import {
  pageHead, actionBtn, alertBox, dataTable, dl, chip, statusChip, toast,
  formModal, openDrawer, openModal, confirmDialog, searchInput, selectFilter, tabs, photoPicker,
} from '../ui.js';
import { el, fmtDate, fmtDateTime, fmtMoney, matches, sortBy, plural, workdaysSince } from '../util.js';
import { icon } from '../icons.js';
import { decideIncident, approveWriteOff } from '../workflow.js';
import { openEquipmentCard, openMoveForm, openReturnForm, openIncidentForm, openWriteOffForm } from './equipment.js';

let tab = 'movements';

export function render(root) {
  root.append(pageHead(
    'Операції з обладнанням',
    'Переміщення, повернення, повідомлення про втрату чи пошкодження та списання ТО (п. 9, 11 Положення).',
    [
      can('ops.move') && actionBtn('Переміщення', 'arrows', () => pickEquipment('Переміщення ТО', (eq) => openMoveForm(eq, () => rerender(root)))),
      can('ops.incident') && actionBtn('Втрата / пошкодження', 'alert', () => pickEquipment('Повідомлення про подію', (eq) => openIncidentForm(eq, () => rerender(root)))),
      can('ops.writeoff') && actionBtn('Списання', 'recycle', () => openWriteOffPicker(() => rerender(root)), 'primary'),
    ]
  ));

  root.append(tabs([
    { id: 'movements', label: 'Історія переміщень' },
    { id: 'incidents', label: `Втрати та пошкодження (${all('incidents').filter((i) => i.status === 'investigating').length})` },
    { id: 'writeoffs', label: `Списання (${all('writeoffs').filter((w) => w.status === 'pending').length})` },
  ], tab, (t) => { tab = t; rerender(root); }));

  const holder = el('div');
  root.append(holder);
  if (tab === 'movements') renderMovements(holder);
  if (tab === 'incidents') renderIncidents(holder, () => rerender(root));
  if (tab === 'writeoffs') renderWriteOffs(holder, () => rerender(root));
}

function rerender(root) { root.innerHTML = ''; render(root); }

async function pickEquipment(title, cb) {
  const list = all('equipment').filter((e) => e.status !== 'written_off');
  const v = await formModal({
    title, submitText: 'Далі', size: 'slim',
    fields: [{
      name: 'equipmentId', label: 'Обладнання', type: 'select', required: true,
      options: list.map((e) => ({ id: e.id, name: `${e.invNumber} — ${e.name} (${statusName(e.status)})` })),
    }],
  });
  if (!v) return;
  cb(get('equipment', v.equipmentId));
}

/* ---------- Історія переміщень ---------- */
const mstate = { q: '', type: '' };

function renderMovements(root) {
  const filters = el('div.filters');
  filters.append(searchInput('Пошук за обладнанням, документом…', (v) => { mstate.q = v; paint(); }, mstate.q));
  filters.append(selectFilter('Усі типи операцій', [
    { id: 'created', name: 'Оприбуткування' },
    { id: 'status', name: 'Зміна статусу' },
    { id: 'transfer', name: 'Передача' },
    { id: 'location', name: 'Місцезнаходження' },
    { id: 'inventory', name: 'Інвентаризація' },
    { id: 'repair', name: 'Ремонт' },
    { id: 'incident', name: 'Інцидент' },
  ], mstate.type, (v) => { mstate.type = v; paint(); }));
  root.append(filters);
  const box = el('div');
  root.append(box);

  function paint() {
    box.innerHTML = '';
    let list = all('movements');
    if (mstate.type) list = list.filter((m) => m.type === mstate.type);
    if (mstate.q) list = list.filter((m) => {
      const eq = get('equipment', m.equipmentId) || {};
      return matches(mstate.q, eq.invNumber, eq.name, m.comment, m.doc, userName(m.userId));
    });
    list = sortBy(list, 'at', -1).slice(0, 300);

    box.append(dataTable({
      columns: [
        { label: 'Дата', render: (m) => fmtDateTime(m.at), main: true },
        {
          label: 'Обладнання', render: (m) => {
            const eq = get('equipment', m.equipmentId);
            return eq ? el('span', {}, [el('b.mono', { text: eq.invNumber }), el('span.small', { text: ' ' + eq.name })]) : '—';
          }
        },
        {
          label: 'Операція', render: (m) => m.fromStatus && m.toStatus
            ? `${statusName(m.fromStatus)} → ${statusName(m.toStatus)}`
            : ({ created: 'Оприбуткування', location: 'Місцезнаходження', inventory: 'Інвентаризація', repair: 'Ремонт', incident: 'Інцидент', transfer: 'Передача' }[m.type] || m.type)
        },
        { label: 'Підстава', render: (m) => m.doc || '—', hideMobile: true },
        { label: 'Користувач', render: (m) => userName(m.userId), hideMobile: true },
        { label: 'Коментар', render: (m) => el('span.small', { text: (m.comment || '').slice(0, 80) }), hideMobile: true },
      ],
      rows: list,
      onRow: (m) => m.equipmentId && openEquipmentCard(m.equipmentId),
      empty: 'Операцій не знайдено',
      footer: el('span', { text: `Показано останні ${list.length} операцій` }),
    }));
  }
  paint();
}

/* ---------- Втрати та пошкодження ---------- */
function renderIncidents(root, onChange) {
  const list = sortBy(all('incidents'), 'createdAt', -1);
  root.append(alertBox(
    `Про втрату, викрадення, пошкодження або неможливість встановити місцезнаходження ТО відповідальний менеджер невідкладно повідомляє Комерційного директора, менеджера з трейд-маркетингу та бухгалтерію (п. 11.1). Норматив реагування — ${settings().incidentReportDays} робочі дні.`,
    'info'));

  root.append(dataTable({
    columns: [
      {
        label: 'Номер', main: true, render: (i) => {
          const eq = get('equipment', i.equipmentId) || {};
          return el('div', {}, [el('b.mono', { text: i.number }), el('div.small', { text: `${eq.invNumber || ''} ${eq.name || ''}` })]);
        }
      },
      { label: 'Тип', render: (i) => chip(({ damage: 'Пошкодження', loss: 'Втрата', theft: 'Викрадення', unknown: 'Місце невідоме' })[i.type] || i.type, i.type === 'damage' ? 'amber' : 'red') },
      { label: 'Заявник', render: (i) => userName(i.createdBy), hideMobile: true },
      { label: 'Дата', render: (i) => fmtDate(i.createdAt) },
      { label: 'Стан', render: (i) => chip(i.status === 'closed' ? 'Рішення прийнято' : 'Розслідування', i.status === 'closed' ? 'green' : 'amber') },
    ],
    rows: list,
    onRow: (i) => openIncidentCard(i.id, onChange),
    empty: 'Повідомлень немає',
  }));
}

function openIncidentCard(id, onChange) {
  return openDrawer({
    title: 'Повідомлення про подію',
    render: (body, api) => {
      const inc = get('incidents', id);
      const eq = get('equipment', inc.equipmentId);
      api.setTitle(inc.number);
      body.append(dl([
        ['Обладнання', eq ? el('a', { href: 'javascript:void(0)', text: `${eq.invNumber} — ${eq.name}`, onclick: () => openEquipmentCard(eq.id) }) : '—'],
        ['Поточний статус ТО', eq ? statusChip(eq.status) : null],
        ['Тип події', ({ damage: 'Пошкодження', loss: 'Втрата', theft: 'Викрадення', unknown: 'Неможливо встановити місцезнаходження' })[inc.type]],
        ['Заявник', `${userName(inc.createdBy)} · ${fmtDateTime(inc.createdAt)}`],
        ['Дата події', inc.occurredAt ? fmtDate(inc.occurredAt) : null],
        ['Обставини', inc.description],
        ['Рішення', inc.decision ? ({ write_off: 'Списання', repair: 'Ремонт', compensation: 'Компенсація вартості', return: 'Повернення', replace: 'Заміна' })[inc.decision] : null],
        ['Прийняв рішення', inc.decidedBy ? `${userName(inc.decidedBy)} · ${fmtDateTime(inc.decidedAt)}` : null],
        ['Коментар до рішення', inc.comment || null],
      ]));
      if (inc.photos?.length) body.append(photoPicker(inc.photos, null, { label: 'Фотофіксація', readonly: true }));

      if (inc.status !== 'closed' && (can('ops.writeoff.approve') || can('repair.manage'))) {
        body.append(el('div.row.gap8.mt24', {}, [
          actionBtn('Прийняти рішення', 'check', async () => {
            const v = await formModal({
              title: 'Рішення за результатами розгляду',
              submitText: 'Зафіксувати рішення',
              intro: alertBox('За результатами розгляду приймається рішення щодо повернення обладнання, ремонту, компенсації вартості, заміни або списання (п. 11.2).', 'info'),
              fields: [
                { name: 'decision', label: 'Рішення', type: 'select', required: true, options: [
                  { id: 'return', name: 'Повернення обладнання' },
                  { id: 'repair', name: 'Ремонт' },
                  { id: 'compensation', name: 'Компенсація вартості' },
                  { id: 'replace', name: 'Заміна' },
                  { id: 'write_off', name: 'Списання' },
                ] },
                { name: 'comment', label: 'Обґрунтування', type: 'textarea', required: true, colspan: 2 },
              ],
            });
            if (!v) return;
            decideIncident(inc, currentUser(), v);
            toast('Рішення зафіксовано', 'ok');
            api.refresh(); onChange && onChange();
          }, 'primary'),
        ]));
      }
    },
  });
}

/* ---------- Списання ---------- */
function renderWriteOffs(root, onChange) {
  const list = sortBy(all('writeoffs'), 'createdAt', -1);
  root.append(alertBox('Списання здійснюється відповідно до внутрішніх процедур на підставі належно оформлених документів та рішення уповноважених осіб або комісії (п. 11.3).', 'info'));

  root.append(dataTable({
    columns: [
      { label: 'Номер', main: true, render: (w) => el('div', {}, [el('b.mono', { text: w.number }), el('div.small.muted', { text: fmtDate(w.createdAt) })]) },
      { label: 'Позицій', render: (w) => String(w.equipmentIds.length) },
      { label: 'Підстава', render: (w) => ({ wear: 'Фізичне зношення', uneconomic: 'Недоцільність ремонту', damage: 'Безповоротне пошкодження', theft: 'Викрадення', unknown: 'Місце невідоме' })[w.reason] || w.reason },
      { label: 'Ініціатор', render: (w) => userName(w.createdBy), hideMobile: true },
      { label: 'Сума', render: (w) => fmtMoney(w.equipmentIds.reduce((s, id) => s + (+(get('equipment', id) || {}).initialCost || 0), 0)), hideMobile: true },
      { label: 'Стан', render: (w) => chip(({ pending: 'Очікує затвердження', approved: 'Затверджено', rejected: 'Відхилено' })[w.status], ({ pending: 'amber', approved: 'green', rejected: 'grey' })[w.status]) },
    ],
    rows: list,
    onRow: (w) => openWriteOffCard(w.id, onChange),
    empty: 'Документів на списання немає',
  }));
}

function openWriteOffCard(id, onChange) {
  return openDrawer({
    title: 'Документ на списання',
    render: (body, api) => {
      const w = get('writeoffs', id);
      api.setTitle(w.number);
      body.append(dl([
        ['Статус', chip(({ pending: 'Очікує затвердження', approved: 'Затверджено', rejected: 'Відхилено' })[w.status], ({ pending: 'amber', approved: 'green', rejected: 'grey' })[w.status])],
        ['Ініціатор', `${userName(w.createdBy)} · ${fmtDateTime(w.createdAt)}`],
        ['Підстава', ({ wear: 'Фізичне зношення', uneconomic: 'Економічна недоцільність ремонту', damage: 'Безповоротне пошкодження', theft: 'Викрадення', unknown: 'Неможливо встановити місцезнаходження' })[w.reason]],
        ['Склад комісії', w.commission || null],
        ['Обґрунтування', w.comment],
        ['Рішення', w.decidedBy ? `${userName(w.decidedBy)} · ${fmtDateTime(w.decidedAt)}` : null],
        ['Коментар до рішення', w.decisionComment || null],
      ]));

      body.append(el('div.section-title', { text: `Обладнання (${w.equipmentIds.length})` }));
      const list = el('div.col.gap6');
      let total = 0;
      for (const id2 of w.equipmentIds) {
        const e = get('equipment', id2);
        if (!e) continue;
        total += +e.initialCost || 0;
        const row = el('div.row.gap8', { style: 'padding:8px 10px;border:1px solid var(--line);border-radius:9px;cursor:pointer' });
        row.append(el('div.grow', {}, [el('b.mono', { text: e.invNumber }), el('div.small', { text: e.name })]));
        row.append(el('div.small', { text: fmtMoney(e.initialCost) }));
        row.addEventListener('click', () => openEquipmentCard(e.id));
        list.append(row);
      }
      body.append(list);
      body.append(el('div.right.strong.mt8', { text: 'Разом: ' + fmtMoney(total) }));

      if (w.status === 'pending' && can('ops.writeoff.approve')) {
        body.append(el('div.row.gap8.mt24', {}, [
          actionBtn('Затвердити списання', 'check', async () => {
            if (!await confirmDialog({
              title: 'Затвердити списання?', okText: 'Затвердити', danger: true,
              text: `${w.equipmentIds.length} ${plural(w.equipmentIds.length, 'одиниця', 'одиниці', 'одиниць')} ТО буде переведено у статус «Списано». Дію відображено в історії руху.`,
            })) return;
            approveWriteOff(w, currentUser(), true);
            toast('Списання затверджено', 'ok');
            api.refresh(); onChange && onChange();
          }, 'success'),
          actionBtn('Відхилити', 'x', async () => {
            const v = await formModal({ title: 'Відхилення списання', submitText: 'Відхилити', size: 'slim', fields: [{ name: 'comment', label: 'Причина', type: 'textarea', required: true, colspan: 2 }] });
            if (!v) return;
            approveWriteOff(w, currentUser(), false, v.comment);
            toast('Списання відхилено');
            api.refresh(); onChange && onChange();
          }, 'danger'),
        ]));
      }
    },
  });
}

async function openWriteOffPicker(onDone) {
  const candidates = all('equipment').filter((e) => ['to_write_off', 'returned', 'in_stock', 'in_repair'].includes(e.status));
  if (!candidates.length) { toast('Немає обладнання, доступного до списання', 'err'); return; }
  const selected = new Set(candidates.filter((e) => e.status === 'to_write_off').map((e) => e.id));

  const body = el('div');
  body.append(alertBox('Оберіть обладнання для включення до документа на списання. Пропонуються позиції зі статусами «На списанні», «Повернено», «На складі», «У ремонті».', 'info'));
  const search = el('input.input.mb8', { type: 'search', placeholder: 'Пошук…' });
  const listBox = el('div.pick-list');
  const counter = el('div.small.muted.mt8', { text: `Обрано: ${selected.size}` });
  const paint = () => {
    listBox.innerHTML = '';
    for (const e of candidates.filter((x) => matches(search.value, x.invNumber, x.name)).slice(0, 150)) {
      const it = el('label.it');
      const cb = el('input', { type: 'checkbox' });
      cb.checked = selected.has(e.id);
      cb.addEventListener('change', () => {
        cb.checked ? selected.add(e.id) : selected.delete(e.id);
        counter.textContent = `Обрано: ${selected.size}`;
      });
      it.append(cb, el('div.grow', {}, [
        el('b', { text: `${e.invNumber} — ${e.name}` }),
        el('small', { text: `${statusName(e.status)} · ${holderLabel(e)} · ${fmtMoney(e.initialCost)}` }),
      ]));
      listBox.append(it);
    }
  };
  search.addEventListener('input', paint);
  paint();
  body.append(search, listBox, counter);

  const next = el('button.btn.primary', { type: 'button', text: 'Далі' });
  const m = openModal({ title: 'Списання ТО', body, footer: next, size: 'wide' });
  next.addEventListener('click', () => {
    if (!selected.size) { toast('Оберіть щонайменше одну позицію', 'err'); return; }
    m.close();
    openWriteOffForm([...selected].map((id) => get('equipment', id)), onDone);
  });
}
