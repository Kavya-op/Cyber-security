"""
Feature 1: Data Ingestion & Normalization Engine Verification Test
Validates:
1. Format-Agnostic Ingestion & Carrier Fingerprinting (Airtel, Jio, IPDR, Custom).
2. Automated SHA-256 Cryptographic Evidence Hashing (Sec. 65B Indian Evidence Act).
3. Interactive Column Mapping & Normalization to Canonical Law Enforcement Schema.
4. Data Quality & Hygiene Validation (error reporting on corrupt numbers, timestamps, durations).
5. Database Commit with Section 65B Audit Trail.
"""
import sys
import io
from pathlib import Path

# Setup paths
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal, AuditLog, CDRRecord, IPDRRecord

def test_feature1_ingestion_engine():
    print("=" * 70)
    print("FEATURE 1: DATA INGESTION & NORMALIZATION ENGINE VERIFICATION")
    print("=" * 70)

    client = TestClient(app)

    # 1. Test Airtel Carrier CDR Inspection & Carrier Detection
    airtel_csv = (
        b"Caller_Number,Receiver_Number,Call_Time,Duration_Sec,FirstCellID,IMEI\n"
        b"9829012345,9414056789,2024-11-18 02:14:32,482,TOW-JPR-014,860432049102481\n"
        b"9829012345,9829987654,2024-11-18 03:45:10,195,TOW-JPR-029,860432049102481\n"
    )
    res = client.post("/api/upload/inspect", files={"file": ("airtel_sample.csv", io.BytesIO(airtel_csv), "text/csv")})
    assert res.status_code == 200, f"Inspect failed: {res.text}"
    insp = res.json()
    assert "Bharti Airtel" in insp["carrier_detected"]
    assert len(insp["sha256"]) == 64
    assert insp["detected_schema"] == "cdr"
    print(" [PASS] Airtel Carrier Format Detected & SHA-256 Hashed:", insp["carrier_detected"])

    # 2. Test Jio Carrier CDR Inspection
    jio_csv = (
        b"A_Party,B_Party,DateTime,Dur,Cell_ID,Device_IMEI\n"
        b"9414011111,9829922222,2024-11-18 11:15:40,64,TOW-AJM-102,864109038291047\n"
    )
    res = client.post("/api/upload/inspect", files={"file": ("jio_sample.csv", io.BytesIO(jio_csv), "text/csv")})
    assert res.status_code == 200
    insp_jio = res.json()
    assert "Reliance Jio" in insp_jio["carrier_detected"]
    print(" [PASS] Reliance Jio Format Detected:", insp_jio["carrier_detected"])

    # 3. Test IPDR Session Logs Inspection
    ipdr_csv = (
        b"Subscriber_Num,Public_IP,Source_Port,Session_Time,App_Service\n"
        b"9829012345,103.21.244.18,443,2024-11-18 02:18:00,Telegram Voice/Encrypted\n"
    )
    res = client.post("/api/upload/inspect", files={"file": ("ipdr_sample.csv", io.BytesIO(ipdr_csv), "text/csv")})
    assert res.status_code == 200
    insp_ipdr = res.json()
    assert insp_ipdr["detected_schema"] == "ipdr"
    print(" [PASS] IPDR Session Logs Format Detected:", insp_ipdr["carrier_detected"])

    # 4. Test Data Quality Validation with Corrupt & Valid Rows
    corrupt_csv = (
        b"Caller_Number,Receiver_Number,Call_Time,Duration_Sec,Tower_ID,IMEI\n"
        b"9829012345,9414056789,2024-11-18 02:14:32,482,TOW-JPR-014,860432049102481\n"
        b"123,9829987654,2024-11-18 03:45:10,195,TOW-JPR-029,860432049102481\n"
        b",,INVALID_DATE,corrupt_dur,TOW-JPR-000,\n"
    )
    res = client.post(
        "/api/upload/validate",
        files={"file": ("validation_test.csv", io.BytesIO(corrupt_csv), "text/csv")},
        data={"schema_type": "cdr"}
    )
    assert res.status_code == 200
    val_report = res.json()
    assert val_report["total_rows"] == 3
    assert val_report["valid_count"] == 1
    assert val_report["invalid_count"] == 2
    assert val_report["quality_score"] == 33.3
    assert len(val_report["invalid_rows"]) == 2
    print(" [PASS] Data Quality Engine Detected Incomplete & Corrupt Rows:", f"Score: {val_report['quality_score']}%")

    # 5. Test Cryptographic Evidence Sealing & Commit with Sec. 65B Audit Trail
    res = client.post(
        "/api/upload/commit",
        files={"file": ("custody_seal_test.csv", io.BytesIO(airtel_csv), "text/csv")},
        data={
            "case_id": 1,
            "schema_type": "cdr",
            "skip_invalid": "true",
            "officer_badge": "RJ-POL-8821"
        }
    )
    assert res.status_code == 200
    commit_res = res.json()
    assert commit_res["status"] == "success"
    assert commit_res["committed_rows"] == 2
    assert commit_res["certificate"]["compliance"] == "Section 65B Indian Evidence Act"
    assert len(commit_res["certificate"]["integrity_seal"]) == 64
    print(" [PASS] Cryptographic Evidence Sealed & Committed (Sec. 65B SHA-256 Hash Certified)")

    # 6. Verify SQLite Database Record & Audit Trail
    db = SessionLocal()
    try:
        last_log = db.query(AuditLog).filter(AuditLog.action == "SECTION_65B_INGESTION_SEAL").order_by(AuditLog.id.desc()).first()
        assert last_log is not None
        assert "custody_seal_test.csv" in last_log.query_text
        assert "RJ-POL-8821" in last_log.query_text
        print(" [PASS] Audit Log Integrity Confirmed in SQLite:", last_log.query_text[:65], "...")
    finally:
        db.close()

    print("\n" + "=" * 70)
    print("FEATURE 1 VERIFICATION COMPLETE: ALL 6 INGESTION ENGINE TESTS PASSED")
    print("=" * 70)

if __name__ == "__main__":
    test_feature1_ingestion_engine()
