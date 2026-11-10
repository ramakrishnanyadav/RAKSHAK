import asyncio
import os
from playwright.async_api import async_playwright

async def capture():
    os.makedirs("docs/screenshots/simulate_3d", exist_ok=True)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        
        print("Navigating to workstation...")
        await page.goto("http://localhost:5174/app/workstation", wait_until="networkidle")
        await asyncio.sleep(2)
        
        # Targets:
        # t=0s -> frame 0
        # t=5s -> frame 50
        # t=12.6s -> frame 126
        times = [
            ("t0", 0, "0.0s"),
            ("t5", 50, "5.0s"),
            ("t12_6", 126, "12.6s")
        ]
        
        # Camera modes:
        # Chase, Bird's-Eye, Cockpit, Free Orbit
        modes = [
            ("chase", "Chase"),
            ("bird", "Bird's-Eye"),
            ("cockpit", "Cockpit"),
            ("orbit", "Free Orbit")
        ]
        
        for t_label, frame_idx, t_str in times:
            # Set the slider value via native value setter
            res = await page.evaluate(f'''(idx) => {{
                const slider = document.querySelector('input[type="range"]');
                if (!slider) return false;
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeInputValueSetter.call(slider, idx);
                slider.dispatchEvent(new Event('input', {{ bubbles: true }}));
                slider.dispatchEvent(new Event('change', {{ bubbles: true }}));
                return true;
            }}''', frame_idx)
            
            await asyncio.sleep(0.6)
            
            for m_label, button_text in modes:
                # Click camera button
                clicked = await page.evaluate(f'''(btnText) => {{
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const target = buttons.find(b => b.textContent.trim().toLowerCase() === btnText.toLowerCase());
                    if (target) {{
                        target.click();
                        return true;
                    }}
                    return false;
                }}''', button_text)
                
                await asyncio.sleep(0.5)
                
                # Verify time readout
                time_readout = await page.evaluate('''() => {
                    const spans = Array.from(document.querySelectorAll('span'));
                    const tSpan = spans.find(s => s.textContent.trim().startsWith('t = '));
                    return tSpan ? tSpan.textContent.trim() : 'unknown';
                }''')
                
                filename = f"docs/screenshots/simulate_3d/cattle_crossing_{t_label}_{m_label}.png"
                await page.screenshot(path=filename)
                print(f"Captured {filename} ({button_text}, {time_readout})")
                
        # Open AV Safety Pipeline Modal & capture screenshot
        await page.evaluate('''() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const target = buttons.find(b => b.textContent.includes('AV Safety Pipeline'));
            if (target) target.click();
        }''')
        await asyncio.sleep(0.8)
        pipeline_file = "docs/screenshots/simulate_3d/cattle_crossing_av_safety_pipeline.png"
        await page.screenshot(path=pipeline_file)
        print(f"Captured {pipeline_file}")

        # Close AV Safety Pipeline Modal
        await page.evaluate('''() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const target = buttons.find(b => b.textContent.includes('Close'));
            if (target) target.click();
        }''')
        await asyncio.sleep(0.5)

        # Open Normal AV vs Our Solution Deep Dive Modal
        await page.evaluate('''() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const target = buttons.find(b => b.textContent.includes('Normal AV vs Our Solution'));
            if (target) target.click();
        }''')
        await asyncio.sleep(0.8)
        compare_modal_file = "docs/screenshots/simulate_3d/cattle_crossing_normal_av_vs_our_solution.png"
        await page.screenshot(path=compare_modal_file)
        print(f"Captured {compare_modal_file}")

        # Close Modal & Activate Head-to-Head Compare Viewports at t = 7.3s (B1 collision point)
        await page.evaluate('''() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const target = buttons.find(b => b.textContent.includes('Launch Single-Canvas Head-to-Head Compare'));
            if (target) target.click();
        }''')
        await asyncio.sleep(0.8)

        # Scrub slider to frame 73 (t = 7.3s)
        await page.evaluate('''() => {
            const slider = document.querySelector('input[type="range"]');
            if (!slider) return;
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputValueSetter.call(slider, 73);
            slider.dispatchEvent(new Event('input', { bubbles: true }));
            slider.dispatchEvent(new Event('change', { bubbles: true }));
        }''')
        await asyncio.sleep(0.8)
        head_to_head_file = "docs/screenshots/simulate_3d/cattle_crossing_head_to_head_t7_3s.png"
        await page.screenshot(path=head_to_head_file)
        print(f"Captured {head_to_head_file}")

        await browser.close()
        print("All screenshots captured successfully!")

if __name__ == "__main__":
    asyncio.run(capture())
