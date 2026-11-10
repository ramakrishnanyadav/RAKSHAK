import os
import sys
import time
import json
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = os.path.join(os.getcwd(), "docs", "screenshots", "gate3")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

SCENARIOS = [
    ("SCENARIO_5_CATTLE_CROSSING", "cattle"),
    ("SCENARIO_1_VILLAGE_ROAD", "village"),
    ("SCENARIO_2_URBAN_INTERSECTION", "intersection"),
    ("SCENARIO_3_HIGHWAY_MERGE", "highway"),
    ("SCENARIO_4_DENSE_MARKET", "market"),
]

RESOLUTIONS = [
    (1920, 1080, "1080p"),
    (1280, 720, "720p"),
]

def main():
    console_errors = []
    page_errors = []
    capture_metadata = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        for width, height, res_name in RESOLUTIONS:
            print(f"\n==========================================")
            print(f"Capturing Resolution: {res_name} ({width}x{height})")
            print(f"==========================================")
            context = browser.new_context(viewport={"width": width, "height": height})
            page = context.new_page()

            page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)
            page.on("pageerror", lambda err: page_errors.append(str(err)))

            # Navigate to Workstation
            page.goto("http://localhost:5174/app/workstation", wait_until="networkidle")
            page.wait_for_selector("select", timeout=15000)
            page.wait_for_timeout(2000)

            # Query WebGL context info
            webgl_info = page.evaluate("""() => {
                const canvas = document.querySelector('canvas');
                if (!canvas) return { error: 'No canvas element found' };
                // Check WebGL context
                const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
                if (!gl) return { contextType: '2d or none', renderer: 'none', vendor: 'none' };
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                return {
                    contextType: gl.constructor ? gl.constructor.name : 'WebGLRenderingContext',
                    renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
                    vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
                };
            }""")
            print(f"WebGL Diagnostic [{res_name}]: {json.dumps(webgl_info, indent=2)}")

            # Standard 5 scenarios (3D & 2D)
            for sc_id, sc_short in SCENARIOS:
                page.select_option("select", sc_id)
                page.wait_for_timeout(1500)

                # Ensure P3 planner selected
                p3_btn = page.locator("button:has-text('ADAPTIVE-PATH (P3)')").first
                if p3_btn.is_visible():
                    p3_btn.click()
                page.wait_for_timeout(500)

                # 1. 3D Perspective
                btn_3d = page.locator("button:has-text('3D Perspective')").first
                if btn_3d.is_visible():
                    btn_3d.click()
                page.wait_for_timeout(1000)

                time_text = page.locator("span:has-text('t =')").first.inner_text() if page.locator("span:has-text('t =')").count() > 0 else "t = 0.0 s"
                slider_val = page.locator("input[type='range']").first.input_value() if page.locator("input[type='range']").count() > 0 else "0"

                filename_3d = f"{sc_short}_3d_{res_name}.png"
                out_path_3d = os.path.join(SCREENSHOT_DIR, filename_3d)
                page.screenshot(path=out_path_3d, full_page=False)
                print(f"  [x] Saved 3D screenshot: {filename_3d} (frame {slider_val}, {time_text})")
                capture_metadata.append({
                    "file": filename_3d,
                    "scenario": sc_id,
                    "view": "3D Perspective",
                    "planner": "P3",
                    "resolution": f"{width}x{height}",
                    "frame_index": int(slider_val),
                    "time_text": time_text
                })

                # 2. 2D Plan View (Fallback)
                btn_2d = page.locator("button:has-text('2D Plan View')").first
                if btn_2d.is_visible():
                    btn_2d.click()
                page.wait_for_timeout(1000)

                filename_2d = f"{sc_short}_2d_{res_name}.png"
                out_path_2d = os.path.join(SCREENSHOT_DIR, filename_2d)
                page.screenshot(path=out_path_2d, full_page=False)
                print(f"  [x] Saved 2D fallback screenshot: {filename_2d} (frame {slider_val}, {time_text})")
                capture_metadata.append({
                    "file": filename_2d,
                    "scenario": sc_id,
                    "view": "2D Plan View",
                    "planner": "P3",
                    "resolution": f"{width}x{height}",
                    "frame_index": int(slider_val),
                    "time_text": time_text
                })

                # Return to 3D
                if btn_3d.is_visible():
                    btn_3d.click()
                page.wait_for_timeout(500)

            # 3. Special Event Captures: Cattle Crossing Cow Step-Out Moment at t=2.5s (frame 25)
            print(f"\n--- Capturing Cattle Crossing Cow Step-Out Moment (t=2.5s / step 25) [{res_name}] ---")
            page.select_option("select", "SCENARIO_5_CATTLE_CROSSING")
            page.wait_for_timeout(1000)

            # Ensure 3D Perspective
            btn_3d = page.locator("button:has-text('3D Perspective')").first
            if btn_3d.is_visible():
                btn_3d.click()
            page.wait_for_timeout(500)

            # (A) P3 at frame 25 (t=2.5s)
            p3_btn = page.locator("button:has-text('ADAPTIVE-PATH (P3)')").first
            if p3_btn.is_visible():
                p3_btn.click()
            page.wait_for_timeout(500)

            page.evaluate("""() => {
                const slider = document.querySelector("input[type='range']");
                if (slider) {
                    slider.value = 25;
                    slider.dispatchEvent(new Event('input', { bubbles: true }));
                    slider.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }""")
            page.wait_for_timeout(800)

            time_text = page.locator("span:has-text('t =')").first.inner_text() if page.locator("span:has-text('t =')").count() > 0 else "t = 2.5 s"
            filename_p3_stepout = f"cattle_stepout_p3_{res_name}.png"
            page.screenshot(path=os.path.join(SCREENSHOT_DIR, filename_p3_stepout), full_page=False)
            print(f"  [x] Saved Cattle Step-Out P3: {filename_p3_stepout} ({time_text})")
            capture_metadata.append({
                "file": filename_p3_stepout,
                "scenario": "SCENARIO_5_CATTLE_CROSSING",
                "view": "3D Perspective",
                "planner": "P3",
                "resolution": f"{width}x{height}",
                "frame_index": 25,
                "time_text": time_text,
                "event": "Cow enters roadway at t=2.5s; P3 decelerates and smoothly plans bypass"
            })

            # (B) B1 at frame 25 (t=2.5s)
            b1_btn = page.locator("button:has-text('Standard planner (B1: DWA + velocity obstacles)')").first
            if b1_btn.is_visible():
                b1_btn.click()
            page.wait_for_timeout(500)

            page.evaluate("""() => {
                const slider = document.querySelector("input[type='range']");
                if (slider) {
                    slider.value = 25;
                    slider.dispatchEvent(new Event('input', { bubbles: true }));
                    slider.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }""")
            page.wait_for_timeout(800)

            time_text = page.locator("span:has-text('t =')").first.inner_text() if page.locator("span:has-text('t =')").count() > 0 else "t = 2.5 s"
            filename_b1_stepout = f"cattle_stepout_b1_{res_name}.png"
            page.screenshot(path=os.path.join(SCREENSHOT_DIR, filename_b1_stepout), full_page=False)
            print(f"  [x] Saved Cattle Step-Out B1: {filename_b1_stepout} ({time_text})")
            capture_metadata.append({
                "file": filename_b1_stepout,
                "scenario": "SCENARIO_5_CATTLE_CROSSING",
                "view": "3D Perspective",
                "planner": "B1",
                "resolution": f"{width}x{height}",
                "frame_index": 25,
                "time_text": time_text,
                "event": "Cow enters roadway at t=2.5s; B1 velocity obstacles comparison"
            })

            context.close()

        browser.close()

    # Write capture metadata summary
    metadata_path = os.path.join(SCREENSHOT_DIR, "capture_manifest.json")
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump({
            "webgl_info": webgl_info,
            "total_screenshots": len(capture_metadata),
            "captures": capture_metadata,
            "console_errors": console_errors,
            "page_errors": page_errors
        }, f, indent=2)

    print(f"\n[DONE] Manifest written to {metadata_path}")
    print(f"Total screenshots: {len(capture_metadata)}")
    print(f"Console errors: {len(console_errors)}")
    print(f"Page errors: {len(page_errors)}")

if __name__ == "__main__":
    main()
