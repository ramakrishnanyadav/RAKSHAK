# MATLAB / Simulink + RoadRunner Co-Simulation Adapter

This directory provides the official bridge between MathWorks RoadRunner Scenario, Automated Driving Toolbox, and the ADAPTIVE-PATH Studio.

## Architecture

```
[ RoadRunner Scenario ]
         │ (gRPC Co-Sim API)
         ▼
[ Simulink Vehicle Control / Automated Driving Toolbox ]
         │
         ▼
[ apath_log_v1_export.m ]
         │ (apath-log v1 JSON)
         ▼
[ ADAPTIVE-PATH Studio Replay Viewer ]
```

## How to Run the Co-Simulation & Export Logs

1. **Open RoadRunner Scenario**:
   - Load any of the 5 scenes: `VillageRoad.rrscenario`, `UrbanIntersection.rrscenario`, `HighwayMerge.rrscenario`, `DenseMarket.rrscenario`, or `CattleCrossing.rrscenario`.
2. **Open the Simulink Model**:
   - Open `adaptive_path_controller.slx` in MATLAB R2026a (or R2024b+).
   - Click **Run Co-Simulation**.
3. **Export to `apath-log/v1`**:
   - In MATLAB Command Window:
     ```matlab
     apath_log_v1_export(out, "SCENARIO_5_CATTLE_CROSSING", "P3", 1000, "../storage/runs/matlab_run_export.json");
     ```
4. **Replay in Studio**:
   - Open ADAPTIVE-PATH Studio at `http://localhost:5173/` or launch the standalone bundle.
   - The MATLAB run renders identically to Python reference runs with zero engine dependencies.
