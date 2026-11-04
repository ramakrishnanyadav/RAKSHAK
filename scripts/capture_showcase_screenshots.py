"""
Capture high-resolution screenshots of the demo-first ADAPTIVE-PATH Studio showcase page.
Captures full-page views at 1920x1080 and 1280x720, plus close-ups of key sections:
1. Hero & Top Bar
2. Flagship Demo Stage (Dual Synchronized Replay)
3. Results Row & Ablation Comparison
4. Our Data Section (Dataset Provenance & Real vs. Sim)
5. Technical Details Slide-over Drawer
6. 3-Minute Demo Tour Modal
"""

from pathlib import Path
from playwright.sync_api import sync_playwright

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "docs" / "screenshots"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def capture_showcase():
    print("[+] Launching Playwright Chromium to capture showcase views...")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        
        # 1. Full Page 1920x1080
        page_1080 = browser.new_page(viewport={"width": 1920, "height": 1080})
        page_1080.goto("http://localhost:5174/", wait_until="networkidle")
        page_1080.wait_for_timeout(1500)
        
        full_1080 = OUTPUT_DIR / "showcase_1920x1080_full.png"
        page_1080.screenshot(path=str(full_1080), full_page=True)
        print(f"    -> Saved {full_1080.name} ({full_1080.stat().st_size} bytes)")
        
        # Hero viewport
        hero_1080 = OUTPUT_DIR / "showcase_hero_viewport.png"
        page_1080.screenshot(path=str(hero_1080), full_page=False)
        print(f"    -> Saved {hero_1080.name}")

        # 2. Details Drawer open
        page_1080.click("button:has-text('Details & Code')")
        page_1080.wait_for_timeout(500)
        drawer_path = OUTPUT_DIR / "showcase_details_drawer.png"
        page_1080.screenshot(path=str(drawer_path), full_page=False)
        print(f"    -> Saved {drawer_path.name}")
        
        # Close drawer
        page_1080.click("button[aria-label='Close details drawer']")
        page_1080.wait_for_timeout(300)

        # 3. Demo Tour Modal open
        page_1080.click("button:has-text('Play full demo tour')")
        page_1080.wait_for_timeout(500)
        tour_path = OUTPUT_DIR / "showcase_demo_tour_step1.png"
        page_1080.screenshot(path=str(tour_path), full_page=False)
        print(f"    -> Saved {tour_path.name}")
        
        # Next step in tour
        page_1080.click("button:has-text('Next')")
        page_1080.wait_for_timeout(400)
        tour2_path = OUTPUT_DIR / "showcase_demo_tour_step2.png"
        page_1080.screenshot(path=str(tour2_path), full_page=False)
        print(f"    -> Saved {tour2_path.name}")
        
        page_1080.close()

        # 4. 1280x720 Viewport Full Page
        page_720 = browser.new_page(viewport={"width": 1280, "height": 720})
        page_720.goto("http://localhost:5174/", wait_until="networkidle")
        page_720.wait_for_timeout(1500)
        
        full_720 = OUTPUT_DIR / "showcase_1280x720_full.png"
        page_720.screenshot(path=str(full_720), full_page=True)
        print(f"    -> Saved {full_720.name} ({full_720.stat().st_size} bytes)")
        
        page_720.close()
        browser.close()

    print("[+] Showcase screenshot capture finished successfully.")

if __name__ == "__main__":
    capture_showcase()

