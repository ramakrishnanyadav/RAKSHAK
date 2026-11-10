import asyncio
import json
import os
from playwright.async_api import async_playwright

async def run_diagnostics():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--use-gl=angle', '--use-angle=swiftshader'])
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        
        console_msgs = []
        page.on("console", lambda msg: console_msgs.append({"type": msg.type, "text": msg.text}))
        page.on("pageerror", lambda err: console_msgs.append({"type": "error", "text": str(err)}))
        
        print("\n================ DIAGNOSTIC RUN: /app/workstation ================")
        await page.goto("http://localhost:5174/app/workstation", wait_until="networkidle")
        await asyncio.sleep(2)
        
        report = await page.evaluate('''() => {
            const canvas = document.querySelector('canvas');
            if (!canvas) return { error: 'No canvas found on page' };
            
            // 1. WebGL Context Status
            const gl2 = canvas.getContext('webgl2');
            const gl = gl2 || canvas.getContext('webgl');
            let glStatus = {
                hasContext: !!gl,
                isContextLost: gl ? gl.isContextLost() : true,
                version: gl2 ? 'WebGL 2.0' : (gl ? 'WebGL 1.0' : 'None'),
                vendor: 'unknown',
                renderer: 'unknown'
            };
            if (gl) {
                const dbg = gl.getExtension('WEBGL_debug_renderer_info');
                if (dbg) {
                    glStatus.vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL);
                    glStatus.renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
                }
            }
            
            // 2. Canvas & Parent Container Dimensions
            const parent = canvas.parentElement;
            const grandParent = parent ? parent.parentElement : null;
            const parentComp = parent ? window.getComputedStyle(parent) : null;
            const grandComp = grandParent ? window.getComputedStyle(grandParent) : null;
            
            const dimensions = {
                canvasPixelWidth: canvas.width,
                canvasPixelHeight: canvas.height,
                canvasClientWidth: canvas.clientWidth,
                canvasClientHeight: canvas.clientHeight,
                parentTagName: parent ? parent.tagName : null,
                parentComputedHeight: parentComp ? parentComp.height : null,
                parentComputedWidth: parentComp ? parentComp.width : null,
                parentClientHeight: parent ? parent.clientHeight : null,
                parentClientWidth: parent ? parent.clientWidth : null,
                grandParentComputedHeight: grandComp ? grandComp.height : null
            };
            
            // 3. Camera Position, Target, Near/Far in Chase Mode against Ego pose at t=0
            let cameraDetails = null;
            let meshes = [];
            
            if (window.__THREE_WORKSTATION__) {
                const { camera, scene, roadGroup, dynamicGroup, controls } = window.__THREE_WORKSTATION__;
                
                // Read camera parameters
                cameraDetails = {
                    position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
                    target: controls && controls.target ? { x: controls.target.x, y: controls.target.y, z: controls.target.z } : null,
                    near: camera.near,
                    far: camera.far,
                    fov: camera.fov,
                    aspect: camera.aspect,
                    up: { x: camera.up.x, y: camera.up.y, z: camera.up.z }
                };
                
                // 4. Mesh inventory & non-zero bounds
                scene.traverse((obj) => {
                    if (obj.isMesh || obj.isLine) {
                        obj.geometry.computeBoundingBox();
                        const bb = obj.geometry.boundingBox;
                        let size = { x: 0, y: 0, z: 0 };
                        if (bb) {
                            size = {
                                x: bb.max.x - bb.min.x,
                                y: bb.max.y - bb.min.y,
                                z: bb.max.z - bb.min.z
                            };
                        }
                        meshes.push({
                            type: obj.type,
                            name: obj.name || (obj.parent ? obj.parent.name : 'unnamed'),
                            visible: obj.visible,
                            position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
                            boundsSize: size,
                            hasNonZeroBounds: (size.x > 0 || size.y > 0 || size.z > 0)
                        });
                    }
                });
            }
            
            return {
                glStatus,
                dimensions,
                cameraDetails,
                meshCount: meshes.length,
                meshes: meshes.slice(0, 20) // First 20 meshes
            };
        }''')
        
        print("DIAGNOSTIC REPORT:")
        print(json.dumps(report, indent=2))
        print("\nCONSOLE MESSAGES:")
        for m in console_msgs:
            print(f"[{m['type']}] {m['text']}")
            
        await browser.close()

asyncio.run(run_diagnostics())
