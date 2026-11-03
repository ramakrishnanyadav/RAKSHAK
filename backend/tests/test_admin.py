"""
Admin and Operations Governance Tests.
Covers user management, role updating, quota adjustments, audit logs, and system metrics.
"""

import pytest


def test_admin_update_user_role_and_quota(client, admin_headers):
    # Update role
    role_res = client.put(
        "/api/admin/users/test_researcher_id/role",
        headers=admin_headers,
        json={"role": "designer"},
    )
    assert role_res.status_code == 200
    assert "designer" in role_res.json()["message"]

    # Update quota
    quota_res = client.put(
        "/api/admin/users/test_researcher_id/quota",
        headers=admin_headers,
        json={"max_concurrent_runs": 8, "daily_run_limit": 250},
    )
    assert quota_res.status_code == 200
    assert "Updated quotas" in quota_res.json()["message"]

    # Revert role
    client.put(
        "/api/admin/users/test_researcher_id/role",
        headers=admin_headers,
        json={"role": "researcher"},
    )


def test_admin_audit_logs_query_filters(client, admin_headers):
    # Retrieve all audit logs
    all_res = client.get("/api/admin/audit-logs", headers=admin_headers)
    assert all_res.status_code == 200
    logs = all_res.json()
    assert isinstance(logs, list)

    # Filter by user
    u_res = client.get("/api/admin/audit-logs?user_id=test_admin_id", headers=admin_headers)
    assert u_res.status_code == 200


def test_admin_system_stats(client, admin_headers):
    stats_res = client.get("/api/admin/system-stats", headers=admin_headers)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert "total_runs_recorded" in stats
    assert "active_worker_threads" in stats
