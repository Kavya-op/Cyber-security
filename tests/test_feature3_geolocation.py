"""
Feature 3: Cell Tower Geolocation & Movement Reconstruction Engine Test
Validates:
1. Haversine distance accuracy across Rajasthan cell tower grid coordinates.
2. Chronological movement trail reconstruction with hop distance (km), time delta, and velocity (km/h).
3. Impossible travel / velocity anomaly detection (>120 km/h threshold).
4. Co-Location & physical meeting detection engine (suspect rendezvous within time window).
5. REST API responses for /api/movement-trail/{phone_num} and /api/co-location.
"""
import sys
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))

from fastapi.testclient import TestClient
from main import app
from services.graph_engine import (
    calculate_haversine_km,
    reconstruct_movement_trail,
    detect_co_locations,
)
from database import SessionLocal, CDRRecord, CellTower

def test_feature3_geolocation():
    print("=" * 70)
    print("FEATURE 3: CELL TOWER GEOLOCATION & MOVEMENT RECONSTRUCTION VERIFICATION")
    print("=" * 70)

    # 1. Haversine Calculation Accuracy Tests
    print("\n[Step 1] Haversine Geographic Distance Calculations")
    # Same point should be 0.0 km
    d_same = calculate_haversine_km(26.9215, 75.7985, 26.9215, 75.7985)
    assert d_same == 0.0, f"Expected 0.0 km, got {d_same}"
    print("  [PASS] Identical coordinates distance: 0.0 km")

    # Jaipur Sindhi Camp Central to Ajmer Civil Lines
    # Lat/Lng: (26.9215, 75.7985) to (26.4690, 74.6390) is ~125.7 km
    d_jpr_ajm = calculate_haversine_km(26.9215, 75.7985, 26.4690, 74.6390)
    assert 120.0 <= d_jpr_ajm <= 135.0, f"Expected ~125.7 km, got {d_jpr_ajm}"
    print(f"  [PASS] Jaipur Sindhi Camp ➔ Ajmer Civil Lines: {d_jpr_ajm} km")

    # 2. Movement Trail Reconstruction Test
    print("\n[Step 2] Suspect Movement Trail Reconstruction")
    db = SessionLocal()
    try:
        towers = db.query(CellTower).all()
        towers_map = {
            t.tower_id: {
                "latitude": t.latitude,
                "longitude": t.longitude,
                "address": t.address,
                "operator": t.operator,
            }
            for t in towers
            if t.tower_id
        }

        records = db.query(CDRRecord).filter(CDRRecord.case_id == 1).all()
        target_phone = "9829011111"
        trail = reconstruct_movement_trail(records, target_phone, towers_map)

        assert trail["phone_number"] == target_phone
        summary = trail["summary"]
        hops = trail["hops"]

        assert summary["total_hops"] >= 10, f"Expected at least 10 hops, got {summary['total_hops']}"
        assert summary["total_distance_km"] > 0, "Total distance should be greater than 0 km"
        assert summary["unique_towers_count"] >= 3, "Expected multiple unique cell towers"
        print(f"  [PASS] Reconstructed {summary['total_hops']} hops across {summary['unique_towers_count']} cell towers")
        print(f"  [PASS] Total route distance: {summary['total_distance_km']} km")

        first_hop = hops[0]
        assert "tower_id" in first_hop
        assert "latitude" in first_hop
        assert "longitude" in first_hop
        assert "azimuth" in first_hop
        assert "evidence_ref" in first_hop
        print(f"  [PASS] Hop #1: Tower {first_hop['tower_id']} ({first_hop['tower_name']}) Azimuth: {first_hop['azimuth']}")

        # 3. Impossible Travel / Velocity Anomaly Test
        print("\n[Step 3] Velocity Anomaly & Impossible Travel Engine")
        class MockRecord:
            def __init__(self, rid, caller, tower, start_time, imei):
                self.id = rid
                self.caller_num = caller
                self.receiver_num = "9829099999"
                self.tower_id = tower
                self.start_time = start_time
                self.call_type = "Voice"
                self.duration_sec = 60
                self.imei = imei
                self.source_file = "Velocity_Test.csv"
                self.row_number = rid

        # Two records 125 km apart in 20 minutes = 375 km/h -> Impossible travel!
        t1 = datetime(2024, 11, 18, 10, 0, 0)
        t2 = datetime(2024, 11, 18, 10, 20, 0)
        mock_recs = [
            MockRecord(1, "9999911111", "TOW-JPR-014", t1, "358924081290455"),
            MockRecord(2, "9999911111", "TOW-AJM-102", t2, "358924081290455"),
        ]
        mock_trail = reconstruct_movement_trail(mock_recs, "9999911111", towers_map)
        assert mock_trail["summary"]["velocity_anomalies_count"] == 1, "Expected 1 velocity anomaly"
        anom_hop = mock_trail["hops"][1]
        assert anom_hop["is_velocity_anomaly"] is True
        assert anom_hop["speed_kmh"] > 120.0
        print(f"  [PASS] Anomaly Flagged: Jumped {anom_hop['distance_from_prev_km']} km in {anom_hop['time_delta_min']} mins ({anom_hop['speed_kmh']} km/h)")

        # 4. Co-Location & Meeting Detection Test
        print("\n[Step 4] Physical Rendezvous & Co-Location Detection Engine")
        co_locs = detect_co_locations(records, towers_map, window_minutes=30)
        assert len(co_locs) >= 1, f"Expected co-locations, got {len(co_locs)}"
        print(f"  [PASS] Detected {len(co_locs)} suspect physical rendezvous incidents within 30-min window")

        sample_meeting = co_locs[0]
        assert "tower_id" in sample_meeting
        assert "suspect_1" in sample_meeting
        assert "suspect_2" in sample_meeting
        assert sample_meeting["suspect_1"]["phone"] != sample_meeting["suspect_2"]["phone"]
        assert sample_meeting["time_delta_minutes"] <= 30
        assert "evidence_ref" in sample_meeting["suspect_1"]
        print(f"  [PASS] Sample Meeting at {sample_meeting['tower_id']} ({sample_meeting['tower_name']}):")
        print(f"         Suspect 1 ({sample_meeting['suspect_1']['phone']}) & Suspect 2 ({sample_meeting['suspect_2']['phone']})")
        print(f"         Time Delta: {sample_meeting['time_delta_minutes']} mins (Confidence: {sample_meeting['meeting_confidence']})")
        print(f"         Evidence Ref: {sample_meeting['suspect_1']['evidence_ref']} & {sample_meeting['suspect_2']['evidence_ref']}")

        # 5. REST API Verification via TestClient
        print("\n[Step 5] REST API Verification (FastAPI TestClient)")
        client = TestClient(app)

        # 5a. Movement Trail endpoint
        resp_trail = client.get("/api/movement-trail/9829011111")
        assert resp_trail.status_code == 200, f"Expected 200, got {resp_trail.status_code}"
        trail_json = resp_trail.json()
        assert "summary" in trail_json
        assert "hops" in trail_json
        print(f"  [PASS] GET /api/movement-trail/9829011111 -> 200 OK (Hops: {trail_json['summary']['total_hops']})")

        # 5b. Co-Location endpoint
        resp_coloc = client.get("/api/co-location?window_minutes=30")
        assert resp_coloc.status_code == 200, f"Expected 200, got {resp_coloc.status_code}"
        coloc_json = resp_coloc.json()
        assert "total_co_locations" in coloc_json
        assert coloc_json["total_co_locations"] >= 1
        print(f"  [PASS] GET /api/co-location?window_minutes=30 -> 200 OK (Meetings: {coloc_json['total_co_locations']})")

        # 5c. Case-specific analytics endpoints
        resp_case_trail = client.get("/api/analytics/1/movement-trail/9829011111")
        assert resp_case_trail.status_code == 200
        print(f"  [PASS] GET /api/analytics/1/movement-trail/9829011111 -> 200 OK")

        resp_case_coloc = client.get("/api/analytics/1/co-location?window_minutes=30")
        assert resp_case_coloc.status_code == 200
        print(f"  [PASS] GET /api/analytics/1/co-location?window_minutes=30 -> 200 OK")

    finally:
        db.close()

    print("\n" + "=" * 70)
    print("ALL FEATURE 3 VERIFICATION CHECKS PASSED (100.0%)")
    print("=" * 70)

if __name__ == "__main__":
    test_feature3_geolocation()
