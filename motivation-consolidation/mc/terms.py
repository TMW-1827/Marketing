"""Розбір умов мотивації, записаних текстом під таблицею.

Умови формулюються вільною мовою і зводяться до кількох сталих граматик:

* ставка за одиницю зі сходинками виконання
  «тп - 0,7 грн/пл., СВ 0,2 грн/пл. при виконанні 100%, від 70% до 99% —
  бонус 50%, до 70% — бонус не виплачується; від 120% — тп - 0,8 грн/пл.»
* фіксована сума зі сходинками
  «тп - 1800, св 2500, нтв 2500 при виконанні на 96% і більше; при
  виконані 80-95 % - тп - 900, св 1000; до 80% бонус не нараховується»
* сходинки, розписані окремо на кожну роль
  «_ТП_ при виконанні від 85 % - 90% - 2500 грн, 91% - 99% - 3000 грн»
* «отримує бонус X грн за виконання плану на 100 %, або Y грн за 80-99%»

Розібране використовується, щоб перерахувати мотивацію кожного рядка і
звірити з тим, що стоїть у файлі. Там, де впевненого розбору не вийшло,
система про це каже прямо, а не мовчить.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# нормалізація ролей: у файлах їх звуть по-різному
ROLE_ALIASES = {
    "тп": "тп", "та": "тп", "ек": "тп", "вд": "тп", "fm": "тп", "fo": "тп",
    "св": "св", "нто": "нто", "нтв": "нто", "ктв": "нто", "кам": "тп",
}
ROLE_RX = re.compile(r"(?<![а-яіїєґa-z])(тп|та|ек|вд|св|нто|нтв|ктв|кам|fm\d?|fo\d?)"
                     r"(?![а-яіїєґa-z])", re.I)

NUM = r"\d+(?:[.,]\d+)?"
# «тп - 0,85 грн./пл.»  /  «св 0,2 грн/пл»
RATE_RX = re.compile(
    rf"(тп|св|нто|нтв|ктв)\s*[-–—:]?\s*({NUM})\s*грн\.?\s*/\s*пл", re.I)
# «ТП - 1800», «св 2500», «нтв - 1000»  (без «грн/пл»)
FIXED_RX = re.compile(
    rf"(тп|св|нто|нтв|ктв)\s*[-–—:]?\s*(\d[\d\s]{{2,6}})(?!\s*%)"
    rf"(?!\s*грн\.?\s*/)", re.I)
# «до 70% - бонус не виплачується». Проміжок навмисно вузький: у фразі
# «від 70% до 120%, до 70% — бонус не виплачується» широкий проміжок
# чіплявся б за «до 120%» і обнуляв усе до 120 %.
ZERO_RX = re.compile(
    r"до\s*(\d+)\s*%?\s*[-–—]?\s*бонус\s+не\s+"
    r"(?:виплачується|нараховується|нараховуєься)", re.I)
# «від 70% до 99% - бонус 50%» / «при виконані 80-95 % - бонус 50 %»
RATIO_RX = re.compile(
    r"(?:від\s*)?(\d+)\s*%?\s*(?:до|[-–—])\s*(\d+)\s*%[^.;]{0,20}?бонус\s*(\d+)\s*%",
    re.I)
# «при виконанні на 96% і більше» / «при виконанні 100%» /
# «при виконанні від 70% до 120%» (трапляється й одруківка «виконанн»)
FULL_RX = re.compile(
    r"при\s+викона\w*\s*(?:на\s+|від\s+)?(\d+)\s*%", re.I)
# «120% - Бонус ТП 1,5 грн/пл» / «від 120% - тп - 0,8 грн/пл»
UPGRADE_RX = re.compile(r"(?:від\s*)?(\d{3})\s*%\s*[-–—]", re.I)
# «отримує бонус 1000 грн за виконання ... на 100 %»
GETS_RX = re.compile(
    rf"(тп|св|нто|нтв)[^.;/]{{0,40}}?бонус\s*({NUM})\s*грн[^.;/]{{0,60}}?(\d+)\s*%",
    re.I)
# «або бонус 500 грн за виконання плану на 80-99%»
ALT_RX = re.compile(
    rf"або\s*бонус\s*({NUM})\s*грн[^./]{{0,40}}?(\d+)\s*[-–—]\s*(\d+)\s*%", re.I)
# Бойчак: «85 % - 90% - 2500 грн»
BAND_RX = re.compile(rf"(\d+)\s*%?\s*[-–—]\s*(\d+)\s*%\s*[-–—]\s*({NUM})\s*грн", re.I)
ROLE_TAG_RX = re.compile(r"_\s*(ТП|СВ|НТО|НТВ)\s*_", re.I)


METRIC_HINTS = [
    ("akb", re.compile(r"\bакб\b|\bтт\b", re.I)),
    ("revenue", re.compile(r"сум[аи]\s+(вторин|вп)|валов", re.I)),
    ("sales", re.compile(r"продаж|\bпл\b|\bвал\b|об.?єм|пляшк", re.I)),
]


def split_tasks(text: str) -> list[tuple[str | None, str]]:
    """Ділить умови на пронумеровані завдання і визначає метрику кожного.

    У дистриб'юторів із двома завданнями (вал і АКБ) умови виписані
    окремими пунктами, і кожен блок треба звіряти зі своїм.
    """
    parts = re.split(r"(?m)^\s*(?=\d{1,2}\s*[.)]\s)", text)
    out = []
    for part in parts:
        part = part.strip()
        if len(part) < 15:
            continue
        metric = None
        for name, rx in METRIC_HINTS:
            if rx.search(part):
                metric = name
                break
        out.append((metric, part))
    return out


def terms_for(text: str, metric: str) -> "Terms":
    """Умови, що стосуються конкретної метрики блоку."""
    tasks = split_tasks(text)
    matching = [t for m, t in tasks if m == metric]
    if matching:
        return parse("\n".join(matching))
    return parse(text)


def _num(text: str) -> float:
    return float(text.replace(" ", "").replace("\xa0", "").replace(",", "."))


def norm_role(text: str) -> str | None:
    m = ROLE_RX.search(text or "")
    if not m:
        return None
    key = m.group(1).lower()
    key = re.sub(r"\d", "", key)
    return ROLE_ALIASES.get(key)


@dataclass
class Tier:
    """Сходинка виконання: від lo до hi частки плану."""
    lo: float
    hi: float
    kind: str                                  # 'zero' | 'ratio' | 'values'
    ratio: float = 1.0
    values: dict[str, float] = field(default_factory=dict)

    def covers(self, performance: float) -> bool:
        return self.lo <= performance < self.hi


@dataclass
class Terms:
    text: str
    kind: str | None = None                    # 'per_unit' | 'fixed'
    base: dict[str, float] = field(default_factory=dict)
    tiers: list[Tier] = field(default_factory=list)
    # з якого виконання платять повністю; 0 означає «без порогу» —
    # ставка діє на будь-який факт
    full_from: float = 0.0
    confidence: str = "none"                   # 'high' | 'medium' | 'none'
    note: str = ""
    rate_unit: str | None = None               # одиниця ставки: 'пл' для грн/пл

    def applies_to(self, block_unit: str) -> bool:
        """Чи можна звіряти ці умови з блоком у такій одиниці.

        У Мілани ставка «1 грн/пл» рахується від пляшок, а блок веде АКБ у
        торгових точках — пляшки лежать в окремій колонці, тож перерахунок
        зробити нема з чого.
        """
        if self.kind != "per_unit" or not self.rate_unit:
            return True
        return block_unit in (self.rate_unit, "шт") or self.rate_unit == block_unit

    def expected(self, role: str, plan: float | None, fact: float | None,
                 ) -> float | None:
        """Скільки мотивації має вийти за умовами."""
        if self.kind is None or role not in self.base:
            return None
        if fact is None:
            return None
        performance = (fact / plan) if plan else 0.0

        for tier in self.tiers:
            if not tier.covers(performance):
                continue
            if tier.kind == "zero":
                return 0.0
            if tier.kind == "values":
                if role not in tier.values:
                    return None
                return self._amount(tier.values[role], fact)
            if tier.kind == "ratio":
                return self._amount(self.base[role], fact) * tier.ratio

        if performance + 1e-9 < self.full_from:
            return 0.0
        return self._amount(self.base[role], fact)

    def _amount(self, value: float, fact: float) -> float:
        return value * fact if self.kind == "per_unit" else value


def _collect(rx, text: str) -> dict[str, float]:
    out: dict[str, float] = {}
    for m in rx.finditer(text):
        role = ROLE_ALIASES.get(m.group(1).lower())
        if role and role not in out:
            out[role] = _num(m.group(2))
    return out


def parse(text: str) -> Terms:
    """Розбирає текст умов в набір правил."""
    terms = Terms(text=text.strip())
    if not text or len(text) < 15:
        terms.note = "умови мотивації не знайдено під таблицею"
        return terms

    head, _, tail = text.partition(";")

    rates = _collect(RATE_RX, text)
    if rates:
        terms.kind = "per_unit"
        terms.base = _collect(RATE_RX, head) or rates
        terms.rate_unit = "пл"
    else:
        gets, alt, gets_threshold = _parse_gets(text)
        fixed = gets or _collect(FIXED_RX, head)
        if alt:
            terms.tiers.extend(alt)
        if fixed:
            terms.kind = "fixed"
            terms.base = fixed
            if gets_threshold:
                terms.full_from = gets_threshold

    if terms.kind is None:
        bands = _parse_role_bands(text)
        if bands:
            terms.kind = "fixed"
            terms.base = {r: max(v.values()) for r, v in bands.items()}
            terms.tiers = _tiers_from_bands(bands)
            terms.full_from = 0.0
            terms.confidence = "high"
            return terms
        terms.note = "не вдалося розібрати умови мотивації"
        return terms

    # поріг береться лише якщо він справді записаний в умовах:
    # у частини дистриб'юторів ставка діє без жодного порогу
    full = FULL_RX.search(text)
    if full:
        terms.full_from = int(full.group(1)) / 100

    tiers: list[Tier] = list(terms.tiers)
    zero = ZERO_RX.search(text)
    if zero:
        tiers.append(Tier(0.0, int(zero.group(1)) / 100, "zero"))

    for m in RATIO_RX.finditer(text):
        lo, hi, ratio = int(m.group(1)), int(m.group(2)), int(m.group(3))
        tiers.append(Tier(lo / 100, (hi + 1) / 100, "ratio", ratio=ratio / 100))

    tiers += _tiers_with_values(text, terms.kind)

    upgrade = UPGRADE_RX.search(text)
    if upgrade:
        boundary = int(upgrade.group(1)) / 100
        tail_text = text[upgrade.end():]
        better = (_collect(RATE_RX, tail_text) if terms.kind == "per_unit"
                  else _collect(FIXED_RX, tail_text))
        if better:
            tiers.append(Tier(boundary, 10.0, "values", values=better))

    # сходинка не може перекривати поріг повної виплати
    for tier in tiers:
        if tier.kind != "zero" and tier.lo < terms.full_from < tier.hi:
            tier.hi = terms.full_from

    terms.tiers = sorted(tiers, key=lambda t: t.lo)
    terms.confidence = "high" if terms.base else "none"
    if any(t.kind == "ratio" for t in terms.tiers):
        terms.confidence = "medium"
    return terms


def _parse_gets(text: str) -> tuple[dict[str, float], list[Tier], float | None]:
    """«ТП отримує бонус 1000 грн за виконання на 100 %, або 500 грн за 80-99%».

    Кожна роль описана своїм відрізком тексту, розділеним похилою рискою.
    """
    base: dict[str, float] = {}
    tiers: list[Tier] = []
    threshold: float | None = None
    for chunk in re.split(r"\s/\s", text):
        m = GETS_RX.search(chunk)
        if not m:
            continue
        role = ROLE_ALIASES.get(m.group(1).lower())
        if not role or role in base:
            continue
        base[role] = _num(m.group(2))
        # «за виконання плану на 100 %» — це і є поріг повної виплати
        threshold = threshold or int(m.group(3)) / 100
        a = ALT_RX.search(chunk)
        if a:
            lo, hi = int(a.group(2)) / 100, (int(a.group(3)) + 1) / 100
            for tier in tiers:
                if tier.kind == "values" and (tier.lo, tier.hi) == (lo, hi):
                    tier.values[role] = _num(a.group(1))
                    break
            else:
                tiers.append(Tier(lo, hi, "values", values={role: _num(a.group(1))}))
    return base, tiers, threshold


def _tiers_with_values(text: str, kind: str) -> list[Tier]:
    """Сходинки, де на кожну роль виписано власну суму або ставку."""
    out = []
    rx = re.compile(r"при\s+викона[нні]{0,4}\s*(\d+)\s*[-–—]\s*(\d+)\s*%([^.;]*)", re.I)
    for m in rx.finditer(text):
        lo, hi, body = int(m.group(1)), int(m.group(2)), m.group(3)
        values = (_collect(RATE_RX, body) if kind == "per_unit"
                  else _collect(FIXED_RX, body))
        if values:
            out.append(Tier(lo / 100, (hi + 1) / 100, "values", values=values))
    return out


def _parse_role_bands(text: str) -> dict[str, dict[tuple, float]]:
    """Формат Бойчака: кожна роль окремим рядком зі своїми сходинками."""
    bands: dict[str, dict[tuple, float]] = {}
    for line in text.splitlines():
        tag = ROLE_TAG_RX.search(line)
        if not tag:
            continue
        role = ROLE_ALIASES.get(tag.group(1).lower())
        if not role:
            continue
        found: dict[tuple, float] = {}
        for m in BAND_RX.finditer(line):
            found[(int(m.group(1)) / 100, (int(m.group(2)) + 1) / 100)] = _num(m.group(3))
        for m in re.finditer(rf"(?<![-–—\d])\s(\d{{3}})\s*%\s*[-–—]\s*({NUM})\s*грн",
                             line):
            found[(int(m.group(1)) / 100, 10.0)] = _num(m.group(2))
        if found:
            bands[role] = found
    return bands


def _tiers_from_bands(bands: dict[str, dict[tuple, float]]) -> list[Tier]:
    edges: dict[tuple, dict[str, float]] = {}
    for role, spans in bands.items():
        for span, value in spans.items():
            edges.setdefault(span, {})[role] = value
    tiers = [Tier(lo, hi, "values", values=vals)
             for (lo, hi), vals in sorted(edges.items())]
    if tiers:
        tiers.insert(0, Tier(0.0, tiers[0].lo, "zero"))
    return tiers


def read_terms(grid, after_row: int = 0) -> str:
    """Збирає текст умов мотивації, що йде під таблицею."""
    task_rx = re.compile(r"^\s*задач", re.I)
    stop_rx = re.compile(r"^\s*(акці|блок\s*2)", re.I)
    lines: list[str] = []
    started = False
    for r in range(max(1, after_row), min(grid.nrows, after_row + 60) + 1):
        for c in range(1, min(grid.ncols, 8) + 1):
            t = grid.text(r, c)
            if not t:
                continue
            if task_rx.match(t):
                started = True
                break
            if started and stop_rx.match(t):
                return "\n".join(lines)
            if started and len(t) > 10:
                lines.append(t)
            break
    return "\n".join(lines)


def read_promo(grid, after_row: int = 0) -> str:
    """Збирає текст умов акцій — його переносять у зведену на новий місяць."""
    promo_rx = re.compile(r"^\s*акці", re.I)
    stop_rx = re.compile(r"^\s*(блок\s*2|задач|факт\s|відвантажено)", re.I)
    lines: list[str] = []
    started = False
    for r in range(max(1, after_row), min(grid.nrows, after_row + 80) + 1):
        for c in range(1, min(grid.ncols, 8) + 1):
            t = grid.text(r, c)
            if not t:
                continue
            if promo_rx.match(t):
                started = True
                break
            if started and stop_rx.match(t):
                return "\n".join(lines)
            if started and len(t) > 10:
                lines.append(t)
            break
    return "\n".join(lines)
