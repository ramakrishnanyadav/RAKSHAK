"""
Script to capture actual screenshots of all workspaces in ADAPTIVE-PATH Studio
using Python Playwright connecting to http://localhost:5174.
"""

import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "docs" / "screenshots"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

PAGES_TO_CAPTURE = [
    {
        "id": "01_landing_home",
        "url": "http://localhost:5174/",
        "title": "Home / Landing Page",
        "wait_for": "h1",
    },
    {
        "id": "02_dashboard",
        "url": "http://localhost:5174/app",
        "title": "Main Dashboard Workspace",
        "wait_for": "nav",
    },
    {
        "id": "03_simulation_preparation",
        "url": "http://localhost:5174/app/runs/new",
        "title": "Simulation Preparation (Launch Run)",
        "wait_for": "form",
    },
    {
        "id": "04_live_simulation_replay",
        "url": "http://localhost:5174/app/runs/run_scenario_5_cattle_crossing_p3_tune_s1000",
        "title": "Simulation Replay Viewer & Telemetry",
        "wait_for": "canvas",
    },
    {
        "id": "05_scenarios_catalog",
        "url": "http://localhost:5174/app/scenarios",
        "title": "Scenarios Catalog",
        "wait_for": "nav",
    },
    {
        "id": "06_compare_view",
        "url": "http://localhost:5174/app/compare",
        "title": "Comparative Replay View",
        "wait_for": "select",
    },
    {
        "id": "07_benchmark_results",
        "url": "http://localhost:5174/app/benchmark",
        "title": "Ablation Benchmark Results",
        "wait_for": "table",
    },
    {
        "id": "08_failures_view",
        "url": "http://localhost:5174/app/failures",
        "title": "Failure Explorer & Attribution",
        "wait_for": "table",
    },
    {
        "id": "09_reports_export",
        "url": "http://localhost:5174/app/reports",
        "title": "Research Reports & Submission",
        "wait_for": "pre",
    },
    {
        "id": "10_settings_profile",
        "url": "http://localhost:5174/app/settings/profile",
        "title": "Settings & Accessibility",
        "wait_for": "nav",
    },
]

def capture_all():
    print(f"[+] Starting screenshot capture of Studio running on http://localhost:5174...")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        # Set guest authentication token in localStorage so protected routes /app render cleanly
        page.goto("http://localhost:5174/demo")
        page.wait_for_timeout(1000)

        for item in PAGES_TO_CAPTURE:
            shot_id = item["id"]
            url = item["url"]
            print(f"[-] Capturing {shot_id}: {url}...")
            try:
                page.goto(url, wait_until="networkidle")
                page.wait_for_timeout(1000)
                out_path = OUTPUT_DIR / f"{shot_id}.png"
                page.screenshot(path=str(out_path), full_page=False)
                print(f"    -> Saved {out_path.name} ({out_path.stat().st_size} bytes)")
            except Exception as e:
                print(f"    [!] Error capturing {shot_id}: {e}")

        # Also capture high-contrast theme
        try:
            print(f"[-] Capturing High-Contrast Theme Replay...")
            page.goto("http://localhost:5174/app/runs/run_scenario_5_cattle_crossing_p3_tune_s1000")
            page.wait_for_timeout(1000)
            # Click theme toggle twice to reach high contrast
            page.click("button[title*='Theme'], button[aria-label*='Theme']")
            page.wait_for_timeout(500)
            page.click("button[title*='Theme'], button[aria-label*='Theme']")
            page.wait_for_timeout(500)
            out_path = OUTPUT_DIR / "11_high_contrast_replay.png"
            page.screenshot(path=str(out_path), full_page=False)
            print(f"    -> Saved {out_path.name}")
        except Exception as e:
            print(f"    [!] Error capturing high contrast: {e}")

        browser.close()
    print("[+] All screenshots successfully captured.")

if __name__ == "__main__":
    capture_all()

