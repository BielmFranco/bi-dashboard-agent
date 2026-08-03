"""Playwright headless Chromium → PDF renderer.

Loads a URL (typically the Next.js /report/{fileId} route) and returns
the rendered A4 PDF as bytes. Handles Recharts (SVG) natively since
Chromium runs the client JS bundle.
"""
from __future__ import annotations

import logging
from typing import Optional

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

log = logging.getLogger("bi.pdf")


class PdfExportError(RuntimeError):
    pass


def render_pdf(url: str, wait_ms: int = 2500) -> bytes:
    """Render URL to A4 PDF using headless Chromium.

    `wait_ms` gives Recharts + framer-motion time to finish their entrance
    animations before we snapshot the page.
    """
    log.info("Rendering PDF from %s", url)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--disable-dev-shm-usage", "--no-sandbox"],
            )
            try:
                context = browser.new_context(
                    viewport={"width": 1754, "height": 1240},
                    device_scale_factor=2,
                )
                page = context.new_page()
                page.goto(url, wait_until="networkidle", timeout=30000)
                page.wait_for_timeout(wait_ms)
                pdf: Optional[bytes] = page.pdf(
                    format="A4",
                    landscape=True,
                    print_background=True,
                    margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
                    prefer_css_page_size=True,
                )
                if not pdf:
                    raise PdfExportError("Playwright retornou PDF vazio.")
                log.info("PDF gerado: %d bytes", len(pdf))
                return pdf
            finally:
                browser.close()
    except PlaywrightError as e:
        log.exception("Playwright error")
        raise PdfExportError(f"Falha ao renderizar PDF: {e}")
    except PdfExportError:
        raise
    except Exception as e:
        log.exception("Unexpected PDF error")
        raise PdfExportError(f"Erro inesperado: {e}")
