"""Веб-інтерфейс: завантажив файл — побачив перевірку — підтвердив.

Розрахований на роботу без командного рядка. Тримає робочу теку, в якій
лежить зведена таблиця і завантажені файли дистриб'юторів; жоден запис
у зведену не відбувається без явного підтвердження в інтерфейсі.
"""

from __future__ import annotations

import os
import shutil
import traceback
import uuid
from dataclasses import dataclass, field

from flask import Flask, jsonify, render_template, request, send_file

from . import config as cfgmod
from .consolidated import Consolidated
from .discover import scan_file
from .months import Period
from .rules import check_source, check_cost
from .xlio import load

WORKDIR = os.environ.get(
    "MC_WORKDIR",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                 "workdir"))
UPLOADS = os.path.join(WORKDIR, "uploads")
CONSOLIDATED = os.path.join(WORKDIR, "zvedena.xlsx")
BACKUPS = os.path.join(WORKDIR, "backups")

LEVEL_ORDER = {"ERROR": 0, "WARN": 1, "INFO": 2}
METRIC_LABEL = {"sales": "продажі", "akb": "АКБ", "revenue": "сума ВП"}

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024 * 1024


@dataclass
class Upload:
    uid: str
    filename: str
    path: str
    analyses: list[dict] = field(default_factory=list)


UPLOADED: dict[str, Upload] = {}
# картка -> (файл, розбір); один файл дає одну-дві картки
CARDS: dict[str, tuple[Upload, dict]] = {}


def _ensure_dirs() -> None:
    for path in (WORKDIR, UPLOADS, BACKUPS):
        os.makedirs(path, exist_ok=True)


def _has_consolidated() -> bool:
    return os.path.exists(CONSOLIDATED)


def _fmt(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return round(float(value), 2)
    return value


def analyse(upload: Upload) -> list[dict]:
    """Розбирає файл. Один файл несе і факт місяця, і план наступного."""
    load.cache_clear()
    cfg = cfgmod.load()
    try:
        sf = scan_file(upload.path)
    except Exception as exc:                              # noqa: BLE001
        return [{"uid": upload.uid, "filename": upload.filename,
                 "fatal": f"файл не читається: {exc}"}]

    if not sf.periods():
        return [{"uid": upload.uid, "filename": upload.filename,
                 "distributor": sf.distributor_raw,
                 "fatal": "у файлі не знайдено жодного місяця — перевір "
                          "заголовки аркушів"}]

    cons = Consolidated(CONSOLIDATED) if _has_consolidated() else None
    out = [_analyse_period(upload, sf, cfg, cons, period)
           for period in _periods_to_apply(sf, cons)]
    if not out:
        out.append({"uid": upload.uid, "filename": upload.filename,
                    "distributor": sf.distributor_raw,
                    "fatal": "усе, що є в цьому файлі, вже внесено у зведену"})
    return out


def _analyse_period(upload: Upload, sf, cfg, cons, period: Period) -> dict:
    rule = cfg.resolve(sf.distributor_raw)
    res = check_source(sf, period, cfg, cons)
    if cons is not None:
        check_cost(res, cons, cfg)

    findings = sorted(res.findings, key=lambda f: LEVEL_ORDER[f.level])
    new_month = bool(cons and not cons.block(period))

    return {
        "uid": f"{upload.uid}#{period}",
        "filename": upload.filename,
        "distributor": sf.distributor_raw,
        "consolidated_name": res.consolidated_name,
        "known": rule is not None,
        "period": str(period),
        "period_label": period.label,
        "kind": "план" if all(b.fact is None for b in res.blocks) and res.blocks
                else "факт",
        "new_month": new_month,
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


def _periods_to_apply(sf, cons) -> list[Period]:
    """Які місяці цей файл приносить у зведену.

    Типовий файл несе одразу дві речі: факт місяця, що завершився, і план
    на наступний. Показуємо їх окремо — закрити місяць і відкрити новий
    це різні дії, і підтверджувати їх треба свідомо.
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


# -- маршрути ---------------------------------------------------------------

@app.get("/")
def index():
    _ensure_dirs()
    return render_template("index.html",
                           has_consolidated=_has_consolidated())


@app.get("/api/state")
def state():
    _ensure_dirs()
    info = {"has_consolidated": _has_consolidated(),
            "uploads": len(UPLOADED)}
    if _has_consolidated():
        cons = Consolidated(CONSOLIDATED)
        info["last_month"] = cons.blocks[-1].period.label if cons.blocks else "—"
        info["months"] = len(cons.blocks)
        info["distributors"] = sorted({n for t in cons.tables for n in t.rows})
    return jsonify(info)


@app.post("/api/consolidated")
def upload_consolidated():
    _ensure_dirs()
    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "файл не передано"}), 400
    if not file.filename.lower().endswith((".xlsx", ".xlsm")):
        return jsonify({"error": "зведена має бути у форматі .xlsx"}), 400
    file.save(CONSOLIDATED)
    try:
        cons = Consolidated(CONSOLIDATED)
    except Exception as exc:                              # noqa: BLE001
        os.remove(CONSOLIDATED)
        return jsonify({"error": f"не вдалося прочитати зведену: {exc}"}), 400
    return jsonify({"ok": True,
                    "months": len(cons.blocks),
                    "last_month": cons.blocks[-1].period.label})


@app.post("/api/upload")
def upload_sources():
    _ensure_dirs()
    out = []
    for file in request.files.getlist("files"):
        if not file.filename:
            continue
        if not file.filename.lower().endswith((".xls", ".xlsx", ".xlsm")):
            out.append({"filename": file.filename,
                        "fatal": "підтримуються лише файли Excel"})
            continue
        uid = uuid.uuid4().hex[:12]
        path = os.path.join(UPLOADS, f"{uid}__{file.filename}")
        file.save(path)
        upload = Upload(uid=uid, filename=file.filename, path=path)
        UPLOADED[uid] = upload
        try:
            upload.analyses = analyse(upload)
        except Exception:                                 # noqa: BLE001
            upload.analyses = [{"uid": uid, "filename": file.filename,
                                "fatal": "не вдалося розібрати файл",
                                "trace": traceback.format_exc(limit=3)}]
        for card in upload.analyses:
            CARDS[card["uid"]] = (upload, card)
        out.extend(upload.analyses)
    return jsonify({"files": out})


@app.post("/api/reanalyse")
def reanalyse():
    out = []
    CARDS.clear()
    for upload in list(UPLOADED.values()):
        upload.analyses = analyse(upload)
        for card in upload.analyses:
            CARDS[card["uid"]] = (upload, card)
        out.extend(upload.analyses)
    return jsonify({"files": out})


@app.post("/api/preview")
def preview():
    """Що саме буде записано — показуємо перед підтвердженням."""
    uids = request.json.get("uids") or []
    if not _has_consolidated():
        return jsonify({"error": "спершу завантаж зведену таблицю"}), 400
    cons = Consolidated(CONSOLIDATED)
    plan_rows, new_months = [], []
    for uid in _ordered(uids):
        entry = CARDS.get(uid)
        if not entry or not entry[1].get("ok"):
            continue
        info = entry[1]
        period = Period(*map(int, info["period"].split("-")))
        if not cons.block(period) and str(period) not in new_months:
            new_months.append(str(period))
        for block in info["blocks"]:
            plan_rows.append({
                "distributor": info["consolidated_name"],
                "metric": block["metric_label"],
                "period": info["period_label"],
                "plan": block["plan"], "fact": block["fact"],
                "bonus_plan": block["bonus_plan"],
                "bonus_fact": block["bonus_fact"],
                "promo": bool(block["promo_terms"]),
            })
    last = cons.blocks[-1] if cons.blocks else None
    return jsonify({
        "rows": plan_rows,
        "new_months": new_months,
        "closing": (last.period.label
                    if new_months and last and not last.closed else None),
    })


@app.post("/api/apply")
def apply():
    uids = request.json.get("uids") or []
    fix_totals = bool(request.json.get("fix_totals"))
    if not _has_consolidated():
        return jsonify({"error": "спершу завантаж зведену таблицю"}), 400

    backup = os.path.join(BACKUPS, f"zvedena_{uuid.uuid4().hex[:8]}.xlsx")
    shutil.copy(CONSOLIDATED, backup)

    cons = Consolidated(CONSOLIDATED)
    applied, skipped = [], []
    for uid in _ordered(uids):
        entry = CARDS.get(uid)
        if not entry:
            continue
        info = entry[1]
        if not info.get("ok"):
            skipped.append({"name": info.get("consolidated_name")
                            or info.get("filename"),
                            "reason": "лишились помилки"})
            continue
        period = Period(*map(int, info["period"].split("-")))
        try:
            cons.ensure_month(period)
        except ValueError as exc:
            skipped.append({"name": info["consolidated_name"],
                            "reason": str(exc)})
            continue
        for block in info["blocks"]:
            values = {
                "plan": block["plan"], "fact": block["fact"],
                "bonus_plan": block["bonus_plan"],
                "bonus_fact": block["bonus_fact"],
                "promo_terms": block["promo_terms"] or None,
            }
            try:
                cells = cons.write(period, block["metric"],
                                   info["consolidated_name"], values)
            except ValueError as exc:
                skipped.append({"name": info["consolidated_name"],
                                "reason": str(exc)})
                continue
            applied.append({"name": info["consolidated_name"],
                            "metric": block["metric_label"],
                            "period": info["period_label"],
                            "cells": cells})
    fixed = cons.refresh_totals() if fix_totals else []
    cons.save()
    for uid in uids:
        CARDS.pop(uid, None)

    return jsonify({"applied": applied, "skipped": skipped,
                    "fixed": fixed, "dropped": cons.dropped,
                    "backup": os.path.basename(backup)})


def _ordered(uids: list[str]) -> list[str]:
    """Хронологічно: спершу закрити старий місяць, потім відкрити новий."""
    def key(uid: str):
        card = CARDS.get(uid)
        return card[1].get("period", "") if card else ""
    return sorted(uids, key=key)


@app.get("/api/download")
def download():
    if not _has_consolidated():
        return jsonify({"error": "зведеної немає"}), 404
    return send_file(CONSOLIDATED, as_attachment=True,
                     download_name="Зведена таблиця мотивацій.xlsx")


@app.post("/api/reset")
def reset():
    """Прибирає завантажені файли дистриб'юторів, зведену лишає."""
    UPLOADED.clear()
    CARDS.clear()
    if os.path.isdir(UPLOADS):
        shutil.rmtree(UPLOADS)
    os.makedirs(UPLOADS, exist_ok=True)
    return jsonify({"ok": True})


def main() -> None:
    _ensure_dirs()
    port = int(os.environ.get("MC_PORT", "8000"))
    print(f"Відкрий у браузері:  http://127.0.0.1:{port}")
    print(f"Робоча тека:         {WORKDIR}")
    app.run(host=os.environ.get("MC_HOST", "127.0.0.1"), port=port,
            debug=False)


if __name__ == "__main__":
    main()
