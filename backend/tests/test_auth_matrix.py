"""
Full Authorization Matrix Tests: Role x Action x Resource Ownership.
Validates access boundaries across:
- Roles: Guest, Researcher, Designer, Admin
- Actions: read, launch, cancel, author variants, admin governance
- Ownership: Shipped (public) vs Own vs Other's Private resources
"""

import pytest


class TestAuthorizationMatrix:
    # -------------------------------------------------------------
    # 1. READ RUNS & SHIPPED/OWNERSHIP PERMISSIONS
    # -------------------------------------------------------------
    def test_guest_can_read_shipped_run(self, client, guest_headers):
        res = client.get("/api/runs/run_shipped_sample", headers=guest_headers)
        assert res.status_code == 200
        assert res.json()["is_shipped"] is True

    def test_guest_cannot_read_private_run(self, client, guest_headers):
        res = client.get("/api/runs/run_private_sample", headers=guest_headers)
        assert res.status_code == 403
        assert res.json()["code"] == "OWNERSHIP_DENIED"

    def test_researcher_can_read_own_run(self, client, researcher_headers):
        res = client.get("/api/runs/run_private_sample", headers=researcher_headers)
        assert res.status_code == 200
        assert res.json()["id"] == "run_private_sample"

    def test_other_researcher_cannot_read_private_run(self, client, other_researcher_headers):
        res = client.get("/api/runs/run_private_sample", headers=other_researcher_headers)
        assert res.status_code == 403
        assert res.json()["code"] == "OWNERSHIP_DENIED"

    def test_admin_can_read_any_private_run(self, client, admin_headers):
        res = client.get("/api/runs/run_private_sample", headers=admin_headers)
        assert res.status_code == 200

    # -------------------------------------------------------------
    # 2. RUN LAUNCH PERMISSIONS
    # -------------------------------------------------------------
    def test_guest_cannot_launch_run(self, client, guest_headers):
        payload = {
            "scenario_id": "SCENARIO_5_CATTLE_CROSSING",
            "planner_id": "P3",
            "split": "tune",
            "seed": 1000,
            "engine_adapter": "python",
        }
        res = client.post("/api/runs", headers=guest_headers, json=payload)
        assert res.status_code == 403
        assert res.json()["code"] == "ROLE_PERMISSION_DENIED"

    def test_researcher_can_launch_run(self, client, researcher_headers):
        payload = {
            "scenario_id": "SCENARIO_5_CATTLE_CROSSING",
            "planner_id": "P3",
            "split": "tune",
            "seed": 1000,
            "engine_adapter": "python",
        }
        res = client.post("/api/runs", headers=researcher_headers, json=payload)
        assert res.status_code == 200
        assert res.json()["status"] == "queued"

    def test_designer_can_launch_run(self, client, designer_headers):
        payload = {
            "scenario_id": "SCENARIO_5_CATTLE_CROSSING",
            "planner_id": "P3",
            "split": "tune",
            "seed": 1000,
            "engine_adapter": "python",
        }
        res = client.post("/api/runs", headers=designer_headers, json=payload)
        assert res.status_code == 200

    # -------------------------------------------------------------
    # 3. RUN CANCELLATION OWNERSHIP MATRIX
    # -------------------------------------------------------------
    def test_guest_cannot_cancel_run(self, client, guest_headers):
        res = client.post("/api/runs/run_private_sample/cancel", headers=guest_headers)
        assert res.status_code == 403
        assert res.json()["code"] == "ROLE_PERMISSION_DENIED"

    def test_other_researcher_cannot_cancel_run(self, client, other_researcher_headers):
        res = client.post("/api/runs/run_private_sample/cancel", headers=other_researcher_headers)
        assert res.status_code == 403
        assert res.json()["code"] == "OWNERSHIP_DENIED"

    def test_owner_researcher_can_cancel_own_run(self, client, researcher_headers):
        res = client.post("/api/runs/run_private_sample/cancel", headers=researcher_headers)
        assert res.status_code == 200
        assert res.json()["status"] == "cancelling"

    def test_admin_can_cancel_any_run(self, client, admin_headers):
        res = client.post("/api/runs/run_private_sample/cancel", headers=admin_headers)
        assert res.status_code == 200

    # -------------------------------------------------------------
    # 4. SCENARIO VARIANT CREATION MATRIX
    # -------------------------------------------------------------
    def test_guest_cannot_create_variant(self, client, guest_headers):
        payload = {
            "name": "Guest Variant",
            "description": "Unauthorized attempt",
            "base_scenario_id": "SCENARIO_5_CATTLE_CROSSING",
            "config_overrides": {},
        }
        res = client.post("/api/scenarios/variants", headers=guest_headers, json=payload)
        assert res.status_code == 403

    def test_researcher_cannot_create_variant(self, client, researcher_headers):
        payload = {
            "name": "Researcher Variant",
            "description": "Researchers cannot author variants",
            "base_scenario_id": "SCENARIO_5_CATTLE_CROSSING",
            "config_overrides": {},
        }
        res = client.post("/api/scenarios/variants", headers=researcher_headers, json=payload)
        assert res.status_code == 403
        assert res.json()["code"] == "ROLE_PERMISSION_DENIED"

    def test_designer_can_create_variant(self, client, designer_headers):
        payload = {
            "name": "Designer Cattle Variant",
            "description": "Wider verge with active cattle",
            "base_scenario_id": "SCENARIO_5_CATTLE_CROSSING",
            "config_overrides": {"target_distance_m": 85.0},
        }
        res = client.post("/api/scenarios/variants", headers=designer_headers, json=payload)
        assert res.status_code == 201
        assert res.json()["is_variant"] is True

    def test_admin_can_create_variant(self, client, admin_headers):
        payload = {
            "name": "Admin Variant",
            "description": "High-risk variant",
            "base_scenario_id": "SCENARIO_1_VILLAGE_ROAD",
            "config_overrides": {},
        }
        res = client.post("/api/scenarios/variants", headers=admin_headers, json=payload)
        assert res.status_code == 201

    # -------------------------------------------------------------
    # 5. ADMIN GOVERNANCE ENDPOINTS MATRIX
    # -------------------------------------------------------------
    def test_guest_cannot_access_admin(self, client, guest_headers):
        res = client.get("/api/admin/users", headers=guest_headers)
        assert res.status_code == 403

    def test_researcher_cannot_access_admin(self, client, researcher_headers):
        res = client.get("/api/admin/users", headers=researcher_headers)
        assert res.status_code == 403
        assert res.json()["code"] == "ROLE_PERMISSION_DENIED"

    def test_designer_cannot_access_admin(self, client, designer_headers):
        res = client.get("/api/admin/audit-logs", headers=designer_headers)
        assert res.status_code == 403

    def test_admin_has_full_governance_access(self, client, admin_headers):
        # 1. Users list
        u_res = client.get("/api/admin/users", headers=admin_headers)
        assert u_res.status_code == 200
        assert len(u_res.json()) >= 1

        # 2. Audit logs
        a_res = client.get("/api/admin/audit-logs", headers=admin_headers)
        assert a_res.status_code == 200

        # 3. System stats
        s_res = client.get("/api/admin/system-stats", headers=admin_headers)
        assert s_res.status_code == 200
        assert "total_runs_recorded" in s_res.json()
