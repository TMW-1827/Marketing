"""Єдиний інтерфейс читання .xls та .xlsx.

Файли-джерела приходять у двох форматах, тому весь інший код працює
з абстракцією Grid і не знає, який движок під ним.
Індексація всюди 1-based, як у самому Excel.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Any


def col_letter(idx: int) -> str:
    """1 -> A, 27 -> AA"""
    out = ""
    while idx:
        idx, rem = divmod(idx - 1, 26)
        out = chr(65 + rem) + out
    return out


def col_index(letter: str) -> int:
    idx = 0
    for ch in letter.upper():
        idx = idx * 26 + (ord(ch) - 64)
    return idx


class Grid:
    """Один аркуш. value() віддає обчислене значення, formula() — текст формули."""

    def __init__(self, name: str, nrows: int, ncols: int):
        self.name = name
        self.nrows = nrows
        self.ncols = ncols

    def value(self, row: int, col: int) -> Any:  # pragma: no cover - інтерфейс
        raise NotImplementedError

    def formula(self, row: int, col: int) -> str | None:
        return None

    # -- зручні похідні --------------------------------------------------

    def text(self, row: int, col: int) -> str:
        v = self.value(row, col)
        if v is None:
            return ""
        if isinstance(v, str):
            return v.strip()
        return str(v).strip()

    def number(self, row: int, col: int) -> float | None:
        v = self.value(row, col)
        if isinstance(v, bool):
            return None
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, str):
            s = v.strip().replace("\xa0", "").replace(" ", "").replace(",", ".")
            if re.fullmatch(r"-?\d+(\.\d+)?", s):
                return float(s)
        return None

    def row_texts(self, row: int, max_col: int | None = None) -> list[str]:
        limit = min(self.ncols, max_col or self.ncols)
        return [self.text(row, c) for c in range(1, limit + 1)]

    def find(self, pattern: str, max_row: int | None = None,
             max_col: int | None = None) -> list[tuple[int, int, str]]:
        """Усі клітинки з текстом, що матчить regex (без урахування регістру)."""
        rx = re.compile(pattern, re.I)
        hits = []
        rlimit = min(self.nrows, max_row or self.nrows)
        climit = min(self.ncols, max_col or self.ncols)
        for r in range(1, rlimit + 1):
            for c in range(1, climit + 1):
                t = self.text(r, c)
                if t and rx.search(t):
                    hits.append((r, c, t))
        return hits


class _XlsGrid(Grid):
    def __init__(self, sheet):
        super().__init__(sheet.name, sheet.nrows, sheet.ncols)
        self._sh = sheet

    def value(self, row: int, col: int):
        if 1 <= row <= self.nrows and 1 <= col <= self.ncols:
            v = self._sh.cell_value(row - 1, col - 1)
            return None if v == "" else v
        return None


class _XlsxGrid(Grid):
    """Тримає дві копії аркуша: зі значеннями і з формулами."""

    def __init__(self, ws_values, ws_formulas):
        super().__init__(ws_values.title, ws_values.max_row or 0,
                         ws_values.max_column or 0)
        self._v = ws_values
        self._f = ws_formulas

    def value(self, row: int, col: int):
        if 1 <= row <= self.nrows and 1 <= col <= self.ncols:
            return self._v.cell(row=row, column=col).value
        return None

    def formula(self, row: int, col: int):
        if 1 <= row <= self.nrows and 1 <= col <= self.ncols:
            v = self._f.cell(row=row, column=col).value
            if isinstance(v, str) and v.startswith("="):
                return v
        return None


@dataclass
class Workbook:
    path: str
    sheets: list[Grid]

    def names(self) -> list[str]:
        return [s.name for s in self.sheets]

    def by_name(self, name: str) -> Grid | None:
        for s in self.sheets:
            if s.name == name:
                return s
        return None

    def index_of(self, name: str) -> int:
        for i, s in enumerate(self.sheets):
            if s.name == name:
                return i
        return -1


@lru_cache(maxsize=64)
def load(path: str) -> Workbook:
    """Читає книгу цілком. Кешується — один файл відкривається раз за прогін."""
    low = path.lower()
    if low.endswith(".xls"):
        import xlrd

        bk = xlrd.open_workbook(path, on_demand=False)
        return Workbook(path, [_XlsGrid(sh) for sh in bk.sheets()])

    import openpyxl

    wb_v = openpyxl.load_workbook(path, data_only=True)
    wb_f = openpyxl.load_workbook(path, data_only=False)
    grids = [_XlsxGrid(wb_v[n], wb_f[n]) for n in wb_v.sheetnames]
    return Workbook(path, grids)
