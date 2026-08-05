/* ==========================================================================
   Базові UI-компоненти: сповіщення, модальні вікна, форми, таблиці, фото.
   ========================================================================== */

import { el, $, $$, esc, readImageCompressed, isMobile } from './util.js';
import { icon } from './icons.js';
import { statusById, photos } from './store.js';

/* ---------- Toast ---------- */
export function toast(msg, type = '') {
  let wrap = $('.toast-wrap');
  if (!wrap) { wrap = el('div.toast-wrap'); document.body.append(wrap); }
  const t = el('div.toast' + (type ? '.' + type : ''), { text: msg });
  wrap.append(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, 3000);
}

/* ---------- Модальні вікна ---------- */
export function openModal({ title, body, footer, size = '', onClose, closeOnScrim = true }) {
  const scrim = el('div.scrim');
  const modal = el('div.modal' + (size ? '.' + size : ''));
  const head = el('div.modal-head', {}, [el('h3', { text: title || '' })]);
  const closeBtn = el('button.btn-icon', { type: 'button', title: 'Закрити', html: icon('x') });
  head.append(closeBtn);
  const bodyEl = el('div.modal-body');
  if (body) bodyEl.append(body);
  modal.append(head, bodyEl);
  let footEl = null;
  if (footer) { footEl = el('div.modal-foot'); footEl.append(footer); modal.append(footEl); }
  scrim.append(modal);
  document.body.append(scrim);
  document.body.style.overflow = 'hidden';

  const close = () => {
    scrim.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    onClose && onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  closeBtn.addEventListener('click', close);
  if (closeOnScrim) scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });

  setTimeout(() => { const f = modal.querySelector('input,select,textarea,button.primary'); if (f && !isMobile()) f.focus(); }, 60);
  return { close, scrim, modal, body: bodyEl, foot: footEl };
}

export function confirmDialog({ title = 'Підтвердження', text = '', okText = 'Підтвердити', cancelText = 'Скасувати', danger = false }) {
  return new Promise((resolve) => {
    let settled = false;
    const body = el('div', {}, [el('p', { text })]);
    const ok = el('button.btn' + (danger ? '.danger' : '.primary'), { type: 'button', text: okText });
    const cancel = el('button.btn', { type: 'button', text: cancelText });
    const foot = el('div.row.gap8', {}, [cancel, ok]);
    const m = openModal({ title, body, footer: foot, size: 'slim', onClose: () => { if (!settled) resolve(false); } });
    ok.addEventListener('click', () => { settled = true; m.close(); resolve(true); });
    cancel.addEventListener('click', () => m.close());
  });
}

/* ---------- Побудова полів форми ---------- */
export function buildField(f, value) {
  const id = 'f_' + f.name;
  const wrap = el('div.field', { style: f.colspan === 2 ? 'grid-column:1/-1' : null });
  if (f.type !== 'checkbox') {
    wrap.append(el('label' + (f.required ? '.req' : ''), { for: id, text: f.label }));
  }
  let input;
  const v = value !== undefined && value !== null ? value : (f.value ?? '');

  switch (f.type) {
    case 'textarea':
      input = el('textarea.textarea', { id, name: f.name, rows: f.rows || 3, placeholder: f.placeholder || '' });
      input.value = v;
      break;
    case 'select': {
      input = el('select.select', { id, name: f.name });
      const opts = typeof f.options === 'function' ? f.options() : (f.options || []);
      if (f.placeholder !== false) input.append(el('option', { value: '', text: f.placeholder || '— оберіть —' }));
      for (const o of opts) {
        const val = o.value ?? o.id;
        const lbl = o.label ?? o.name;
        const opt = el('option', { value: val, text: lbl });
        if (String(val) === String(v)) opt.selected = true;
        input.append(opt);
      }
      break;
    }
    case 'checkbox': {
      input = el('input', { type: 'checkbox', id, name: f.name });
      input.checked = !!v;
      const line = el('label.checkline', {}, [input, el('span', { text: f.label })]);
      wrap.append(line);
      if (f.hint) wrap.append(el('div.hint', { text: f.hint }));
      wrap._input = input;
      return wrap;
    }
    case 'number':
      input = el('input.input', { type: 'number', id, name: f.name, step: f.step || 'any', min: f.min, max: f.max, placeholder: f.placeholder || '' });
      input.value = v;
      break;
    case 'date':
      input = el('input.input', { type: 'date', id, name: f.name });
      input.value = v ? String(v).slice(0, 10) : '';
      break;
    case 'static':
      input = el('div.input', { text: v || '—', style: 'background:var(--paper);color:var(--ink-soft)' });
      break;
    default:
      input = el('input.input', { type: f.type || 'text', id, name: f.name, placeholder: f.placeholder || '', maxlength: f.maxlength });
      input.value = v;
  }
  if (f.readonly) input.setAttribute('readonly', '');
  if (f.disabled) input.setAttribute('disabled', '');
  wrap.append(input);
  if (f.hint) wrap.append(el('div.hint', { text: f.hint }));
  wrap._input = input;
  return wrap;
}

/**
 * Універсальна модальна форма.
 * fields: [{name,label,type,options,required,hint,value,colspan,validate}]
 * Повертає Promise<values|null>
 */
export function formModal({ title, fields, values = {}, submitText = 'Зберегти', size = '', intro = null, onRender = null, validate = null }) {
  return new Promise((resolve) => {
    let settled = false;
    const form = el('form', { autocomplete: 'off' });
    if (intro) form.append(intro);
    const grid = el('div', { style: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px' });
    if (isMobile()) grid.style.gridTemplateColumns = '1fr';
    const inputs = {};
    for (const f of fields) {
      if (f.type === 'divider') {
        grid.append(el('div.section-title', { text: f.label, style: 'grid-column:1/-1' }));
        continue;
      }
      const w = buildField(f, values[f.name]);
      inputs[f.name] = w._input;
      grid.append(w);
    }
    form.append(grid);
    const errBox = el('div.alert.err.hidden');
    form.append(errBox);

    const submit = el('button.btn.primary', { type: 'button', text: submitText });
    const cancel = el('button.btn', { type: 'button', text: 'Скасувати' });
    const foot = el('div.row.gap8', {}, [cancel, submit]);

    const m = openModal({ title, body: form, footer: foot, size, onClose: () => { if (!settled) resolve(null); }, closeOnScrim: false });
    cancel.addEventListener('click', () => m.close());
    /* кнопка підтвердження розміщена у футері модального вікна — поза <form>,
       тому надсилання форми ініціюємо явно */
    const doSubmit = () => form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    submit.addEventListener('click', doSubmit);
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); doSubmit(); }
    });
    onRender && onRender(inputs, form, m);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const out = {};
      for (const f of fields) {
        if (f.type === 'divider' || f.type === 'static') continue;
        const inp = inputs[f.name];
        out[f.name] = f.type === 'checkbox' ? inp.checked
          : f.type === 'number' ? (inp.value === '' ? null : Number(inp.value))
            : inp.value.trim ? inp.value.trim() : inp.value;
      }
      const missing = fields.filter((f) => f.required && (out[f.name] === '' || out[f.name] === null || out[f.name] === undefined));
      if (missing.length) {
        errBox.textContent = 'Заповніть обов’язкові поля: ' + missing.map((f) => f.label).join(', ');
        errBox.classList.remove('hidden');
        return;
      }
      if (validate) {
        const msg = validate(out, inputs);
        if (msg) { errBox.textContent = msg; errBox.classList.remove('hidden'); return; }
      }
      settled = true;
      m.close();
      resolve(out);
    });
  });
}

/* ---------- Бічна панель (деталі) ---------- */
export function openDrawer({ title, render, onClose }) {
  const scrim = el('div.drawer-scrim');
  const drawer = el('div.drawer');
  const head = el('div.modal-head', {}, [el('h3', { text: title })]);
  const closeBtn = el('button.btn-icon', { type: 'button', html: icon('x'), title: 'Закрити' });
  head.append(closeBtn);
  const body = el('div.modal-body');
  drawer.append(head, body);
  scrim.append(drawer);
  document.body.append(scrim);
  document.body.style.overflow = 'hidden';

  const close = () => {
    scrim.remove(); document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    onClose && onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  closeBtn.addEventListener('click', close);
  scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });

  const api = {
    close, body, head,
    setTitle: (t) => { head.querySelector('h3').textContent = t; },
    refresh: () => { body.innerHTML = ''; render(body, api); },
  };
  render(body, api);
  return api;
}

/* ---------- Чіп статусу ---------- */
export function statusChip(statusId) {
  const s = statusById(statusId);
  return el('span.chip.' + (s.color || 'grey'), {}, [el('i.dot'), s.name]);
}
export function chip(text, color = 'grey') {
  return el('span.chip.' + color, { text });
}

/* ---------- Таблиця ---------- */
/**
 * columns: [{key,label,render(row),width,cls,sortable,sortValue(row),hideMobile,main}]
 */
export function dataTable({ columns, rows, onRow, empty = 'Немає записів', cards = true, footer = null }) {
  const wrap = el('div.card.list-card');
  const inner = el('div.card-body.tight');
  if (!rows.length) {
    inner.append(el('div.empty', {}, [
      el('div', { html: icon('inbox') }),
      el('b', { text: empty }),
      el('div.small', { text: 'Спробуйте змінити параметри фільтра.' }),
    ]));
    wrap.append(inner);
    return wrap;
  }
  const scroll = el('div.tbl-wrap');
  const table = el('table.tbl' + (cards ? '.cards' : ''));
  const thead = el('thead');
  const trh = el('tr');
  for (const c of columns) {
    if (c.hideMobile && isMobile()) continue;
    trh.append(el('th', { style: c.width ? `width:${c.width}` : null, text: c.label }));
  }
  thead.append(trh);
  const tbody = el('tbody');
  for (const r of rows) {
    const tr = el('tr' + (onRow ? '.clickable' : ''));
    for (const c of columns) {
      if (c.hideMobile && isMobile()) continue;
      const td = el('td' + (c.main ? '.tmain' : '') + (c.cls ? '.' + c.cls : ''), { 'data-l': c.label });
      const v = c.render ? c.render(r) : r[c.key];
      if (v === null || v === undefined) td.textContent = '—';
      else if (v.nodeType) td.append(v);
      else td.textContent = String(v);
      tr.append(td);
    }
    if (onRow) tr.addEventListener('click', (e) => {
      if (e.target.closest('button,a,input,select')) return;
      onRow(r);
    });
    tbody.append(tr);
  }
  table.append(thead, tbody);
  scroll.append(table);
  inner.append(scroll);
  wrap.append(inner);
  if (footer) wrap.append(el('div.tbl-foot', {}, [footer]));
  return wrap;
}

/* ---------- Опис (dl) ---------- */
export function dl(pairs) {
  const d = el('dl.dl');
  for (const [k, v] of pairs) {
    if (v === undefined) continue;
    d.append(el('dt', { text: k }));
    const dd = el('dd');
    if (v === null) dd.textContent = '—';
    else if (v.nodeType) dd.append(v);
    else dd.textContent = String(v);
    d.append(dd);
  }
  return d;
}

/* ---------- Фотографії ---------- */
export function lightbox(dataUrl) {
  const scrim = el('div.scrim', { style: 'background:rgba(0,0,0,.85)' });
  const img = el('img', { src: dataUrl, style: 'max-width:96vw;max-height:92dvh;border-radius:10px' });
  scrim.append(img);
  scrim.addEventListener('click', () => { scrim.remove(); document.body.style.overflow = ''; });
  document.body.append(scrim);
  document.body.style.overflow = 'hidden';
}

/**
 * Компонент завантаження фото. ids — масив id у IndexedDB; onChange(ids).
 * На мобільному відкриває камеру (capture="environment").
 */
export function photoPicker(ids = [], onChange, { label = 'Фотографії', max = 8, readonly = false } = {}) {
  const wrap = el('div');
  wrap.append(el('div.section-title', { text: label }));
  const grid = el('div.photo-grid');
  const list = [...ids];

  const render = async () => {
    grid.innerHTML = '';
    for (const id of list) {
      const rec = await photos.get(id);
      const cell = el('div.ph');
      if (rec) {
        const img = el('img', { src: rec.dataUrl, alt: 'Фото обладнання', loading: 'lazy' });
        img.addEventListener('click', () => lightbox(rec.dataUrl));
        cell.append(img);
      } else {
        cell.append(el('div.center.xs.muted', { text: 'Фото недоступне', style: 'padding:12px' }));
      }
      if (!readonly) {
        const rm = el('button.rm', { type: 'button', title: 'Видалити', text: '×' });
        rm.addEventListener('click', async () => {
          await photos.del(id);
          list.splice(list.indexOf(id), 1);
          onChange && onChange([...list]);
          render();
        });
        cell.append(rm);
      }
      grid.append(cell);
    }
    if (!readonly && list.length < max) {
      const add = el('label.ph', { style: 'display:grid;place-items:center;cursor:pointer;border-style:dashed' });
      add.innerHTML = `<div style="text-align:center;color:var(--ink-mute);font-size:11.5px">
        <div style="width:22px;height:22px;margin:0 auto 4px">${icon('camera')}</div>Додати</div>`;
      const inp = el('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none' });
      if (isMobile()) inp.setAttribute('capture', 'environment');
      inp.addEventListener('change', async () => {
        for (const f of Array.from(inp.files).slice(0, max - list.length)) {
          try {
            const durl = await readImageCompressed(f);
            const id = await photos.put(durl, { name: f.name });
            list.push(id);
          } catch (e) { toast('Не вдалося обробити фото', 'err'); }
        }
        inp.value = '';
        onChange && onChange([...list]);
        render();
      });
      add.append(inp);
      grid.append(add);
    }
    if (readonly && !list.length) {
      grid.append(el('div.small.muted', { text: 'Фотографії не додано' }));
    }
  };
  render();
  wrap.append(grid);
  return wrap;
}

/* ---------- Різне ---------- */
export function pageHead(title, desc, actions = []) {
  const h = el('div.page-head');
  const left = el('div');
  left.append(el('h1', { text: title }));
  if (desc) left.append(el('div.desc', { text: desc }));
  h.append(left);
  if (actions.length) {
    const a = el('div.page-actions');
    actions.filter(Boolean).forEach((x) => a.append(x));
    h.append(a);
  }
  return h;
}

export function actionBtn(label, iconName, onClick, cls = '') {
  const b = el('button.btn' + (cls ? '.' + cls : ''), { type: 'button' });
  if (iconName) b.innerHTML = icon(iconName);
  b.append(document.createTextNode(label));
  b.addEventListener('click', onClick);
  return b;
}

export function alertBox(text, type = 'info', iconName = 'info') {
  const a = el('div.alert.' + type);
  a.innerHTML = icon(iconName);
  a.append(el('div', { text }));
  return a;
}

export function searchInput(placeholder, onInput, value = '') {
  const wrap = el('div.search');
  wrap.innerHTML = icon('search');
  const inp = el('input', { type: 'search', placeholder, value });
  inp.addEventListener('input', () => onInput(inp.value));
  wrap.append(inp);
  return wrap;
}

export function selectFilter(label, options, value, onChange) {
  const s = el('select.select');
  s.append(el('option', { value: '', text: label }));
  for (const o of options) {
    const opt = el('option', { value: o.value ?? o.id, text: o.label ?? o.name });
    if (String(o.value ?? o.id) === String(value)) opt.selected = true;
    s.append(opt);
  }
  s.addEventListener('change', () => onChange(s.value));
  return s;
}

export function tabs(items, active, onSwitch) {
  const wrap = el('div.pill-tabs');
  for (const it of items) {
    const b = el('button' + (it.id === active ? '.active' : ''), { type: 'button', text: it.label });
    b.addEventListener('click', () => onSwitch(it.id));
    wrap.append(b);
  }
  return wrap;
}

export function stepper(steps, currentIdx) {
  const w = el('div.stepper');
  steps.forEach((s, i) => {
    const cls = i < currentIdx ? '.done' : i === currentIdx ? '.active' : '';
    w.append(el('div.st' + cls, {}, [el('b', { text: String(i + 1) }), s]));
  });
  return w;
}
