"""Розбір українських назв місяців та періодів.

Назви аркушів у джерелах ненадійні (одруківки, неправильні роки, числові
позначення), тому період визначається за заголовком усередині аркуша,
а назва аркуша слугує лише резервним і перевірочним джерелом.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# основа назви -> номер місяця; свідомо обрізані, щоб ловити всі відмінки
_STEMS = {
    "січ": 1, "лют": 2, "берез": 3, "квіт": 4, "трав": 5, "черв": 6,
    "лип": 7, "серп": 8, "верес": 9, "жовт": 10, "листопад": 11, "груд": 12,
    # типові одруківки, що реально трапляються у файлах
    "вересент": 9, "вересн": 9,
}

MONTH_NAMES = {
    1: "січень", 2: "лютий", 3: "березень", 4: "квітень", 5: "травень",
    6: "червень", 7: "липень", 8: "серпень", 9: "вересень", 10: "жовтень",
    11: "листопад", 12: "грудень",
}

_STEM_RX = re.compile("|".join(sorted(_STEMS, key=len, reverse=True)), re.I)


@dataclass(frozen=True, order=True)
class Period:
    year: int
    month: int

    def __str__(self) -> str:
        return f"{self.year}-{self.month:02d}"

    @property
    def label(self) -> str:
        return f"{MONTH_NAMES[self.month]} {self.year}"

    def shift(self, delta: int) -> "Period":
        idx = (self.year * 12 + self.month - 1) + delta
        return Period(idx // 12, idx % 12 + 1)

    @property
    def prev(self) -> "Period":
        return self.shift(-1)


def find_month(text: str) -> int | None:
    m = _STEM_RX.search(text or "")
    if not m:
        return None
    key = m.group(0).lower()
    for stem in sorted(_STEMS, key=len, reverse=True):
        if key.startswith(stem) or stem.startswith(key):
            return _STEMS[stem]
    return None


def find_year(text: str, default_century: int = 2000) -> int | None:
    """Ловить і 2026, і скорочене '26' (як у 'червень 26')."""
    if not text:
        return None
    # межі слова тут не годяться: у джерелах пишуть «2025р.», а кирилична
    # «р» для \b є таким самим символом слова, як і цифра
    m = re.search(r"(?<!\d)(20\d{2})(?!\d)", text)
    if m:
        return int(m.group(1))
    for m in re.finditer(r"(?<!\d)(\d{2})(?!\d)", text):
        val = int(m.group(1))
        if 20 <= val <= 40:
            return default_century + val
    return None


def parse_period(text: str) -> Period | None:
    month = find_month(text)
    year = find_year(text)
    if month and year:
        return Period(year, month)
    return None
