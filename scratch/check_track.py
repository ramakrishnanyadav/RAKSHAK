import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1920, 'height': 1080})
        await page.goto('http://localhost:5174/app/workstation')
        for i in range(5):
            val = await page.evaluate("() => { const el = document.querySelector('input[type=\"range\"]'); return el ? el.value : 'no slider'; }")
            print(f'step {i}: {val}')
            await asyncio.sleep(0.5)
        await browser.close()

asyncio.run(run())

