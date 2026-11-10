import asyncio
from playwright.async_api import async_playwright

async def snap_t0():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--use-gl=angle', '--use-angle=swiftshader'])
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        await page.goto("http://localhost:5174/app/workstation", wait_until="networkidle")
        await asyncio.sleep(1)
        
        # Click reset or set slider to 0
        await page.evaluate('''() => {
            const slider = document.querySelector('input[type="range"]');
            if (slider) {
                slider.value = 0;
                slider.dispatchEvent(new Event('input', { bubbles: true }));
                slider.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }''')
        await asyncio.sleep(1)
        
        await page.screenshot(path="docs/screenshots/simulate_3d/workstation_t0.png")
        print("Captured workstation_t0.png")
        await browser.close()

asyncio.run(snap_t0())

