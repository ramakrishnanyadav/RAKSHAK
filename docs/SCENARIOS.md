# ADAPTIVE-PATH — Scenario Pack Documentation

> **Target System**: ADAPTIVE-PATH Simulation Engine & Benchmark Suite  
> **Problem Statement**: SIH26037 (MathWorks / Smart India Hackathon 2026)  
> **Evaluation Mode**: Closed-loop simulation on unstructured Indian roadways  
> **Framing**: Simulation and research platform only — strictly not road-ready software; never claim real-world safety.

---

## 🗺️ Overview of the Scenario Pack

Standard ADAS and autonomous driving benchmarks (e.g. nuScenes, Waymo, CARLA Town01-05) assume structured multi-lane Western roadways with clear lane markers, signalized intersections, and strictly compliant vehicular traffic.

The ADAPTIVE-PATH Scenario Pack models **five characteristic unstructured Indian road driving challenges** characterized by:
- Absence of painted lane markings and physical medians.
- Highly heterogeneous traffic mixes (heavy trucks, auto-rickshaws, two-wheelers, pedestrian crowds, stray cattle).
- Non-lane-following dynamic trajectories with aggressive lateral maneuvers.
- Occluded emergence from roadside stalls and parked vehicles.
- Variable surface conditions (potholes, unpaved gravel shoulders).

---

## 📋 Protocol Seed Splits & Anti-Overfitting Safeguards

To prevent post-hoc hyperparameter tuning and data leakage, all scenarios adhere to fixed seed splits:

| Split Name | Seed Range | Count | Scientific Purpose | Access Policy |
| :--- | :---: | :---: | :--- | :--- |
| **`tune`** | `1000` – `1009` | 10 seeds | Algorithm tuning, cost weight optimization, and pilot testing. | Open for training & tuning. |
| **`validate`** | `2000` – `2009` | 10 seeds | Sensitivity sweeps (agent crowding, sensor dropouts, latency). | Tuning evaluation only. |
| **`frozen_test`** | `3000` – `3029` | 30 seeds | Final frozen statistical hypothesis evaluation (H1–H4). | **Strictly locked & frozen**. No post-hoc tuning permitted. |

---

## 🛣️ The Five Scenario Families

### Scenario 1: `SCENARIO_1_VILLAGE_ROAD` ("Narrow Rural Road Oncoming Truck")
```
          [ Shoulder (Mud/Gravel) ]
  ════════════════════════════════════════════════  (5.5m Unmarked Road)
      Ego Vehicle ──>              <── Heavy Truck
                           [ Pothole ]
  ════════════════════════════════════════════════
          [ Shoulder (Mud/Gravel) ]
```
- **Description**: Narrow 5.5-meter rural asphalt without a centerline. An oncoming commercial truck occupies 65% of the roadway width, forcing the ego vehicle to anticipate early, decelerate, and negotiate a lateral bypass using the unpaved shoulder while avoiding localized pothole hazards.
- **Key Challenge**: Lateral corridor constriction, non-linear tire-road friction drops on unpaved shoulders ($\mu = 0.45$ vs $\mu = 0.85$), and early velocity management.
- **Dynamic Actors**: Oncoming heavy truck ($v = 8.5\text{ m/s}$), trailing two-wheeler ($v = 11.0\text{ m/s}$).
- **Target Horizon**: 10.0 seconds ($100\text{ cycles}$).

---

### Scenario 2: `SCENARIO_2_URBAN_INTERSECTION` ("Unsignalized Mixed-Traffic Junction")
```
                     │  ▲ Auto-Rickshaw
                     │  │
    ─────────────────┘  └─────────────────
      Ego ──>                 Two-Wheelers
                              Swarm (4x)
    ─────────────────┐  ┌─────────────────
                     │  │
                     │  ▼ Pedestrian
```
- **Description**: A busy, unsignalized crossroad with zero traffic signals, no stop signs, and multi-directional traffic. Swarms of two-wheelers filter through gaps while auto-rickshaws cut across left turns without yielding.
- **Key Challenge**: Multi-agent non-lane trajectory prediction ($K=6$ multimodal hypotheses), dead-lock avoidance, and negotiating gap acceptance under acute uncertainty.
- **Dynamic Actors**: 2 auto-rickshaws, 4 motorcycles/scooters, 2 crossing pedestrians.
- **Target Horizon**: 12.0 seconds ($120\text{ cycles}$).

---

### Scenario 3: `SCENARIO_3_HIGHWAY_MERGE` ("Acute Angle Slow-Vehicle Merge")
```
  ════════════════════════════════════════════════════════
    Ego (Cruising at 14 m/s) ──────────────────────>
  ══════════════════════════════╲
                                 ╲  Slow Tractor / Cart
                                  ╲ (3.5 m/s Merge)
```
- **Description**: High-speed peripheral corridor where slow agricultural vehicles (tractors, cycle-rickshaws) enter from unpaved farm access ramps at acute angles without dedicated acceleration lanes.
- **Key Challenge**: High relative speed differential ($\Delta v > 10\text{ m/s}$), continuous risk field compression, and choosing between lane-change bypass vs safe deceleration without rear-end risk.
- **Dynamic Actors**: Slow tractor entering at $3.5\text{ m/s}$, parallel passenger car traveling at $12.0\text{ m/s}$.
- **Target Horizon**: 12.0 seconds ($120\text{ cycles}$).

---

### Scenario 4: `SCENARIO_4_DENSE_MARKET` ("Occluded Sudden Pedestrian Emergence")
```
   [ Fruit Stall ]  [ Fruit Stall ]  [ Parked Van ]
                                          🚶 (Pedestrian Emerges)
  ────────────────────────────────────────────────────────
    Ego Vehicle ──────────────────────────────────>
  ────────────────────────────────────────────────────────
   [ Parked Autos ] [ Tea Stall ]    [ Vendor Cart ]
```
- **Description**: High-density urban bazaar flanked by temporary vendor stalls, parked auto-rickshaws, and handcarts. A pedestrian suddenly steps into the travel path from behind a parked delivery van with minimal initial line-of-sight.
- **Key Challenge**: Sensor raycasting occlusion handling, anticipatory speed gating through occluded zones, and rapid Minimal-Risk Manoeuvre (MRM) triggering when lead time is $< 0.5\text{ s}$.
- **Dynamic Actors**: 4 pedestrians (1 sudden crosser), 2 parked obstacle clusters, 1 low-speed oncoming rickshaw.
- **Target Horizon**: 8.0 seconds ($80\text{ cycles}$).

---

### Scenario 5: `SCENARIO_5_CATTLE_CROSSING` ("Bovine Obstacle Halting Mid-Lane")
```
  ────────────────────────────────────────────────────────
    Ego Vehicle ──────────────>          🐄 (Bovine Halts)
  ────────────────────────────────────────────────────────
```
- **Description**: A wandering cow enters the roadway from the roadside shoulder and comes to a complete halt directly in the ego vehicle's travel lane. Bovine motion is characterized by low velocity, high physical mass, and unpredictable directional swerves.
- **Key Challenge**: Early conformal uncertainty cone expansion, distinguishing between crossing intent vs stationary halting, and executing an anticipatory smooth lateral bypass $1.6\text{ s}$ earlier than reactive emergency braking.
- **Dynamic Actors**: 1 adult bovine obstacle ($v = 1.2\text{ m/s} \to 0.0\text{ m/s}$ halt), 1 following two-wheeler.
- **Target Horizon**: 12.0 seconds ($120\text{ cycles}$).

---

## 🔬 Road Geometry & Actor Data Schema

Scenarios are defined programmatically via [`engine/scenarios/registry.py`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/scenarios/registry.py) and serializable into standard JSON:

```json
{
  "scenario_id": "SCENARIO_5_CATTLE_CROSSING",
  "name": "Sudden Cattle Crossing",
  "road_geometry": {
    "type": "STRAIGHT_TWO_WAY",
    "length_m": 120.0,
    "width_m": 7.0,
    "lane_count": 2,
    "has_divider": false,
    "shoulder_type": "UNPAVED_DIRT",
    "shoulder_width_m": 1.5,
    "surface_friction": 0.85
  },
  "ego_start": {
    "x": 0.0,
    "y": -1.75,
    "v": 8.0,
    "target_v": 8.0,
    "heading": 0.0
  },
  "actors": [
    {
      "id": "cattle_01",
      "type": "CATTLE",
      "spawn_t": 0.0,
      "start_x": 35.0,
      "start_y": 4.5,
      "target_y": -1.5,
      "speed": 1.2,
      "halt_at_y": 0.0,
      "bounding_box": {"length": 2.2, "width": 1.1}
    }
  ]
}
```

---

## 🛠️ Authoring Custom Variants via API

Scenario Designers can author and register custom parameterized variants using `POST /api/scenarios/variants`:
```bash
curl -X POST http://localhost:8000/api/scenarios/variants \
  -H "Authorization: Bearer <DESIGNER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "scenario_family": "SCENARIO_1_VILLAGE_ROAD",
    "variant_name": "SCENARIO_1_MONSOON_FLOOD",
    "road_width_m": 4.8,
    "friction_coefficient": 0.38,
    "sensor_range_m": 25.0,
    "seed_split": "validate"
  }'
```
Variants are immediately validated against kinematic feasibility constraints and stored in the scenario registry.
