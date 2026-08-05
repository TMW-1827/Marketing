/* ==========================================================================
   Сканер інвентарних номерів (камера пристрою).

   Використовує вбудований BarcodeDetector API (Android Chrome, Edge, десктоп
   Chrome). Там, де API недоступний (зокрема Safari на iOS), автоматично
   вмикається режим ручного введення номера — сам процес інвентаризації від
   цього не блокується. Якщо портал запаковано в нативну оболонку (Capacitor),
   тут достатньо підключити плагін ML Kit — точка розширення позначена нижче.
   ========================================================================== */

import { el, $ } from './util.js';
import { icon } from './icons.js';
import { toast } from './ui.js';

const FORMATS = ['code_39', 'code_128', 'qr_code', 'ean_13', 'ean_8', 'itf', 'codabar', 'data_matrix'];

export const scannerSupported = () => 'BarcodeDetector' in window;

/**
 * Відкриває повноекранний сканер.
 * @returns {Promise<string|null>} зчитаний код або null
 */
export async function openScanner({ title = 'Сканування інвентарного номера', hint = 'Наведіть камеру на штрих-код або QR-код етикетки' } = {}) {
  return new Promise(async (resolve) => {
    const shell = el('div.scan-shell');
    const video = el('video.scan-video', { playsinline: '', autoplay: '', muted: '' });
    video.muted = true;
    const frame = el('div.scan-frame');

    const closeBtn = el('button.scan-close', { type: 'button', title: 'Закрити', text: '×' });
    const top = el('div.scan-top', {}, [closeBtn, el('b', { text: title })]);
    const torchBtn = el('button.scan-close', { type: 'button', title: 'Ліхтарик', html: icon('flash') });
    torchBtn.classList.add('hidden');
    top.append(el('div.grow'), torchBtn);

    const hintEl = el('div.scan-hint', { text: hint });
    const manualWrap = el('div.row.gap8');
    const manualInput = el('input.input', {
      type: 'text', placeholder: 'Інвентарний номер, напр. ТО-000123',
      style: 'background:rgba(255,255,255,.94)', autocapitalize: 'characters',
    });
    const manualBtn = el('button.btn.primary', { type: 'button', text: 'ОК' });
    manualWrap.append(manualInput, manualBtn);
    const bottom = el('div.scan-bottom', {}, [hintEl, manualWrap]);

    shell.append(video, frame, top, bottom);
    document.body.append(shell);
    document.body.style.overflow = 'hidden';

    let stream = null, detector = null, timer = null, done = false;

    const finish = (code) => {
      if (done) return;
      done = true;
      clearInterval(timer);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      shell.remove();
      document.body.style.overflow = '';
      if (code && navigator.vibrate) navigator.vibrate(60);
      resolve(code || null);
    };

    closeBtn.addEventListener('click', () => finish(null));
    manualBtn.addEventListener('click', () => {
      const v = manualInput.value.trim();
      if (!v) { manualInput.focus(); return; }
      finish(v.toUpperCase());
    });
    manualInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') manualBtn.click(); });

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play().catch(() => { });

      // ліхтарик, якщо підтримується
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (caps.torch) {
        torchBtn.classList.remove('hidden');
        let on = false;
        torchBtn.addEventListener('click', async () => {
          on = !on;
          try { await track.applyConstraints({ advanced: [{ torch: on }] }); } catch { }
        });
      }
    } catch (e) {
      hintEl.textContent = 'Немає доступу до камери. Введіть інвентарний номер вручну.';
      frame.classList.add('hidden');
      manualInput.focus();
      return;
    }

    if (scannerSupported()) {
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const fmts = FORMATS.filter((f) => supported.includes(f));
        detector = new window.BarcodeDetector({ formats: fmts.length ? fmts : supported });
      } catch (e) { detector = null; }
    }

    if (!detector) {
      // ↓ Точка розширення для нативної оболонки (Capacitor + ML Kit)
      hintEl.textContent = 'Автоматичне розпізнавання недоступне у цьому браузері. Введіть номер вручну — фото та геолокацію буде збережено.';
      manualInput.focus();
      return;
    }

    timer = setInterval(async () => {
      if (done || video.readyState < 2) return;
      try {
        const codes = await detector.detect(video);
        if (codes && codes.length) {
          const val = String(codes[0].rawValue || '').trim();
          if (val) finish(val.toUpperCase());
        }
      } catch (e) { /* кадр пропускаємо */ }
    }, 260);
  });
}

/** Пошук обладнання за зчитаним кодом: інвентарний або серійний номер */
export function resolveCode(code, equipmentList) {
  if (!code) return null;
  const norm = String(code).trim().toUpperCase().replace(/\s+/g, '');
  const byInv = equipmentList.find((e) => (e.invNumber || '').toUpperCase().replace(/\s+/g, '') === norm);
  if (byInv) return byInv;
  const bySn = equipmentList.find((e) => (e.serialNumber || '').toUpperCase().replace(/\s+/g, '') === norm);
  if (bySn) return bySn;
  // допускаємо номер без префікса: «000123» → «ТО-000123»
  const digits = norm.replace(/\D/g, '');
  if (digits) {
    return equipmentList.find((e) => (e.invNumber || '').replace(/\D/g, '') === digits) || null;
  }
  return null;
}
