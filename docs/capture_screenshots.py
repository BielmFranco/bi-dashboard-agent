"""Automated screenshots for README.

Runs Playwright against local dev server, uploads a test CSV,
captures key sections. Outputs to docs/screenshots/.

Usage (from repo root):
    cd docs
    python capture_screenshots.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "test-data" / "T5_vendas_semicolon.csv"
OUT = ROOT / "docs" / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)
FRONTEND = "http://localhost:3000"


def capture(theme: str = "dark"):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2,
            color_scheme=theme,
        )
        page = ctx.new_page()

        # Home
        page.goto(FRONTEND, wait_until="networkidle")
        page.wait_for_timeout(600)
        page.screenshot(path=OUT / f"01-home-{theme}.png", full_page=False)
        print(f"[{theme}] home ok")

        # Upload
        input_el = page.locator('input[type="file"]')
        input_el.set_input_files(str(CSV_PATH))
        page.wait_for_selector("text=Total de registros", timeout=30_000)
        page.wait_for_timeout(1200)
        page.screenshot(path=OUT / f"02-dashboard-{theme}.png", full_page=True)
        print(f"[{theme}] dashboard ok")

        # Filters section
        try:
            filters_btn = page.locator("button:has-text('Filtros')").first
            if filters_btn.is_visible():
                filters_btn.click()
                page.wait_for_timeout(400)
                filters_btn.evaluate("el => el.scrollIntoView({block: 'start'})")
                page.wait_for_timeout(300)
                page.screenshot(path=OUT / f"03-filters-{theme}.png", full_page=False)
                print(f"[{theme}] filters ok")
        except Exception as e:
            print(f"[{theme}] filters skipped: {e}")

        # Chat area (scroll to bottom)
        try:
            chat = page.locator("text=Pergunte sobre a base").first
            if chat.is_visible():
                chat.evaluate("el => el.scrollIntoView({block: 'center'})")
                page.wait_for_timeout(500)
                page.screenshot(path=OUT / f"04-chat-{theme}.png", full_page=False)
                print(f"[{theme}] chat ok")
        except Exception as e:
            print(f"[{theme}] chat skipped: {e}")

        # Insights section (trigger + wait first chunks)
        try:
            gen_btn = page.get_by_role("button", name="Gerar análise").first
            gen_btn.wait_for(state="visible", timeout=5000)
            gen_btn.scroll_into_view_if_needed()
            gen_btn.click()
            page.wait_for_timeout(8000)
            page.screenshot(path=OUT / f"05-insights-{theme}.png", full_page=False)
            print(f"[{theme}] insights ok")
        except Exception as e:
            print(f"[{theme}] insights skipped: {type(e).__name__}")

        browser.close()


if __name__ == "__main__":
    for t in ("dark", "light"):
        capture(t)
    print(f"\nAll shots in: {OUT}")
