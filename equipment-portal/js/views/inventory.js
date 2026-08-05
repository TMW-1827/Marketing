/* ==========================================================================
   Інвентаризація / щорічне підтвердження наявності ТО (п. 12 Положення).
   Мобільний сценарій: сканування інвентарного номера → фото → геолокація.
   ========================================================================== */

import {
  all, get, update, settings, userName, holderLabel, locationLabel,
  statusName, categoryName, photos,
} from '../store.js';
import { can, currentUser } from '../auth.js';
import {
  pageHead, actionBtn, alertBox, dataTable, dl, chip, statusChip, toast,
  formModal, openDrawer, openModal, confirmDialog, searchInput, selectFilter, photoPicker,
} from '../ui.js';
import {
  el, fmtDate, fmtDateTime, fmtDateInput, matches, sortBy, getPosition, distanceM,
  mapLink, downloadFile, toCSV, isMobile, readImageCompressed, plural,
} from '../util.js';
import { icon } from '../icons.js';
import { createInventory, confirmInventoryItem, closeInventory } from '../workflow.js';
import { openEquipmentCard } from './equipment.js';

export function render(root, params = {}) {
  const u = currentUser();
  root.append(pageHead(
    'Інвентаризація торговельного обладнання',
    'Не рідше одного разу на рік проводиться підтвердження фактичного місцезнаходження ТО: особистий огляд, фото-/відеофіксація або підтвердження від клієнта (п. 12.1, 12.3).',
    [
      can('inventory.confirm') && actionBtn('Сканувати ТО', 'scan', () => quickScan(() => rerender(root)), 'primary'),
      can('inventory.manage') && actionBtn('Нова інвентаризація', 'plus', () => openCreateForm(() => rerender(root))),
    ]
  ));

  const list = sortBy(all('inventories'), 'createdAt', -1);
  if (!list.length) {
    root.append(el('div.empty', {}, [
      el('div', { html: icon('clipboard') }),
      el('b', { text: 'Інвентаризацій ще не створено' }),
      el('div.small', { text: 'Менеджер із трейд-маркетингу формує реєстр ТО з BAS та розпочинає підтвердження наявності (п. 12.2).' }),
    ]));
    return;
  }

  const grid = el('div.grid.auto');
  for (const inv of list) {
    const done = inv.items.filter((i) => i.status !== 'pending').length;
    const pct = inv.items.length ? Math.round((done / inv.items.length) * 100) : 0;
    const disc = inv.items.filter((i) => i.status === 'discrepancy').length;
    const card = el('button.kpi', { type: 'button', style: 'align-items:stretch' });
    card.append(el('div.row.gap8', {}, [
      el('b.mono', { text: inv.number }),
      el('span.grow'),
      chip(inv.status === 'active' ? 'Активна' : 'Закрита', inv.status === 'active' ? 'green' : 'grey'),
    ]));
    card.append(el('div.strong', { text: inv.name, style: 'font-size:14px' }));
    card.append(el('div.small.muted', { text: `Строк: ${fmtDate(inv.dueDate)} · ${userName(inv.createdBy)}` }));
    const pr = el('div.progress.mt8');
    pr.append(el('i', { style: `width:${pct}%;background:${pct === 100 ? 'var(--green)' : 'var(--blue)'}` }));
    card.append(pr);
    card.append(el('div.small.mt8', { text: `Підтверджено ${done} з ${inv.items.length} (${pct}%)${disc ? ` · розбіжностей: ${disc}` : ''}` }));
    card.addEventListener('click', () => openInventory(inv.id, () => rerender(root)));
    grid.append(card);
  }
  root.append(grid);

  const activeInv = list.find((i) => i.status === 'active');
  if (activeInv) openInventoryInline(root, activeInv, () => rerender(root));
  if (params.open) openInventory(params.open, () => rerender(root));
}

function rerender(root) { root.innerHTML = ''; render(root); }

/* ==========================================================================
   Активна інвентаризація — робочий список
   ========================================================================== */
const wstate = { q: '', filter: 'pending', mine: true };

function openInventoryInline(root, inv, onChange) {
  const u = currentUser();
  root.append(el('h2.mt24.mb8', { text: `Робочий список — ${inv.number}` }));

  const filters = el('div.filters');
  filters.append(searchInput('Пошук за інвентарним номером, клієнтом…', (v) => { wstate.q = v; paint(); }, wstate.q));
  filters.append(selectFilter('Усі позиції', [
    { id: 'pending', name: 'Не підтверджені' },
    { id: 'confirmed', name: 'Підтверджені' },
    { id: 'discrepancy', name: 'Розбіжності' },
  ], wstate.filter, (v) => { wstate.filter = v; paint(); }));
  if (u.role === 'responsible_manager' || can('inventory.manage')) {
    const cb = el('label.checkline', {}, []);
    const inp = el('input', { type: 'checkbox' });
    inp.checked = wstate.mine;
    inp.addEventListener('change', () => { wstate.mine = inp.checked; paint(); });
    cb.append(inp, el('span.small', { text: 'Лише моє ТО' }));
    filters.append(cb);
  }
  filters.append(actionBtn('Експорт', 'download', () => exportInventory(inv), 'sm'));
  if (can('inventory.manage') && inv.status === 'active') {
    filters.append(actionBtn('Закрити інвентаризацію', 'check', async () => {
      const pending = inv.items.filter((i) => i.status === 'pending').length;
      if (!await confirmDialog({
        title: 'Закрити інвентаризацію?',
        text: pending ? `Залишилось непідтверджених позицій: ${pending}. Їх буде зафіксовано як непідтверджені. Результати передаються бухгалтерії (п. 12.4).`
          : 'Усі позиції підтверджено. Результати передаються бухгалтерії (п. 12.4).',
        okText: 'Закрити',
      })) return;
      closeInventory(inv, u);
      toast('Інвентаризацію закрито', 'ok');
      onChange && onChange();
    }, 'sm'));
  }
  root.append(filters);

  const holder = el('div');
  root.append(holder);

  function paint() {
    holder.innerHTML = '';
    let items = inv.items;
    if (wstate.filter) items = items.filter((i) => i.status === wstate.filter);
    if (wstate.mine && u.role === 'responsible_manager') {
      items = items.filter((i) => {
        const eq = get('equipment', i.equipmentId);
        return eq && eq.responsibleManagerId === u.id;
      });
    }
    if (wstate.q) items = items.filter((i) => {
      const eq = get('equipment', i.equipmentId) || {};
      return matches(wstate.q, eq.invNumber, eq.name, holderLabel(eq), locationLabel(eq));
    });

    holder.append(dataTable({
      columns: [
        {
          label: 'Обладнання', main: true, render: (i) => {
            const eq = get('equipment', i.equipmentId) || {};
            const w = el('div');
            w.append(el('b.mono', { text: eq.invNumber || '—' }));
            w.append(el('div.small', { text: eq.name || '' }));
            return w;
          }
        },
        { label: 'Утримувач', render: (i) => holderLabel(get('equipment', i.equipmentId)) },
        { label: 'Адреса', render: (i) => el('span.small', { text: locationLabel(get('equipment', i.equipmentId)) }), hideMobile: true },
        { label: 'Відповідальний', render: (i) => { const eq = get('equipment', i.equipmentId); return eq?.responsibleManagerId ? userName(eq.responsibleManagerId) : '—'; }, hideMobile: true },
        {
          label: 'Стан', render: (i) => i.status === 'confirmed' ? chip('Підтверджено ' + fmtDate(i.confirmedAt), 'green')
            : i.status === 'discrepancy' ? chip('Розбіжність', 'red') : chip('Очікує', 'amber')
        },
        {
          label: '', render: (i) => {
            if (inv.status !== 'active' || !can('inventory.confirm')) return '';
            if (i.status !== 'pending') return actionBtn('Деталі', 'eye', () => showItem(inv, i), 'sm ghost');
            return actionBtn('Підтвердити', 'check', () => confirmItem(inv, i.equipmentId, () => { paint(); onChange && onChange(); }), 'sm primary');
          }
        },
      ],
      rows: items.slice(0, 200),
      empty: 'Позицій немає',
      footer: el('span', { text: `Показано: ${items.length} із ${inv.items.length}` }),
    }));
  }
  paint();
}

function openInventory(id, onChange) {
  const inv = get('inventories', id);
  if (!inv) return;
  return openDrawer({
    title: inv.number,
    render: (body, api) => {
      const cur = get('inventories', id);
      const done = cur.items.filter((i) => i.status !== 'pending').length;
      const disc = cur.items.filter((i) => i.status === 'discrepancy').length;
      body.append(dl([
        ['Найменування', cur.name],
        ['Статус', chip(cur.status === 'active' ? 'Активна' : 'Закрита', cur.status === 'active' ? 'green' : 'grey')],
        ['Ініціатор', `${userName(cur.createdBy)} · ${fmtDateTime(cur.createdAt)}`],
        ['Строк завершення', fmtDate(cur.dueDate)],
        ['Охоплення', (cur.scope.statuses || []).map(statusName).join(', ')],
        ['Позицій', String(cur.items.length)],
        ['Підтверджено', `${done} (${cur.items.length ? Math.round(done / cur.items.length * 100) : 0}%)`],
        ['Розбіжностей', String(disc)],
        ['Закрито', cur.closedAt ? `${fmtDateTime(cur.closedAt)} · ${userName(cur.closedBy)}` : null],
      ]));

      /* прогрес за відповідальними */
      const byMgr = new Map();
      for (const it of cur.items) {
        const eq = get('equipment', it.equipmentId);
        const k = eq?.responsibleManagerId || 'none';
        if (!byMgr.has(k)) byMgr.set(k, { total: 0, done: 0 });
        const s = byMgr.get(k);
        s.total++;
        if (it.status !== 'pending') s.done++;
      }
      body.append(el('div.section-title', { text: 'Прогрес за відповідальними менеджерами' }));
      for (const [k, s] of byMgr) {
        const row = el('div.bar-row');
        row.append(el('div.small', { text: k === 'none' ? 'Без відповідального' : userName(k) }));
        const track = el('div.bar-track');
        track.append(el('i', { style: `width:${(s.done / s.total) * 100}%;background:${s.done === s.total ? 'var(--green)' : 'var(--blue)'}` }));
        row.append(track, el('div.right.small', { text: `${s.done}/${s.total}` }));
        body.append(row);
      }

      body.append(el('div.row.gap8.mt24', {}, [
        actionBtn('Експорт результатів', 'download', () => exportInventory(cur), 'sm'),
      ]));
    },
    onClose: onChange,
  });
}

/* ==========================================================================
   Створення інвентаризації
   ========================================================================== */
async function openCreateForm(onDone) {
  const v = await formModal({
    title: 'Нова інвентаризація ТО',
    submitText: 'Створити',
    intro: alertBox('Менеджер із трейд-маркетингу формує реєстр ТО, відповідальні менеджери підтверджують місцезнаходження (п. 12.2–12.3).', 'info'),
    fields: [
      { name: 'name', label: 'Найменування', required: true, colspan: 2, value: `Річне підтвердження наявності ТО ${new Date().getFullYear()}` },
      { name: 'dueDate', label: 'Строк завершення', type: 'date', required: true, value: fmtDateInput(new Date(Date.now() + 30 * 864e5).toISOString()) },
      { name: 'scopeStatuses', label: 'Охоплення', type: 'select', placeholder: false, value: 'external', options: [
        { id: 'external', name: 'ТО у клієнтів та дистриб’юторів' },
        { id: 'all_active', name: 'Усе ТО, крім списаного' },
        { id: 'stock', name: 'Лише склад' },
      ] },
      { name: 'note', label: 'Примітка', type: 'textarea', colspan: 2 },
    ],
  });
  if (!v) return;
  const statusesMap = {
    external: ['at_client', 'at_distributor'],
    all_active: ['in_stock', 'in_transit', 'at_client', 'at_distributor', 'in_repair', 'returned'],
    stock: ['in_stock', 'returned'],
  };
  const inv = createInventory({
    name: v.name, dueDate: v.dueDate, note: v.note,
    scope: { statuses: statusesMap[v.scopeStatuses], managerIds: [] },
  }, currentUser());
  toast(`Створено інвентаризацію ${inv.number} (${inv.items.length} позицій)`, 'ok');
  onDone && onDone();
}

/* ==========================================================================
   Підтвердження позиції — мобільний сценарій
   ========================================================================== */
export async function confirmItem(inv, equipmentId, onDone) {
  const eq = get('equipment', equipmentId);
  if (!eq) return;
  const u = currentUser();
  const st = settings();

  let geo = null, photoIds = [], busy = false;

  const body = el('div');
  body.append(el('div.row.gap8.mb16', {}, [
    el('div', {}, [
      el('b.mono', { text: eq.invNumber, style: 'font-size:16px' }),
      el('div.small', { text: eq.name }),
      el('div.xs.muted', { text: `${holderLabel(eq)} · ${locationLabel(eq)}` }),
    ]),
    el('span.grow'),
    statusChip(eq.status),
  ]));

  /* --- геолокація --- */
  const geoBox = el('div', { style: 'border:1px solid var(--line);border-radius:10px;padding:11px;margin-bottom:12px' });
  const geoStatus = el('div.small.muted', { text: st.requireGeoOnInventory ? 'Геолокацію не визначено (обов’язково)' : 'Геолокацію не визначено' });
  const geoBtn = actionBtn('Визначити місцезнаходження', 'pin', async () => {
    geoBtn.disabled = true;
    geoStatus.textContent = 'Визначення координат…';
    try {
      geo = await getPosition();
      const expected = eq.outletId ? (get('outlets', eq.outletId) || {}).geo
        : eq.holderType === 'counterparty' ? (get('counterparties', eq.holderId) || {}).geo
          : eq.holderType === 'warehouse' ? (get('warehouses', eq.holderId) || {}).geo : null;
      const d = distanceM(geo, expected);
      geoStatus.innerHTML = '';
      geoStatus.append(el('div', { html: `<b>${geo.lat}, ${geo.lng}</b> · точність ±${geo.acc} м` }));
      if (d !== null) {
        const ok = d <= st.geoRadiusM;
        geoStatus.append(el('div.small', {
          text: ok ? `Відхилення від облікової адреси: ${d} м — у межах норми (${st.geoRadiusM} м)`
            : `Увага: відхилення від облікової адреси ${d} м перевищує норму ${st.geoRadiusM} м`,
          style: `color:${ok ? 'var(--green)' : 'var(--red)'};font-weight:600`,
        }));
        if (!ok) discCb.checked = true;
      }
      geoStatus.append(el('a.small', { href: mapLink(geo), target: '_blank', rel: 'noopener', text: 'Показати на карті' }));
    } catch (e) {
      geoStatus.textContent = e.message;
    }
    geoBtn.disabled = false;
  }, 'sm primary');
  geoBox.append(el('div.row.gap8', {}, [geoBtn]), geoStatus);
  body.append(el('div.section-title', { text: 'Геолокація' }), geoBox);

  /* --- фото --- */
  body.append(photoPicker([], (ids) => { photoIds = ids; }, {
    label: `Фотофіксація${st.requirePhotoOnInventory ? ' (обов’язково)' : ''}`, max: 4,
  }));

  /* --- спосіб і коментар --- */
  const method = el('select.select');
  for (const [id, name] of [['visit', 'Особистий огляд'], ['photo', 'Фотофіксація'], ['client', 'Підтвердження від клієнта / дистриб’ютора'], ['other', 'Інше']]) {
    method.append(el('option', { value: id, text: name }));
  }
  body.append(el('div.field.mt16', {}, [el('label', { text: 'Спосіб підтвердження (п. 12.3)' }), method]));

  const discCb = el('input', { type: 'checkbox' });
  body.append(el('label.checkline', {}, [discCb, el('span', { text: 'Зафіксувати розбіжність (ТО відсутнє, переміщене або пошкоджене)' })]));

  const discSelect = el('select.select.hidden');
  for (const [id, name] of [['missing', 'Обладнання відсутнє на місці'], ['moved', 'Переміщене до іншої точки'], ['damaged', 'Пошкоджене'], ['other', 'Інше']]) {
    discSelect.append(el('option', { value: id, text: name }));
  }
  discCb.addEventListener('change', () => discSelect.classList.toggle('hidden', !discCb.checked));
  body.append(discSelect);

  const comment = el('textarea.textarea.mt8', { rows: 2, placeholder: 'Коментар' });
  body.append(comment);

  const save = el('button.btn.primary', { type: 'button', text: 'Зберегти підтвердження' });
  const cancel = el('button.btn', { type: 'button', text: 'Скасувати' });
  const m = openModal({ title: 'Підтвердження наявності', body, footer: el('div.row.gap8', {}, [cancel, save]), closeOnScrim: false });
  cancel.addEventListener('click', () => m.close());

  save.addEventListener('click', () => {
    if (busy) return;
    if (st.requireGeoOnInventory && !geo && !discCb.checked) { toast('Визначте геолокацію або зафіксуйте розбіжність', 'err'); return; }
    if (st.requirePhotoOnInventory && !photoIds.length && !discCb.checked) { toast('Додайте щонайменше одне фото', 'err'); return; }
    busy = true;
    confirmInventoryItem(inv, equipmentId, u, {
      method: method.value,
      photoIds, geo,
      comment: comment.value.trim(),
      discrepancy: discCb.checked ? discSelect.options[discSelect.selectedIndex].text : null,
    });
    m.close();
    toast(discCb.checked ? 'Розбіжність зафіксовано' : 'Наявність підтверджено', 'ok');
    onDone && onDone();
  });
}

function showItem(inv, item) {
  const eq = get('equipment', item.equipmentId) || {};
  const body = el('div');
  body.append(dl([
    ['Обладнання', `${eq.invNumber} — ${eq.name}`],
    ['Стан', item.status === 'confirmed' ? 'Підтверджено' : 'Розбіжність'],
    ['Розбіжність', item.discrepancy || null],
    ['Підтвердив', item.userId ? `${userName(item.userId)} · ${fmtDateTime(item.confirmedAt)}` : null],
    ['Спосіб', { visit: 'Особистий огляд', photo: 'Фотофіксація', client: 'Підтвердження від клієнта', other: 'Інше' }[item.method] || item.method],
    ['Координати', item.geo ? el('a', { href: mapLink(item.geo), target: '_blank', rel: 'noopener', text: `${item.geo.lat}, ${item.geo.lng} (±${item.geo.acc} м)` }) : null],
    ['Коментар', item.comment || null],
  ]));
  if (item.photoIds && item.photoIds.length) body.append(photoPicker(item.photoIds, null, { label: 'Фотофіксація', readonly: true }));
  openModal({ title: 'Результат підтвердження', body, footer: null });
}

/* ==========================================================================
   Швидке сканування (кнопка на нижній панелі)
   ========================================================================== */
export async function quickScan(onDone) {
  const { openScanner, resolveCode } = await import('../scanner.js');
  const code = await openScanner({});
  if (!code) return;
  const eq = resolveCode(code, all('equipment'));
  if (!eq) {
    const v = await formModal({
      title: 'Обладнання не знайдено',
      submitText: 'Обрати вручну',
      size: 'slim',
      intro: alertBox(`Код «${code}» не відповідає жодному інвентарному або серійному номеру в реєстрі.`, 'warn', 'alert'),
      fields: [{
        name: 'equipmentId', label: 'Оберіть обладнання зі списку', type: 'select',
        options: all('equipment').map((e) => ({ id: e.id, name: `${e.invNumber} — ${e.name}` })),
      }],
    });
    if (!v || !v.equipmentId) return;
    return afterScan(get('equipment', v.equipmentId), onDone);
  }
  return afterScan(eq, onDone);
}

async function afterScan(eq, onDone) {
  const active = all('inventories').filter((i) => i.status === 'active');
  const inv = active.find((i) => i.items.some((it) => it.equipmentId === eq.id));
  if (inv && can('inventory.confirm')) {
    const item = inv.items.find((it) => it.equipmentId === eq.id);
    if (item.status !== 'pending') {
      const again = await confirmDialog({
        title: 'Уже підтверджено',
        text: `${eq.invNumber} вже підтверджено ${fmtDate(item.confirmedAt)} (${userName(item.userId)}). Підтвердити повторно?`,
        okText: 'Підтвердити повторно',
      });
      if (!again) { openEquipmentCard(eq.id, onDone); return; }
    }
    return confirmItem(inv, eq.id, onDone);
  }
  toast(`Знайдено: ${eq.invNumber}`, 'ok');
  openEquipmentCard(eq.id, onDone);
}

/* ---------- Експорт результатів ---------- */
function exportInventory(inv) {
  const rows = inv.items.map((i) => {
    const eq = get('equipment', i.equipmentId) || {};
    return [
      eq.invNumber || '', eq.serialNumber || '', eq.name || '', categoryName(eq.categoryId),
      statusName(eq.status), holderLabel(eq), locationLabel(eq),
      eq.responsibleManagerId ? userName(eq.responsibleManagerId) : '',
      i.status === 'confirmed' ? 'Підтверджено' : i.status === 'discrepancy' ? 'Розбіжність' : 'Не підтверджено',
      i.confirmedAt ? fmtDateTime(i.confirmedAt) : '',
      i.userId ? userName(i.userId) : '',
      i.geo ? `${i.geo.lat}, ${i.geo.lng}` : '',
      i.photoIds?.length ? `${i.photoIds.length} фото` : '',
      i.discrepancy || '', i.comment || '',
    ];
  });
  downloadFile(`${inv.number}_результати.csv`, toCSV(rows, [
    'Інв. номер', 'Серійний номер', 'Найменування', 'Категорія', 'Статус ТО', 'Утримувач', 'Адреса',
    'Відповідальний', 'Результат', 'Дата підтвердження', 'Підтвердив', 'Координати', 'Фото', 'Розбіжність', 'Коментар',
  ]), 'text/csv;charset=utf-8');
  toast('Результати експортовано', 'ok');
}
