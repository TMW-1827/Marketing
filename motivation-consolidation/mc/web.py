"""Локальний запуск того самого інтерфейсу, що й на GitHub Pages.

Сторінка статична: уся обробка Excel відбувається у браузері через
Pyodide, який виконує пакет `mc` з цього ж репозиторію. Тут потрібен
лише файловий сервер — щоб браузер міг забрати сторінку і модулі
(зі сторінки, відкритої як file://, fetch до сусідніх файлів заборонений).

    python -m mc.web
"""

from __future__ import annotations

import http.server
import os
import socketserver
import webbrowser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # сторінка й модулі змінюються під час роботи — кеш тут тільки заважає
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):        # тиша замість журналу запитів
        pass


def main() -> None:
    port = int(os.environ.get("MC_PORT", "8000"))
    url = f"http://127.0.0.1:{port}/web/"
    with socketserver.TCPServer(("127.0.0.1", port), Handler) as httpd:
        print(f"Інтерфейс:  {url}")
        print("Зупинити:   Ctrl+C")
        try:
            webbrowser.open(url)
        except Exception:                                  # noqa: BLE001
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nзупинено")


if __name__ == "__main__":
    main()
