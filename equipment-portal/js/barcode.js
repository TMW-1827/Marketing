/* ==========================================================================
   Генерація штрих-коду Code 39 (SVG) для друку етикеток з інвентарним
   номером. Code 39 обрано тому, що він читається вбудованим BarcodeDetector
   у мобільних браузерах і не потребує контрольної суми.
   ========================================================================== */

const CODE39 = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw', 'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw', 'E': 'wnnnwwnnn',
  'F': 'nnwnwwnnn', 'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn', 'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn',
  'K': 'wnnnnnnww', 'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww', 'O': 'wnnnwnnwn',
  'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn', 'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn',
  'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw', 'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn',
  'Z': 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn',
  '$': 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn',
};

/** Нормалізує рядок до символів, підтримуваних Code 39 */
export function normalizeCode39(text) {
  return String(text).toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, '-');
}

/**
 * Повертає SVG-рядок штрих-коду.
 * @param {string} text інвентарний номер
 */
export function code39SVG(text, { height = 46, narrow = 2, wide = 5, quiet = 10, showText = true } = {}) {
  const data = '*' + normalizeCode39(text) + '*';
  const bars = [];
  let x = quiet;
  for (let i = 0; i < data.length; i++) {
    const pat = CODE39[data[i]];
    if (!pat) continue;
    for (let j = 0; j < pat.length; j++) {
      const w = pat[j] === 'w' ? wide : narrow;
      if (j % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${w}" height="${height}"/>`);
      x += w;
    }
    x += narrow; // міжсимвольний проміжок
  }
  const total = x + quiet;
  const th = showText ? 16 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${height + th}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Штрих-код ${text}">
  <rect width="${total}" height="${height + th}" fill="#fff"/>
  <g fill="#000">${bars.join('')}</g>
  ${showText ? `<text x="${total / 2}" y="${height + 13}" text-anchor="middle" font-family="monospace" font-size="13" fill="#000">${text}</text>` : ''}
</svg>`;
}

/** HTML сторінки з етикетками для друку */
export function labelsHTML(items, { companyName = '' } = {}) {
  const cells = items.map((it) => `
    <div class="lbl">
      <div class="co">${companyName}</div>
      <div class="nm">${it.name || ''}</div>
      <div class="bc">${code39SVG(it.invNumber, { height: 40 })}</div>
      ${it.serialNumber ? `<div class="sn">S/N: ${it.serialNumber}</div>` : ''}
    </div>`).join('');
  return `<!doctype html><html lang="uk"><head><meta charset="utf-8">
<title>Етикетки ТО</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:8mm;font-family:Arial,Helvetica,sans-serif;background:#fff}
  .wrap{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
  .lbl{border:1px dashed #999;border-radius:2mm;padding:3mm;text-align:center;break-inside:avoid}
  .co{font-size:8pt;color:#555;text-transform:uppercase;letter-spacing:.06em}
  .nm{font-size:9pt;font-weight:700;margin:1mm 0;min-height:9mm;line-height:1.15}
  .sn{font-size:7.5pt;color:#444;margin-top:1mm}
  .bc svg{width:100%;height:auto}
  @media print{body{padding:6mm}.lbl{border-color:#ccc}}
</style></head><body>
<div class="wrap">${cells}</div>
<script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script>
</body></html>`;
}
