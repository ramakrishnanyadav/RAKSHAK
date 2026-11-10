import sys
sys.path.insert(0, '.')
import json
import math
from engine.runner import SimulationRunner
from engine.simulation.vehicle import KinematicBicycleModel
from engine.scenarios.registry import build_scenario

with open('runs/val_b_manifest.json') as f:
    manifest = json.load(f)

runner = SimulationRunner()
results = []

for cfg_name in ['P3_Corrected', 'P3_Baseline', 'B1_Baseline']:
    cfg = manifest['configurations'][cfg_name]
    planner_id = cfg['planner_id']
    params = cfg['params']
    
    for sc_id, sc_data in cfg['scenario_breakdown'].items():
        for ep in sc_data['episodes']:
            if not ep['collision_occurred']:
                continue
            seed = ep['seed']
            log = runner.run(sc_id, planner_id, seed, 'val_b', custom_params=params)
            
            # Check frames for first excursion step
            first_excursion_step = None
            first_excursion_t = None
            for f in log.frames:
                poly = KinematicBicycleModel.get_bounding_box(f.ego.x, f.ego.y, f.ego.yaw, 4.2, 1.8)
                max_abs_y = max(abs(y) for x, y in poly)
                if max_abs_y > 4.70:
                    first_excursion_step = f.step
                    first_excursion_t = f.t
                    break
            
            # Did it collide physically?
            # In runner.py, if collision_detected:
            # Let's check why runner terminated
            # Final frame
            final_step = log.frames[-1].step
            final_t = log.frames[-1].t
            duration = log.metrics.duration_s
            min_clr = log.metrics.min_clearance_m
            
            # Determine cause:
            # If there was an excursion, was it also physical contact?
            # In runner.py, collision_detected is set if dist == 0.0 to static or dynamic,
            # or if curr_y > (y_max_road + 1.8).
            # If min_clr == 0.0 in runner run (before metrics override), it was contact!
            # Let's inspect runner's min_clearance_run by re-checking final step against world
            world, ego, sc_cfg = build_scenario(sc_id, seed, 'val_b', params)
            # Find the contact target
            last_f = log.frames[-1]
            contact_target = None
            if min_clr == 0.0 or duration < sc_cfg.timeout_s - 0.2:
                # Runner stopped early due to collision_detected
                # Check what it hit at the end
                for ag in last_f.agents:
                    ag_poly = KinematicBicycleModel.get_bounding_box(ag.x, ag.y, ag.yaw, ag.length, ag.width)
                    ego_poly = KinematicBicycleModel.get_bounding_box(last_f.ego.x, last_f.ego.y, last_f.ego.yaw, 4.2, 1.8)
                    d = KinematicBicycleModel.min_distance_polygons(ego_poly, ag_poly)
                    if d < 0.35:
                        contact_target = f"agent:{ag.id}({ag.class_name}) [gap={d:.2f}m at step {last_f.step}]"
                        break
                if not contact_target:
                    for obj in world.static_obstacles:
                        obj_poly = KinematicBicycleModel.get_bounding_box(obj.x, obj.y, obj.yaw, obj.length, obj.width)
                        ego_poly = KinematicBicycleModel.get_bounding_box(last_f.ego.x, last_f.ego.y, last_f.ego.yaw, 4.2, 1.8)
                        d = KinematicBicycleModel.min_distance_polygons(ego_poly, obj_poly)
                        if d < 0.35:
                            contact_target = f"static:{obj.id}({obj.kind}) [gap={d:.2f}m at step {last_f.step}]"
                            break

            res = {
                'config': cfg_name,
                'scenario': sc_id,
                'seed': seed,
                'duration': duration,
                'final_step': final_step,
                'first_excursion_step': first_excursion_step,
                'first_excursion_t': first_excursion_t,
                'contact_target': contact_target,
                'has_sat_contact': contact_target is not None,
            }
            results.append(res)
            print(f"[{cfg_name}] {sc_id} s{seed}: final_step={final_step} (t={final_t}s) excursion_step={first_excursion_step} contact={contact_target}")

with open('scratch/authoritative_collisions.json', 'w') as f:
    json.dump(results, f, indent=2)

