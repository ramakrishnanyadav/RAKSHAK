import json

manifest = json.load(open('runs/val_b_manifest.json'))

p3_corr = manifest['configurations']['P3_Corrected']['scenario_breakdown']
p3_base = manifest['configurations']['P3_Baseline']['scenario_breakdown']

print("=== P3 BASELINE FULL 5x5 TABLE (5 Scenarios x 5 Seeds) ===")
print(f"{'Scenario':<32} | {'Seed':<5} | {'Goal':<6} | {'Collision':<10} | {'Clearance (m)':<14} | {'Duration (s)':<12}")
print("-" * 90)

collision_mismatches = []

for sc_id in p3_base:
    corr_eps = {e['seed']: e for e in p3_corr[sc_id]['episodes']}
    for ep in p3_base[sc_id]['episodes']:
        seed = ep['seed']
        goal = ep['completed_goal']
        col = ep['collision_occurred']
        clr = ep['min_clearance_m']
        dur = ep['duration_s']
        
        corr_ep = corr_eps[seed]
        if corr_ep['collision_occurred'] != col:
            collision_mismatches.append((sc_id, seed, corr_ep['collision_occurred'], col))
            
        print(f"{sc_id:<32} | {seed:<5} | {str(goal):<6} | {str(col):<10} | {clr:<14.2f} | {dur:<12.2f}")

print("\n--- Collision Comparison Between P3 Corrected and P3 Baseline ---")
if not collision_mismatches:
    print("CONFIRMED: P3 Baseline and P3 Corrected show 100% IDENTICAL collision outcomes across all 25 episodes (5 scenarios x 5 seeds)!")
else:
    print(f"Mismatches found: {collision_mismatches}")

