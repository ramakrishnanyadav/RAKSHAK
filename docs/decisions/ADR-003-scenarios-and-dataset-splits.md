# ADR-003: The Five Unstructured Indian Road Scenarios and Split Protocol

- **Status**: Accepted
- **Date**: 2026-10-14
- **Deciders**: Autonomous Systems Lead & Research Engineering Team

## Context
Standard AV simulators (CARLA, nuPlan, Highway-env) test lane-following, signalized junctions, and structured traffic in Western environments. The Smart India Hackathon problem SIH26037 requires evaluating non-lane-based path planning and collision avoidance on unstructured Indian roads with mixed traffic (auto-rickshaws, two-wheelers, pedestrians, cattle, handcarts, trucks).

To prevent tuning on the test set, scenarios must be systematically divided into `tune`, `validate`, and `frozen_test` splits.

## Decision

### 1. The Five Required Scenarios:
1. `SCENARIO_1_VILLAGE_ROAD` ("Unmarked Village Road"):
   - Narrow, unpaved or single-lane asphalt without lane markings.
   - Potholes, unpaved shoulders, oncoming heavy vehicles (tractors/trucks) forcing lateral bypass into edge space, slow bicycles.
2. `SCENARIO_2_URBAN_INTERSECTION` ("Busy Unsignalized Urban Intersection"):
   - Roundabout or chaotic 4-way crossroad without traffic signals or lane lines.
   - Cross-cutting auto-rickshaws, swarming two-wheelers taking opportunistic gaps, pedestrians weaving through traffic.
3. `SCENARIO_3_HIGHWAY_MERGE` ("Highway Merge with Slow Vehicles"):
   - Fast moving corridor with slow three-wheelers and overloaded tractors entering from side unpaved ramps at acute angles.
   - Requires high-speed foresight and dynamic risk evaluation rather than assuming merge etiquette.
4. `SCENARIO_4_DENSE_MARKET` ("Dense Market with Occluded Emergence"):
   - High agent density; vendors, parked auto-rickshaws, and stalls on both road sides.
   - Occluded emergence stress case: pedestrian or handcart emerging suddenly from behind a parked vehicle or market stall.
5. `SCENARIO_5_CATTLE_CROSSING` ("Sudden Cattle Crossing"):
   - Sudden non-compliant obstacles (cows/buffaloes) stepping into driveable corridor.
   - Erratically stops or changes direction mid-road, demanding non-lane lateral avoidance or minimal-risk safe braking.

### 2. Parameterization and Seed Protocol:
Every scenario is generated algorithmically from a deterministic configuration and seed:
- `tune` split (Seeds 1000 - 1009): Used for initial planner development and hyperparameter tuning.
- `validate` split (Seeds 2000 - 2009): Used for validation and sensitivity sweeps.
- `frozen_test` split (Seeds 3000 - 3029): At least 30 independent seeds per scenario for the final frozen benchmark. Parameters are frozen before final evaluation to ensure scientific integrity (G5).

## Consequences
- No subjective runs: all evaluations iterate over explicit seed ranges.
- Logs include the `split` identifier and scenario parameters hash to guarantee tamper-proof benchmark results.
