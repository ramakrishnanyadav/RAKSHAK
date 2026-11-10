import asyncio
import json
import os
import sys
from playwright.async_api import async_playwright

os.environ["PYTHONIOENCODING"] = "utf-8"

async def diagnose(url):
    print(f"=== Diagnosing {url} ===")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--use-gl=angle', '--use-angle=swiftshader'])
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        
        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: console_logs.append(f"[PAGE_ERROR] {err}"))
        
        try:
            await page.goto(url, wait_until="networkidle", timeout=15000)
        except Exception as e:
            print(f"Navigation warning: {e}")
        
        await asyncio.sleep(2)
        
        # Take a screenshot to inspect what it looks like right now
        os.makedirs("docs/screenshots/simulate_3d", exist_ok=True)
        screenshot_path = f"docs/screenshots/simulate_3d/initial_{url.replace('/', '_').replace(':', '_')}.png"
        await page.screenshot(path=screenshot_path)
        print(f"Initial screenshot saved to {screenshot_path}")
        
        # Run in-browser evaluation to inspect canvas, WebGL context, Three.js scene, camera, parent container
        eval_result = await page.evaluate('''() => {
            const result = {
                canvases: [],
                consoleLogs: [],
                threeDetails: null
            };
            
            const canvases = document.querySelectorAll('canvas');
            canvases.forEach((c, idx) => {
                const parent = c.parentElement;
                const grandParent = parent ? parent.parentElement : null;
                const gl2 = c.getContext('webgl2');
                const gl = gl2 || c.getContext('webgl') || c.getContext('experimental-webgl');
                
                let webglStatus = 'NO_WEBGL';
                let rendererInfo = 'None';
                if (gl) {
                    webglStatus = gl.isContextLost() ? 'CONTEXT_LOST' : 'ACTIVE';
                    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
                    if (dbg) {
                        rendererInfo = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
                    }
                }
                
                result.canvases.push({
                    index: idx,
                    id: c.id,
                    className: c.className,
                    width: c.width,
                    height: c.height,
                    clientWidth: c.clientWidth,
                    clientHeight: c.clientHeight,
                    styleWidth: c.style.width,
                    styleHeight: c.style.height,
                    parentTag: parent ? parent.tagName : null,
                    parentComputedWidth: parent ? window.getComputedStyle(parent).width : null,
                    parentComputedHeight: parent ? window.getComputedStyle(parent).height : null,
                    parentClientWidth: parent ? parent.clientWidth : null,
                    parentClientHeight: parent ? parent.clientHeight : null,
                    grandParentComputedHeight: grandParent ? window.getComputedStyle(grandParent).height : null,
                    webglStatus: webglStatus,
                    rendererInfo: rendererInfo
                });
            });
            
            // Check window.__THREE_DEBUG__ or similar if exposed, or search for THREE objects
            if (window.__THREE_SCENE__) {
                const scene = window.__THREE_SCENE__;
                const camera = window.__THREE_CAMERA__;
                // collect scene info
            }
            
            return result;
        }''')
        
        print(json.dumps(eval_result, indent=2))
        print("Console logs during load:")
        for log in console_logs:
            print(log)
            
        await browser.close()

async def main():
    # Diagnose workstation first, then runs, then landing
    for path in ['/app/workstation', '/app/runs', '/']:
        try:
            await diagnose(f"http://localhost:5174{path}")
        except Exception as e:
            print(f"Error diagnosing {path}: {e}")

if __name__ == "__main__":
    asyncio.run(main())

