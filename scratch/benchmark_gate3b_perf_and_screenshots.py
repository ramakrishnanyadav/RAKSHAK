import os
import sys
import time
import json
import statistics
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = os.path.join(os.getcwd(), "docs", "screenshots", "gate3b")
AUDIT_DIR = os.path.join(os.getcwd(), "docs", "audit_logs", "gate3b")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)
os.makedirs(AUDIT_DIR, exist_ok=True)

# 5 Canonical scenarios with their key moments (frame index and time)
SCENARIOS = [
    ("SCENARIO_5_CATTLE_CROSSING", "cattle", 25, "2.5 s", "Cow steps into roadway; P3 vehicle slows and executes smooth left bypass"),
    ("SCENARIO_1_VILLAGE_ROAD", "village", 50, "5.0 s", "Narrow road negotiation approaching oncoming truck"),
    ("SCENARIO_2_URBAN_INTERSECTION", "intersection", 25, "2.5 s", "Unprotected turn negotiation with cross traffic"),
    ("SCENARIO_3_HIGHWAY_MERGE", "highway", 35, "3.5 s", "High-speed highway lateral merge gap matching"),
    ("SCENARIO_4_DENSE_MARKET", "market", 60, "6.0 s", "Narrow corridor crawl past parked autorickshaws and pedestrians"),
]

RESOLUTIONS = [
    (1920, 1080, "1080p"),
    (1280, 720, "720p"),
]

def main():
    console_errors = []
    page_errors = []
    benchmark_results = {}
    captures = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--enable-webgl",
                "--ignore-gpu-blocklist",
                "--enable-gpu-rasterization",
                "--enable-zero-copy",
            ]
        )

        for width, height, res_name in RESOLUTIONS:
            print(f"\n=======================================================")
            print(f"BENCHMARKING & SCREENSHOTS: {res_name} ({width}x{height})")
            print(f"=======================================================")

            context = browser.new_context(viewport={"width": width, "height": height})
            page = context.new_page()

            page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)
            page.on("pageerror", lambda err: page_errors.append(str(err)))

            # Open Landing Page ("/") which opens straight into workstation above the fold
            page.goto("http://localhost:5174/", wait_until="networkidle")
            page.wait_for_selector("canvas", timeout=20000)
            page.wait_for_timeout(2500)

            # 1. Hardware & WebGL Diagnostics
            diag = page.evaluate("""() => {
                const canvas = document.querySelector('canvas');
                const gl = canvas ? (canvas.getContext('webgl2') || canvas.getContext('webgl')) : null;
                const dbg = gl ? gl.getExtension('WEBGL_debug_renderer_info') : null;
                return {
                    browser: navigator.userAgent,
                    hardwareConcurrency: navigator.hardwareConcurrency,
                    platform: navigator.platform,
                    devicePixelRatio: window.devicePixelRatio,
                    contextType: gl ? gl.constructor.name : 'None',
                    renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : (gl ? gl.getParameter(gl.RENDERER) : 'None'),
                    vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : (gl ? gl.getParameter(gl.VENDOR) : 'None'),
                };
            }""")
            print(f"Diagnostics: Context={diag['contextType']}, Renderer={diag['renderer']}")

            # 2. Performance Frame-Rate Harness (120 rAF samples)
            print("Running 120-frame WebGL rendering benchmark...")
            perf_stats = page.evaluate("""() => {
                return new Promise((resolve) => {
                    const deltas = [];
                    let lastTime = performance.now();
                    let count = 0;
                    function measure(now) {
                        const dt = now - lastTime;
                        lastTime = now;
                        if (count > 5) deltas.push(dt); // warm up first 5 frames
                        count++;
                        if (count < 125) {
                            requestAnimationFrame(measure);
                        } else {
                            deltas.sort((a, b) => a - b);
                            const avgDt = deltas.reduce((s, v) => s + v, 0) / deltas.length;
                            const p95Idx = Math.floor(deltas.length * 0.95);
                            const p95Dt = deltas[p95Idx];
                            const avgFps = 1000 / avgDt;
                            resolve({
                                samples: deltas.length,
                                avgFrameTimeMs: avgDt,
                                p95FrameTimeMs: p95Dt,
                                minFrameTimeMs: deltas[0],
                                maxFrameTimeMs: deltas[deltas.length - 1],
                                avgFps: avgFps
                            });
                        }
                    }
                    requestAnimationFrame(measure);
                });
            }""")

            print(f"  Avg FPS: {perf_stats['avgFps']:.1f} FPS (Target >= 55 FPS)")
            print(f"  p95 Frame Time: {perf_stats['p95FrameTimeMs']:.2f} ms")
            print(f"  Avg Frame Time: {perf_stats['avgFrameTimeMs']:.2f} ms")

            benchmark_results[res_name] = {
                "resolution": f"{width}x{height}",
                "diagnostics": diag,
                "performance": perf_stats,
            }

            # 3. Capture All 5 Canonical Scenarios at Key Moments
            for sc_id, sc_short, key_frame, key_time, key_desc in SCENARIOS:
                print(f"Capturing Scenario: {sc_id} at {key_time} (Frame {key_frame})...")
                page.select_option("select", sc_id)
                page.wait_for_timeout(1200)

                # Scrub to key moment
                page.evaluate(f"""() => {{
                    const slider = document.querySelector("input[type='range']");
                    if (slider) {{
                        slider.value = {key_frame};
                        slider.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        slider.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    }}
                }}""")
                page.wait_for_timeout(800)

                filename = f"{sc_short}_key_moment_{res_name}.png"
                out_path = os.path.join(SCREENSHOT_DIR, filename)
                page.screenshot(path=out_path, full_page=False)
                print(f"  [x] Saved: {filename}")

                captures.append({
                    "file": filename,
                    "scenario": sc_id,
                    "resolution": f"{width}x{height}",
                    "frame_index": key_frame,
                    "simulation_time": key_time,
                    "description": key_desc,
                })

            # 4. Capture Compare Mode (Single-Canvas Scissor Dual Viewport)
            print("Capturing Compare Mode (Single-Canvas Dual Viewport P3 vs B1)...")
            page.select_option("select", "SCENARIO_5_CATTLE_CROSSING")
            page.wait_for_timeout(1000)
            compare_btn = page.locator("button:has-text('Compare (P3 vs B1)')").first
            if compare_btn.is_visible():
                compare_btn.click()
            page.wait_for_timeout(1500)

            # Scrub to cow step-out moment at t=2.5s
            page.evaluate("""() => {
                const slider = document.querySelector("input[type='range']");
                if (slider) {
                    slider.value = 25;
                    slider.dispatchEvent(new Event('input', { bubbles: true }));
                    slider.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }""")
            page.wait_for_timeout(1000)

            compare_filename = f"compare_p3_vs_b1_scissor_{res_name}.png"
            compare_out_path = os.path.join(SCREENSHOT_DIR, compare_filename)
            page.screenshot(path=compare_out_path, full_page=False)
            print(f"  [x] Saved Compare View: {compare_filename}")
            captures.append({
                "file": compare_filename,
                "scenario": "SCENARIO_5_CATTLE_CROSSING",
                "resolution": f"{width}x{height}",
                "frame_index": 25,
                "simulation_time": "2.5 s",
                "description": "Single-canvas dual viewport (scissor split): P3 Adaptive left vs B1 Standard right at cow step-out",
            })

            context.close()

        browser.close()

    # Save benchmark report JSON
    report_data = {
        "benchmark_date": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_captures": len(captures),
        "captures": captures,
        "resolutions": benchmark_results,
        "console_errors": console_errors,
        "page_errors": page_errors,
    }

    report_path = os.path.join(AUDIT_DIR, "perf_benchmark.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2)

    print(f"\n=======================================================")
    print(f"PERFORMANCE & CAPTURE AUDIT COMPLETED")
    print(f"Manifest written to: {report_path}")
    print(f"Total Screenshots: {len(captures)}")
    print(f"Console Errors: {len(console_errors)}")
    print(f"Page Errors: {len(page_errors)}")
    print(f"=======================================================")

if __name__ == "__main__":
    main()

