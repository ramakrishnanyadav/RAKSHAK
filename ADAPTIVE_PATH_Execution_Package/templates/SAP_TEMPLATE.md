# Statistical Analysis Plan — ADAPTIVE-PATH

Status: DRAFT / APPROVED  
Version:  
Prepared date:  
Approval date:  
Git commit/tag:  
Seed-list hash:  

## 1. Research question
Can uncertainty-aware event-triggered P3 improve the safety–progress–comfort trade-off versus the validation-selected strongest baseline under specified simulated unstructured traffic conditions?

## 2. Experimental population and run classes
- Experiment configuration IDs:
- `run_class=experiment` definition:
- Interactive/demo exclusion:
- All launched experiment runs enter ITT denominator.
- Experiment cancellation/timeout/fault treatment:
- Sensitivity analysis exclusions, pre-specified:

## 3. Primary endpoint
Safe-progress rate = collision-free AND goal-completed experiment runs / all launched SAP experiment runs.

- Collision definition:
- Goal-completion predicate:
- Timeout:
- Incomplete:
- Simulation fault:
- Denominator:

## 4. Primary contrast
- P3 versus:
- Strongest baseline selection using validation data:
- Selection rule:
- Date/commit frozen:

## 5. Hypothesis
- Superiority / non-inferiority:
- Null:
- Alternative:
- Margin:
- Alpha:
- Power:

## 6. Sample-size calculation
- Expected paired discordance:
- Expected effect:
- Calculation method:
- Required matched episodes:
- Scenario-family allocation:
- Assumptions:

## 7. Primary statistical analysis
- Exact McNemar:
- Paired risk difference:
- Paired-bootstrap CI:
- Bootstrap unit: matched scenario-seed episode.
- Stratification/clustering:

## 8. Secondary endpoints
List each endpoint, metric version, test, effect size, CI and denominator.

## 9. Multiple comparisons
- Family of secondary hypotheses:
- Holm correction:
- Alpha:
- Rule if primary fails:

## 10. Continuous paired endpoints
- Wilcoxon signed-rank or justified alternative:
- Cliff's delta:
- Paired effect estimates:
- Handling ties/zero differences:

## 11. Conformal calibration
- Calibration episode unit:
- Nonconformity score:
- Multi-agent aggregation:
- Class/horizon:
- Minimum n:
- Quantile convention:
- Pointwise coverage:
- Simultaneous coverage:
- Envelope width:
- Planner/scenario source:
- Distribution-shift conditions:

## 12. Data splits
- Tuning:
- Calibration:
- Validation:
- Old exposed frozen set (exploratory):
- New frozen set:
- Disjointness evidence:

## 13. Exclusion and sensitivity rules
No post-hoc exclusions. Specify all rules before G3.

## 14. Missingness and failed runs
Report all failures, incomplete runs, actual denominators and CI widths.

## 15. Frozen-test execution
- SAP commit:
- Seed-list commit/hash:
- Git tag:
- Clean-tree check:
- G3 approval:
- Single run date:
- Artifact path:

## 16. Deviations
Document any deviation, date, reason, impact and whether results remain confirmatory.
