"""
Feature 2: Multi-SIM & Hardware Swap Tracker (IMEI-IMSI Analytics) Test
Validates:
1. Cross-correlation of MSISDNs across multiple IMEIs (Device Swaps).
2. Cross-correlation of IMEIs across multiple MSISDNs (Burner Handset Hubs).
3. TAC (Type Allocation Code) handset make & model identification.
4. Exact swap transition event extraction (timestamps, cell towers, source file citations).
5. REST API responses for /api/hardware-tracker and /api/anomalies.
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))

from fastapi.testclient import TestClient
from main import app
from services.graph_engine import lookup_tac_model, detect_imei_sim_changes, analyze_hardware_tracker
from database import SessionLocal, CDRRecord, CellTower

def test_feature2_hardware_tracker():
    print("=" * 70)
    print("FEATURE 2: MULTI-SIM & HARDWARE SWAP TRACKER VERIFICATION")
    print("=" * 70)

    # 1. TAC Lookup Tests
    print("\n[Step 1] TAC (Type Allocation Code) Model Identification")
    m1 = lookup_tac_model("860432049102481")
    assert "OnePlus 11" in m1, f"Expected OnePlus, got {m1}"
    print("  [PASS] TAC 86043204 ->", m1)

    m2 = lookup_tac_model("358924081290455")
    assert "Apple iPhone" in m2, f"Expected iPhone, got {m2}"
    print("  [PASS] TAC 35892408 ->", m2)

    m3 = lookup_tac_model("864109038291047")
    assert "Samsung Galaxy" in m3, f"Expected Samsung, got {m3}"
    print("  [PASS] TAC 86410903 ->", m3)

    # 2. Database Record Correlation Test
    print("\n[Step 2] Database Record Correlation & Transition Event Detection")
    db = SessionLocal()
    try:
        records = db.query(CDRRecord).filter(CDRRecord.case_id == 1).all()
        towers = db.query(CellTower).all()
        towers_map = {t.tower_id: f"{t.address} ({t.operator or 'Telecom'})" for t in towers if t.tower_id}

        result = analyze_hardware_tracker(records, towers_map=towers_map)
        summary = result["summary"]
        device_swaps = result["device_swaps"]
        shared_handsets = result["shared_handsets"]
        all_events = result["all_swap_events"]

        assert summary["total_device_swaps"] >= 1, "Expected at least 1 device swap"
        assert len(device_swaps) >= 1
        print(f"  [PASS] Detected {len(device_swaps)} suspects with hardware swaps")

        # Verify Suspect Alpha swap
        alpha_swap = next((ds for ds in device_swaps if "9829011111" in ds["phone_number"]), None)
        assert alpha_swap is not None, "Suspect Alpha (9829011111) not found in device swaps"
        assert alpha_swap["imei_count"] >= 2, f"Expected multiple IMEIs, got {alpha_swap['imei_count']}"
        assert len(alpha_swap["swap_events"]) >= 1, "Expected at least 1 transition event"

        first_evt = alpha_swap["swap_events"][0]
        assert "OnePlus" in first_evt["from_model"]
        assert "Apple iPhone" in first_evt["to_model"]
        assert first_evt["tower_id"] == "TOW-JPR-077"
        assert "Malviya Nagar" in first_evt["tower_location"]
        print(f"  [PASS] Malviya Nagar Hardware Switch Verified: {first_evt['from_model']} -> {first_evt['to_model']} at {first_evt['tower_location']}")

        # Verify Burner Handset Hubs
        assert len(shared_handsets) >= 1, "Expected shared burner handsets"
        print(f"  [PASS] Detected {len(shared_handsets)} physical handsets hosting multiple SIMs (burner hubs)")

        # Verify Total Transition Events
        assert len(all_events) >= 1
        print(f"  [PASS] Generated {len(all_events)} geolocated hardware transition events across case")
    finally:
        db.close()

    # 3. REST API Endpoints Verification
    print("\n[Step 3] REST API Endpoints")
    client = TestClient(app)

    res1 = client.get("/api/anomalies")
    assert res1.status_code == 200, f"/api/anomalies failed: {res1.text}"
    anomalies = res1.json()
    assert len(anomalies) >= 1
    assert "swap_events" in anomalies[0]
    print(f"  [PASS] GET /api/anomalies responds 200 OK with enriched transition events ({len(anomalies)} anomalies)")

    res2 = client.get("/api/hardware-tracker")
    assert res2.status_code == 200, f"/api/hardware-tracker failed: {res2.text}"
    ht = res2.json()
    assert "summary" in ht
    assert "device_swaps" in ht
    assert "shared_handsets" in ht
    assert "all_swap_events" in ht
    print("  [PASS] GET /api/hardware-tracker responds 200 OK with full analytics payload")

    res3 = client.get("/api/cases/1/hardware-tracker")
    assert res3.status_code == 200, f"/api/cases/1/hardware-tracker failed: {res3.text}"
    print("  [PASS] GET /api/cases/1/hardware-tracker responds 200 OK")

    print("\n" + "=" * 70)
    print("FEATURE 2 VERIFICATION COMPLETE: ALL TESTS PASSED")
    print("=" * 70)

if __name__ == "__main__":
    test_feature2_hardware_tracker()
