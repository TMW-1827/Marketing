"""Правила перевірки джерел перед записом у зведену.

Кожна знахідка має рівень:

* ERROR — блокує запис місяця у зведену, поки не буде рішення;
* WARN  — не блокує, але показується у звіті;
* INFO  — довідково (наприклад, блок без мотивації, який свідомо
  не потрапляє у зведену).
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass, field

from .blocks import MotivationBlock, extract_blocks
from .config import Config
from .discover import SourceFile, SheetInfo
from .months import Period
from .promo import extract_promo, PromoBlock
from .terms import read_terms, read_promo, terms_for, norm_role, Terms

ERROR, WARN, INFO = "ERROR", "WARN", "INFO"


@dataclass
class Finding:
    level: str
    code: str
    distributor: str
    period: Period
    message: str
    where: str = ""
    expected: float | None = None
    actual: float | None = None

    def __str__(self) -> str:
        loc = f" [{self.where}]" if self.where else ""
        return f"{self.level} {self.code}{loc} {self.message}"


@dataclass
class TermsCheck:
    """Результат звірки мотивації з умовами під таблицею."""
    parsed: bool
    summary: str
    matched: int = 0
    rows: list[tuple] = field(default_factory=list)   # (підпис, роль, факт, у файлі, за умовами)
    # рядки, де до наступної сходинки виконання забракло менше допуску,
    # а в таблиці порахували вже за нею — беремо число з таблиці
    rounded: list[tuple] = field(default_factory=list)


@dataclass
class BlockResult:
    metric: str
    unit: str
    plan: float | None
    fact: float | None
    bonus_plan: float | None
    bonus_fact: float | None
    promo_terms: str = ""
    source: str = ""
    terms: TermsCheck | None = None


@dataclass
class SourceResult:
    distributor: str
    consolidated_name: str | None
    period: Period
    blocks: list[BlockResult] = field(default_factory=list)
    findings: list[Finding] = field(default_factory=list)

    @property
    def errors(self) -> list[Finding]:
        return [f for f in self.findings if f.level == ERROR]

    @property
    def ok(self) -> bool:
        return not self.errors


def _close(a: float | None, b: float | None, tol: float) -> bool:
    if a is None or b is None:
        return False
    return abs(a - b) <= tol


def check_source(sf: SourceFile, period: Period, cfg: Config,
                 consolidated=None) -> SourceResult:
    rule = cfg.resolve(sf.distributor_raw)
    res = SourceResult(distributor=sf.distributor_raw,
                       consolidated_name=rule.consolidated if rule else None,
                       period=period)
    add = res.findings.append
    tol = cfg.settings.tolerance

    if not rule:
        add(Finding(ERROR, "S0", sf.distributor_raw, period,
                    "дистриб'ютора немає в config/distributors.yaml — "
                    "невідомо, в який рядок зведеної писати"))
        return res

    plan_sheet = sf.find(period, "план")
    fact_sheet = sf.find(period, "факт")
    if not plan_sheet:
        add(Finding(ERROR, "S1", rule.consolidated, period,
                    f"немає аркуша «план» за {period.label}"))

    for sheet in (plan_sheet, fact_sheet):
        if sheet:
            for w in sheet.warnings:
                add(Finding(WARN, "S3", rule.consolidated, period, w,
                            where=sheet.name))

    if not fact_sheet:
        # місяць ще не закритий — вносимо його як плановий
        if plan_sheet:
            add(Finding(INFO, "S2", rule.consolidated, period,
                        f"аркуша «факт» за {period.label} ще немає — місяць "
                        f"вноситься лише плановою частиною"))
            _plan_only(res, plan_sheet, rule, period, tol, add,
                       consolidated, cfg)
            if consolidated is not None:
                _check_consolidated(res, consolidated, rule, period, tol, add)
        return res

    fact_blocks = extract_blocks(fact_sheet.grid)
    plan_blocks = extract_blocks(plan_sheet.grid) if plan_sheet else []
    if not fact_blocks:
        add(Finding(ERROR, "S4", rule.consolidated, period,
                    "не розпізнано жодної таблиці мотивацій",
                    where=fact_sheet.name))
        return res

    for block in fact_blocks:
        if not block.motivated:
            add(Finding(INFO, "S5", rule.consolidated, period,
                        f"блок «{block.title[:45]}» ({block.metric}) без сум "
                        f"мотивації — у зведену не потрапляє",
                        where=f"{fact_sheet.name}!{block.where('plan')}"))
            continue
        _check_arithmetic(block, fact_sheet, rule.consolidated, period, tol, add)
        _check_performance(block, fact_sheet, rule.consolidated, period,
                           cfg, add)
        terms_check = check_terms(block, fact_sheet,
                                  cfg.settings.tier_tolerance)
        if not terms_check.parsed:
            add(Finding(INFO, "M3", rule.consolidated, period,
                        f"мотивацію не звірено з умовами: {terms_check.summary}",
                        where=fact_sheet.name))
        if terms_check.rounded:
            near = "; ".join(
                f"{lbl} — виконання {perf:.1%}, у таблиці {got:,.0f} замість "
                f"{want:,.0f}"
                for lbl, _r, perf, got, want in terms_check.rounded[:3])
            add(Finding(WARN, "M2", rule.consolidated, period,
                        f"{len(terms_check.rounded)} рядків зараховано за "
                        f"наступною сходинкою виконання — беремо числа з "
                        f"таблиці: {near}".replace(",", " "),
                        where=fact_sheet.name))
        if terms_check.rows:
            details = "; ".join(
                f"{lbl} — у файлі {got:,.0f}, за умовами {want:,.0f}"
                for lbl, _r, _f, got, want in terms_check.rows[:3])
            add(Finding(WARN, "M1", rule.consolidated, period,
                        f"{terms_check.summary}: {details}".replace(",", " "),
                        where=fact_sheet.name))

        twin = _match_block(block, plan_blocks)
        if plan_sheet and twin is None:
            add(Finding(WARN, "P0", rule.consolidated, period,
                        f"у плановому аркуші немає блоку «{block.metric}» — "
                        f"плановий бонус узяти нізвідки",
                        where=plan_sheet.name))
        elif twin is not None:
            _check_plan_match(block, twin, plan_sheet, fact_sheet,
                              rule.consolidated, period, tol, add)
            _check_team(block, twin, rule.consolidated, period, add)

        bonus_plan = twin.bonus_total if twin else None
        if block.plan and not bonus_plan:
            # у частини файлів бонус у плановому аркуші рахується формулою
            # від факту, тому до закриття місяця там нуль
            add(Finding(WARN, "B0", rule.consolidated, period,
                        "плановий бонус у план-аркуші порожній — клітинку "
                        "«Бонус план» у зведеній буде залишено незаповненою",
                        where=plan_sheet.name if plan_sheet else ""))
            bonus_plan = None

        res.blocks.append(BlockResult(
            metric=block.metric, unit=block.unit,
            plan=block.plan, fact=block.fact,
            bonus_plan=bonus_plan,
            bonus_fact=block.bonus_total,
            source=f"{fact_sheet.name}!{block.where('plan')}",
            terms=terms_check,
        ))

    _check_promo(sf, period, rule, tol, add)
    if consolidated is not None:
        _check_consolidated(res, consolidated, rule, period, tol, add)
    return res


def _plan_only(res: SourceResult, plan_sheet: SheetInfo, rule,
               period: Period, tol: float, add, cons=None,
               cfg: Config | None = None) -> None:
    """Місяць без факту: беремо з планового аркуша план і плановий бонус.

    Який блок брати, вирішує наявність сум мотивації — так само, як для
    закритого місяця. Якщо серед блоків однієї метрики жоден бонусу не
    має (буває, коли бонус у джерелі рахується формулою від факту),
    лишаємо верхній і повідомляємо про це.
    """
    tier_tolerance = cfg.settings.tier_tolerance if cfg else 0.01
    blocks = extract_blocks(plan_sheet.grid)
    if not blocks:
        add(Finding(ERROR, "S4", rule.consolidated, period,
                    "не розпізнано жодної таблиці мотивацій",
                    where=plan_sheet.name))
        return

    # Унизу планового аркуша зазвичай лежить довідкова таблиця вже
    # закритого місяця. Відрізняємо її за фактом: у місяця, який тільки
    # планується, факт ще порожній.
    fresh = [b for b in blocks if not b.fact]
    for stale in [b for b in blocks if b.fact]:
        add(Finding(INFO, "S6", rule.consolidated, period,
                    f"таблиця «{stale.title[:40]}» уже містить факт "
                    f"({stale.fact:,.0f}) — це довідка за попередній місяць, "
                    f"її пропущено".replace(",", " "),
                    where=f"{plan_sheet.name}!{stale.where('plan')}"))
    if not fresh:
        add(Finding(ERROR, "S4", rule.consolidated, period,
                    "у плановому аркуші всі таблиці вже мають факт — "
                    "не видно, де саме план на новий місяць",
                    where=plan_sheet.name))
        return

    by_metric: dict[str, list[MotivationBlock]] = {}
    for block in fresh:
        by_metric.setdefault(block.metric, []).append(block)

    for metric, group in by_metric.items():
        motivated = [b for b in group if b.motivated]
        if motivated:
            chosen = motivated
        elif _has_row(cons, metric, rule.consolidated):
            # мотивації в джерелі не видно, але рядок у зведеній є —
            # отже, дистриб'ютор за цією метрикою веде план
            chosen = group[:1]
            add(Finding(WARN, "B0", rule.consolidated, period,
                        f"у блоці «{metric}» планового аркуша немає сум "
                        f"мотивації — клітинку «Бонус план» буде залишено "
                        f"незаповненою", where=plan_sheet.name))
        else:
            chosen = []
        for block in group:
            if block not in chosen:
                add(Finding(INFO, "S5", rule.consolidated, period,
                            f"блок «{block.title[:45]}» ({metric}) без сум "
                            f"мотивації — у зведену не потрапляє",
                            where=f"{plan_sheet.name}!{block.where('plan')}"))
        for block in chosen:
            _check_arithmetic(block, plan_sheet, rule.consolidated, period,
                              tol, add)
            res.blocks.append(BlockResult(
                metric=block.metric, unit=block.unit,
                plan=block.plan, fact=None,
                bonus_plan=block.bonus_total or None, bonus_fact=None,
                source=f"{plan_sheet.name}!{block.where('plan')}",
                promo_terms=read_promo(plan_sheet.grid,
                                       block.header_rows[-1]
                                       if block.header_rows else 0),
                terms=check_terms(block, plan_sheet, tier_tolerance),
            ))


def _has_row(cons, metric: str, name: str | None) -> bool:
    if cons is None or not name:
        return False
    table = cons.table_for(metric)
    return bool(table and name in table.rows)


def _match_block(block: MotivationBlock,
                 candidates: list[MotivationBlock]) -> MotivationBlock | None:
    """Знаходить той самий блок у плановому аркуші.

    Збіг планового значення важливіший за наявність сум мотивації:
    внизу планового аркуша часто лежить довідкова таблиця минулого
    місяця, і саме вона — на відміну від власне плану — вже має
    заповнені факти й бонуси.
    """
    same = [c for c in candidates if c.metric == block.metric]
    if not same:
        return None
    for c in same:
        if c.plan is not None and block.plan is not None and \
                abs(c.plan - block.plan) < 0.51:
            return c
    motivated = [c for c in same if c.motivated]
    return (motivated or same)[0]


def check_terms(block: MotivationBlock, sheet: SheetInfo,
                tier_tolerance: float = 0.01) -> TermsCheck:
    """Перераховує мотивацію кожного рядка за умовами під таблицею."""
    text = read_terms(sheet.grid, block.header_rows[-1] if block.header_rows else 0)
    terms = terms_for(text, block.metric)
    if not terms.kind:
        return TermsCheck(False, terms.note or "умови мотивації не розібрано")
    if not terms.applies_to(block.unit):
        return TermsCheck(
            False,
            f"ставка задана в грн/пл, а блок веде облік у «{block.unit}» — "
            f"перерахунок зробити нема з чого")

    # на плановому аркуші факту ще немає, тож плановий бонус звіряємо з
    # умовами при стовідсотковому виконанні — саме так його і рахують
    if not any(i.bonus for i in block.items):
        return TermsCheck(False, "у джерелі не заповнено суми мотивації — "
                                 "звіряти з умовами нема з чим")
    # нуль у підсумковому рядку — теж «факту ще немає»
    at_plan = not any(i.fact for i in block.items)
    matched, bad, rounded = 0, [], []
    for item in block.items:
        if item.bonus is None or item.is_total:
            continue
        role = norm_role(item.label) or ("св" if item.is_subtotal else "тп")
        fact = item.plan if at_plan else item.fact
        want = terms.expected(role, item.plan, fact)
        if want is None:
            continue
        if abs(want - item.bonus) < 1.0:
            matched += 1
            continue
        # виконання майже дотягнуло до наступної сходинки, і в таблиці
        # порахували вже за нею — це рішення дистриб'ютора, число беремо
        # з таблиці, але показуємо
        near = terms.expected(role, item.plan, fact, bump=tier_tolerance)
        if near is not None and abs(near - item.bonus) < 1.0:
            performance = (fact / item.plan) if item.plan else 0.0
            rounded.append((item.label[:34], role, performance,
                            item.bonus, round(want, 2)))
            continue
        bad.append((item.label[:34], role, item.fact, item.bonus, round(want, 2)))

    suffix = " (при 100 % виконання)" if at_plan else ""
    total = matched + len(bad) + len(rounded)
    if not total:
        return TermsCheck(False, "жоден рядок не вдалося зіставити з умовами — "
                                 "перевір ролі у підписах рядків")
    near_note = (f"; у {len(rounded)} виконання майже дотягнуло до наступної "
                 f"сходинки і в таблиці зараховано за нею" if rounded else "")
    if not bad:
        return TermsCheck(True,
                          f"усі {total} рядків відповідають умовам{suffix}"
                          f"{near_note}",
                          matched=matched, rounded=rounded)
    return TermsCheck(True,
                      f"{len(bad)} з {total} рядків не сходяться "
                      f"з умовами{suffix}{near_note}",
                      matched=matched, rows=bad, rounded=rounded)


def _check_arithmetic(block: MotivationBlock, sheet: SheetInfo, name: str,
                      period: Period, tol: float, add) -> None:
    loc = f"{sheet.name}!"
    leaves = block.leaves
    total = block.total
    if not total:
        add(Finding(WARN, "A0", name, period,
                    f"у блоці «{block.metric}» не знайдено підсумкового рядка",
                    where=sheet.name))
        return

    mids = [i for i in block.subtotals]
    for field_name, label in (("plan", "план"), ("fact", "факт")):
        parts = [getattr(i, field_name) for i in leaves
                 if getattr(i, field_name) is not None]
        got = getattr(total, field_name)
        if not parts or got is None:
            continue
        want = sum(parts)
        # у частини дистриб'юторів СВ має власну територію, тож підсумок
        # дорівнює рядкам ТП разом із рядками СВ, а не лише ТП
        with_mids = want + sum(getattr(i, field_name) or 0 for i in mids)
        if _close(want, got, tol) or _close(with_mids, got, tol):
            continue
        add(Finding(ERROR, "A1" if field_name == "plan" else "A2", name,
                    period,
                    f"{label} у підсумковому рядку {got:,.2f}, а сума по "
                    f"{len(parts)} рядках ТП — {want:,.2f} "
                    f"(різниця {got - want:+,.2f})".replace(",", " "),
                    where=f"{loc}{block.where(field_name)}{total.row}",
                    expected=want, actual=got))

    bonuses = [i.bonus for i in block.items
               if i.bonus is not None and not i.is_total]
    if bonuses and block.bonus_total is not None:
        rows_sum = sum(bonuses)
        with_total = rows_sum + (total.bonus or 0)
        if not (_close(rows_sum, block.bonus_total, tol)
                or _close(with_total, block.bonus_total, tol)):
            add(Finding(WARN, "A3", name, period,
                        f"підсумок мотивації {block.bonus_total:,.2f} не збігається "
                        f"із сумою по рядках ({rows_sum:,.2f})".replace(",", " "),
                        where=f"{loc}{block.where('bonus')}",
                        expected=rows_sum, actual=block.bonus_total))


def _check_performance(block: MotivationBlock, sheet: SheetInfo, name: str,
                       period: Period, cfg: Config, add) -> None:
    tol = cfg.settings.tolerance
    for item in block.items:
        if item.plan and item.fact is not None and item.pct is not None:
            want = item.fact / item.plan
            if abs(want - item.pct) > 0.005:
                add(Finding(WARN, "A4", name, period,
                            f"«{item.label[:32]}»: у клітинці % стоїть "
                            f"{item.pct:.1%}, а факт/план дає {want:.1%}",
                            where=f"{sheet.name}!{block.where('pct')}{item.row}",
                            expected=want, actual=item.pct))
    total = block.total
    if total and total.plan and total.fact is not None:
        ratio = total.fact / total.plan
        if not (cfg.settings.performance_min <= ratio <= cfg.settings.performance_max):
            add(Finding(WARN, "N1", name, period,
                        f"виконання по блоку «{block.metric}» = {ratio:.0%} — "
                        f"поза очікуваним коридором",
                        where=f"{sheet.name}!{block.where('fact')}{total.row}"))


def _check_plan_match(fact_block: MotivationBlock, plan_block: MotivationBlock,
                      plan_sheet: SheetInfo, fact_sheet: SheetInfo,
                      name: str, period: Period, tol: float, add) -> None:
    """План у факт-аркуші має дорівнювати плану в план-аркуші."""
    a, b = plan_block.plan, fact_block.plan
    if a is None or b is None:
        return
    if not _close(a, b, tol):
        add(Finding(ERROR, "P1", name, period,
                    f"план у «{plan_sheet.name}» = {a:,.2f}, а в "
                    f"«{fact_sheet.name}» = {b:,.2f} "
                    f"(різниця {b - a:+,.2f})".replace(",", " "),
                    where=f"{plan_sheet.name}!{plan_block.where('plan')}"
                          f"{plan_block.total.row if plan_block.total else ''}",
                    expected=a, actual=b))


def _check_team(fact_block: MotivationBlock, plan_block: MotivationBlock,
                name: str, period: Period, add) -> None:
    def names(block):
        return {i.label.strip().lower() for i in block.leaves if i.label.strip()}

    planned, actual = names(plan_block), names(fact_block)
    gone = planned - actual
    fresh = actual - planned
    if gone or fresh:
        bits = []
        if gone:
            bits.append("зникли: " + ", ".join(sorted(gone)[:4]))
        if fresh:
            bits.append("додались: " + ", ".join(sorted(fresh)[:4]))
        add(Finding(WARN, "P3", name, period,
                    f"склад команди у блоці «{fact_block.metric}» змінився між "
                    f"планом і фактом — {'; '.join(bits)}"))


def _check_promo(sf: SourceFile, period: Period, rule, tol: float, add) -> None:
    name = rule.consolidated
    sheet = sf.find(period, "факт")
    if not sheet:
        return
    block = extract_promo(sheet.grid)
    if not block:
        level = WARN if rule.promo else INFO
        add(Finding(level, "Q5", name, period,
                    "не знайдено «Блок 2. Акції» — рух акційної продукції "
                    "не перевірено", where=sheet.name))
        return

    if block.computed is not None and block.closing is not None:
        if not _close(block.computed, block.closing, tol):
            add(Finding(ERROR, "Q1", name, period,
                        f"залишок {block.closing:,.0f} не дорівнює "
                        f"вхідний {block.opening:,.0f} + прихід "
                        f"{block.shipped:,.0f} − витрата {block.spent:,.0f} "
                        f"= {block.computed:,.0f}".replace(",", " "),
                        where=f"{sheet.name}!{block.cells.get('closing','')}",
                        expected=block.computed, actual=block.closing))

    prev_sheet = sf.find(period.prev, "факт")
    prev = extract_promo(prev_sheet.grid) if prev_sheet else None
    if prev and prev.closing is not None:
        if block.opening is not None and not _close(block.opening, prev.closing, tol):
            add(Finding(ERROR, "Q3", name, period,
                        f"вхідний залишок {block.opening:,.0f} не дорівнює "
                        f"вихідному за {period.prev.label} "
                        f"({prev.closing:,.0f})".replace(",", " "),
                        where=f"{sheet.name}!{block.cells.get('opening','')}",
                        expected=prev.closing, actual=block.opening))
        elif block.opening is None and block.closing is not None:
            _check_carryover(block, prev, sheet, name, period, tol, add)

    if block.closing is not None and block.closing < 0:
        add(Finding(WARN, "Q4", name, period,
                    f"від'ємний залишок акційної продукції: "
                    f"{block.closing:,.0f} пл.".replace(",", " "),
                    where=f"{sheet.name}!{block.cells.get('closing','')}"))


def _balances(block: PromoBlock, prev_closing: float) -> dict[str, float]:
    """Умовності обліку залишку, які трапляються у джерелах."""
    shipped, spent = block.shipped or 0, block.spent or 0
    return {
        # звичайна: до приходу за місяць додається перехідний залишок
        "carried": prev_closing + shipped - spent,
        # перехідний залишок уже входить у число «відвантажено»
        "included": shipped - spent,
        # витрата додана замість віднімання
        "added": prev_closing + shipped + spent,
    }


BALANCE_NOTES = {
    "carried": "перехідний залишок додається до приходу окремо",
    "included": "перехідний залишок уже входить у «відвантажено»",
    "added": "витрата додається до залишку, а не віднімається",
}


def _check_carryover(block: PromoBlock, prev: PromoBlock, sheet: SheetInfo,
                     name: str, period: Period, tol: float, add) -> None:
    """Звірка залишку акційної продукції з попереднім місяцем.

    Дистриб'ютори ведуть облік по-різному. Здебільшого «відвантажено» —
    це прихід саме за місяць, і перехідний залишок додається окремо. Але
    буває, що він уже входить у це число: тоді про це сказано в підписі
    («+ залишок з травня») або видно з формули, яка посилається на аркуш
    минулого місяця. Якщо цього не помітити, залишок додається двічі й
    звірка показує розбіжність там, де насправді все сходиться.
    """
    closing = block.closing
    options = _balances(block, prev.closing)
    expected = "included" if block.carryover_in_shipped else "carried"

    if _close(options[expected], closing, tol):
        return

    formula = block.formulas.get("closing")
    hint = f" Формула залишку: {formula}." if formula else ""

    for other, value in options.items():
        if other == expected or not _close(value, closing, tol):
            continue
        level = INFO if other == "included" else WARN
        add(Finding(level, "Q6", name, period,
                    f"залишок сходиться за іншою умовністю: "
                    f"{BALANCE_NOTES[other]}." +
                    ("" if level == INFO else " Перевір, чи так і задумано.") +
                    hint,
                    where=f"{sheet.name}!{block.cells.get('closing','')}"))
        return

    add(Finding(ERROR, "Q2", name, period,
                (f"залишок {closing:,.0f} не сходиться з попереднім місяцем: "
                 f"{prev.closing:,.0f} + прихід {block.shipped or 0:,.0f} − "
                 f"витрата {block.spent or 0:,.0f} = "
                 f"{options['carried']:,.0f}").replace(",", " ") +
                f" Перевір формулу залишку.{hint}",
                where=f"{sheet.name}!{block.cells.get('closing','')}",
                expected=options["carried"], actual=closing))


def _check_consolidated(res: SourceResult, cons, rule, period: Period,
                        tol: float, add) -> None:
    """Звірка з тим, що вже лежить у зведеній за цей і попередній місяць."""
    name = rule.consolidated
    for block in res.blocks:
        table = cons.table_for(block.metric)
        if table is None or name not in table.rows:
            add(Finding(ERROR, "C0", name, period,
                        f"у зведеній немає рядка «{name}» у таблиці "
                        f"«{block.metric}» — нема куди писати {block.metric}"))
            continue

        current = cons.read(period, block.metric, name)
        for key, got, label in (("plan", block.plan, "план"),
                                ("fact", block.fact, "факт"),
                                ("bonus_plan", block.bonus_plan, "бонус план"),
                                ("bonus_fact", block.bonus_fact, "бонус факт")):
            have = current.get(key)
            if isinstance(have, (int, float)) and got is not None \
                    and not _close(float(have), got, tol):
                add(Finding(ERROR, "C2", name, period,
                            f"{label} у зведеній {float(have):,.2f} ≠ "
                            f"{got:,.2f} у джерелі".replace(",", " "),
                            expected=got, actual=float(have)))

        prev = cons.read(period.prev, block.metric, name)
        prev_fact = prev.get("fact")
        if not isinstance(prev_fact, (int, float)):
            add(Finding(WARN, "C3", name, period,
                        f"у зведеній немає факту за {period.prev.label} "
                        f"({block.metric}) — приріст порахувати не буде з чого"))


def cost_history(cons, name: str, metric: str, period: Period,
                 months: int = 6) -> list[float]:
    out = []
    for i in range(1, months + 1):
        row = cons.read(period.shift(-i), metric, name)
        bonus, fact = row.get("bonus_fact"), row.get("fact")
        if isinstance(bonus, (int, float)) and isinstance(fact, (int, float)) and fact:
            out.append(bonus / fact)
    return out


def check_cost(res: SourceResult, cons, cfg: Config) -> None:
    """Затратність на одиницю не повинна різко вибиватись з історії."""
    name = res.consolidated_name
    if not name:
        return
    for block in res.blocks:
        if not block.fact or block.bonus_fact is None:
            continue
        hist = cost_history(cons, name, block.metric, res.period)
        if len(hist) < 3:
            continue
        median = statistics.median(hist)
        current = block.bonus_fact / block.fact
        if median and current > median * cfg.settings.cost_deviation:
            res.findings.append(Finding(
                WARN, "N2", name, res.period,
                f"затратність {current:.2f} грн на одиницю проти медіани "
                f"{median:.2f} за пів року — перевір ставку мотивації"))
