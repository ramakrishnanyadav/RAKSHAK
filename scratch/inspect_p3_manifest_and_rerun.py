import sys
sys.path.insert(0, '.')
import json
from engine.runner import SimulationRunner

with open('runs/val_b_manifest.json') as f:
    m = json.load(f)

for cfg in ['P3_Baseline', 'P3_Corrected']:
    print(f'=== MANIFEST: {cfg} ===')
    print('config params:', json.dumps(m['configurations'][cfg].get('config', {}), indent=2))
    for sc in ['SCENARIO_5_CATTLE_CROSSING', 'SCENARIO_1_VILLAGE_ROAD']:
        eps = [e for e in m['configurations'][cfg]['scenario_breakdown'][sc]['episodes'] if e['seed'] in [2005, 2008]]
        for e in eps:
            print(f'  {sc} seed={e["seed"]}: goal={e["completed_goal"]} coll={e["collision_occurred"]} clr={e["min_clearance_m"]} dur={e["duration_s"]}')

print('\n=== RE-RUNNING UNMODIFIED ENGINE ===')
runner = SimulationRunner()

print('--- P3 with w_stall=0.00 ---')
for sc, s in [('SCENARIO_5_CATTLE_CROSSING', 2005), ('SCENARIO_1_VILLAGE_ROAD', 2008)]:
    log = runner.run(sc, 'P3', s, 'val_b', custom_params={'w_stall': 0.00, 'w_prog': 2.20})
    m = log.metrics
    print(f'  {sc} seed={s} w_stall=0.00: goal={m.completed_goal} coll={m.collision_occurred} clr={m.min_clearance_m} dur={m.duration_s}')

print('--- P3 with w_stall=4.00 ---')
for sc, s in [('SCENARIO_5_CATTLE_CROSSING', 2005), ('SCENARIO_1_VILLAGE_ROAD', 2008)]:
    log = runner.run(sc, 'P3', s, 'val_b', custom_params={'w_stall': 4.00, 'w_prog': 2.20, 't_grace': 1.00, 'gamma': 1.50, 'J_stall_max': 5.00})
    m = log.metrics
    print(f'  {sc} seed={s} w_stall=4.00: goal={m.completed_goal} coll={m.collision_occurred} clr={m.min_clearance_m} dur={m.duration_s}')

print('--- Canonical P3 without custom_params ---')
for sc, s in [('SCENARIO_5_CATTLE_CROSSING', 2005), ('SCENARIO_1_VILLAGE_ROAD', 2008)]:
    log = runner.run(sc, 'P3', s, 'val_b')
    m = log.metrics
    print(f'  {sc} seed={s} default: goal={m.completed_goal} coll={m.collision_occurred} clr={m.min_clearance_m} dur={m.duration_s}')
