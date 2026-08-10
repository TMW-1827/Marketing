/* Інтерфейс зведення мотивацій.
 *
 * Уся обробка Excel відбувається просто у вкладці браузера: Pyodide
 * запускає той самий пакет `mc`, що й командний рядок. Жоден файл не
 * залишає комп'ютер — сервера тут немає взагалі, сторінка статична.
 */

const $ = s => document.querySelector(s);
const PY_MODULES = ['__init__', 'xlio', 'months', 'discover', 'blocks',
                    'promo', 'terms', 'config', 'rules', 'consolidated',
                    'service'];
const WORK = '/work';
const SITE = '/home/pyodide/site';
const CONS = WORK + '/zvedena.xlsx';

let py = null;
let FILES = [];      // картки розбору
let SOURCES = [];    // завантажені файли: {path, name}
let consLoaded = false;

const num = v => (v === null || v === undefined) ? '—'
  : new Intl.NumberFormat('uk-UA', {maximumFractionDigits: 2}).format(v);
const esc = s => String(s ?? '').replace(/[&<>]/g,
  c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c]));

/* ---------- запуск середовища ---------- */

function boot(pct, note) {
  $('#boot-bar').style.width = pct + '%';
  if (note) $('#boot-note').textContent = note;
}

async function start() {
  try {
    boot(10, 'завантажую Python…');
    // ?pyodide=<адреса> дає змогу працювати з локальною копією середовища
    const local = new URLSearchParams(location.search).get('pyodide');
    py = await loadPyodide(local ? {indexURL: local} : {});

    boot(45, 'розпаковую бібліотеки для Excel…');
    await loadVendor();

    boot(70, 'підключаю модулі перевірки…');
    await loadPackage();

    boot(90, 'готую робочу теку…');
    py.FS.mkdirTree(WORK + '/uploads');
    await py.runPythonAsync(BRIDGE);

    boot(100, 'готово');
    $('#boot').classList.add('hide');
    $('#step-cons').classList.remove('hide');
    $('#step-files').classList.remove('hide');
    $('#state').textContent = 'зведену не завантажено';
    renderCons();
  } catch (err) {
    boot(100, '');
    $('#boot-state').innerHTML =
      `<p><b>Не вдалося запустити середовище.</b></p>
       <pre>${esc(err)}</pre>
       <p class="muted">Найчастіша причина — немає доступу до інтернету:
       середовище Python тягнеться з cdn.jsdelivr.net. Перевір мережу
       і онови сторінку.</p>`;
  }
}

/* Бібліотеки лежать поруч одним архівом, а не тягнуться з PyPI:
   сторінка не має залежати ні від мережі, ні від того, яка версія
   опиниться на PyPI сьогодні. */
async function loadVendor() {
  const r = await fetch('vendor/pylibs.zip');
  if (!r.ok) throw new Error('не завантажився vendor/pylibs.zip');
  py.FS.mkdirTree(SITE);
  py.FS.writeFile('/tmp/pylibs.zip', new Uint8Array(await r.arrayBuffer()));
  await py.runPythonAsync(`
import sys, zipfile
with zipfile.ZipFile("/tmp/pylibs.zip") as z:
    z.extractall("${SITE}")
sys.path.insert(0, "${SITE}")
`);
}

async function loadPackage() {
  // модулі пакета лежать поруч у репозиторії — забираємо їх у віртуальну ФС
  py.FS.mkdirTree('/home/pyodide/mc');
  py.FS.mkdirTree('/home/pyodide/config');
  const sources = await Promise.all(PY_MODULES.map(async name => {
    const r = await fetch(`../mc/${name}.py`);
    if (!r.ok) throw new Error(`не завантажився модуль ${name}.py`);
    return [name, await r.text()];
  }));
  for (const [name, code] of sources) {
    py.FS.writeFile(`/home/pyodide/mc/${name}.py`, code);
  }
  const cfg = await fetch('../config/distributors.yaml');
  if (!cfg.ok) throw new Error('не завантажився config/distributors.yaml');
  py.FS.writeFile('/home/pyodide/config/distributors.yaml', await cfg.text());
}

/* Тонкий місток: JSON усередину, JSON назовні. */
const BRIDGE = `
import json, sys
sys.path.insert(0, "/home/pyodide")
from mc import service

def mc_call(name, payload):
    args = json.loads(payload)
    result = getattr(service, name)(*args)
    return json.dumps(result, ensure_ascii=False, default=str)
`;

async function call(name, ...args) {
  const fn = py.globals.get('mc_call');
  try {
    return JSON.parse(fn(name, JSON.stringify(args)));
  } finally {
    fn.destroy();
  }
}

/* ---------- зведена ---------- */

function renderCons(info) {
  if (info) {
    $('#cons-state').innerHTML = `
      <p style="margin:0 0 10px">Зведену завантажено: <b>${info.months}</b>
      місяців, останній — <b>${esc(info.last_month)}</b>,
      <b>${info.distributors.length}</b> дистриб'юторів.</p>
      <button class="ghost" id="btn-recons">Замінити зведену</button>`;
    $('#state').textContent = 'останній місяць: ' + info.last_month;
    $('#btn-download').disabled = false;
  } else {
    $('#cons-state').innerHTML = `
      <p style="margin:0 0 10px">Завантаж файл зведеної таблиці — у нього
      система дописуватиме нові місяці. Файл лишається у цій вкладці,
      нікуди не надсилається.</p>
      <button class="primary" id="btn-cons">Обрати файл зведеної</button>`;
  }
  const btn = $('#btn-recons') || $('#btn-cons');
  if (btn) btn.onclick = pickConsolidated;
}

function pickConsolidated() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.xlsx,.xlsm';
  inp.onchange = async () => {
    const file = inp.files[0];
    if (!file) return;
    try {
      py.FS.writeFile(CONS, new Uint8Array(await file.arrayBuffer()));
      const info = await call('consolidated_info', CONS);
      consLoaded = true;
      renderCons(info);
      if (FILES.length) await reanalyse();
    } catch (err) {
      alert('Не вдалося прочитати зведену:\n' + err);
    }
  };
  inp.click();
}

/* ---------- файли дистриб'юторів ---------- */

async function handleFiles(list) {
  if (!consLoaded) {
    alert('Спершу завантаж зведену таблицю — без неї нема з чим звіряти.');
    return;
  }
  const files = Array.from(list).filter(f => /\.(xls|xlsx|xlsm)$/i.test(f.name));
  if (!files.length) return;

  $('#drop').classList.add('busy');
  const queue = $('#queue');
  for (const file of files) {
    const size = (file.size / 1048576).toFixed(1);
    queue.innerHTML = `<div class="qrow"><span class="spin"></span>
      читаю «${esc(file.name)}» (${size} МБ)…</div>`;
    // даємо браузеру перемалювати рядок черги перед важким розбором
    await new Promise(r => setTimeout(r, 30));
    const path = `${WORK}/uploads/${Date.now()}_${file.name}`;
    py.FS.writeFile(path, new Uint8Array(await file.arrayBuffer()));
    SOURCES.push({path, name: file.name});
    const cards = await call('safe_analyse', path, file.name, CONS);
    FILES = FILES.concat(cards);
    render();
  }
  queue.innerHTML = '';
  $('#drop').classList.remove('busy');
}

async function reanalyse() {
  // після заміни зведеної старий розбір уже не дійсний
  FILES = [];
  for (const src of SOURCES) {
    FILES = FILES.concat(await call('safe_analyse', src.path, src.name, CONS));
  }
  render();
}

/* ---------- показ ---------- */

const statusOf = f => (f.fatal || !f.ok) ? 'err'
  : (f.counts && f.counts.warn ? 'warn' : 'ok');

const blockRow = b => `<tr>
  <td>${esc(b.metric_label)} <span class="muted">(${esc(b.unit)})</span></td>
  <td>${num(b.plan)}</td><td>${num(b.fact)}</td>
  <td>${num(b.bonus_plan)}</td><td>${num(b.bonus_fact)}</td></tr>`;

function termsBlock(b) {
  const t = b.terms;
  if (!t) return '';
  if (!t.parsed) {
    return `<div class="note INFO"><span class="mark">·</span>
      <span>Мотивацію не звірено з умовами: ${esc(t.summary)}</span></div>`;
  }
  if (!t.rows.length) {
    return `<div class="note INFO"><span class="mark">✓</span>
      <span>Мотивація ${esc(b.metric_label)}: ${esc(t.summary)}</span></div>`;
  }
  const rows = t.rows.map(r => `<tr class="warnrow"><td>${esc(r.label)}</td>
    <td>${esc(r.role)}</td><td>${num(r.fact)}</td>
    <td>${num(r.actual)}</td><td>${num(r.expected)}</td></tr>`).join('');
  return `<details open><summary>Мотивація ${esc(b.metric_label)}:
    ${esc(t.summary)}</summary>
    <table><thead><tr><th>Рядок</th><th>Роль</th><th>Факт</th>
    <th>У файлі</th><th>За умовами</th></tr></thead>
    <tbody>${rows}</tbody></table></details>`;
}

function render() {
  const host = $('#files');
  if (!FILES.length) {
    host.innerHTML = '';
    $('#bar').classList.add('hide');
    return;
  }
  host.innerHTML = FILES.map((f, i) => {
    if (f.fatal) {
      return `<div class="file err"><div class="file-head">
        <div style="flex:1"><div class="file-name">${esc(f.filename)}</div>
        <div class="file-sub">${esc(f.fatal)}</div></div></div>
        ${f.trace ? `<div class="file-body"><pre>${esc(f.trace)}</pre></div>` : ''}
        </div>`;
    }
    const st = statusOf(f);
    const label = st === 'ok' ? 'готово'
                : st === 'warn' ? 'є попередження' : 'потребує виправлення';
    const notes = f.findings.map(n => `<div class="note ${n.level}">
      <span class="mark">${n.level === 'ERROR' ? '✗'
                        : n.level === 'WARN' ? '!' : '·'}</span>
      <span>${esc(n.message)}${n.where ? ` <code>${esc(n.where)}</code>` : ''}</span>
      </div>`).join('');
    return `<div class="file ${st}">
      <div class="file-head">
        <div style="flex:1">
          <div class="file-name">${esc(f.consolidated_name || f.distributor)}</div>
          <div class="file-sub">${esc(f.period_label)} · ${esc(f.kind)} ·
            ${esc(f.filename)}</div>
        </div>
        ${f.new_month ? '<span class="pill new">новий місяць</span>' : ''}
        <span class="pill ${st}">${label}</span>
      </div>
      <div class="file-body">
        <table><thead><tr><th>Показник</th><th>План</th><th>Факт</th>
          <th>Бонус план</th><th>Бонус факт</th></tr></thead>
          <tbody>${f.blocks.map(blockRow).join('')}</tbody></table>
        ${f.blocks.map(termsBlock).join('')}
        ${notes}
      </div></div>`;
  }).join('');

  const ready = FILES.filter(f => !f.fatal && f.ok);
  $('#bar').classList.remove('hide');
  $('#summary').textContent = `Карток: ${FILES.length} · готових: ${ready.length}`
    + (FILES.length - ready.length
       ? ` · потребують виправлення: ${FILES.length - ready.length}` : '');
  $('#btn-apply').disabled = !ready.length;
  $('#btn-apply').textContent = `Внести у зведену (${ready.length})`;
}

/* ---------- підтвердження і запис ---------- */

async function openConfirm() {
  const ready = FILES.filter(f => !f.fatal && f.ok);
  const p = await call('preview', ready, CONS);
  const rows = p.rows.map(r => `<tr><td>${esc(r.distributor)}</td>
    <td>${esc(r.metric)}</td><td>${esc(r.period)}</td><td>${num(r.plan)}</td>
    <td>${num(r.fact)}</td><td>${num(r.bonus_plan)}</td>
    <td>${num(r.bonus_fact)}</td></tr>`).join('');
  const banner = p.new_months.length ? `<div class="banner">
    Це перший підтверджений файл із планом на новий місяць. Разом із записом
    система:<ul style="margin:8px 0 0 18px">
      ${p.closing ? `<li>закриє <b>${esc(p.closing)}</b> — додасть колонки
        факту, бонусу факту і затратності</li>` : ''}
      <li>створить заготовку нового місяця</li>
      <li>перенесе умови акцій із планового аркуша</li>
    </ul></div>` : '';

  $('#modal-body').innerHTML = `
    <h2>Підтвердження запису</h2>
    <p class="muted">Перевір, що саме буде записано у зведену.</p>
    ${banner}
    <table><thead><tr><th>Дистриб'ютор</th><th>Показник</th><th>Місяць</th>
      <th>План</th><th>Факт</th><th>Бонус план</th><th>Бонус факт</th></tr>
      </thead><tbody>${rows}</tbody></table>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">
      <button class="ghost" id="m-cancel">Скасувати</button>
      <button class="primary" id="m-ok">Так, внести</button>
    </div>`;
  $('#modal').classList.add('show');
  $('#m-cancel').onclick = () => $('#modal').classList.remove('show');
  $('#m-ok').onclick = () => doApply(ready);
}

async function doApply(ready) {
  $('#m-ok').disabled = true;
  $('#m-ok').textContent = 'Записую…';
  try {
    const r = await call('apply_cards', ready, CONS, $('#fixtotals').checked);
    const rows = r.applied.map(a => `<tr><td>${esc(a.name)}</td>
      <td>${esc(a.metric)}</td><td>${esc(a.period)}</td>
      <td class="muted">${esc(a.cells.join(', '))}</td></tr>`).join('');
    $('#modal-body').innerHTML = `
      <h2>Готово</h2>
      <p>Записано рядків: <b>${r.applied.length}</b>. Не забудь завантажити
         оновлений файл — він живе лише в цій вкладці.</p>
      <table><thead><tr><th>Дистриб'ютор</th><th>Показник</th><th>Місяць</th>
        <th>Клітинки</th></tr></thead><tbody>${rows}</tbody></table>
      ${r.dropped.length ? `<div class="banner">При закритті місяця втрачено:
        <ul style="margin:8px 0 0 18px">${r.dropped.map(d =>
          `<li>${esc(d)}</li>`).join('')}</ul></div>` : ''}
      ${r.fixed.length ? `<details><summary>Полагоджено діапазонів «Сума»:
        ${r.fixed.length}</summary><pre>${esc(r.fixed.join('\n'))}</pre>
        </details>` : ''}
      ${r.skipped.length ? `<div class="banner">Пропущено: ${
        esc(r.skipped.map(s => `${s.name} — ${s.reason}`).join('; '))}</div>` : ''}
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">
        <button class="ghost" id="m-close">Закрити</button>
        <button class="primary" id="m-dl">Завантажити зведену</button>
      </div>`;
    const applied = new Set(r.applied.map(a => a.name + '|' + a.period));
    $('#m-close').onclick = async () => {
      $('#modal').classList.remove('show');
      FILES = FILES.filter(f => !applied.has(
        f.consolidated_name + '|' + f.period_label));
      render();
      renderCons(await call('consolidated_info', CONS));
    };
    $('#m-dl').onclick = download;
  } catch (err) {
    alert('Помилка запису:\n' + err);
    $('#m-ok').disabled = false;
    $('#m-ok').textContent = 'Так, внести';
  }
}

function download() {
  const data = py.FS.readFile(CONS);
  const blob = new Blob([data], {type:
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Зведена таблиця мотивацій.xlsx';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ---------- події ---------- */

$('#drop').onclick = () => $('#picker').click();
$('#picker').onchange = e => { handleFiles(e.target.files); e.target.value = ''; };
['dragenter', 'dragover'].forEach(ev =>
  $('#drop').addEventListener(ev, e => {
    e.preventDefault(); $('#drop').classList.add('over'); }));
['dragleave', 'drop'].forEach(ev =>
  $('#drop').addEventListener(ev, e => {
    e.preventDefault(); $('#drop').classList.remove('over'); }));
$('#drop').addEventListener('drop', e => handleFiles(e.dataTransfer.files));
$('#btn-apply').onclick = openConfirm;
$('#btn-download').onclick = download;
$('#btn-clear').onclick = () => { FILES = []; SOURCES = []; render(); };
$('#modal').onclick = e => {
  if (e.target === $('#modal')) $('#modal').classList.remove('show'); };

start();
