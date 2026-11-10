import asyncio
from playwright.async_api import async_playwright

async def check():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        page.on("requestfailed", lambda req: print(f"FAILED REQUEST: {req.url} - {req.failure}"))
        page.on("response", lambda res: print(f"RESPONSE: {res.url} -> {res.status}") if res.status >= 400 else None)
        await page.goto("http://localhost:5174/app/runs", wait_until="networkidle")
        await browser.close()

asyncio.run(check())

