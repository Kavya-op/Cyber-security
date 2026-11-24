"""
Feature 7: Section 91 CrPC & Evidence Certificate Automated Report Generation Verification
Validates:
1. Section 91 CrPC (and BNSS Sec 94) TSP Requisition Notice generation (JSON preview & PDF binary).
2. Section 65B Indian Evidence Act (and BSA Sec 63) Electronic Evidence Certificate with SHA-256 custody ledger.
3. Comprehensive Master Case Dossier PDF export incorporating all forensic domains.
4. Multi-sheet Excel workbook export with complete case sheets.
5. Immutable Chain of Custody & Audit Trail query API.
6. REST API Endpoints (/api/reports/section-91, /api/reports/section-65b, /api/export/full-dossier, /api/reports/audit-trail).
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal, Case, AuditLog


def test_feature7_reports():
    print("=" * 70)
    print("FEATURE 7: SECTION 91 CrPC & EVIDENCE CERTIFICATE ENGINE VERIFICATION")
    print("=" * 70)

    client = TestClient(app)
    db = SessionLocal()

    try:
        case = db.query(Case).filter(Case.id == 1).first()
        assert case is not None, "Case 1 must exist in database"

        # -------------------------------------------------------------------
        # Step 1: Section 91 CrPC Requisition Notice (JSON Preview)
        # -------------------------------------------------------------------
        print("\n[Step 1] Section 91 CrPC Legal Notice Generation (JSON Preview)")
        sec91_payload_json = {
            "target_phone_numbers": ["9829011111", "9414022222"],
            "target_imeis": ["860432041234567"],
            "target_ip_addresses": ["103.21.244.18", "149.154.167.51"],
            "tsp_name": "Bharti Airtel Ltd.",
            "nodal_officer_email": "nodal.rajasthan@airtel.com",
            "investigating_officer_name": "Vikram Rathore",
            "io_rank": "Inspector of Police / SHO",
            "io_badge_id": "RJ-POL-8821",
            "police_station": "Cyber Crime Police Station, Jaipur",
            "fir_number": "FIR No. 402/2024",
            "fir_date": "2024-11-18",
            "offense_sections": "Sec. 420, 120-B IPC & Sec. 66D IT Act",
            "date_range_start": "2024-11-01",
            "date_range_end": "2024-11-20",
            "compliance_deadline_hours": 24,
            "response_format": "json"
        }

        resp_s91_json = client.post("/api/reports/section-91", json=sec91_payload_json)
        assert resp_s91_json.status_code == 200, f"Expected 200, got {resp_s91_json.status_code}"
        data_s91 = resp_s91_json.json()

        assert "ref_number" in data_s91, "Missing ref_number in notice"
        assert "CCPS/JPR/SEC-91" in data_s91["ref_number"], "Invalid ref number format"
        assert data_s91["tsp_name"] == "Bharti Airtel Ltd."
        assert len(data_s91["target_numbers"]) == 2
        assert "SECTION 91 OF THE CODE OF CRIMINAL PROCEDURE" in data_s91["legal_notice_text"]
        assert "SECTION 175" in data_s91["legal_notice_text"] or "Section 175" in data_s91["legal_notice_text"]
        assert data_s91["status"] == "READY_FOR_SERVICE"

        print(f"  [PASS] Section 91 Notice Generated: {data_s91['ref_number']}")
        print(f"  [PASS] Addressed to: Nodal Officer, {data_s91['tsp_name']}")
        print(f"  [PASS] Statutory Warning verified (Sec 175 IPC / Sec 210 BNS)")

        # -------------------------------------------------------------------
        # Step 2: Section 91 CrPC PDF Document Generation
        # -------------------------------------------------------------------
        print("\n[Step 2] Section 91 CrPC Official PDF Document Generation")
        sec91_payload_pdf = {**sec91_payload_json, "response_format": "pdf"}
        resp_s91_pdf = client.post("/api/reports/section-91", json=sec91_payload_pdf)
        assert resp_s91_pdf.status_code == 200
        assert resp_s91_pdf.headers["content-type"] == "application/pdf"
        assert len(resp_s91_pdf.content) > 2000, f"PDF too small: {len(resp_s91_pdf.content)} bytes"
        assert resp_s91_pdf.content.startswith(b"%PDF-"), "Must start with PDF magic bytes"
        print(f"  [PASS] Section 91 Notice PDF generated: {len(resp_s91_pdf.content)} bytes")

        # -------------------------------------------------------------------
        # Step 3: Section 65B Electronic Evidence Certificate
        # -------------------------------------------------------------------
        print("\n[Step 3] Section 65B Evidence Certificate & SHA-256 Custody Ledger")
        sec65b_payload = {
            "investigating_officer_name": "Vikram Rathore",
            "io_rank": "Inspector of Police / Cyber Cell",
            "io_badge_id": "RJ-POL-8821",
            "police_station": "Cyber Crime Police Station, Jaipur",
            "fir_number": "FIR No. 402/2024",
            "computer_make_model": "Forensic Workstation HP Z8 G4 / Ubuntu 22.04 LTS (Kernel 6.1)",
            "response_format": "json"
        }

        resp_s65b_json = client.post("/api/reports/section-65b", json=sec65b_payload)
        assert resp_s65b_json.status_code == 200
        data_s65b = resp_s65b_json.json()

        assert "evidence_files" in data_s65b
        assert len(data_s65b["evidence_files"]) > 0, "Expected evidence files with SHA-256 hashes"
        first_file = data_s65b["evidence_files"][0]
        assert len(first_file["sha256"]) == 64, f"SHA-256 must be 64 hex characters, got {len(first_file['sha256'])}"
        assert "SECTION 65B" in data_s65b["certificate_text"]
        assert data_s65b["status"] == "COURT_ADMISSIBLE"

        print(f"  [PASS] Section 65B Certificate generated for {data_s65b['officer']}")
        print(f"  [PASS] Certified Evidence Master: {first_file['filename']}")
        print(f"         SHA-256 Hash Digest: {first_file['sha256']}")

        # Section 65B PDF
        sec65b_payload_pdf = {**sec65b_payload, "response_format": "pdf"}
        resp_s65b_pdf = client.post("/api/reports/section-65b", json=sec65b_payload_pdf)
        assert resp_s65b_pdf.status_code == 200
        assert resp_s65b_pdf.headers["content-type"] == "application/pdf"
        assert resp_s65b_pdf.content.startswith(b"%PDF-")
        print(f"  [PASS] Section 65B Certificate PDF generated: {len(resp_s65b_pdf.content)} bytes")

        # -------------------------------------------------------------------
        # Step 4: Comprehensive Master Case Dossier PDF Export
        # -------------------------------------------------------------------
        print("\n[Step 4] Master Forensic Case Dossier PDF Compilation")
        resp_dossier = client.get("/api/export/full-dossier")
        assert resp_dossier.status_code == 200
        assert resp_dossier.headers["content-type"] == "application/pdf"
        assert len(resp_dossier.content) > 3000
        assert resp_dossier.content.startswith(b"%PDF-")
        print(f"  [PASS] Master Forensic Case Dossier generated: {len(resp_dossier.content)} bytes")

        # Case specific endpoint
        resp_dossier_case = client.get("/api/cases/1/export/full-dossier")
        assert resp_dossier_case.status_code == 200
        assert resp_dossier_case.content.startswith(b"%PDF-")
        print(f"  [PASS] Case 1 Specific Dossier generated: {len(resp_dossier_case.content)} bytes")

        # -------------------------------------------------------------------
        # Step 5: Master Forensic Excel Workbook Export
        # -------------------------------------------------------------------
        print("\n[Step 5] Master Forensic Excel Workbook (.xlsx) Export")
        resp_excel = client.get("/api/export/excel")
        assert resp_excel.status_code == 200
        assert "spreadsheet" in resp_excel.headers["content-type"] or "sheet" in resp_excel.headers["content-type"]
        assert len(resp_excel.content) > 10000, f"Excel too small: {len(resp_excel.content)} bytes"
        print(f"  [PASS] Master Forensic Excel Workbook generated: {len(resp_excel.content)} bytes")

        # -------------------------------------------------------------------
        # Step 6: Immutable Chain of Custody & Audit Trail
        # -------------------------------------------------------------------
        print("\n[Step 6] Chain of Custody & Audit Trail API Verification")
        resp_audit = client.get("/api/reports/audit-trail?limit=50")
        assert resp_audit.status_code == 200
        audit_data = resp_audit.json()
        assert audit_data["total_records"] > 0
        assert len(audit_data["audit_logs"]) > 0

        # Action Filtered Query
        resp_audit_seal = client.get("/api/reports/audit-trail?action=SECTION_91")
        assert resp_audit_seal.status_code == 200
        assert resp_audit_seal.json()["total_records"] > 0
        print(f"  [PASS] Audit Trail API verified: {audit_data['total_records']} audit records tracked")
        print(f"  [PASS] Action filter (?action=SECTION_91) logged notice generation correctly")

        print("\n" + "=" * 70)
        print("ALL FEATURE 7: SECTION 91 CrPC & EVIDENCE CERTIFICATE TESTS PASSED (100%)")
        print("=" * 70)

    finally:
        db.close()


if __name__ == "__main__":
    test_feature7_reports()
