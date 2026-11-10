import asyncio
from playwright.async_api import async_playwright

async def inspect():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--use-gl=angle', '--use-angle=swiftshader'])
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        await page.goto("http://localhost:5174/app/workstation", wait_until="networkidle")
        await asyncio.sleep(2)
        
        info = await page.evaluate('''() => {
            const canvas = document.querySelector('canvas');
            if (!canvas) return { error: 'No canvas' };
            const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
            
            // Check pixel data in the center of the canvas
            const w = canvas.width;
            const h = canvas.height;
            let centerPixel = null;
            if (gl) {
                const pixels = new Uint8Array(4 * 10 * 10);
                gl.readPixels(Math.floor(w/2), Math.floor(h/2), 10, 10, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                centerPixel = Array.from(pixels.slice(0, 16));
            }
            
            return {
                w,
                h,
                clientWidth: canvas.clientWidth,
                clientHeight: canvas.clientHeight,
                parentHeight: window.getComputedStyle(canvas.parentElement).height,
                grandParentHeight: window.getComputedStyle(canvas.parentElement.parentElement).height,
                centerPixel
            };
        }''')
        print("Workstation canvas info:", info)
        await browser.close()

asyncio.run(inspect())

