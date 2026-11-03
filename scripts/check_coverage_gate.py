"""
Coverage Gate Verification Script.
Enforces strict CI coverage thresholds:
1. >= 85% coverage on core backend services and routers
2. >= 70% overall repository test coverage
Fails with exit code 1 if any gate is breached.
"""

import sys
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path


def run_coverage_and_check():
    print("=======================================================")
    print("      ADAPTIVE-PATH CI CODE COVERAGE GATE ENFORCEMENT  ")
    print("=======================================================")

    xml_path = Path("coverage.xml")
    # If not present or rerun requested
    if not xml_path.exists():
        cmd = [
            sys.executable,
            "-m",
            "pytest",
            "--cov=backend/app",
            "--cov=engine",
            "--cov-report=term",
            "--cov-report=xml:coverage.xml",
            "tests/",
            "backend/tests/",
        ]
        print(f"Running: {' '.join(cmd)}")
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            print(proc.stdout)
            print(proc.stderr)
            return 1

    tree = ET.parse(xml_path)
    root = tree.getroot()

    overall_line_rate = float(root.attrib.get("line-rate", 0.0))
    overall_pct = overall_line_rate * 100.0

    # Backend core services: routers, auth, models, core security and rate limiting
    backend_service_pkgs = {"core", "routers", "."}
    backend_hits = 0
    backend_total = 0

    for package in root.findall(".//package"):
        pkg_name = package.attrib.get("name", "")
        if pkg_name in backend_service_pkgs:
            for cls in package.findall(".//class"):
                for line in cls.findall(".//line"):
                    backend_total += 1
                    if int(line.attrib.get("hits", 0)) > 0:
                        backend_hits += 1

    backend_pct = (backend_hits / max(1, backend_total)) * 100.0

    print(f"Overall Code Coverage: {overall_pct:.2f}% (Gate: >= 70.0%)")
    print(f"Backend Core Services Coverage: {backend_pct:.2f}% (Gate: >= 85.0%)")
    print("-------------------------------------------------------")

    failures = []
    if overall_pct < 70.0:
        failures.append(f"Overall coverage {overall_pct:.1f}% below required 70.0% threshold.")

    if backend_pct < 85.0:
        failures.append(f"Backend services coverage {backend_pct:.1f}% below required 85.0% threshold.")

    if failures:
        print("CI GATE FAILED:")
        for f in failures:
            print(f"  [GATE VIOLATION] {f}")
        return 1
    else:
        print("CI GATE PASSED: All coverage thresholds successfully certified.")
        return 0


if __name__ == "__main__":
    sys.exit(run_coverage_and_check())
