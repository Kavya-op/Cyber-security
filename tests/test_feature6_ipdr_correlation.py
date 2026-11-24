"""
Feature 6: Integrated IPDR & VoIP Session Correlation Verification
Validates:
1. Application ecosystem fingerprinting (WhatsApp VoIP, Telegram Voice, Signal/Proton, DarkWeb/Tor).
2. Multi-modal cross correlation between cellular GSM voice/SMS (CDR) and IP data sessions (IPDR).
3. Nearest GSM call temporal correlation (identifying immediate switch from GSM to VoIP).
4. Cellular silence & encrypted data surge anomaly detection (GSM silence >= 3h with active IP packets).
5. Chronologically unified multi-modal timeline merging CDR and IPDR events.
6. Section 65B Indian Evidence Act admissibility citations (source_file#Lrow_number) across all records.
7. REST API Endpoints (/api/ipdr-correlation, /api/voip-sessions, /api/cases/{case_id}/ipdr-correlation).
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))

from fastapi.testclient import TestClient
from main import app
from services.graph_engine import correlate_ipdr_cdr
from database import SessionLocal, CDRRecord, IPDRRecord


def test_feature6_ipdr_correlation():
    print("=" * 70)
    print("FEATURE 6: INTEGRATED IPDR & VOIP SESSION CORRELATION VERIFICATION")
    print("=" * 70)

    db = SessionLocal()
    try:
        cdr_records = db.query(CDRRecord).filter(CDRRecord.case_id == 1).all()
        ipdr_records = db.query(IPDRRecord).filter(IPDRRecord.case_id == 1).all()

        assert len(cdr_records) > 0, "Expected CDR records in database for Case 1"
        assert len(ipdr_records) > 0, "Expected IPDR records in database for Case 1"

        # 1. Cross-Modal Correlation & Summary Metrics
        print("\n[Step 1] Cross-Modal Ingestion & Correlation Metrics")
        res = correlate_ipdr_cdr(cdr_records, ipdr_records)
        summary = res["summary"]

        assert summary["total_cdr_records"] == len(cdr_records)
        assert summary["total_ipdr_records"] == len(ipdr_records)
        assert summary["correlated_subscribers"] >= 40, f"Expected >= 40 correlated suspects, got {summary['correlated_subscribers']}"
        assert summary["voip_sessions_count"] >= 2, f"Expected at least 2 VoIP sessions, got {summary['voip_sessions_count']}"
        assert summary["darkweb_sessions_count"] >= 2, f"Expected at least 2 DarkWeb sessions, got {summary['darkweb_sessions_count']}"
        assert summary["risk_level"] == "CRITICAL", "Overall risk should be CRITICAL due to Tor/VoIP sessions"

        print(f"  [PASS] Correlated {summary['correlated_subscribers']} suspects across {summary['total_cdr_records']} CDRs and {summary['total_ipdr_records']} IPDRs")
        print(f"  [PASS] Identified {summary['voip_sessions_count']} priority covert/VoIP sessions")
        print(f"  [PASS] Identified {summary['darkweb_sessions_count']} DarkWeb / Tor anonymizer events")
        print(f"  [PASS] Primary investigation target: {summary['top_target_suspect']}")

        # 2. Application Fingerprinting & OTT Breakdown
        print("\n[Step 2] OTT Application Fingerprinting & Protocol Classification")
        breakdown = res["app_breakdown"]
        categories = [b["category"] for b in breakdown]

        assert "WhatsApp" in categories, "Expected WhatsApp category"
        assert "Telegram" in categories, "Expected Telegram category"
        assert "DarkWeb / Tor / Proxy" in categories, "Expected DarkWeb/Tor category"
        assert "Standard HTTPS" in categories, "Expected Standard HTTPS category"

        for b in breakdown:
            print(f"  [PASS] Category: {b['category']:<25} | Sessions: {b['session_count']:<4} | Suspects: {b['distinct_subscribers']:<3} | Encrypted: {b['is_encrypted']}")

        # 3. High-Priority VoIP & Covert Sessions Test
        print("\n[Step 3] VoIP & Covert Anonymizer Session Dossiers")
        priority = res["priority_sessions"]
        assert len(priority) >= 4, "Expected priority sessions"

        tg_session = next((p for p in priority if "Telegram" in p["service_hint"]), None)
        assert tg_session is not None, "Expected Telegram Voice session"
        assert tg_session["is_voip"] is True
        assert tg_session["threat_level"] == "CRITICAL"
        assert "3.5m after GSM call" in tg_session["correlation_note"]
        assert "#L" in tg_session["evidence_ref"]

        wa_session = next((p for p in priority if "WhatsApp" in p["service_hint"]), None)
        assert wa_session is not None, "Expected WhatsApp VoIP session"
        assert wa_session["is_voip"] is True
        assert wa_session["threat_level"] == "CRITICAL"

        tor_session = next((p for p in priority if "Tor" in p["service_hint"]), None)
        assert tor_session is not None, "Expected Tor session"
        assert tor_session["is_darkweb"] is True

        print(f"  [PASS] Telegram VoIP: Suspect {tg_session['subscriber_num']} to {tg_session['dest_ip']} ({tg_session['duration_sec']}s)")
        print(f"         Correlation: {tg_session['correlation_note']}")
        print(f"         Sec 65B Citation: {tg_session['evidence_ref']}")
        print(f"  [PASS] WhatsApp VoIP: Suspect {wa_session['subscriber_num']} to {wa_session['dest_ip']} ({wa_session['duration_sec']}s)")
        print(f"  [PASS] Tor Anonymizer: Suspect {tor_session['subscriber_num']} to {tor_session['dest_ip']}")

        # 4. Cellular Silence & Data Surge Anomalies Test
        print("\n[Step 4] Cellular Silence Windows with Active Encrypted IP Traffic")
        silence_list = res["cellular_silence_incidents"]
        assert len(silence_list) > 0, "Expected cellular silence incidents"

        top_silence = silence_list[0]
        assert top_silence["duration_hours"] >= 3.0, "Silence window must be >= 3 hours"
        assert top_silence["ipdr_session_count"] >= 1, "Must have active IPDR sessions during silence"
        assert len(top_silence["evidence_refs"]) > 0, "Must have IPDR citations"
        assert len(top_silence["flanking_cdr_refs"]) == 2, "Must have both before and after CDR citations"

        print(f"  [PASS] Detected {len(silence_list)} cellular silence anomalies")
        print(f"  [PASS] Sample Incident {top_silence['incident_id']}: Suspect {top_silence['subscriber_num']} went silent on GSM for {top_silence['duration_hours']} hours")
        print(f"         Active Apps: {', '.join(top_silence['apps_used'])} ({top_silence['ipdr_session_count']} sessions)")
        print(f"         Flanking GSM Calls: {top_silence['flanking_cdr_refs'][0]} -> {top_silence['flanking_cdr_refs'][1]}")

        # 5. Multi-Modal Unified Chronological Timeline Test
        print("\n[Step 5] Multi-Modal Chronological Co-Occurrence Timeline")
        timeline = res["multimodal_timeline"]
        assert len(timeline) >= 20, f"Expected >= 20 timeline events, got {len(timeline)}"

        streams = set(e["stream"] for e in timeline)
        assert "CDR" in streams and "IPDR" in streams, "Timeline must merge both CDR and IPDR streams"

        # Verify sorted order
        timestamps = [e["timestamp"] for e in timeline]
        assert timestamps == sorted(timestamps), "Timeline events must be chronologically ordered"

        print(f"  [PASS] Constructed unified timeline with {len(timeline)} co-occurrence events")
        print(f"  [PASS] First Event: [{timeline[0]['stream']}] {timeline[0]['service_label']} at {timeline[0]['timestamp']}")
        print(f"  [PASS] Sample Citation: {timeline[0]['evidence_ref']}")

        # 6. REST API Endpoints Verification via TestClient
        print("\n[Step 6] REST API Endpoints Verification (FastAPI TestClient)")
        client = TestClient(app)

        # GET /api/ipdr-correlation
        resp = client.get("/api/ipdr-correlation")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert "summary" in data and "app_breakdown" in data and "priority_sessions" in data
        assert data["summary"]["risk_level"] == "CRITICAL"
        print("  [PASS] GET /api/ipdr-correlation -> 200 OK")

        # GET /api/voip-sessions
        resp_voip = client.get("/api/voip-sessions")
        assert resp_voip.status_code == 200
        assert resp_voip.json()["total_voip_sessions"] >= 2
        print(f"  [PASS] GET /api/voip-sessions -> 200 OK ({resp_voip.json()['total_voip_sessions']} sessions)")

        # GET /api/cases/1/ipdr-correlation
        resp_case = client.get("/api/cases/1/ipdr-correlation")
        assert resp_case.status_code == 200
        assert resp_case.json()["case_id"] == 1
        print("  [PASS] GET /api/cases/1/ipdr-correlation -> 200 OK")

        # Target Suspect Filter Query
        resp_filtered = client.get("/api/ipdr-correlation?phone_number=9829011111")
        assert resp_filtered.status_code == 200
        assert resp_filtered.json()["summary"]["total_cdr_records"] > 0
        print("  [PASS] Filtered query (?phone_number=9829011111) -> 200 OK")

        print("\n" + "=" * 70)
        print("ALL FEATURE 6: INTEGRATED IPDR & VOIP CORRELATION TESTS PASSED (100%)")
        print("=" * 70)

    finally:
        db.close()


if __name__ == "__main__":
    test_feature6_ipdr_correlation()
