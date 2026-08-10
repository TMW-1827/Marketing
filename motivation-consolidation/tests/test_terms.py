"""Тести розбору умов мотивації — на реальних формулюваннях із файлів."""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mc.terms import norm_role, parse, split_tasks, terms_for  # noqa: E402


def test_rate_without_threshold():
    t = parse("1. ТМ Трускавецька план продажів - 50 000 пл. мотивація - "
              "(ТП - 0,85 грн./пл., СВ - 0,15 грн./пл.)")
    assert t.kind == "per_unit"
    assert t.base == {"тп": 0.85, "св": 0.15}
    # порогу в умовах немає — ставка діє на будь-який факт
    assert t.full_from == 0.0
    assert t.expected("тп", 8000, 7864) == pytest.approx(6684.4)


def test_rate_with_floor_and_upgrade():
    t = parse("1. ТМ Трускавецька ПЛ ( тп - 0,5 грн/пл, св 0,2 грн/пл., "
              "при виконанн від 70% до 120%, до 70% - бонус не виплачується; "
              "120% - Бонус ТП 0,70грн/пл і СВ 0,25 грн.)")
    assert t.base["тп"] == 0.5
    assert t.expected("тп", 1300, 1196) == pytest.approx(598)     # 92 %
    assert t.expected("тп", 1000, 500) == 0                        # 50 %
    assert t.expected("тп", 1000, 1300) == pytest.approx(910)      # 130 %


def test_zero_tier_does_not_grab_the_upper_bound():
    """«від 70% до 120%, до 70% — не виплачується» — нуль саме до 70 %."""
    t = parse("тп - 1 грн/пл при виконанні від 70% до 120%, "
              "до 70% - бонус не виплачується")
    assert t.expected("тп", 1000, 800) == pytest.approx(800)
    assert t.expected("тп", 1000, 600) == 0


def test_fixed_with_tiers():
    t = parse('1. ТМ Трускавецька Об"єм продажу - 45 000 пл ( тп  - 1800, '
              "св 2500, нтв 2500 при виконанні на 96% і більше; при виконані "
              "80-95 % - тп  - 900, св 1000, нтв 1000;  до 80% бонус не "
              "нараховується).")
    assert t.kind == "fixed"
    assert t.base["тп"] == 1800
    assert t.expected("тп", 1000, 1000) == 1800      # 100 %
    assert t.expected("тп", 1000, 900) == 900        # 90 %
    assert t.expected("тп", 1000, 700) == 0          # 70 %


def test_half_bonus_tier():
    t = parse("1. ТМ Трускавецька ВАЛ ( тп - 0,7 грн/пл., СВ 0,2 грн/пл. "
              "при виконанні 100%, від 70% до 99% - бонус 50%, "
              "до 70% - бонус не виплачується )")
    assert t.expected("тп", 1000, 1000) == pytest.approx(700)
    assert t.expected("тп", 1000, 800) == pytest.approx(280)   # половина ставки
    assert t.expected("тп", 1000, 500) == 0


def test_gets_bonus_with_alternative():
    t = parse("1. ТМ Трускавецька план продажів - 15 000 пл. (ТП отримує "
              "бонус 1000 грн за виконання індивідуального плану на 100 % , "
              "або бонус 500 грн за виконання плану на 80-99% / СВ отримує "
              "бонус 2000 грн за виконання плану на 100 %)")
    assert t.base["тп"] == 1000 and t.base["св"] == 2000
    assert t.expected("тп", 1000, 1000) == 1000
    assert t.expected("тп", 1000, 900) == 500
    assert t.expected("тп", 1000, 600) == 0


def test_per_role_bands():
    t = parse("1. ТМ Трускавецька план продажів  - 92000пл._ТП_ при виконанні "
              "від 85 % - 90% - 2500 грн, 91% - 99% - 3000 грн, 100% - 4000 грн\n"
              "2. ТМ Трускавецька план продажів  - 92000пл._СВ_ при виконанні "
              "від 85 % - 90% - 2500 грн, 91% - 99% - 3500 грн, 100% - 5000 грн")
    assert t.kind == "fixed"
    assert t.expected("тп", 1000, 1000) == 4000
    assert t.expected("св", 1000, 950) == 3500
    assert t.expected("тп", 1000, 870) == 2500
    assert t.expected("тп", 1000, 800) == 0


def test_tasks_are_split_by_metric():
    text = ("1. ТМ Трускавецька план продажів - 133000 пл. (СВ - 2000 грн., "
            "ТП - 2500 грн. при виконанні на 96% і більше)\n"
            "2. ТМ Трускавецька план АКБ - 1175 ТТ. (СВ - 1500 грн., "
            "ТП - 1500 грн. при виконанні на 96% і більше)")
    metrics = [m for m, _ in split_tasks(text)]
    assert "akb" in metrics and "sales" in metrics
    assert terms_for(text, "sales").base["тп"] == 2500
    assert terms_for(text, "akb").base["тп"] == 1500


def test_rate_unit_guards_against_wrong_metric():
    """Ставка в грн/пл не застосовується до блоку, що рахує торгові точки."""
    t = parse("1. ТМ Трускавецька АКБ від 1 уп/ТТ ( тп - 1 грн/пл, "
              "св - 0,2 грн/пл при виконанні на 100% і більше)")
    assert t.applies_to("пл") is True
    assert t.applies_to("тт") is False


def test_roles_are_recognised_in_labels():
    assert norm_role("ТП Городинець О.") == "тп"
    assert norm_role("СВ_ВОДА_ЛЬВІВ_3") == "св"
    assert norm_role("НТВ Заддніпрянець Оксана") == "нто"
    assert norm_role("Трускавецька КТВ Гриців Тарас") == "нто"
    assert norm_role("ТА Байдик Таня") == "тп"
    assert norm_role("Бубенко Альона") is None


def test_bump_reaches_next_tier():
    """Виконання 98 % при межі 99 % — з допуском у 1 % дотягує до неї."""
    t = parse("1. ТМ Трускавецька АКБ ( тп - 700, св 1000 при виконанні "
              "на 99% і більше, при виконані 80-98 % - тп 500, св - 500, "
              "до 80% бонус не нараховується).")
    assert t.expected("тп", 100, 98) == 500
    assert t.expected("тп", 100, 98, bump=0.01) == 700
    # до межі далеко — допуск нічого не змінює
    assert t.expected("тп", 100, 90, bump=0.01) == 500


def test_unparseable_terms_are_reported():
    t = parse("Мотивація за домовленістю з керівництвом")
    assert t.kind is None and t.note


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-q"]))
