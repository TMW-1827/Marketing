"""Формування звіту про перевірку."""

from __future__ import annotations

from .rules import SourceResult, ERROR, WARN, INFO

MARK = {ERROR: "✗", WARN: "!", INFO: "·"}
ORDER = {ERROR: 0, WARN: 1, INFO: 2}
METRIC_LABEL = {"sales": "продажі", "akb": "АКБ", "revenue": "сума ВП"}


def _num(v):
    if v is None:
        return "—"
    if abs(v - round(v)) < 0.005:
        return f"{round(v):,}".replace(",", " ")
    return f"{v:,.2f}".replace(",", " ")


def render(results: list[SourceResult], period, title: str = "") -> str:
    lines: list[str] = []
    errors = sum(len(r.errors) for r in results)
    warns = sum(1 for r in results for f in r.findings if f.level == WARN)
    ready = [r for r in results if r.ok and r.blocks]

    lines.append(f"ПЕРЕВІРКА ДЖЕРЕЛ ЗА {period.label.upper()}")
    if title:
        lines.append(title)
    lines.append("=" * 78)
    lines.append(
        f"файлів: {len(results)}   готових до внесення: {len(ready)}   "
        f"помилок: {errors}   попереджень: {warns}")
    lines.append("")

    for res in sorted(results, key=lambda r: (r.ok, r.distributor)):
        name = res.consolidated_name or res.distributor
        status = "ГОТОВО" if res.ok else "БЛОКОВАНО"
        lines.append(f"── {name}  [{status}]")
        for b in res.blocks:
            lines.append(
                f"     {METRIC_LABEL.get(b.metric, b.metric):9} "
                f"план {_num(b.plan):>12}  факт {_num(b.fact):>12}  "
                f"бонус план {_num(b.bonus_plan):>10}  "
                f"бонус факт {_num(b.bonus_fact):>10}   ({b.unit})")
        for f in sorted(res.findings, key=lambda f: ORDER[f.level]):
            loc = f"  →  {f.where}" if f.where else ""
            lines.append(f"     {MARK[f.level]} {f.code}  {f.message}{loc}")
        lines.append("")

    if errors:
        lines.append("-" * 78)
        lines.append(
            "Місяць не вноситься у зведену, поки лишаються позначки ✗.")
        lines.append(
            "Виправ джерела і запусти перевірку ще раз, або внеси лише "
            "готових: --only \"Назва\"")
    else:
        lines.append("-" * 78)
        lines.append("Помилок немає. Внести у зведену: команда apply --confirm")
    return "\n".join(lines)


def render_apply(applied: list[tuple[str, str, list[str]]],
                 fixed: list[str], out_path: str,
                 dropped: list[str] | None = None) -> str:
    lines = ["ВНЕСЕНО У ЗВЕДЕНУ", "=" * 78]
    for name, metric, cells in applied:
        lines.append(f"  {name:26} {METRIC_LABEL.get(metric, metric):9} "
                     f"{', '.join(cells)}")
    if fixed:
        lines.append("")
        lines.append("Виправлені діапазони у рядках «Сума»:")
        for f in fixed:
            lines.append(f"  {f}")
    if dropped:
        lines.append("")
        lines.append("Втрачено при закритті місяця (перенеси вручну, якщо треба):")
        for d in dropped:
            lines.append(f"  {d}")
    lines.append("")
    lines.append(f"Файл збережено: {out_path}")
    return "\n".join(lines)
