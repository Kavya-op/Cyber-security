"""
Feature 5: Suspicious Pattern Detection (Night-Time Calling, High-Frequency Bursts) Verification
Validates:
1. 24-Hour temporal profile & hourly distribution (00:00 to 23:00) with nocturnal hazard classification.
2. Night-Time Calling Dossiers (23:00 to 05:00) with nocturnal percentage, top counterparts, and towers.
3. Sliding-window rapid call burst detection (cadence rate, intensity rating, cell sector).
4. Short-duration beacon signaling clusters (<= 10s covert micro-calls and missed calls).
5. Section 65B Indian Evidence Act admissibility citations (source_file#Lrow_number) across all anomalies.
6. REST API Endpoints (/api/suspicious-patterns, /api/patterns, /api/cases/{case_id}/suspicious-patterns).
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))

from fastapi.testclient import TestClient
from main import app
from services.graph_engine import analyze_suspicious_patterns
from database import SessionLocal, CDRRecord


def test_feature5_suspicious_patterns():
    print("=" * 70)
    print("FEATURE 5: SUSPICIOUS PATTERN DETECTION ENGINE VERIFICATION")
    print("=" * 70)

    db = SessionLocal()
    try:
        records = db.query(CDRRecord).filter(CDRRecord.case_id == 1).all()
        assert len(records) > 0, "Expected case records in database"

        # 1. Temporal 24-Hour Hourly Profile Test
        print("\n[Step 1] 24-Hour Diurnal / Nocturnal Hourly Distribution Profile")
        patterns = analyze_suspicious_patterns(records, burst_window_minutes=20, burst_min_calls=3)
        hourly = patterns["hourly_distribution"]
        summary = patterns["summary"]

        assert len(hourly) == 24, f"Expected 24 hourly buckets, got {len(hourly)}"
        night_hours = [d for d in hourly if d["is_night"]]
        assert len(night_hours) == 6, f"Expected 6 nocturnal hours (23 to 4), got {len(night_hours)}"

        total_counted = sum(d["call_count"] for d in hourly)
        assert total_counted == len(records), f"Hourly sum {total_counted} should match total records {len(records)}"

        night_calls_count = sum(d["call_count"] for d in night_hours)
        assert summary["night_calls_count"] == night_calls_count, "Summary night calls count mismatch"
        print(f"  [PASS] 24-Hour profile constructed. Total records: {summary['total_records_analyzed']}")
        print(f"  [PASS] Nocturnal calls (23:00-05:00): {summary['night_calls_count']} ({summary['night_calls_percentage']}%)")

        # Verify Peak Nocturnal Hour
        peak_night = max(night_hours, key=lambda d: d["call_count"])
        print(f"  [PASS] Peak nocturnal traffic hour: {peak_night['hour_label']} with {peak_night['call_count']} calls")
        assert peak_night["call_count"] > 0, "Expected non-zero nocturnal peak"

        # 2. Night-Time Calling Dossiers Test
        print("\n[Step 2] Suspect Nocturnal Communication Dossiers")
        dossiers = patterns["night_calling_dossiers"]
        assert len(dossiers) > 0, "Expected at least one nocturnal suspect dossier"
        top_dossier = dossiers[0]
        assert "suspect" in top_dossier, "Dossier must contain suspect phone"
        assert top_dossier["night_calls_count"] > 0, "Dossier must have positive night calls"
        assert top_dossier["nocturnal_percentage"] > 0, "Nocturnal percentage must be positive"
        assert len(top_dossier["sample_evidence"]) > 0, "Must contain Section 65B evidence citations"
        assert "#L" in top_dossier["sample_evidence"][0], "Citations must follow filename#Llinenumber format"

        print(f"  [PASS] Top nocturnal suspect: {top_dossier['suspect']} with {top_dossier['night_calls_count']} night calls ({top_dossier['nocturnal_percentage']}%)")
        print(f"  [PASS] Visited cell towers: {', '.join(top_dossier['towers_visited'][:3])}")
        print(f"  [PASS] Section 65B Line Citation: {top_dossier['sample_evidence'][0]}")

        # 3. High-Frequency Call Bursts Test (Sliding Window)
        print("\n[Step 3] Sliding-Window Rapid Call Bursts (>= 3 calls in 20 min)")
        bursts = patterns["burst_incidents"]
        assert len(bursts) > 0, "Expected call burst incidents in test case"
        burst_0 = bursts[0]

        assert burst_0["call_count"] >= 3, f"Burst must have >= 3 calls, got {burst_0['call_count']}"
        assert burst_0["window_minutes"] <= 20.0, "Window duration must be <= burst_window_minutes"
        assert burst_0["rate_calls_per_min"] > 0, "Burst rate must be positive"
        assert burst_0["intensity"] in ["CRITICAL", "HIGH"], "Intensity must be CRITICAL or HIGH"
        assert len(burst_0["evidence_refs"]) >= 3, "All calls in burst must have evidence references"
        assert all("#L" in ref for ref in burst_0["evidence_refs"]), "Burst evidence must have Section 65B line numbers"

        print(f"  [PASS] Detected {len(bursts)} rapid burst incidents.")
        print(f"  [PASS] Incident {burst_0['incident_id']}: Initiator {burst_0['caller']}, {burst_0['call_count']} calls in {burst_0['window_minutes']}m ({burst_0['rate_calls_per_min']} calls/min)")
        print(f"  [PASS] Sector: {burst_0['tower_location']} | Intensity: {burst_0['intensity']}")

        # 4. Short-Duration Beacon Signaling Test (<= 10 seconds)
        print("\n[Step 4] Short-Duration Beacon Signaling & Missed Calls (<= 10s)")
        pings = patterns["ping_signaling_clusters"]
        assert len(pings) > 0, "Expected short ping signaling clusters"
        ping_0 = pings[0]

        assert ping_0["ping_count"] >= 2, "Ping cluster must have >= 2 signaling events"
        assert ping_0["avg_duration_sec"] <= 10.0, f"Average duration must be <= 10s, got {ping_0['avg_duration_sec']}s"
        assert len(ping_0["evidence_refs"]) >= 2, "Evidence references required for pings"

        print(f"  [PASS] Detected {len(pings)} covert signaling pairs.")
        print(f"  [PASS] Cluster {ping_0['cluster_id']}: {ping_0['caller']} <-> {ping_0['receiver']} ({ping_0['ping_count']} pings, avg {ping_0['avg_duration_sec']}s)")

        # 5. REST API Endpoints Test
        print("\n[Step 5] REST API Endpoints Verification via TestClient")
        client = TestClient(app)

        # GET /api/suspicious-patterns
        resp = client.get("/api/suspicious-patterns")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert "summary" in data and "hourly_distribution" in data
        assert data["summary"]["risk_level"] in ["CRITICAL", "ELEVATED"]
        print("  [PASS] GET /api/suspicious-patterns -> 200 OK")

        # GET /api/patterns
        resp_alt = client.get("/api/patterns")
        assert resp_alt.status_code == 200
        print("  [PASS] GET /api/patterns -> 200 OK")

        # GET /api/cases/1/suspicious-patterns
        resp_case = client.get("/api/cases/1/suspicious-patterns")
        assert resp_case.status_code == 200
        assert resp_case.json()["case_id"] == 1
        print("  [PASS] GET /api/cases/1/suspicious-patterns -> 200 OK")

        # Parameterized Query
        resp_filtered = client.get("/api/suspicious-patterns?burst_window_minutes=10&burst_min_calls=2")
        assert resp_filtered.status_code == 200
        print("  [PASS] Parameterized burst window query (?burst_window_minutes=10) -> 200 OK")

        print("\n" + "=" * 70)
        print("ALL FEATURE 5: SUSPICIOUS PATTERN DETECTION TESTS PASSED (100%)")
        print("=" * 70)

    finally:
        db.close()


if __name__ == "__main__":
    test_feature5_suspicious_patterns()
