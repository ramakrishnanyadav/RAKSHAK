import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1920, 'height': 1080})
        await page.goto('http://localhost:5174/app/workstation')
        await asyncio.sleep(2)
        res = await page.evaluate("""() => {
            const slider = document.querySelector('input[type="range"]');
            if (!slider) return 'no slider';
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputValueSetter.call(slider, 0);
            slider.dispatchEvent(new Event('input', { bubbles: true }));
            return {
                val: slider.value,
                timeText: document.querySelector('span[style*="minWidth"]')?.textContent
            };
        }""")
        print('Result with nativeInputValueSetter:', res)
        await browser.close()

asyncio.run(run())

