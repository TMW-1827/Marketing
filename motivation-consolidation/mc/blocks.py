"""Витяг мотиваційних блоків («Блок 1. Погоджувальна частина») з аркуша.

Розкладка таблиці різна майже в кожного дистриб'ютора: заголовок починається
то з B7, то з C10, колонка «факт» буває D, E, F або G, на одному аркуші може
бути два незалежні блоки (Київ + Область у Алекс ком) або два завдання поруч
у тих самих рядках (вал + АКБ у Буковини Трек). Тому колонки шукаються за
текстом заголовків, а не за фіксованими адресами.

Підсумкові рядки визначаються двома незалежними способами — за ключовим
словом (СВ / НТО / Всього / Загалом) і арифметично (значення дорівнює сумі
попередніх рядків). Це дозволяє не залежати від формул, яких у .xls не видно.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .xlio import Grid, col_letter

MAX_HEADER_ROW = 60
STOP_RX = re.compile(r"^\s*(задач|акці|блок\s*2|умови|примітк|коментар)", re.I)
BLOCK_RX = re.compile(r"^\s*блок\s*1", re.I)
TASK_RX = re.compile(r"задача\s*\d", re.I)

PLAN_RX = re.compile(r"(^|[^а-яіїєґ])(план|орієнтовний\s+план|задача\s*\d)", re.I)
FACT_RX = re.compile(r"факт", re.I)
PCT_RX = re.compile(r"^\s*%|викон", re.I)
BONUS_RX = re.compile(r"бонус|мотивац", re.I)
GROWTH_RX = re.compile(r"приріст", re.I)

# підсумкові ролі; шукаються будь-де в підписі рядка, бо підпис часто
# склеєний з кількох колонок ('Трускавецька КТВ Гриців Тарас')
# межі — саме «не літера», а не \W: у Бойчака підрозділи звуться
# СВ_ВОДА_ЛЬВІВ_3, а підкреслення для \W є символом слова
SUBTOTAL_RX = re.compile(
    r"(?<![а-яіїєґa-z])(св|нто|нтв|ктв|команда|всього|загалом|разом|сума)"
    r"(?![а-яіїєґa-z])", re.I)

# підсумок-ярлик, за яким не стоїть конкретна людина
SUMMARY_ONLY_RX = re.compile(
    r"(?<![а-яіїєґa-z])(всього|загалом|разом|сума)(?![а-яіїєґa-z])", re.I)

UNIT_PATTERNS = [
    (re.compile(r"\bгрн\b", re.I), "грн"),
    (re.compile(r"\bшт\b", re.I), "шт"),
    (re.compile(r"\bтт\b|\bакб\b", re.I), "тт"),
    (re.compile(r"\bпл\b|пляшк", re.I), "пл"),
]
METRIC_BY_UNIT = {"пл": "sales", "шт": "sales", "тт": "akb", "грн": "revenue"}


@dataclass
class LineItem:
    row: int
    label: str
    plan: float | None
    fact: float | None
    pct: float | None
    bonus: float | None
    is_subtotal: bool = False
    is_total: bool = False


@dataclass
class MotivationBlock:
    sheet: str
    title: str
    unit: str
    metric: str                  # 'sales' | 'akb' | 'revenue'
    header_rows: list[int]
    cols: dict[str, int]
    items: list[LineItem] = field(default_factory=list)
    total: LineItem | None = None
    bonus_total: float | None = None
    notes: list[str] = field(default_factory=list)

    @property
    def leaves(self) -> list[LineItem]:
        return [i for i in self.items if not i.is_subtotal and not i.is_total]

    @property
    def subtotals(self) -> list[LineItem]:
        return [i for i in self.items if i.is_subtotal and not i.is_total]

    @property
    def motivated(self) -> bool:
        """Блок потрапляє у зведену лише якщо в ньому є жива сума мотивації."""
        return bool(self.bonus_total and abs(self.bonus_total) > 1e-9)

    @property
    def plan(self) -> float | None:
        return self.total.plan if self.total else None

    @property
    def fact(self) -> float | None:
        return self.total.fact if self.total else None

    def where(self, key: str) -> str:
        c = self.cols.get(key)
        return col_letter(c) if c else "?"


def _unit_of(text: str) -> str | None:
    for rx, unit in UNIT_PATTERNS:
        if rx.search(text or ""):
            return unit
    return None


def _header_cells(grid: Grid, row: int) -> list[tuple[int, str]]:
    return [(c, grid.text(row, c)) for c in range(1, grid.ncols + 1)
            if grid.text(row, c)]


def _find_bands(grid: Grid) -> list[list[int]]:
    """Рядки-заголовки таблиць. Band — це 1-2 сусідні рядки з описом колонок."""
    limit = min(grid.nrows, MAX_HEADER_ROW)
    plan_rows = []
    for r in range(1, limit + 1):
        for c, t in _header_cells(grid, r):
            # довгі речення — це опис мотивації в рядку даних
            # ('ТП отримує бонус 1000 грн за виконання ... плану на 100 %'),
            # а не заголовок колонки
            if len(t) > 70 or BONUS_RX.search(t) or GROWTH_RX.search(t):
                continue
            if PLAN_RX.search(t):
                plan_rows.append(r)
                break

    bands: list[list[int]] = []
    for r in plan_rows:
        if bands and r - bands[-1][-1] == 1:
            bands[-1].append(r)
        else:
            bands.append([r])
    # заголовок на кшталт 'бонус максимум' часто стоїть на рядок вище
    return [[b[0] - 1] + b if b[0] > 1 else b for b in bands]


def _column_map(grid: Grid, band: list[int]) -> list[dict]:
    """Розбиває band на блоки: по одному на кожну колонку «план»."""
    plan_cols: dict[int, str] = {}
    others: list[tuple[int, str, int]] = []   # (col, role, row)

    for r in band:
        for c, t in _header_cells(grid, r):
            if GROWTH_RX.search(t):
                continue
            # спершу бонус: 'мотивація за виконання плану' містить слово
            # «план», але колонкою плану не є
            if BONUS_RX.search(t):
                others.append((c, "bonus", r))
            elif PLAN_RX.search(t):
                # 'ЗАДАЧА 1' і 'план,пл' стоять в одній колонці — тримаємо
                # найкоротший підпис, він конкретніший щодо одиниці виміру
                if c not in plan_cols or len(t) < len(plan_cols[c]):
                    plan_cols[c] = t
            elif FACT_RX.search(t):
                others.append((c, "fact", r))
            elif PCT_RX.search(t):
                others.append((c, "pct", r))

    if not plan_cols:
        return []

    starts = sorted(plan_cols)
    blocks = []
    for i, start in enumerate(starts):
        end = starts[i + 1] - 1 if i + 1 < len(starts) else grid.ncols
        cols = {"plan": start}
        # одиницю беремо з найкоротшого підпису колонки ('План, пл.'),
        # а не із заголовка завдання — той у Бойчака містить одразу
        # «пл., грн» і не дає однозначної відповіді
        unit = _unit_of(plan_cols[start])
        title = plan_cols[start]
        for r in band:
            t = grid.text(r, start)
            if TASK_RX.search(t):
                title = t

        cands = [(c, role) for c, role, _ in others if start < c <= end]
        for role in ("fact", "pct", "bonus"):
            pick = [c for c, rl in cands if rl == role]
            if not pick:
                continue
            if role == "fact" and unit:
                # у Бойчака поруч 'Факт, пл' і 'Факт, грн' — беремо ту,
                # що збігається з одиницею плану
                same = [c for c in pick
                        if _unit_of(_header_text(grid, band, c)) == unit]
                if same:
                    pick = same
            cols[role] = pick[0] if role != "bonus" else pick[-1]
        blocks.append({"cols": cols, "title": title, "unit": unit,
                       "end": end, "band": band})
    return blocks


def _header_text(grid: Grid, band: list[int], col: int) -> str:
    return " ".join(grid.text(r, col) for r in band if grid.text(r, col))


def _row_label(grid: Grid, row: int, upto_col: int) -> str:
    parts = [grid.text(row, c) for c in range(1, upto_col)]
    parts = [p for p in parts if p and not re.fullmatch(r"\d+([.,]\d+)?", p)]
    return " ".join(parts).strip()


def _pick_bonus_col(grid: Grid, spec: dict, rows: range) -> int | None:
    """Серед колонок «бонус/мотивація» обирає ту, що містить числа.

    У частини файлів колонка «мотивація, грн.» — це текстова ставка
    ('0,85 грн./пл.'), а справжня сума лежить у сусідній «Факт мотивація».
    """
    band, end, start = spec["band"], spec["end"], spec["cols"]["plan"]
    cands = []
    for r in band:
        for c, t in _header_cells(grid, r):
            if start < c <= end and BONUS_RX.search(t) and not GROWTH_RX.search(t):
                numeric = sum(1 for rr in rows if grid.number(rr, c) is not None)
                score = numeric * 10 + (5 if "бонус" in t.lower() else 0)
                cands.append((score, c))
    if not cands:
        return None
    return max(cands)[1]


def extract_blocks(grid: Grid) -> list[MotivationBlock]:
    out: list[MotivationBlock] = []
    for band in _find_bands(grid):
        for spec in _column_map(grid, band):
            block = _build_block(grid, spec)
            if block and block.items:
                out.append(block)
    return _dedupe(out)


def _data_rows(grid: Grid, spec: dict) -> list[int]:
    start = max(spec["band"]) + 1
    rows, blanks = [], 0
    plan_c, fact_c = spec["cols"]["plan"], spec["cols"].get("fact")
    for r in range(start, grid.nrows + 1):
        label = _row_label(grid, r, plan_c)
        if label and STOP_RX.match(label):
            break
        has_num = grid.number(r, plan_c) is not None or (
            fact_c and grid.number(r, fact_c) is not None)
        if not label and not has_num:
            blanks += 1
            if blanks >= 3:
                break
            continue
        blanks = 0
        if label or has_num:
            rows.append(r)
    return rows


def _build_block(grid: Grid, spec: dict) -> MotivationBlock | None:
    rows = _data_rows(grid, spec)
    if not rows:
        return None
    cols = dict(spec["cols"])
    bonus_c = _pick_bonus_col(grid, spec, range(rows[0], rows[-1] + 1))
    if bonus_c:
        cols["bonus"] = bonus_c

    plan_c = cols["plan"]
    items = []
    for r in rows:
        label = _row_label(grid, r, plan_c)
        items.append(LineItem(
            row=r,
            label=label,
            plan=grid.number(r, plan_c),
            fact=grid.number(r, cols["fact"]) if cols.get("fact") else None,
            pct=grid.number(r, cols["pct"]) if cols.get("pct") else None,
            bonus=grid.number(r, cols["bonus"]) if cols.get("bonus") else None,
        ))

    _classify(items)
    all_items = list(items)
    total = _grand_total(items)
    if total:
        # усе, що нижче підсумкового рядка, — підвал таблиці, не її рядки
        items = [i for i in items if i.row <= total.row]
    unit = spec["unit"] or _guess_unit(grid, spec)
    block = MotivationBlock(
        sheet=grid.name,
        title=_block_title(grid, spec),
        unit=unit or "?",
        metric=METRIC_BY_UNIT.get(unit or "", "sales"),
        header_rows=spec["band"],
        cols=cols,
        items=items,
    )
    block.total = total
    block.bonus_total = _bonus_total(grid, block, spec, all_items)
    return block


def _guess_unit(grid: Grid, spec: dict) -> str | None:
    # тільки колонки плану і факту: колонка бонусу завжди в гривнях
    # і збила б визначення одиниці для всього блоку
    probe = [c for c in (spec["cols"].get("plan"), spec["cols"].get("fact")) if c]
    for r in spec["band"]:
        for c in probe:
            u = _unit_of(grid.text(r, c))
            if u:
                return u
    # у частини файлів шапка одиниці не містить ('План 06' у РДК,
    # 'ЗАДАЧА 1. Вал' у Омели Маркет) — тоді її видно з опису задачі
    # під таблицею: «план продажів - 15 000 пл.», «тп - 1 грн/пл»
    chunks = [spec.get("title") or ""]
    last = max(spec["band"])
    for r in range(last, min(grid.nrows, last + 40) + 1):
        for c in range(1, min(grid.ncols, 6) + 1):
            if STOP_RX.match(grid.text(r, c)):
                for rr in range(r, min(grid.nrows, r + 6) + 1):
                    chunks += [grid.text(rr, cc)
                               for cc in range(1, min(grid.ncols, 6) + 1)]
                return _unit_from_prose("\n".join(chunks))
    return _unit_from_prose("\n".join(chunks))


def _unit_from_prose(text: str) -> str | None:
    """Одиниця виміру з опису мотивації.

    Порядок важливий: у «1 грн/пл» гривня — це валюта бонусу, а не
    одиниця плану, тому ставка виду «грн/пл» читається як пляшки.
    """
    m = re.search(r"грн\.?\s*[/\\.]\s*(пл|тт|шт)", text, re.I)
    if m:
        return m.group(1).lower()
    m = re.search(r"\d[\d\s ]*\s*(пл|тт|шт)\b", text, re.I)
    if m:
        return m.group(1).lower()
    if re.search(r"\bвал\b|\bпл\b|пляшк", text, re.I):
        return "пл"
    if re.search(r"\bакб\b|\bтт\b", text, re.I):
        return "тт"
    if re.search(r"\bгрн\b", text, re.I):
        return "грн"
    return None


def _block_title(grid: Grid, spec: dict) -> str:
    """Підпис блоку — найближчий заголовок «Блок 1 ...» вище таблиці."""
    top = min(spec["band"])
    for r in range(top, max(1, top - 6), -1):
        for c in range(1, min(grid.ncols, 6) + 1):
            t = grid.text(r, c)
            if BLOCK_RX.match(t):
                return t
    return spec["title"]


def _classify(items: list[LineItem]) -> None:
    """Позначає підсумкові рядки.

    Основний спосіб — за підписом ролі (СВ / НТО / НТВ / КТВ / Всього).
    Арифметичний спосіб лишається запасним: він помиляється там, де в
    сусідніх ТП однакові плани (1000 + 1000 виглядає як підсумок 2000),
    тому вмикається, лише якщо за підписами підсумку знайти не вдалося.
    """
    for it in items:
        it.is_subtotal = bool(SUBTOTAL_RX.search(it.label))

    leaves = [i for i in items if not i.is_subtotal]
    target = sum(i.plan for i in leaves if i.plan is not None)
    subs = [i for i in items if i.is_subtotal]
    if target and any(i.plan is not None and abs(i.plan - target) < 0.51
                      for i in subs):
        return

    _classify_by_sums(items)


def _classify_by_sums(items: list[LineItem]) -> None:
    """Запасний спосіб: рядок є підсумком, якщо дорівнює сумі попередніх."""
    running: list[float] = []
    seen: list[float] = []
    for it in items:
        val = it.plan if it.plan is not None else it.fact
        if it.is_subtotal:
            running = []
            continue
        if val is not None:
            # потрібно щонайменше два доданки, інакше другий рядок
            # з таким самим планом зійшов би за підсумок першого
            if (len(running) >= 2 and abs(sum(running) - val) < 0.51) or \
                    (len(seen) >= 2 and abs(sum(seen) - val) < 0.51):
                it.is_subtotal = True
                running = []
                continue
            running.append(val)
            seen.append(val)


def _grand_total(items: list[LineItem]) -> LineItem | None:
    """Підсумковий рядок блоку — перший, що дорівнює сумі всіх рядків ТП.

    Саме перший: під ним часто йде ще один рядок з тим самим планом
    («план продаж» у РДК, безіменний рядок у Олга Торг), який насправді
    є підвалом таблиці, а не її частиною.
    """
    leaves = [i for i in items if not i.is_subtotal]
    subs = [i for i in items if i.is_subtotal]
    if not subs:
        return None
    target = sum(i.plan for i in leaves if i.plan is not None) or None
    total = None
    if target:
        for it in subs:
            if it.plan is not None and abs(it.plan - target) < 0.51:
                total = it
                break
    total = total or subs[-1]
    total.is_total = True
    return total


def _bonus_total(grid: Grid, block: MotivationBlock, spec: dict,
                 rows: list[LineItem]) -> float | None:
    """Сума мотивації по блоку.

    Спершу шукаємо явну клітинку підсумку («Сума», «всього:») у колонці
    бонусу під таблицею; якщо її немає — додаємо бонуси всіх рядків,
    окрім підсумкового.
    """
    col = block.cols.get("bonus")
    if not col or not rows:
        return None

    # Підсумок мотивації підписаний по-різному ('Сума', 'ЗАГАЛОМ', 'всього:',
    # а в РДК і Олга Торг — взагалі ніяк), тому шукаємо його не за підписом,
    # а за властивістю: значення дорівнює сумі бонусів усіх рядків над ним.
    known = {i.row: i.bonus for i in rows if i.bonus is not None}
    # шукаємо не раніше підсумкового рядка: вище нього два однакові
    # бонуси поспіль дали б хибний збіг
    start = block.total.row if block.total else rows[0].row
    for r in range(start, min(grid.nrows, rows[-1].row + 5) + 1):
        value = grid.number(r, col)
        if value is None:
            continue
        above = sum(b for row, b in known.items() if row < r)
        if above and abs(value - above) < 0.51:
            return value

    # Явного підсумку немає — додаємо рядки. Підсумковий рядок беремо в
    # суму, тільки якщо це людина зі своїм бонусом (НТО/НТВ/СВ + прізвище);
    # рядок-ярлик «Всього:» містить не бонус, а окрему формулу.
    skip = None
    if block.total and SUMMARY_ONLY_RX.search(block.total.label):
        skip = block.total.row
    vals = [b for row, b in known.items() if row != skip]
    return sum(vals) if vals else None


def _dedupe(blocks: list[MotivationBlock]) -> list[MotivationBlock]:
    seen, out = set(), []
    for b in blocks:
        key = (b.cols.get("plan"), b.items[0].row if b.items else None,
               b.items[-1].row if b.items else None)
        if key in seen:
            continue
        seen.add(key)
        out.append(b)
    return out
