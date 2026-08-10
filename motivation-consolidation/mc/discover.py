"""Розпізнавання: який це дистриб'ютор, який аркуш до якого місяця належить.

Назви аркушів у 15 файлах написані щонайменше шістьма різними схемами
('план січень 24', 'Січень 2026 план', '03', '3', 'план липень 26р БОЙЧАК'),
трапляються одруківки та неправильні роки. Тому основне джерело істини —
заголовок усередині аркуша, а назва аркуша та порядок аркушів
використовуються як резерв і як перевірка.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .months import Period, parse_period, find_month, find_year
from .xlio import Grid, Workbook, load

# 'План акцій і мотивацій на Червень 2026', 'ФАКТ акцій і мотивацій червень 2026',
# 'Факт мотивації на червень 2026р.', 'Факт акцій і мотивації червень 2026'
HEADER_RX = re.compile(r"^\s*(план|факт)\b.{0,40}?(акці|мотива)", re.I)
DIST_RX = re.compile(r"дистриб[юу]тор", re.I)

HEADER_SCAN_ROWS = 10
HEADER_SCAN_COLS = 8


@dataclass
class SheetInfo:
    grid: Grid
    index: int
    kind: str                    # 'план' | 'факт'
    period: Period | None
    header: str
    warnings: list[str] = field(default_factory=list)
    name_period: Period | None = None
    name_kind: str | None = None

    @property
    def name(self) -> str:
        return self.grid.name


@dataclass
class SourceFile:
    path: str
    distributor_raw: str
    sheets: list[SheetInfo]

    def find(self, period: Period, kind: str) -> SheetInfo | None:
        for s in self.sheets:
            if s.period == period and s.kind == kind:
                return s
        return None

    def periods(self) -> list[Period]:
        return sorted({s.period for s in self.sheets if s.period})


def _read_header(grid: Grid) -> tuple[str, str] | None:
    """Повертає (kind, повний текст заголовка) або None."""
    for r in range(1, min(grid.nrows, HEADER_SCAN_ROWS) + 1):
        for c in range(1, min(grid.ncols, HEADER_SCAN_COLS) + 1):
            t = grid.text(r, c)
            if len(t) > 12 and HEADER_RX.match(t):
                return t.split()[0].lower().strip(".:"), t
    return None


def _read_distributor(grid: Grid) -> str | None:
    for r in range(1, min(grid.nrows, HEADER_SCAN_ROWS) + 1):
        for c in range(1, min(grid.ncols, HEADER_SCAN_COLS) + 1):
            t = grid.text(r, c)
            if DIST_RX.search(t):
                cleaned = DIST_RX.sub("", t)
                cleaned = cleaned.strip(" -–— .\"'")
                if cleaned:
                    return cleaned
    return None


def _kind_from_name(name: str) -> str | None:
    low = name.lower()
    if re.search(r"\bфакт|\bфак\b", low):
        return "факт"
    if "план" in low:
        return "план"
    return None


def _period_from_name(name: str) -> Period | None:
    p = parse_period(name)
    if p:
        return p
    # суто числові назви аркушів ('03', '3', '06 факт') року не містять
    return None


def scan_file(path: str) -> SourceFile:
    wb: Workbook = load(path)
    distributor = None
    infos: list[SheetInfo] = []

    for idx, grid in enumerate(wb.sheets):
        head = _read_header(grid)
        dist = _read_distributor(grid)
        if dist and not distributor:
            distributor = dist
        if not head:
            continue  # службові аркуші: 'Стратегія', 'Графіки'

        kind, header_text = head
        kind = "факт" if kind.startswith("фак") else "план"
        period = parse_period(header_text)
        warnings: list[str] = []

        name_kind = _kind_from_name(grid.name)
        if name_kind and name_kind != kind:
            warnings.append(
                f"назва аркуша '{grid.name}' каже «{name_kind}», "
                f"а заголовок — «{kind}»")

        name_period = _period_from_name(grid.name)
        if period and name_period and name_period != period:
            warnings.append(
                f"назва аркуша '{grid.name}' вказує на {name_period}, "
                f"а заголовок — на {period}")
        if not period:
            month = find_month(header_text) or find_month(grid.name)
            year = find_year(header_text)
            if month and not year:
                warnings.append(
                    f"у заголовку немає року: «{header_text[:60]}»")
            period = None

        info = SheetInfo(grid, idx, kind, period, header_text, warnings)
        info.name_period = name_period
        info.name_kind = name_kind
        infos.append(info)

    _infer_missing_years(infos)
    _resolve_conflicts(infos)
    return SourceFile(path, distributor or "?", infos)


def _resolve_conflicts(infos: list[SheetInfo]) -> None:
    """Лагодить аркуші, чий заголовок скопійований з попереднього місяця.

    Аркуші в книзі лежать хронологічно, тож заголовок, який тягне період
    назад або дублює вже зайняту пару (період, вид), майже завжди означає
    незмінений копіпаст. У такому разі довіряємо назві аркуша — але гучно
    про це попереджаємо, бо це помилка в самому джерелі.
    """
    taken: dict[tuple, SheetInfo] = {}
    last: Period | None = None

    for info in infos:
        if not info.period:
            continue
        # назва аркуша може виправити або період, або вид, або обидва
        alt = info.name_period or info.period
        alt_kind = info.name_kind or info.kind
        key = (info.period, info.kind)

        duplicate = key in taken
        goes_back = last is not None and info.period < last

        if ((duplicate or goes_back) and (alt, alt_kind) != key
                and (alt, alt_kind) not in taken):
            reason = ("дублює вже зайнятий аркуш" if duplicate
                      else "тягне період назад")
            info.warnings.append(
                f"заголовок «{info.header[:50]}» {reason} — період узято з "
                f"назви аркуша: {alt} ({alt_kind}). Заголовок у джерелі "
                f"треба виправити")
            info.period = alt
            info.kind = alt_kind
            key = (info.period, info.kind)
        elif duplicate:
            info.warnings.append(
                f"конфлікт: {info.period} ({info.kind}) вже зайнято аркушем "
                f"'{taken[key].name}' — аркуш пропущено")
            info.period = None
            continue

        taken[key] = info
        last = info.period if last is None else max(last, info.period)


def _infer_missing_years(infos: list[SheetInfo]) -> None:
    """Дозаповнює рік там, де заголовок його не містить.

    Аркуші йдуть у хронологічному порядку, тож рік відновлюється від
    найближчого відомого сусіда з поправкою на переходи через грудень.
    """
    known = [(i, s) for i, s in enumerate(infos) if s.period]
    if not known:
        return
    for i, sheet in enumerate(infos):
        if sheet.period:
            continue
        month = find_month(sheet.header) or find_month(sheet.name)
        if not month:
            continue
        anchor = min(known, key=lambda kv: abs(kv[0] - i))
        a_idx, a_sheet = anchor
        year = a_sheet.period.year
        if i > a_idx and month < a_sheet.period.month:
            year += 1
        elif i < a_idx and month > a_sheet.period.month:
            year -= 1
        sheet.period = Period(year, month)
        sheet.warnings.append(
            f"рік не вказано у заголовку, відновлено за сусідніми аркушами -> {sheet.period}")
