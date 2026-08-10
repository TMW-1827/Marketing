"""Збирає web/vendor/pylibs.zip — бібліотеки, потрібні сторінці у браузері.

Сторінка не ставить пакети з PyPI під час роботи: інакше вона залежала б
від мережі й від того, яка версія опиниться на PyPI сьогодні. Замість
цього всі чотири бібліотеки (усі — на чистому Python) лежать в одному
архіві поруч зі сторінкою.

Перезібрати після оновлення версій:

    python tools/build_vendor.py
"""

from __future__ import annotations

import io
import json
import os
import shutil
import tarfile
import tempfile
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "web", "vendor", "pylibs.zip")

# колеса мають бути придатні для будь-якої платформи (py3-none-any),
# інакше вони не запрацюють у WebAssembly
WHEELS = {"openpyxl": "3.1.5", "et_xmlfile": "2.0.0", "xlrd": "2.0.2"}
# PyYAML постачається з прискорювачем на C; у браузері потрібна чиста
# реалізація, тому беремо її з архіву з вихідним кодом
PYYAML = ("PyYAML", "6.0.2")


def pypi_files(name: str, version: str) -> list[dict]:
    url = f"https://pypi.org/pypi/{name}/{version}/json"
    with urllib.request.urlopen(url, timeout=60) as resp:
        return json.load(resp)["urls"]


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=120) as resp:
        return resp.read()


def main() -> None:
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        staging = os.path.join(tmp, "stage")
        os.makedirs(staging)

        for name, version in WHEELS.items():
            entry = next(f for f in pypi_files(name, version)
                         if f["filename"].endswith("py3-none-any.whl"))
            with zipfile.ZipFile(io.BytesIO(fetch(entry["url"]))) as zf:
                zf.extractall(staging)
            print(f"  {entry['filename']}")

        name, version = PYYAML
        entry = next(f for f in pypi_files(name, version)
                     if f["packagetype"] == "sdist")
        with tarfile.open(fileobj=io.BytesIO(fetch(entry["url"]))) as tf:
            tf.extractall(tmp, filter="data")
        shutil.copytree(os.path.join(tmp, f"{name.lower()}-{version}", "lib", "yaml"),
                        os.path.join(staging, "yaml"))
        print(f"  {entry['filename']} (тільки чистий Python)")

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as out:
            for root, _dirs, files in os.walk(staging):
                for fname in sorted(files):
                    if fname.endswith((".pyc", ".so", ".pyd")):
                        continue
                    full = os.path.join(root, fname)
                    out.write(full, os.path.relpath(full, staging))
        with open(OUT, "wb") as fh:
            fh.write(buf.getvalue())

    print(f"{OUT} — {os.path.getsize(OUT) / 1024:.0f} КБ")


if __name__ == "__main__":
    main()
