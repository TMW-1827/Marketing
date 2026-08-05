/* ==========================================================================
   Реєстр торговельного обладнання: перегляд, картка, операції над ТО.
   ========================================================================== */

import {
  all, get, insert, update, remove, persist, logAudit,
  nextInvNumber, invNumberExists, holderLabel, locationLabel, equipmentHistory,
  statusName, userName, counterpartyName, categoryName, settings,
} from '../store.js';
import { can, currentUser, isResponsibleFor } from '../auth.js';
import {
  toast, openDrawer, formModal, confirmDialog, dataTable, dl, statusChip, chip,
  pageHead, actionBtn, alertBox, searchInput, selectFilter, photoPicker, tabs, openModal,
} from '../ui.js';
import {
  el, fmtDate, fmtDateTime, fmtMoney, matches, sortBy, downloadFile, toCSV,
  getPosition, mapLink, workdaysSince, daysBetween, isMobile, fmtDateInput,
} from '../util.js';
import { icon } from '../icons.js';
import {
  setStatus, setLocation, moveEquipment, returnToWarehouse, createRepair,
  createIncident, createWriteOff,
} from '../workflow.js';
import { code39SVG, labelsHTML } from '../barcode.js';
import { navigate } from '../router.js';

const state = { q: '', status: '', category: '', manager: '', holder: '', attention: '', sort: 'invNumber', dir: 1 };

export function filteredEquipment() {
  let list = all('equipment');
  if (state.status) list = list.filter((e) => e.status === state.status);
  if (state.category) list = list.filter((e) => e.categoryId === state.category);
  if (state.manager) list = list.filter((e) => e.responsibleManagerId === state.manager);
  if (state.holder) list = list.filter((e) => e.holderType === state.holder);
  if (state.attention === 'no_location') {
    const lim = settings().locationDeadlineDays;
    list = list.filter((e) => ['at_client', 'at_distributor'].includes(e.status) && !e.lastConfirmedAt
      && e.transferredAt && (workdaysSince(e.transferredAt) || 0) > lim);
  }
  if (state.attention === 'no_confirm') {
    const cutoff = Date.now() - settings().inventoryPeriodMonths * 30.4 * 86400000;
    list = list.filter((e) => ['at_client', 'at_distributor'].includes(e.status)
      && new Date(e.lastConfirmedAt || e.transferredAt || 0).getTime() < cutoff);
  }
  if (state.attention === 'no_serial') list = list.filter((e) => !e.serialNumber);
  if (state.q) {
    list = list.filter((e) => matches(state.q, e.invNumber, e.serialNumber, e.name, e.model,
      e.manufacturer, holderLabel(e), locationLabel(e), userName(e.responsibleManagerId)));
  }
  return sortBy(list, state.sort, state.dir);
}

export function render(root, params = {}) {
  root.innerHTML = '';
  const user = currentUser();

  root.append(pageHead(
    'Реєстр торговельного обладнання',
    'Єдиний перелік ТО з інвентарними номерами, статусами та фактичним місцезнаходженням (п. 2, 6, 7 Положення).',
    [
      can('equipment.create') && actionBtn('Оприбуткувати ТО', 'plus', () => openEquipmentForm(null, () => render(root)), 'primary'),
      can('equipment.import') && actionBtn('Імпорт', 'upload', () => openImport(() => render(root))),
      actionBtn('Експорт CSV', 'download', exportCSV),
      actionBtn('Етикетки', 'barcode', printLabels),
    ]
  ));

  /* --- фільтри --- */
  const filters = el('div.filters');
  filters.append(searchInput('Пошук за номером, назвою, отримувачем…', (v) => { state.q = v; refresh(); }, state.q));
  filters.append(selectFilter('Усі статуси', all('statuses'), state.status, (v) => { state.status = v; refresh(); }));
  filters.append(selectFilter('Усі категорії', all('categories'), state.category, (v) => { state.category = v; refresh(); }));
  filters.append(selectFilter('Усі відповідальні', all('users').filter((u) => u.role === 'responsible_manager')
    .map((u) => ({ id: u.id, name: u.fullName })), state.manager, (v) => { state.manager = v; refresh(); }));
  filters.append(selectFilter('Потребує уваги', [
    { id: 'no_location', name: 'Не внесено місцезнаходження' },
    { id: 'no_confirm', name: 'Не підтверджено понад рік' },
    { id: 'no_serial', name: 'Без серійного номера' },
  ], state.attention, (v) => { state.attention = v; refresh(); }));
  const reset = actionBtn('Скинути', 'refresh', () => {
    Object.assign(state, { q: '', status: '', category: '', manager: '', holder: '', attention: '' });
    render(root);
  }, 'sm');
  filters.append(reset);
  root.append(filters);

  const holder = el('div');
  root.append(holder);

  function refresh() {
    holder.innerHTML = '';
    const list = filteredEquipment();
    holder.append(dataTable({
      columns: [
        {
          label: 'Інв. номер', main: true, render: (e) => {
            const w = el('div');
            w.append(el('b.mono', { text: e.invNumber }));
            w.append(el('div.small', { text: e.name }));
            return w;
          }
        },
        { label: 'Категорія', render: (e) => categoryName(e.categoryId), hideMobile: true },
        { label: 'Статус', render: (e) => statusChip(e.status) },
        {
          label: 'Утримувач / місце', render: (e) => {
            const w = el('div');
            w.append(el('div', { text: holderLabel(e) }));
            const loc = locationLabel(e);
            if (loc && loc !== '—') w.append(el('div.small.muted', { text: loc }));
            return w;
          }
        },
        { label: 'Відповідальний', render: (e) => e.responsibleManagerId ? userName(e.responsibleManagerId) : '—', hideMobile: true },
        {
          label: 'Підтверджено', render: (e) => {
            if (!['at_client', 'at_distributor'].includes(e.status)) return '—';
            if (!e.lastConfirmedAt) {
              const wd = e.transferredAt ? workdaysSince(e.transferredAt) : null;
              const late = wd !== null && wd > settings().locationDeadlineDays;
              return chip(late ? `Прострочено (${wd} р.д.)` : 'Очікує', late ? 'red' : 'amber');
            }
            const d = daysBetween(e.lastConfirmedAt);
            return chip(fmtDate(e.lastConfirmedAt), d > 365 ? 'red' : d > 300 ? 'amber' : 'green');
          }
        },
      ],
      rows: list,
      onRow: (e) => openEquipmentCard(e.id, () => refresh()),
      empty: 'Обладнання не знайдено',
      footer: el('div.row', {}, [
        el('span', { text: `Показано: ${list.length} з ${all('equipment').length}` }),
        el('span.grow'),
        el('span.small', { text: `Загальна вартість: ${fmtMoney(list.reduce((s, e) => s + (+e.initialCost || 0), 0))}` }),
      ]),
    }));
  }
  refresh();

  if (params.open) openEquipmentCard(params.open, () => refresh());
}

/* ==========================================================================
   Картка обладнання
   ========================================================================== */
export function openEquipmentCard(eqId, onChange) {
  let tab = 'main';
  const drawer = openDrawer({
    title: 'Картка обладнання',
    render: (body, api) => {
      const e = get('equipment', eqId);
      if (!e) { body.append(el('div.empty', { text: 'Обладнання не знайдено' })); return; }
      api.setTitle(`${e.invNumber} — ${e.name}`);

      /* заголовок */
      const head = el('div.row.wrap.gap8.mb16');
      head.append(statusChip(e.status));
      head.append(chip(categoryName(e.categoryId), 'grey'));
      if (e.serialNumber) head.append(chip('S/N ' + e.serialNumber, 'grey'));
      body.append(head);

      /* попередження */
      if (['at_client', 'at_distributor'].includes(e.status) && !e.lastConfirmedAt && e.transferredAt) {
        const wd = workdaysSince(e.transferredAt);
        if (wd > settings().locationDeadlineDays) {
          body.append(alertBox(`Не внесено фактичне місцезнаходження — минуло ${wd} робочих днів після передачі (норматив: ${settings().locationDeadlineDays} р.д., п. 6.1).`, 'err', 'alert'));
        }
      }
      if (!e.serialNumber && e.status !== 'written_off') {
        body.append(alertBox('Не зафіксовано заводський/серійний номер (п. 2.3).', 'warn', 'alert'));
      }

      body.append(tabs([
        { id: 'main', label: 'Загальне' },
        { id: 'history', label: 'Історія руху' },
        { id: 'photos', label: 'Фото' },
        { id: 'docs', label: 'Документи' },
      ], tab, (t) => { tab = t; api.refresh(); }));

      if (tab === 'main') renderMain(body, e, api, onChange);
      if (tab === 'history') renderHistory(body, e);
      if (tab === 'photos') renderPhotos(body, e);
      if (tab === 'docs') renderDocs(body, e);
    },
  });
  return drawer;
}

function renderMain(body, e, api, onChange) {
  const refresh = () => { api.refresh(); onChange && onChange(); };

  body.append(dl([
    ['Інвентарний номер', el('b.mono', { text: e.invNumber })],
    ['Серійний / заводський номер', e.serialNumber || null],
    ['Найменування', e.name],
    ['Модель / виробник', [e.model, e.manufacturer].filter(Boolean).join(' · ') || null],
    ['Категорія', categoryName(e.categoryId)],
    ['Статус', statusChip(e.status)],
    ['Утримувач', holderLabel(e)],
    ['Фактична адреса', locationLabel(e)],
    ['Відповідальний менеджер', e.responsibleManagerId ? userName(e.responsibleManagerId) : null],
    ['Дата придбання', fmtDate(e.purchaseDate)],
    ['Первісна вартість', fmtMoney(e.initialCost)],
    ['Постачальник', e.supplier || null],
    ['Передано отримувачу', e.transferredAt ? fmtDate(e.transferredAt) : null],
    ['Останнє підтвердження', e.lastConfirmedAt ? fmtDateTime(e.lastConfirmedAt) : null],
    ['Координати підтвердження', e.lastGeo
      ? el('a', { href: mapLink(e.lastGeo), target: '_blank', rel: 'noopener', text: `${e.lastGeo.lat}, ${e.lastGeo.lng} (±${e.lastGeo.acc || '?'} м)` })
      : null],
    ['Примітка', e.note || null],
  ]));

  /* штрих-код */
  const bc = el('div.mt16', { style: 'max-width:280px' });
  bc.innerHTML = code39SVG(e.invNumber);
  body.append(el('div.section-title', { text: 'Етикетка' }), bc);
  body.append(el('div.row.gap8.mt8', {}, [
    actionBtn('Друк етикетки', 'print', () => {
      const w = window.open('', '_blank');
      w.document.write(labelsHTML([e], { companyName: settings().companyName }));
      w.document.close();
    }, 'sm'),
  ]));

  /* дії */
  const acts = el('div.row.wrap.gap8.mt24');
  const u = currentUser();
  const active = !['written_off'].includes(e.status);

  if (can('equipment.edit')) acts.append(actionBtn('Редагувати', 'edit', () => openEquipmentForm(e, refresh), 'sm'));
  if (can('equipment.status') && active) acts.append(actionBtn('Змінити статус', 'refresh', () => openStatusForm(e, refresh), 'sm'));
  if (active && (can('inventory.confirm') || isResponsibleFor(e, u)))
    acts.append(actionBtn('Підтвердити місце', 'pin', () => openLocationForm(e, refresh), 'sm primary'));
  if (can('ops.move') && active) acts.append(actionBtn('Перемістити', 'arrows', () => openMoveForm(e, refresh), 'sm'));
  if (can('ops.return') && ['at_client', 'at_distributor', 'in_transit'].includes(e.status))
    acts.append(actionBtn('Повернути на склад', 'warehouse', () => openReturnForm(e, refresh), 'sm'));
  if (can('repair.create') && active) acts.append(actionBtn('Заявка на ремонт', 'wrench', () => openRepairForm(e, refresh), 'sm'));
  if (can('ops.incident') && active) acts.append(actionBtn('Втрата / пошкодження', 'alert', () => openIncidentForm(e, refresh), 'sm'));
  if (can('ops.writeoff') && active) acts.append(actionBtn('На списання', 'recycle', () => openWriteOffForm([e], refresh), 'sm'));
  if (can('equipment.delete')) acts.append(actionBtn('Видалити', 'trash', async () => {
    if (await confirmDialog({
      title: 'Видалити картку?', danger: true, okText: 'Видалити',
      text: `Картку ${e.invNumber} буде видалено без можливості відновлення. Історія руху залишиться в журналі аудиту.`,
    })) {
      logAudit(u.id, 'delete', 'equipment', e.id, `Видалено ${e.invNumber}`);
      remove('equipment', e.id);
      toast('Картку видалено');
      api.close();
      onChange && onChange();
    }
  }, 'sm danger'));
  body.append(acts);
}

function renderHistory(body, e) {
  const hist = equipmentHistory(e.id);
  if (!hist.length) { body.append(el('div.empty', { text: 'Історія порожня' })); return; }
  const tl = el('div.timeline');
  for (const h of hist) {
    const it = el('div.tl-item');
    it.append(el('div.tl-t', { text: `${fmtDateTime(h.at)} · ${userName(h.userId)}` }));
    const line = el('div.tl-b');
    if (h.fromStatus && h.toStatus) {
      line.append(el('b', { text: `${statusName(h.fromStatus)} → ${statusName(h.toStatus)}` }));
      line.append(el('br'));
    } else if (h.type) {
      line.append(el('b', { text: typeLabel(h.type) }));
      line.append(el('br'));
    }
    line.append(document.createTextNode(h.comment || ''));
    if (h.doc) { line.append(el('br')); line.append(el('span.small.muted', { text: 'Документ: ' + h.doc })); }
    if (h.geo) {
      line.append(el('br'));
      line.append(el('a.small', { href: mapLink(h.geo), target: '_blank', rel: 'noopener', text: `Координати: ${h.geo.lat}, ${h.geo.lng}` }));
    }
    it.append(line);
    tl.append(it);
  }
  body.append(tl);
}

const typeLabel = (t) => ({
  created: 'Оприбуткування', status: 'Зміна статусу', transfer: 'Передача', location: 'Місцезнаходження',
  inventory: 'Інвентаризація', repair: 'Ремонт', incident: 'Інцидент',
}[t] || t);

function renderPhotos(body, e) {
  body.append(photoPicker(e.photos || [], (ids) => {
    update('equipment', e.id, { photos: ids });
    toast('Фотографії збережено', 'ok');
  }, { label: 'Фотографії обладнання', max: 12, readonly: !can('equipment.edit') }));
}

function renderDocs(body, e) {
  const acts = all('acts').filter((a) => (a.equipmentIds || []).includes(e.id));
  const reqs = all('requests').filter((r) => (r.equipmentIds || []).includes(e.id));
  const reps = all('repairs').filter((r) => r.equipmentId === e.id);
  const wos = all('writeoffs').filter((w) => (w.equipmentIds || []).includes(e.id));

  const section = (title, items, fmt, link) => {
    body.append(el('div.section-title', { text: title }));
    if (!items.length) { body.append(el('div.small.muted', { text: 'Немає документів' })); return; }
    const list = el('div.col.gap6');
    for (const it of items) {
      const row = el('div.row.gap8', { style: 'padding:8px 10px;border:1px solid var(--line);border-radius:9px' });
      row.append(el('div.grow', { html: fmt(it) }));
      if (link) row.append(actionBtn('Відкрити', 'chevronRight', () => link(it), 'sm ghost'));
      list.append(row);
    }
    body.append(list);
  };

  section('Акти приймання-передачі', acts, (a) => `<b class="mono">${a.number}</b> · ${fmtDate(a.date)}<br><span class="small muted">${counterpartyName(a.recipientId)}</span>`,
    (a) => openActView(a));
  section('Заявки на передачу', reqs, (r) => `<b class="mono">${r.number}</b> · ${fmtDate(r.createdAt)}<br><span class="small muted">${reqStatusLabel(r.status)}</span>`,
    (r) => navigate(`#/requests/${r.id}`));
  section('Заявки на ремонт', reps, (r) => `<b class="mono">${r.number}</b> · ${fmtDate(r.createdAt)}<br><span class="small muted">${r.problem}</span>`,
    (r) => navigate(`#/repairs/${r.id}`));
  section('Документи на списання', wos, (w) => `<b class="mono">${w.number}</b> · ${fmtDate(w.createdAt)}<br><span class="small muted">${w.reason || ''}</span>`, null);
}

const reqStatusLabel = (s) => ({
  pending: 'Очікує погодження', approved: 'Погоджено', rejected: 'Відхилено', planned: 'Заплановано',
  shipped: 'Відвантажено', completed: 'Завершено', cancelled: 'Скасовано',
}[s] || s);

/* ==========================================================================
   Форми
   ========================================================================== */
export async function openEquipmentForm(eq, onDone) {
  const isNew = !eq;
  const vals = await formModal({
    title: isNew ? 'Оприбуткування торговельного обладнання' : 'Редагування картки ТО',
    size: 'wide',
    submitText: isNew ? 'Оприбуткувати' : 'Зберегти',
    intro: isNew ? alertBox('Кожній одиниці ТО присвоюється унікальний інвентарний номер. Передача без інвентарного номера не допускається (п. 2.2, 2.4).', 'info') : null,
    fields: [
      { name: 'invNumber', label: 'Інвентарний номер', required: true, value: isNew ? nextInvNumber() : eq.invNumber, hint: 'Унікальний у межах Товариства' },
      { name: 'serialNumber', label: 'Серійний / заводський номер', value: eq?.serialNumber || '', hint: 'Обов’язково, якщо наявний (п. 2.3)' },
      { name: 'name', label: 'Найменування', required: true, value: eq?.name || '', colspan: 2 },
      { name: 'categoryId', label: 'Категорія', type: 'select', required: true, options: all('categories'), value: eq?.categoryId || '' },
      { name: 'model', label: 'Модель', value: eq?.model || '' },
      { name: 'manufacturer', label: 'Виробник', value: eq?.manufacturer || '' },
      { name: 'supplier', label: 'Постачальник', value: eq?.supplier || '' },
      { name: 'purchaseDate', label: 'Дата придбання', type: 'date', value: fmtDateInput(eq?.purchaseDate) || fmtDateInput(new Date().toISOString()) },
      { name: 'initialCost', label: 'Первісна вартість, ₴', type: 'number', value: eq?.initialCost ?? '' },
      { name: 'warehouseId', label: 'Місце зберігання (склад)', type: 'select', options: all('warehouses'), value: eq?.holderType === 'warehouse' ? eq.holderId : (all('warehouses')[0] || {}).id },
      { name: 'note', label: 'Примітка', type: 'textarea', value: eq?.note || '', colspan: 2 },
    ],
    validate: (v) => {
      if (invNumberExists(v.invNumber, eq?.id)) return 'Обладнання з таким інвентарним номером уже існує.';
      return null;
    },
  });
  if (!vals) return;
  const u = currentUser();
  if (isNew) {
    const rec = insert('equipment', {
      invNumber: vals.invNumber, serialNumber: vals.serialNumber, name: vals.name,
      categoryId: vals.categoryId, model: vals.model, manufacturer: vals.manufacturer,
      supplier: vals.supplier, purchaseDate: vals.purchaseDate || new Date().toISOString(),
      initialCost: vals.initialCost, note: vals.note,
      status: 'in_stock', holderType: 'warehouse', holderId: vals.warehouseId,
      outletId: null, responsibleManagerId: null, photos: [], lastConfirmedAt: null, lastGeo: null,
      createdBy: u.id,
    }, { silent: true });
    logAudit(u.id, 'create', 'equipment', rec.id, `Оприбутковано ${rec.invNumber}`);
    const { addMovement } = await import('../store.js');
    addMovement({ equipmentId: rec.id, type: 'created', toStatus: 'in_stock', userId: u.id, comment: 'Оприбуткування ТО (п. 2.1)' });
    persist();
    toast('Обладнання оприбутковано', 'ok');
  } else {
    const patch = {
      invNumber: vals.invNumber, serialNumber: vals.serialNumber, name: vals.name,
      categoryId: vals.categoryId, model: vals.model, manufacturer: vals.manufacturer,
      supplier: vals.supplier, purchaseDate: vals.purchaseDate, initialCost: vals.initialCost, note: vals.note,
    };
    if (eq.holderType === 'warehouse') patch.holderId = vals.warehouseId;
    update('equipment', eq.id, patch);
    logAudit(u.id, 'update', 'equipment', eq.id, `Оновлено картку ${vals.invNumber}`);
    persist();
    toast('Зміни збережено', 'ok');
  }
  onDone && onDone();
}

export async function openStatusForm(eq, onDone) {
  const vals = await formModal({
    title: `Зміна статусу — ${eq.invNumber}`,
    submitText: 'Змінити статус',
    intro: alertBox('Зміна статусу здійснюється на підставі первинних документів, погодженої заявки або іншого підтвердження (п. 7.3).', 'info'),
    fields: [
      { name: 'status', label: 'Новий статус', type: 'select', required: true, options: all('statuses'), value: eq.status },
      { name: 'doc', label: 'Підстава (номер документа)', placeholder: 'Акт, ТТН, заявка…' },
      { name: 'comment', label: 'Коментар', type: 'textarea', colspan: 2 },
    ],
  });
  if (!vals) return;
  setStatus(eq, vals.status, currentUser(), { comment: vals.comment, doc: vals.doc });
  toast('Статус змінено', 'ok');
  onDone && onDone();
}

export async function openLocationForm(eq, onDone) {
  let geo = null, photoIds = [];
  const cpOutlets = eq.holderType === 'counterparty'
    ? all('outlets').filter((o) => o.counterpartyId === eq.holderId) : [];

  const vals = await formModal({
    title: `Підтвердження місцезнаходження — ${eq.invNumber}`,
    submitText: 'Зберегти підтвердження',
    intro: alertBox('Підтвердження виконується оглядом, фото- або відеофіксацією чи підтвердженням від клієнта (п. 12.3). Дані потрапляють до історії руху ТО.', 'info'),
    fields: [
      { name: 'outletId', label: 'Торгова точка', type: 'select', options: cpOutlets, value: eq.outletId || '', placeholder: '— не змінювати —' },
      { name: 'method', label: 'Спосіб підтвердження', type: 'select', required: true, value: 'visit', placeholder: false, options: [
        { id: 'visit', name: 'Особистий огляд' },
        { id: 'photo', name: 'Фотофіксація' },
        { id: 'client', name: 'Підтвердження від клієнта / дистриб’ютора' },
        { id: 'other', name: 'Інше' },
      ] },
      { name: 'comment', label: 'Коментар', type: 'textarea', colspan: 2 },
    ],
    onRender: (inputs, form) => {
      const box = el('div.mt8');
      const geoRow = el('div.row.gap8.wrap');
      const geoInfo = el('div.small.muted', { text: 'Координати не визначено' });
      const geoBtn = actionBtn('Визначити геолокацію', 'pin', async () => {
        geoBtn.disabled = true; geoInfo.textContent = 'Визначення…';
        try {
          geo = await getPosition();
          geoInfo.innerHTML = `<b>${geo.lat}, ${geo.lng}</b> · точність ±${geo.acc} м`;
        } catch (err) { geoInfo.textContent = err.message; }
        geoBtn.disabled = false;
      }, 'sm');
      geoRow.append(geoBtn, geoInfo);
      box.append(el('div.section-title', { text: 'Геолокація' }), geoRow);
      box.append(photoPicker([], (ids) => { photoIds = ids; }, { label: 'Фотофіксація', max: 4 }));
      form.append(box);
    },
  });
  if (!vals) return;
  setLocation(eq, currentUser(), {
    outletId: vals.outletId || eq.outletId, geo, photoIds,
    comment: `Спосіб: ${vals.method}. ${vals.comment || ''}`.trim(),
  });
  toast('Місцезнаходження підтверджено', 'ok');
  onDone && onDone();
}

export async function openMoveForm(eq, onDone) {
  let target = 'counterparty';
  const vals = await formModal({
    title: `Переміщення ТО — ${eq.invNumber}`,
    submitText: 'Зафіксувати переміщення',
    intro: alertBox('Будь-яке переміщення здійснюється лише після належного документального оформлення (п. 9.1).', 'warn', 'alert'),
    fields: [
      { name: 'targetType', label: 'Куди переміщується', type: 'select', required: true, placeholder: false, value: 'counterparty', options: [
        { id: 'counterparty', name: 'До клієнта / дистриб’ютора' },
        { id: 'warehouse', name: 'На склад' },
      ] },
      { name: 'counterpartyId', label: 'Отримувач', type: 'select', options: all('counterparties').filter((c) => c.active !== false) },
      { name: 'outletId', label: 'Торгова точка', type: 'select', options: all('outlets') },
      { name: 'warehouseId', label: 'Склад', type: 'select', options: all('warehouses') },
      { name: 'responsibleManagerId', label: 'Відповідальний менеджер', type: 'select', options: all('users').filter((u) => u.role === 'responsible_manager').map((u) => ({ id: u.id, name: u.fullName })), value: eq.responsibleManagerId || '' },
      { name: 'docNumber', label: 'Документ (Акт / ТТН)', required: true },
      { name: 'comment', label: 'Коментар', type: 'textarea', colspan: 2 },
    ],
    onRender: (inputs) => {
      const sync = () => {
        target = inputs.targetType.value;
        const toCp = target === 'counterparty';
        inputs.counterpartyId.closest('.field').classList.toggle('hidden', !toCp);
        inputs.outletId.closest('.field').classList.toggle('hidden', !toCp);
        inputs.responsibleManagerId.closest('.field').classList.toggle('hidden', !toCp);
        inputs.warehouseId.closest('.field').classList.toggle('hidden', toCp);
      };
      inputs.targetType.addEventListener('change', sync);
      inputs.counterpartyId.addEventListener('change', () => {
        const list = all('outlets').filter((o) => o.counterpartyId === inputs.counterpartyId.value);
        inputs.outletId.innerHTML = '<option value="">— торгова точка —</option>' +
          list.map((o) => `<option value="${o.id}">${o.name}</option>`).join('');
      });
      sync();
    },
    validate: (v) => {
      if (v.targetType === 'counterparty' && !v.counterpartyId) return 'Оберіть отримувача.';
      if (v.targetType === 'warehouse' && !v.warehouseId) return 'Оберіть склад.';
      return null;
    },
  });
  if (!vals) return;
  moveEquipment(eq, currentUser(), vals);
  toast('Переміщення зафіксовано', 'ok');
  onDone && onDone();
}

export async function openReturnForm(eq, onDone) {
  const vals = await formModal({
    title: `Повернення ТО — ${eq.invNumber}`,
    submitText: 'Оформити повернення',
    intro: alertBox('Повернення оформлюється Актом повернення; ТО повертається на склад або передається іншому клієнту/дистриб’ютору.', 'info'),
    fields: [
      { name: 'warehouseId', label: 'Склад', type: 'select', required: true, options: all('warehouses'), value: (all('warehouses')[0] || {}).id },
      { name: 'condition', label: 'Стан обладнання', type: 'select', placeholder: false, value: 'working', options: [
        { id: 'working', name: 'Робочий' },
        { id: 'needs_repair', name: 'Потребує ремонту' },
        { id: 'damaged', name: 'Пошкоджений' },
      ] },
      { name: 'docNumber', label: 'Номер Акта повернення', required: true },
      { name: 'comment', label: 'Коментар', type: 'textarea', colspan: 2 },
    ],
  });
  if (!vals) return;
  returnToWarehouse(eq, currentUser(), vals);
  toast('Повернення оформлено', 'ok');
  onDone && onDone();
}

export async function openRepairForm(eq, onDone) {
  let photoIds = [];
  const vals = await formModal({
    title: `Заявка на ремонт — ${eq.invNumber}`,
    submitText: 'Подати заявку',
    intro: alertBox('Заявка надходить менеджеру з трейд-маркетингу, який організовує взаємодію із сервісною організацією (п. 10.1–10.2).', 'info'),
    fields: [
      { name: 'problem', label: 'Опис несправності', type: 'textarea', required: true, colspan: 2, rows: 4 },
      { name: 'urgency', label: 'Терміновість', type: 'select', placeholder: false, value: 'normal', options: [
        { id: 'low', name: 'Низька' }, { id: 'normal', name: 'Звичайна' }, { id: 'high', name: 'Висока' },
      ] },
      { name: 'needsRelocation', label: 'Потрібне переміщення обладнання', type: 'checkbox', hint: 'Якщо так — переміщення координує ВАП зі складом (п. 10.3)' },
      { name: 'contact', label: 'Контакт на місці', placeholder: 'ПІБ, телефон', colspan: 2 },
    ],
    onRender: (i, form) => form.append(photoPicker([], (ids) => { photoIds = ids; }, { label: 'Фото несправності', max: 6 })),
  });
  if (!vals) return;
  createRepair({ equipmentId: eq.id, ...vals, photos: photoIds }, currentUser());
  toast('Заявку на ремонт подано', 'ok');
  onDone && onDone();
}

export async function openIncidentForm(eq, onDone) {
  let photoIds = [];
  const vals = await formModal({
    title: `Втрата / пошкодження — ${eq.invNumber}`,
    submitText: 'Надіслати повідомлення',
    intro: alertBox(`Повідомлення невідкладно надсилається Комерційному директору, бухгалтерії та менеджеру з трейд-маркетингу (п. 11.1). Норматив: ${settings().incidentReportDays} робочі дні.`, 'warn', 'alert'),
    fields: [
      { name: 'type', label: 'Тип події', type: 'select', required: true, placeholder: false, value: 'damage', options: [
        { id: 'damage', name: 'Пошкодження' },
        { id: 'loss', name: 'Втрата' },
        { id: 'theft', name: 'Викрадення' },
        { id: 'unknown', name: 'Неможливо встановити місцезнаходження' },
      ] },
      { name: 'occurredAt', label: 'Дата події', type: 'date', value: fmtDateInput(new Date().toISOString()) },
      { name: 'description', label: 'Опис обставин', type: 'textarea', required: true, colspan: 2, rows: 4 },
    ],
    onRender: (i, form) => form.append(photoPicker([], (ids) => { photoIds = ids; }, { label: 'Фотофіксація', max: 6 })),
  });
  if (!vals) return;
  createIncident({ equipmentId: eq.id, ...vals, photos: photoIds }, currentUser());
  toast('Повідомлення зареєстровано', 'ok');
  onDone && onDone();
}

export async function openWriteOffForm(eqList, onDone) {
  const vals = await formModal({
    title: 'Ініціювання списання ТО',
    submitText: 'Передати на затвердження',
    intro: alertBox(`До списання буде включено: ${eqList.map((e) => e.invNumber).join(', ')}. Списання здійснюється на підставі рішення уповноважених осіб або комісії (п. 11.3).`, 'info'),
    fields: [
      { name: 'reason', label: 'Підстава', type: 'select', required: true, options: [
        { id: 'wear', name: 'Фізичне зношення' },
        { id: 'uneconomic', name: 'Економічна недоцільність ремонту' },
        { id: 'damage', name: 'Безповоротне пошкодження' },
        { id: 'theft', name: 'Викрадення' },
        { id: 'unknown', name: 'Неможливо встановити місцезнаходження' },
      ] },
      { name: 'commission', label: 'Склад комісії', placeholder: 'ПІБ членів комісії', colspan: 2 },
      { name: 'comment', label: 'Обґрунтування', type: 'textarea', required: true, colspan: 2, rows: 3 },
    ],
  });
  if (!vals) return;
  createWriteOff({ equipmentIds: eqList.map((e) => e.id), ...vals }, currentUser());
  toast('Документ на списання створено', 'ok');
  onDone && onDone();
}

/* ---------- Перегляд Акта приймання-передачі ---------- */
export function openActView(act) {
  const body = el('div.print-doc');
  const items = act.equipmentIds.map((id) => get('equipment', id)).filter(Boolean);
  const recipient = get('counterparties', act.recipientId);
  const via = act.viaDistributorId ? get('counterparties', act.viaDistributorId) : null;

  body.append(el('h2', { text: `Акт приймання-передачі торговельного обладнання № ${act.number}`, style: 'margin-bottom:6px' }));
  body.append(el('div.small.muted.mb16', { text: `від ${fmtDate(act.date)}` }));
  body.append(dl([
    ['Передавач', settings().companyName],
    ['Отримувач', recipient ? `${recipient.name} (ЄДРПОУ ${recipient.edrpou || '—'})` : '—'],
    ['Адреса отримувача', recipient?.address || '—'],
    ['Тип передачі', { client: 'Клієнту', distributor: 'Дистриб’ютору', client_via_distributor: 'Клієнту через дистриб’ютора' }[act.transferType]],
    ...(via ? [['Реалізація продукції здійснюється через', `${via.name} (п. 5.4)`]] : []),
    ['Торгова точка', act.outletId ? (get('outlets', act.outletId) || {}).name : '—'],
    ['Відповідальний менеджер', userName(act.responsibleManagerId)],
    ['ТТН', act.ttn || '—'],
  ]));

  const t = el('table.tbl.mt16');
  t.innerHTML = `<thead><tr><th>№</th><th>Інвентарний номер</th><th>Найменування</th><th>Серійний №</th><th class="right">Вартість</th></tr></thead>`;
  const tb = el('tbody');
  items.forEach((e, i) => {
    tb.append(el('tr', {}, [
      el('td', { text: String(i + 1) }),
      el('td.mono', { text: e.invNumber }),
      el('td', { text: e.name }),
      el('td', { text: e.serialNumber || '—' }),
      el('td.right', { text: fmtMoney(e.initialCost) }),
    ]));
  });
  t.append(tb);
  body.append(t);

  body.append(el('div.mt24.small', { html: `
    <p><b>Підписи сторін</b></p>
    <p>Від Товариства (відповідальний менеджер): ${userName(act.responsibleManagerId)} ____________________</p>
    <p>Від отримувача: ${act.recipientSigner || '____________________'}</p>
    <p class="muted">Підпис відповідального менеджера підтверджує погодження передачі, правильність визначення отримувача
    та подальший контроль місцезнаходження обладнання (п. 5.5).</p>` }));

  const printBtn = actionBtn('Друк', 'print', () => window.print(), 'primary');
  openModal({ title: 'Акт приймання-передачі', body, footer: printBtn, size: 'wide' });
}

/* ---------- Експорт / імпорт / етикетки ---------- */
function exportCSV() {
  const list = filteredEquipment();
  const rows = list.map((e) => [
    e.invNumber, e.serialNumber || '', e.name, categoryName(e.categoryId), statusName(e.status),
    holderLabel(e), locationLabel(e), e.responsibleManagerId ? userName(e.responsibleManagerId) : '',
    fmtDate(e.purchaseDate), e.initialCost ?? '', e.lastConfirmedAt ? fmtDate(e.lastConfirmedAt) : '',
  ]);
  downloadFile(`ТО_реєстр_${new Date().toISOString().slice(0, 10)}.csv`,
    toCSV(rows, ['Інв. номер', 'Серійний номер', 'Найменування', 'Категорія', 'Статус', 'Утримувач',
      'Адреса', 'Відповідальний', 'Дата придбання', 'Первісна вартість', 'Останнє підтвердження']),
    'text/csv;charset=utf-8');
  toast(`Експортовано ${rows.length} позицій`, 'ok');
}

function printLabels() {
  const list = filteredEquipment();
  if (!list.length) return toast('Немає позицій для друку', 'err');
  const w = window.open('', '_blank');
  if (!w) return toast('Дозвольте відкриття нових вікон для друку', 'err');
  w.document.write(labelsHTML(list.slice(0, 300), { companyName: settings().companyName }));
  w.document.close();
}

export async function openImport(onDone) {
  const body = el('div');
  body.append(alertBox('Формат CSV (роздільник «;»), перший рядок — заголовки. Обов’язкові колонки: Інв. номер; Найменування. Додаткові: Серійний номер; Категорія; Модель; Виробник; Дата придбання; Вартість; Склад.', 'info'));
  const sample = 'Інв. номер;Найменування;Серійний номер;Категорія;Модель;Виробник;Дата придбання;Вартість;Склад\r\n' +
    'ТО-000501;Холодильник Frigoglass ICOOL 650;SN123456;Холодильне обладнання;ICOOL 650;Frigoglass;2026-03-15;24500;Центральний склад (Трускавець)';
  body.append(actionBtn('Завантажити шаблон CSV', 'download', () =>
    downloadFile('шаблон_імпорту_ТО.csv', sample, 'text/csv;charset=utf-8'), 'sm'));

  const fileInput = el('input.input.mt16', { type: 'file', accept: '.csv,text/csv' });
  body.append(el('div.section-title', { text: 'Файл імпорту' }), fileInput);
  const preview = el('div.mt16');
  body.append(preview);

  const importBtn = el('button.btn.primary', { type: 'button', text: 'Імпортувати', disabled: true });
  const m = openModal({ title: 'Імпорт обладнання та залишків', body, footer: importBtn, size: 'wide' });

  let parsed = [];
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    if (!f) return;
    const { readFileAsText } = await import('../util.js');
    const text = await readFileAsText(f);
    const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) { preview.innerHTML = '<div class="alert err">Файл порожній</div>'; return; }
    const head = lines[0].split(';').map((h) => h.trim().toLowerCase());
    const idx = (names) => head.findIndex((h) => names.some((n) => h.includes(n)));
    const cInv = idx(['інв']), cName = idx(['наймен', 'назва']), cSn = idx(['серій']),
      cCat = idx(['категор']), cModel = idx(['модел']), cMan = idx(['виробн']),
      cDate = idx(['дата']), cCost = idx(['вартіс']), cWh = idx(['склад']);
    if (cInv < 0 || cName < 0) { preview.innerHTML = '<div class="alert err">Не знайдено колонок «Інв. номер» та «Найменування»</div>'; return; }

    parsed = [];
    const errors = [];
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(';').map((x) => x.trim().replace(/^"|"$/g, ''));
      const invNumber = c[cInv];
      if (!invNumber) continue;
      if (invNumberExists(invNumber)) { errors.push(`Рядок ${i + 1}: ${invNumber} — уже існує`); continue; }
      if (parsed.some((p) => p.invNumber === invNumber)) { errors.push(`Рядок ${i + 1}: ${invNumber} — дубль у файлі`); continue; }
      const catName = cCat >= 0 ? c[cCat] : '';
      const cat = all('categories').find((x) => x.name.toLowerCase() === String(catName).toLowerCase());
      const whName = cWh >= 0 ? c[cWh] : '';
      const wh = all('warehouses').find((x) => x.name.toLowerCase() === String(whName).toLowerCase()) || all('warehouses')[0];
      parsed.push({
        invNumber, name: c[cName],
        serialNumber: cSn >= 0 ? c[cSn] : '',
        categoryId: cat ? cat.id : (all('categories')[0] || {}).id,
        model: cModel >= 0 ? c[cModel] : '',
        manufacturer: cMan >= 0 ? c[cMan] : '',
        purchaseDate: cDate >= 0 && c[cDate] ? new Date(c[cDate]).toISOString() : new Date().toISOString(),
        initialCost: cCost >= 0 ? Number(String(c[cCost]).replace(',', '.')) || null : null,
        warehouseId: wh ? wh.id : null,
      });
    }
    preview.innerHTML = '';
    preview.append(alertBox(`До імпорту готово: ${parsed.length} позицій.${errors.length ? ` Пропущено: ${errors.length}.` : ''}`, errors.length ? 'warn' : 'ok', errors.length ? 'alert' : 'check'));
    if (errors.length) preview.append(el('div.small.muted', { html: errors.slice(0, 12).map((e) => `• ${e}`).join('<br>') }));
    importBtn.disabled = !parsed.length;
  });

  importBtn.addEventListener('click', async () => {
    const u = currentUser();
    const { addMovement } = await import('../store.js');
    for (const p of parsed) {
      const rec = insert('equipment', {
        ...p, status: 'in_stock', holderType: 'warehouse', holderId: p.warehouseId,
        outletId: null, responsibleManagerId: null, photos: [], lastConfirmedAt: null, lastGeo: null,
        createdBy: u.id,
      }, { silent: true });
      addMovement({ equipmentId: rec.id, type: 'created', toStatus: 'in_stock', userId: u.id, comment: 'Імпорт залишків' });
    }
    logAudit(u.id, 'import', 'equipment', '', `Імпортовано ${parsed.length} позицій`);
    persist();
    m.close();
    toast(`Імпортовано ${parsed.length} позицій`, 'ok');
    onDone && onDone();
  });
}
