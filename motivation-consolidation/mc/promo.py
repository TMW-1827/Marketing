"""Витяг «Блоку 2. Акції» — руху акційної продукції за місяць.

Зустрічаються дві розкладки:

* однорядкова — підписи і числа в одному рядку
  ('Залишок травень | 135 | Відвантажено ... | 2016 | витрачено акцій | 2422 |
   залишок акційної продукції | -271');
* таблиця по SKU — підписи стоять шапкою колонок, а рядки нижче
  перелічують позиції (Бойчак).

Головна цінність блоку — зв'язок між місяцями: вхідний залишок місяця
має дорівнювати вихідному залишку попереднього.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .xlio import Grid, col_letter

OPENING_RX = re.compile(
    r"(перех[іи]дн\w*\s+залишок|залишок\s+(акцій\s+)?"
    r"(січ|лют|берез|квіт|трав|черв|лип|серп|верес|жовт|листопад|груд)\w*)", re.I)
SHIPPED_RX = re.compile(r"відвантажено|прихід", re.I)
SPENT_RX = re.compile(r"витрачено|розхід|використано", re.I)
CLOSING_RX = re.compile(r"залишок", re.I)
UNIT_RX = re.compile(r"^(пл|тт|шт)\.?$", re.I)

MAX_SCAN = 120


@dataclass
class PromoBlock:
    row: int
    opening: float | None = None
    shipped: float | None = None
    spent: float | None = None
    closing: float | None = None
    cells: dict[str, str] = field(default_factory=dict)
    closing_formula: str | None = None
    per_sku: int = 0

    @property
    def computed(self) -> float | None:
        if self.opening is None or self.shipped is None or self.spent is None:
            return None
        return self.opening + self.shipped - self.spent


def _labels_in_row(grid: Grid, row: int) -> list[tuple[int, str, str]]:
    """Повертає (колонка, роль, текст) для підписів у рядку."""
    out = []
    for c in range(1, grid.ncols + 1):
        t = grid.text(row, c)
        if not t or len(t) > 70:
            continue
        if OPENING_RX.search(t):
            role = "opening"
        elif SHIPPED_RX.search(t):
            role = "shipped"
        elif SPENT_RX.search(t):
            role = "spent"
        elif CLOSING_RX.search(t):
            role = "closing"
        else:
            continue
        out.append((c, role, t))
    return out


def _value_right(grid: Grid, row: int, start: int, stop: int) -> tuple[float | None, int | None]:
    for c in range(start + 1, stop):
        v = grid.number(row, c)
        if v is not None and not UNIT_RX.match(grid.text(row, c)):
            return v, c
    return None, None


def extract_promo(grid: Grid) -> PromoBlock | None:
    limit = min(grid.nrows, MAX_SCAN)
    for r in range(1, limit + 1):
        labels = _labels_in_row(grid, r)
        roles = {role for _, role, _ in labels}
        if not ({"shipped", "spent"} & roles) or "closing" not in roles:
            continue
        block = _from_row(grid, r, labels)
        if block:
            return block
    return None


def _from_row(grid: Grid, row: int, labels) -> PromoBlock | None:
    labels = sorted(labels)
    block = PromoBlock(row=row)
    inline = False

    for i, (col, role, _text) in enumerate(labels):
        stop = labels[i + 1][0] if i + 1 < len(labels) else grid.ncols + 1
        val, vcol = _value_right(grid, row, col, stop)
        if val is None:
            continue
        inline = True
        # перший «залишок» — вхідний, останній — вихідний
        if role == "closing" and block.closing is not None:
            pass
        setattr(block, role, val)
        block.cells[role] = f"{col_letter(vcol)}{row}"
        if role == "closing":
            block.closing_formula = grid.formula(row, vcol)

    if inline:
        return block
    return _from_table(grid, row, labels)


def _from_table(grid: Grid, header_row: int, labels) -> PromoBlock | None:
    """Шапка таблиці по SKU: підсумовуємо всі рядки нижче."""
    cols = {role: col for col, role, _ in labels}
    if "closing" not in cols:
        return None
    totals = {k: 0.0 for k in cols}
    seen = 0
    blanks = 0
    for r in range(header_row + 1, min(grid.nrows, header_row + 40) + 1):
        vals = {k: grid.number(r, c) for k, c in cols.items()}
        if all(v is None for v in vals.values()):
            blanks += 1
            if blanks >= 2:
                break
            continue
        blanks = 0
        seen += 1
        for k, v in vals.items():
            if v is not None:
                totals[k] += v
    if not seen:
        return None
    block = PromoBlock(row=header_row, per_sku=seen)
    for role, val in totals.items():
        setattr(block, role, val)
        block.cells[role] = f"{col_letter(cols[role])}{header_row + 1}.."
    block.closing_formula = grid.formula(header_row + 1, cols["closing"])
    return block
