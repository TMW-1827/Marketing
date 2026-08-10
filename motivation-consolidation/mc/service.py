"""Спільний шар між інтерфейсами.

Той самий код обслуговує і браузер (через Pyodide), і командний рядок.
Працює з файлами на диску — у браузері це віртуальна файлова система
Pyodide, тож решта модулів не знає, де вона виконується.

Назовні віддає лише прості словники й списки, щоб їх можна було без
перетворень передати у JavaScript.
"""

from __future__ import annotations

import os
import shutil
import traceback

from . import config as cfgmod
from .consolidated import Consolidated
from .discover import scan_file
from .months import Period
from .rules import check_source, check_cost
from .xlio import load

LEVEL_ORDER = {"ERROR": 0, "WARN": 1, "INFO": 2}

# зведена перечитується для кожного файлу-джерела, а це книга на 240
# колонок; тримаємо розібрану копію, поки файл на диску не змінився
_CONS_CACHE: dict[str, tuple[float, Consolidated]] = {}
METRIC_LABEL = {"sales": "продажі", "akb": "АКБ", "revenue": "сума ВП"}


def _fmt(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return round(float(value), 2)
    return value


def _read_consolidated(path: str) -> Consolidated:
    """Читає зведену, повторно використовуючи розбір незміненого файлу.

    Об'єкт віддається лише для читання; ті, хто пише, беруть свіжу копію.
    """
    stamp = os.path.getmtime(path)
    cached = _CONS_CACHE.get(path)
    if cached and cached[0] == stamp:
        return cached[1]
    cons = Consolidated(path)
    _CONS_CACHE[path] = (stamp, cons)
    return cons


def consolidated_info(path: str) -> dict:
    """Коротка довідка про зведену — щоб показати, що саме завантажено."""
    cons = _read_consolidated(path)
    return {
        "months": len(cons.blocks),
        "last_month": cons.blocks[-1].period.label if cons.blocks else "—",
        "last_closed": bool(cons.blocks and cons.blocks[-1].closed),
        "distributors": sorted({n for t in cons.tables for n in t.rows}),
    }


def analyse(path: str, filename: str, consolidated: str | None = None,
            config_path: str | None = None) -> list[dict]:
    """Розбирає файл дистриб'ютора.

    Один файл зазвичай приносить дві речі — факт місяця, що завершився,
    і план на наступний, — тому повертається список карток.
    """
    load.cache_clear()
    cfg = cfgmod.load(config_path)
    try:
        sf = scan_file(path)
    except Exception as exc:                              # noqa: BLE001
        return [{"filename": filename,
                 "fatal": f"файл не читається: {exc}"}]

    if not sf.periods():
        return [{"filename": filename, "distributor": sf.distributor_raw,
                 "fatal": "у файлі не знайдено жодного місяця — перевір "
                          "заголовки аркушів"}]

    cons = _read_consolidated(consolidated) if consolidated and \
        os.path.exists(consolidated) else None
    cards = [_card(sf, cfg, cons, period, filename)
             for period in periods_to_apply(sf, cons)]
    if not cards:
        cards.append({"filename": filename, "distributor": sf.distributor_raw,
                      "fatal": "усе, що є в цьому файлі, вже внесено "
                               "у зведену"})
    return cards


def _card(sf, cfg, cons, period: Period, filename: str) -> dict:
    rule = cfg.resolve(sf.distributor_raw)
    res = check_source(sf, period, cfg, cons)
    if cons is not None:
        check_cost(res, cons, cfg)

    findings = sorted(res.findings, key=lambda f: LEVEL_ORDER[f.level])
    return {
        "filename": filename,
        "distributor": sf.distributor_raw,
        "consolidated_name": res.consolidated_name,
        "known": rule is not None,
        "period": str(period),
        "period_label": period.label,
        "kind": "план" if res.blocks and all(b.fact is None for b in res.blocks)
                else "факт",
        "new_month": bool(cons and not cons.block(period)),
        "ok": res.ok,
        "blocks": [{
            "metric": b.metric,
            "metric_label": METRIC_LABEL.get(b.metric, b.metric),
            "unit": b.unit,
            "plan": _fmt(b.plan), "fact": _fmt(b.fact),
            "bonus_plan": _fmt(b.bonus_plan), "bonus_fact": _fmt(b.bonus_fact),
            "promo_terms": b.promo_terms,
            "terms": ({
                "parsed": b.terms.parsed,
                "summary": b.terms.summary,
                "matched": b.terms.matched,
                "rows": [{"label": r[0], "role": r[1], "fact": _fmt(r[2]),
                          "actual": _fmt(r[3]), "expected": _fmt(r[4])}
                         for r in b.terms.rows],
            } if b.terms else None),
        } for b in res.blocks],
        "findings": [{"level": f.level, "code": f.code,
                      "message": f.message, "where": f.where}
                     for f in findings],
        "counts": {
            "error": sum(1 for f in findings if f.level == "ERROR"),
            "warn": sum(1 for f in findings if f.level == "WARN"),
        },
    }


def periods_to_apply(sf, cons) -> list[Period]:
    """Які місяці цей файл приносить у зведену.

    Закрити місяць і відкрити новий — різні дії, тому вони й показуються
    окремо, і підтверджуються окремо.
    """
    facts = sorted({s.period for s in sf.sheets
                    if s.period and s.kind == "факт"})
    plans = sorted({s.period for s in sf.sheets
                    if s.period and s.kind == "план"})
    latest_fact = facts[-1] if facts else None
    latest_plan = plans[-1] if plans else None

    out: list[Period] = []
    if latest_fact is not None:
        block = cons.block(latest_fact) if cons else None
        if block is None or not block.closed:
            out.append(latest_fact)
    if latest_plan is not None and (latest_fact is None
                                    or latest_plan > latest_fact):
        out.append(latest_plan)
    return out


def _period_of(card: dict) -> Period:
    year, month = card["period"].split("-")
    return Period(int(year), int(month))


def preview(cards: list[dict], consolidated: str) -> dict:
    """Що саме буде записано — показуємо до підтвердження."""
    cons = _read_consolidated(consolidated)
    rows, new_months = [], []
    for card in sorted(cards, key=lambda c: c.get("period", "")):
        if not card.get("ok"):
            continue
        period = _period_of(card)
        if not cons.block(period) and str(period) not in new_months:
            new_months.append(str(period))
        for block in card["blocks"]:
            rows.append({
                "distributor": card["consolidated_name"],
                "metric": block["metric_label"],
                "period": card["period_label"],
                "plan": block["plan"], "fact": block["fact"],
                "bonus_plan": block["bonus_plan"],
                "bonus_fact": block["bonus_fact"],
                "promo": bool(block["promo_terms"]),
            })
    last = cons.blocks[-1] if cons.blocks else None
    return {
        "rows": rows,
        "new_months": new_months,
        "closing": (last.period.label
                    if new_months and last and not last.closed else None),
    }


def apply_cards(cards: list[dict], consolidated: str,
                fix_totals: bool = False, backup_dir: str | None = None) -> dict:
    """Записує підтверджені картки у зведену."""
    backup = None
    if backup_dir:
        os.makedirs(backup_dir, exist_ok=True)
        backup = os.path.join(backup_dir, "zvedena_backup.xlsx")
        shutil.copy(consolidated, backup)

    cons = Consolidated(consolidated)
    applied, skipped = [], []
    # хронологічно: спершу закрити старий місяць, потім відкрити новий
    for card in sorted(cards, key=lambda c: c.get("period", "")):
        if not card.get("ok"):
            skipped.append({"name": card.get("consolidated_name")
                            or card.get("filename"),
                            "reason": "лишились помилки"})
            continue
        period = _period_of(card)
        try:
            cons.ensure_month(period)
        except ValueError as exc:
            skipped.append({"name": card["consolidated_name"],
                            "reason": str(exc)})
            continue
        for block in card["blocks"]:
            values = {
                "plan": block["plan"], "fact": block["fact"],
                "bonus_plan": block["bonus_plan"],
                "bonus_fact": block["bonus_fact"],
                # умови акцій на новий місяць беруться з планового аркуша
                "promo_terms": block["promo_terms"] or None,
            }
            try:
                cells = cons.write(period, block["metric"],
                                   card["consolidated_name"], values)
            except ValueError as exc:
                skipped.append({"name": card["consolidated_name"],
                                "reason": str(exc)})
                continue
            applied.append({"name": card["consolidated_name"],
                            "metric": block["metric_label"],
                            "period": card["period_label"],
                            "cells": cells})

    fixed = cons.refresh_totals() if fix_totals else []
    cons.save()
    return {"applied": applied, "skipped": skipped, "fixed": fixed,
            "dropped": cons.dropped,
            "backup": os.path.basename(backup) if backup else None}


def safe_analyse(path: str, filename: str, consolidated: str | None = None,
                 config_path: str | None = None) -> list[dict]:
    """Той самий розбір, але будь-яка несподівана помилка стає карткою.

    У браузері немає куди подивитись трасування, тож воно має долетіти
    до інтерфейсу разом із файлом, на якому все зламалось.
    """
    try:
        return analyse(path, filename, consolidated, config_path)
    except Exception:                                     # noqa: BLE001
        return [{"filename": filename,
                 "fatal": "не вдалося розібрати файл",
                 "trace": traceback.format_exc(limit=4)}]
