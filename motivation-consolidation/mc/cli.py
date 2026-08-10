"""Командний рядок: перевірка джерел і внесення місяця у зведену."""

from __future__ import annotations

import argparse
import glob
import os
import sys

from . import config as cfgmod
from . import report
from .consolidated import Consolidated
from .discover import scan_file
from .months import Period
from .rules import check_source, check_cost

EXTS = (".xls", ".xlsx", ".xlsm")


def _sources(paths: list[str], consolidated: str) -> list[str]:
    out = []
    for p in paths:
        if os.path.isdir(p):
            for ext in EXTS:
                out += glob.glob(os.path.join(p, f"*{ext}"))
        else:
            out.append(p)
    real = os.path.realpath(consolidated) if consolidated else None
    files = [f for f in sorted(set(out))
             if not os.path.basename(f).startswith("~$")
             and os.path.realpath(f) != real]
    return files


def _parse_period(text: str) -> Period:
    year, month = text.split("-")
    return Period(int(year), int(month))


def _detect_period(files: list[str]) -> Period | None:
    """Найсвіжіший місяць, у якого є факт-аркуші хоча б у половині файлів."""
    counts: dict[Period, int] = {}
    for path in files:
        try:
            sf = scan_file(path)
        except Exception:
            continue
        for sheet in sf.sheets:
            if sheet.period and sheet.kind == "факт":
                counts[sheet.period] = counts.get(sheet.period, 0) + 1
    if not counts:
        return None
    threshold = max(1, len(files) // 2)
    good = [p for p, n in counts.items() if n >= threshold]
    return max(good) if good else max(counts)


def _run_checks(args) -> tuple[list, Period, Consolidated]:
    cfg = cfgmod.load(args.config)
    files = _sources(args.sources, args.consolidated)
    if not files:
        sys.exit("не знайдено жодного файлу-джерела")
    period = _parse_period(args.period) if args.period else _detect_period(files)
    if not period:
        sys.exit("не вдалося визначити місяць — вкажи --period РРРР-ММ")

    cons = Consolidated(args.consolidated) if args.consolidated else None
    results = []
    for path in files:
        try:
            sf = scan_file(path)
        except Exception as exc:                      # noqa: BLE001
            print(f"! {os.path.basename(path)}: не читається — {exc}",
                  file=sys.stderr)
            continue
        res = check_source(sf, period, cfg, cons)
        if cons is not None:
            check_cost(res, cons, cfg)
        results.append(res)
    return results, period, cons


def cmd_validate(args) -> int:
    results, period, _ = _run_checks(args)
    print(report.render(results, period,
                        f"джерела: {', '.join(args.sources)}"))
    return 1 if any(not r.ok for r in results) else 0


def cmd_apply(args) -> int:
    results, period, cons = _run_checks(args)
    if cons is None:
        sys.exit("для внесення потрібен --consolidated")

    blocked = [r for r in results if not r.ok]
    only = set(args.only or [])
    usable = [r for r in results if r.ok and r.blocks
              and (not only or r.consolidated_name in only)]

    if blocked and not only:
        print(report.render(results, period))
        print()
        print("Нічого не внесено: спершу треба розібратися з помилками ✗.")
        return 1
    if not args.confirm:
        print(report.render(results, period))
        print()
        print(f"Готово до внесення: {len(usable)} дистриб'юторів. "
              f"Додай --confirm, щоб записати.")
        return 0

    cons.ensure_month(period)
    applied = []
    for res in usable:
        for block in res.blocks:
            values = {
                "plan": block.plan,
                "fact": block.fact,
                "bonus_plan": block.bonus_plan,
                "bonus_fact": block.bonus_fact,
                # умови акцій на новий місяць беруться з планового аркуша
                "promo_terms": block.promo_terms or None,
            }
            try:
                cells = cons.write(period, block.metric,
                                   res.consolidated_name, values)
            except ValueError as exc:
                print(f"! {res.consolidated_name}: {exc}", file=sys.stderr)
                continue
            applied.append((res.consolidated_name, block.metric, cells))

    fixed = cons.refresh_totals() if args.fix_totals else []
    out = args.out or args.consolidated
    cons.save(out)
    print(report.render_apply(applied, fixed, out, cons.dropped))
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        prog="mc", description="Перевірка файлів дистриб'юторів і "
                               "формування зведеної таблиці мотивацій")
    parser.add_argument("--config", help="шлях до distributors.yaml")
    sub = parser.add_subparsers(dest="cmd", required=True)

    def common(p):
        p.add_argument("sources", nargs="+",
                       help="файли або тека з файлами дистриб'юторів")
        p.add_argument("-c", "--consolidated", required=True,
                       help="зведений файл")
        p.add_argument("-p", "--period", help="місяць РРРР-ММ "
                                              "(типово — найсвіжіший спільний)")

    p_val = sub.add_parser("validate", help="перевірити джерела")
    common(p_val)
    p_val.set_defaults(func=cmd_validate)

    p_app = sub.add_parser("apply", help="внести місяць у зведену")
    common(p_app)
    p_app.add_argument("--confirm", action="store_true",
                       help="власне записати (без прапорця — тільки показати)")
    p_app.add_argument("--only", nargs="*",
                       help="внести лише вказаних дистриб'юторів")
    p_app.add_argument("--out", help="куди зберегти (типово — поверх зведеної)")
    p_app.add_argument("--fix-totals", action="store_true",
                       help="заразом перебудувати діапазони у рядках «Сума»")
    p_app.set_defaults(func=cmd_apply)

    args = parser.parse_args(argv)
    return args.func(args)
