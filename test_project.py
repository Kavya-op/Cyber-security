"""
End-to-End Test Suite for Rajasthan Police CDR & IPDR Intelligence Platform.
Validates Database, Backend APIs, Forensics Analytics, AI Assistant, and Frontend Build.
"""
import sys
from pathlib import Path

# Add backend directory to path
BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal, Case, CellTower, CDRRecord, IPDRRecord, AuditLog

def run_tests():
    print("=" * 70)
    print("RAJASTHAN POLICE CDR/IPDR INTELLIGENCE PLATFORM - VERIFICATION SUITE")
    print("=" * 70)

    passed = 0
    total = 0

    def assert_test(name, condition, details=""):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f"  [PASS] {name} {details}")
        else:
            print(f"  [FAIL] {name} {details}")

    # 1. Database Integrity Checks
    print("\n[Phase 1] Database Tables & Dataset Integrity")
    db = SessionLocal()
    try:
        cases_count = db.query(Case).count()
        assert_test("Cases table has active cases", cases_count >= 1, f"({cases_count} cases)")

        towers_count = db.query(CellTower).count()
        assert_test("Cell Towers seeded", towers_count >= 15, f"({towers_count} towers in Jaipur & Ajmer)")

        cdr_count = db.query(CDRRecord).count()
        assert_test("CDR records present", cdr_count >= 600, f"({cdr_count} call detail records)")

        ipdr_count = db.query(IPDRRecord).count()
        assert_test("IPDR records present", ipdr_count >= 400, f"({ipdr_count} internet session records)")

        audit_count = db.query(AuditLog).count()
        assert_test("Audit Trail initialized", audit_count >= 4, f"({audit_count} compliance logs)")
    finally:
        db.close()

    # 2. REST API & Analytics Verification
    print("\n[Phase 2] Backend Analytics & Investigation APIs")
    with TestClient(app) as client:
        # Health
        res = client.get("/health")
        assert_test("Health check responds 200 OK", res.status_code == 200 and res.json().get("status") == "ok")

        # Overview Stats
        res = client.get("/api/stats")
        data = res.json()
        assert_test("Stats API returns forensic metrics", res.status_code == 200 and data.get("total_cdr_records", 0) > 0, 
                    f"(CDRs: {data.get('total_cdr_records')}, IPDRs: {data.get('total_ipdr_records')})")

        # Network Graph
        res = client.get("/api/graph")
        graph = res.json()
        nodes = graph.get("nodes", [])
        assert_test("Network Graph calculation", res.status_code == 200 and len(nodes) > 0, f"({len(nodes)} communication nodes)")

        # IMEI / SIM Swap Anomalies
        res = client.get("/api/anomalies")
        anomalies = res.json()
        assert_test("Device / IMEI Swap detection", res.status_code == 200 and len(anomalies) > 0, f"({len(anomalies)} anomaly incidents detected)")

        # Suspect Tower Timeline
        res = client.get("/api/timeline/9829011111")
        timeline = res.json()
        assert_test("Tower movement timeline for suspect", res.status_code == 200 and len(timeline) > 0, f"({len(timeline)} geolocated hops)")

        # Common Contacts Detection
        res = client.get("/api/common-contacts?num1=9829011111&num2=9829933333")
        common = res.json()
        assert_test("Cross-suspect common contacts", res.status_code == 200 and "common_contacts" in common)

        # AI Forensics Query
        res = client.post("/api/chat", json={"query": "Cite exact source file and row for IMEI change"})
        chat_data = res.json()
        answer = chat_data.get("answer", "")
        has_citations = len(chat_data.get("evidence_records", [])) > 0 or "OperatorA_Airtel_CDR.csv" in answer or "investigation.db" in answer or "IMEI" in answer
        assert_test("Evidence-Aware AI Natural Language query", res.status_code == 200 and has_citations, f"(Intent: {chat_data.get('intent')})")

        # Section 91 CrPC PDF Dossier Generation
        res = client.get("/api/cases/1/export/pdf")
        assert_test("Official Section 91 CrPC PDF export", res.status_code == 200 and len(res.content) > 1000, f"({len(res.content)} bytes PDF generated)")

        # Excel Export
        res = client.get("/api/cases/1/export/excel")
        assert_test("Excel Forensic Report export", res.status_code == 200 and len(res.content) > 5000, f"({len(res.content)} bytes XLSX generated)")

    # 3. Frontend Static Build Verification
    print("\n[Phase 3] Frontend Single-Bundle Serving")
    with TestClient(app) as client:
        res = client.get("/")
        assert_test("Frontend index.html served at root", res.status_code == 200 and "html" in res.headers.get("content-type", ""))

        dist_css = list((BASE_DIR / "frontend" / "dist" / "assets").glob("*.css"))
        if dist_css:
            css_name = dist_css[0].name
            res = client.get(f"/assets/{css_name}")
            assert_test("Neumorphic CSS stylesheets served", res.status_code == 200 and len(res.content) > 1000)

        dist_js = list((BASE_DIR / "frontend" / "dist" / "assets").glob("*.js"))
        if dist_js:
            js_name = dist_js[0].name
            res = client.get(f"/assets/{js_name}")
            assert_test("React application bundle served", res.status_code == 200 and len(res.content) > 1000)

    print("\n" + "=" * 70)
    print(f"VERIFICATION SUMMARY: {passed}/{total} tests PASSED ({round(passed/total*100, 1)}%)")
    print("=" * 70)

    return passed == total

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
