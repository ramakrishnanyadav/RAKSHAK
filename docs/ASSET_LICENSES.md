# 3D Asset Licenses & Provenance Record
**ADAPTIVE-PATH 3D Autonomous Workstation**
Date: 2026-11-05

All 3D geometric models and road textures utilized in the ADAPTIVE-PATH 3D Autonomous Workstation (`Scene3DCanvas.tsx`) are authored procedurally in TypeScript using Three.js geometric primitives and procedural canvas texture generators. No external third-party binary assets or external CDNs are required, ensuring zero network dependencies, 100% offline reproducibility, and clean licensing.

---

### Asset Inventory & Licensing

| Asset Category | Identifier / Actor Class | Authoring Method | License | Attribution / Source |
|---|---|---|---|---|
| **Ego Vehicle** | `car` / `ego` | Procedural Three.js Compound Mesh (Chassis, Cabin, Wheels, Lights) | CC0 1.0 Universal / MIT | Authored in-repo (`Scene3DCanvas.tsx`) |
| **Heavy Vehicle** | `truck` | Procedural Compound Mesh (Cab, Cargo Container, Dual Axles, Exhaust) | CC0 1.0 Universal / MIT | Authored in-repo (`Scene3DCanvas.tsx`) |
| **Bovine Animal** | `cattle` / `cow` | Procedural Compound Mesh (Torso, 4 Articulated Limbs, Neck, Head, Horns) | CC0 1.0 Universal / MIT | Authored in-repo (`Scene3DCanvas.tsx`) |
| **Vulnerable User** | `pedestrian` | Procedural Humanoid Mesh (Head, Torso, Arms, Stride Limbs) | CC0 1.0 Universal / MIT | Authored in-repo (`Scene3DCanvas.tsx`) |
| **Two Wheeler** | `two_wheeler` / `motorcycle` | Procedural Frame (Chassis, Handlebars, Twin Spoke Wheels, Rider Silhouette) | CC0 1.0 Universal / MIT | Authored in-repo (`Scene3DCanvas.tsx`) |
| **Three Wheeler** | `auto_rickshaw` | Procedural Iconic Indian 3-Wheeler (Triangular Base, Canvas Hood, Front Wheel) | CC0 1.0 Universal / MIT | Authored in-repo (`Scene3DCanvas.tsx`) |
| **Manual Transport**| `handcart` | Procedural Flatbed Cart (Wood-toned Bed, High-Spoke Wheels, Pull Handles) | CC0 1.0 Universal / MIT | Authored in-repo (`Scene3DCanvas.tsx`) |
| **Road Surface** | `asphalt_texture` | Procedural 2D Canvas Noise & Grain Map (512x512 generated on init) | CC0 1.0 Universal / MIT | In-memory procedural generator |
| **Infrastructure** | `road_boundaries`, `pothole` | Dynamic Extrusion from `world.road_boundaries` & `world.static_obstacles` | CC0 1.0 Universal / MIT | Synthesized from Log Coordinates |

---

### Nominal Dimensions vs. Logged Dimensions
In accordance with Rule R1 and Master Brief requirements:
- **Class, pose, and bounding extents**: Derived strictly from logged episode frames (`ag.length`, `ag.width`, `ego.length`, `ego.width`, `ego.yaw`, `ag.yaw`).
- **Visual meshes**: Scaled parametrically to fit the exact bounding box logged by the simulation engine, preserving strict physical fidelity with zero phantom geometry.

