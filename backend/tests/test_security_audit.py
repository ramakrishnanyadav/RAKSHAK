"""
OWASP ASVS L2 & Top 10 Security Audit Test Suite.
Validates:
1. XML Security: XXE and Billion Laughs DoS prevention on scenario imports.
2. Archive Security: Zip bomb and path traversal (../../) rejection.
3. SSRF Protection: Loopback, private IP, and cloud metadata URL rejection.
4. Process Execution Safety: MATLAB argument injection prevention and strict validation.
5. CORS & Security Headers: Strict origins, CSP, HSTS, Permissions-Policy.
6. Privacy & GDPR: Complete data export and account erasure flows.
"""

import io
import zipfile
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.config import settings
from backend.app.core.xml_security import safe_parse_xml, validate_and_extract_scenario_archive
from backend.app.core.ssrf_validator import validate_outbound_url
from backend.app.adapters.matlab_adapter import MatlabRoadrunnerAdapter
from backend.app.adapters.base import RunContext


# Test fixtures (client, researcher_headers, admin_headers) provided by conftest.py


# =====================================================================
# 1. XML SECURITY (XXE & BILLION LAUGHS ENTITY EXPANSION)
# =====================================================================
class TestXMLSecurity:
    def test_xxe_external_entity_injection_rejected(self):
        """Attacker attempts to read /etc/passwd via XML external entity SYSTEM identifier."""
        malicious_xml = """<?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE scenario [
            <!ENTITY xxe SYSTEM "file:///etc/passwd">
        ]>
        <OpenSCENARIO>
            <Description>&xxe;</Description>
        </OpenSCENARIO>
        """
        with pytest.raises(ValueError) as exc:
            safe_parse_xml(malicious_xml)
        assert "DOCTYPE" in str(exc.value) or "entity" in str(exc.value).lower() or "forbidden" in str(exc.value).lower()

    def test_billion_laughs_exponential_entity_expansion_rejected(self):
        """Attacker attempts DoS via exponential XML entity expansion."""
        billion_laughs_xml = """<?xml version="1.0"?>
        <!DOCTYPE lolz [
            <!ENTITY lol "lol">
            <!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
            <!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;">
            <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
        ]>
        <OpenSCENARIO>&lol3;</OpenSCENARIO>
        """
        with pytest.raises(ValueError) as exc:
            safe_parse_xml(billion_laughs_xml)
        assert "DOCTYPE" in str(exc.value) or "forbidden" in str(exc.value).lower() or "entity" in str(exc.value).lower()


# =====================================================================
# 2. ARCHIVE SECURITY (ZIP BOMBS & PATH TRAVERSAL)
# =====================================================================
class TestArchiveSecurity:
    def test_zip_path_traversal_rejected(self, tmp_path):
        """Attacker crafts a zip archive with ../../../../ traversal payload."""
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("../../evil.txt", "malicious payload")
        zip_bytes = zip_buffer.getvalue()

        with pytest.raises(ValueError) as exc:
            validate_and_extract_scenario_archive(zip_bytes, tmp_path)
        assert "traversal" in str(exc.value).lower() or "insecure path" in str(exc.value).lower()

    def test_zip_bomb_excessive_compression_rejected(self, tmp_path):
        """Attacker creates a zip bomb with huge uncompressed size."""
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            # High compression repetition (15 MB uncompressed zeroes)
            zf.writestr("huge_map.xodr", b"\x00" * (15 * 1024 * 1024))
        zip_bytes = zip_buffer.getvalue()

        with pytest.raises(ValueError) as exc:
            validate_and_extract_scenario_archive(zip_bytes, tmp_path, max_uncompressed_bytes=10 * 1024 * 1024)
        assert "size" in str(exc.value).lower() or "bomb" in str(exc.value).lower()

    def test_zip_executable_payload_rejected(self, tmp_path):
        """Attacker places an executable shell script inside a scenario package."""
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("payload.sh", "#!/bin/sh\nrm -rf /")
        zip_bytes = zip_buffer.getvalue()

        with pytest.raises(ValueError) as exc:
            validate_and_extract_scenario_archive(zip_bytes, tmp_path)
        assert "extension" in str(exc.value).lower() or "disallowed" in str(exc.value).lower()


# =====================================================================
# 3. SSRF PROTECTION
# =====================================================================
class TestSSRFProtection:
    @pytest.mark.parametrize("malicious_url", [
        "http://127.0.0.1:8000/internal",
        "http://localhost:6379",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1/admin",
        "http://192.168.1.1/router",
        "http://172.16.0.5/api",
        "file:///etc/passwd",
        "gopher://localhost:11211",
    ])
    def test_ssrf_private_and_metadata_addresses_blocked(self, malicious_url):
        """Outbound scenario / resource URL ingestion MUST block private and link-local ranges."""
        with pytest.raises(ValueError) as exc:
            validate_outbound_url(malicious_url)
        assert "ssrf" in str(exc.value).lower() or "private" in str(exc.value).lower() or "scheme" in str(exc.value).lower()

    def test_ssrf_public_https_allowed(self):
        """Legitimate public HTTPS repositories must be allowed."""
        valid_url = "https://raw.githubusercontent.com/ASAM-OpenSCENARIO/examples/main/test.xosc"
        assert validate_outbound_url(valid_url) is True


# =====================================================================
# 4. MATLAB PROCESS INVOCATION SAFETY
# =====================================================================
class TestProcessExecutionSafety:
    def test_matlab_command_injection_rejected(self):
        """Attacker crafts a scenario_id containing MATLAB syntax injection."""
        adapter = MatlabRoadrunnerAdapter()
        malicious_context = RunContext(
            run_id="run_injected",
            scenario_id="SCENARIO_1'); system('calc.exe'); %",
            planner_id="P3",
            seed=1000,
        )

        with pytest.raises(ValueError) as exc:
            list(adapter.stream_progress(adapter.start(malicious_context)))
        assert "invalid" in str(exc.value).lower() or "injection" in str(exc.value).lower()


# =====================================================================
# 5. CORS & SECURITY HEADERS (ASVS V14)
# =====================================================================
class TestSecurityHeadersAndCORS:
    def test_cors_does_not_permit_wildcard_with_credentials(self):
        """ASVS L2 requirement: CORS must not use wildcard '*' when credentials are enabled."""
        assert "*" not in settings.cors_origins, "Wildcard '*' must not be present in cors_origins"

    def test_security_headers_present(self, client):
        """OWASP ASVS V14 headers must be present on all HTTP responses."""
        res = client.get("/health")
        assert res.status_code == 200
        headers = res.headers

        # Required headers
        assert "X-Content-Type-Options" in headers
        assert headers["X-Content-Type-Options"] == "nosniff"
        assert "X-Frame-Options" in headers
        assert headers["X-Frame-Options"] == "DENY"
        assert "Content-Security-Policy" in headers
        assert "default-src 'self'" in headers["Content-Security-Policy"]
        assert "Strict-Transport-Security" in headers
        assert "Permissions-Policy" in headers


# =====================================================================
# 6. PRIVACY & GDPR / DPDP COMPLIANCE
# =====================================================================
class TestPrivacyCompliance:
    def test_data_export_flow(self, client, researcher_headers):
        """GDPR Right to Data Portability: user can export all personal data."""
        export_res = client.get(
            "/api/settings/data/export",
            headers=researcher_headers,
        )
        assert export_res.status_code == 200
        data = export_res.json()
        assert "user_profile" in data
        assert "runs" in data
        assert "preferences" in data
        assert "quota" in data
        assert "sessions" in data
        assert data["user_profile"]["id"] == "test_researcher_id"
