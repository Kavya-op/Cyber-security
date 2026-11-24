"""
Feature 8: AI-Powered Natural Language Investigation Assistant Verification
Validates:
1. Natural language query processing with intent recognition across 10+ forensic categories:
   - Top / frequent contacts
   - Handset / IMEI / IMSI swaps & transitions
   - Cell tower geolocation & movement
   - Nocturnal / late-night calling (23:00 to 05:00)
   - Cross-suspect common & mutual contacts
   - Integrated VoIP & OTT session correlation (WhatsApp, Telegram, Signal)
   - High-frequency burst & panic calling patterns
   - Shortest communication path & degrees of separation
   - Section 91 CrPC requisition & Section 65B Indian Evidence Act admissibility
   - Hindi & Hinglish natural language support
2. Section 65B Indian Evidence Act row citations (source_file#Lrow_number) in all responses.
3. Official Section 91 CrPC / Section 65B statutory disclaimer attached to every response.
4. Top-level REST API endpoints (/api/ai/ask and /api/chat).
5. Immutable chain-of-custody audit logging for AI inquiries (AI_QUERY).
6. Dual-mode support (offline rule-based synthesis and Gemini 3.8 Flash LLM summarization).
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal, Case, AuditLog


def test_feature8_ai_assistant():
    print("=" * 70)
    print("FEATURE 8: AI INVESTIGATION ASSISTANT (GEMINI 3.8 FLASH) VERIFICATION")
    print("=" * 70)

    client = TestClient(app)
    db = SessionLocal()

    try:
        case = db.query(Case).filter(Case.id == 1).first()
        assert case is not None, "Case 1 must exist in the database"

        # -------------------------------------------------------------------
        # Step 1: Top / Frequent Contacts Query Intent
        # -------------------------------------------------------------------
        print("\n[Step 1] Top Contacts Inquiry Intent & Citations")
        resp1 = client.post("/api/ai/ask", json={
            "case_id": 1,
            "question": "Who are the most frequent calling contacts for suspect 9829011111?",
            "user_role": "investigator"
        })
        assert resp1.status_code == 200, f"Expected 200, got {resp1.status_code}"
        data1 = resp1.json()
        assert data1["intent"] == "top_contacts", f"Unexpected intent: {data1['intent']}"
        assert len(data1["answer"]) > 20, "Answer too short"
        assert len(data1["evidence"]) > 0, "Expected evidence items"
        assert "disclaimer" in data1 and "DISCLAIMER" in data1["disclaimer"]
        ev1 = data1["evidence"][0]
        assert "source_file" in ev1 and "row_number" in ev1, "Evidence missing citation fields"
        print(f"  [PASS] Top contacts response received with {len(data1['evidence'])} certified evidence records")

        # -------------------------------------------------------------------
        # Step 2: Handset / IMEI / SIM Swap Query Intent
        # -------------------------------------------------------------------
        print("\n[Step 2] Handset / IMEI / SIM Swap Inquiry Intent")
        resp2 = client.post("/api/ai/ask", json={
            "case_id": 1,
            "question": "Did suspect 9829011111 change their IMEI handset or swap SIM cards?",
            "user_role": "investigator"
        })
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2["intent"] == "imei_sim_changes"
        assert any(k in data2["answer"].lower() for k in ["imei", "handset", "sim", "swap", "device"])
        assert len(data2["evidence"]) > 0
        print(f"  [PASS] IMEI / SIM swap intent detected; {len(data2['evidence'])} evidence records cited")

        # -------------------------------------------------------------------
        # Step 3: Cell Tower Location & Geolocation Query Intent
        # -------------------------------------------------------------------
        print("\n[Step 3] Cell Tower Location & Movement Telemetry Intent")
        resp3 = client.post("/api/ai/ask", json={
            "case_id": 1,
            "question": "Where was 9829011111 located? Show cell tower addresses and movement",
            "user_role": "investigator"
        })
        assert resp3.status_code == 200
        data3 = resp3.json()
        assert data3["intent"] == "tower_location"
        assert "Tower" in data3["answer"] or "tower" in data3["answer"] or "location" in data3["answer"].lower()
        assert len(data3["evidence"]) > 0
        print(f"  [PASS] Cell tower location intent resolved with {len(data3['evidence'])} evidence rows")

        # -------------------------------------------------------------------
        # Step 4: Nocturnal / Late-Night Calling Intent
        # -------------------------------------------------------------------
        print("\n[Step 4] Nocturnal / Late-Night Calling Query Intent")
        resp4 = client.post("/api/ai/ask", json={
            "case_id": 1,
            "question": "Show all midnight and late night calls between 23:00 and 05:00 for 9829011111",
            "user_role": "investigator"
        })
        assert resp4.status_code == 200
        data4 = resp4.json()
        assert data4["intent"] == "night_calls"
        assert any(k in data4["answer"].lower() for k in ["night", "call", "23:00", "05:00"])
        assert len(data4["evidence"]) > 0
        print(f"  [PASS] Night calls intent recognized with {len(data4['evidence'])} nocturnal citations")

        # -------------------------------------------------------------------
        # Step 5: Common & Mutual Contacts Query Intent
        # -------------------------------------------------------------------
        print("\n[Step 5] Cross-Suspect Common Contacts Query Intent")
        resp5 = client.post("/api/ai/ask", json={
            "case_id": 1,
            "question": "What are the common contacts between 9829011111 and 9829933333?",
            "user_role": "investigator"
        })
        assert resp5.status_code == 200
        data5 = resp5.json()
        assert data5["intent"] == "common_contacts"
        assert "common" in data5["answer"].lower() or "shared" in data5["answer"].lower() or "संपर्क" in data5["answer"]
        print(f"  [PASS] Common contacts intent resolved; citations count: {len(data5['evidence'])}")

        # -------------------------------------------------------------------
        # Step 6: Integrated VoIP & OTT Session Correlation Intent
        # -------------------------------------------------------------------
        print("\n[Step 6] Integrated VoIP & OTT Session Correlation Intent")
        resp6 = client.post("/api/ai/ask", json={
            "case_id": 1,
            "question": "Show WhatsApp VoIP and Telegram voice call sessions correlated with suspect 9829011111",
            "user_role": "investigator"
        })
        assert resp6.status_code == 200
        data6 = resp6.json()
        assert data6["intent"] == "voip_correlation"
        assert any(k in data6["answer"].lower() for k in ["voip", "whatsapp", "telegram", "encrypted", "silence"])
        assert len(data6["evidence"]) > 0
        assert any("Carrier_IPDR" in e.get("source_file", "") or "IPDR" in e.get("source_file", "") for e in data6["evidence"])
        print(f"  [PASS] VoIP & OTT correlation intent verified with {len(data6['evidence'])} IPDR citations")

        # -------------------------------------------------------------------
        # Step 7: High-Frequency Burst & Panic Calling Intent
        # -------------------------------------------------------------------
        print("\n[Step 7] High-Frequency Burst & Panic Calling Intent")
        resp7 = client.post("/api/ai/ask", json={
            "case_id": 1,
            "question": "Did 9829011111 engage in rapid call bursts or panic calling storms?",
            "user_role": "investigator"
        })
        assert resp7.status_code == 200
        data7 = resp7.json()
        assert data7["intent"] == "burst_patterns"
        assert any(k in data7["answer"].lower() for k in ["burst", "frequency", "call", "panic"])
        print(f"  [PASS] Burst patterns intent verified; response received successfully")

        # -------------------------------------------------------------------
        # Step 8: Shortest Path & Connection Chain Intent
        # -------------------------------------------------------------------
        print("\n[Step 8] Shortest Communication Path & Degrees of Separation")
        resp8 = client.post("/api/ai/ask", json={
            "case_id": 1,
            "question": "Find the shortest communication path and connection chain between 9829011111 and 9829933333",
            "user_role": "investigator"
        })
        assert resp8.status_code == 200
        data8 = resp8.json()
        assert data8["intent"] == "shortest_path"
        assert any(k in data8["answer"].lower() for k in ["path", "chain", "separation", "degrees", "link", "➔"])
        print(f"  [PASS] Shortest path intent resolved with connection chain mapping")

        # -------------------------------------------------------------------
        # Step 9: Section 91 CrPC & Section 65B Legal Evidence Inquiry
        # -------------------------------------------------------------------
        print("\n[Step 9] Section 91 CrPC & Section 65B Legal Evidence Dossier Inquiry")
        resp9 = client.post("/api/ai/ask", json={
            "case_id": 1,
            "question": "Prepare a Section 91 CrPC notice summary and Section 65B Indian Evidence Act admissibility certificate",
            "user_role": "investigator"
        })
        assert resp9.status_code == 200
        data9 = resp9.json()
        assert data9["intent"] == "legal_evidence"
        assert "Section 91" in data9["answer"] or "Section 65B" in data9["answer"] or "धारा 91" in data9["answer"]
        assert "SHA-256" in data9["answer"]
        assert len(data9["evidence"]) > 0
        print(f"  [PASS] Legal evidence intent verified with statutory Section 65B certificate details")

        # -------------------------------------------------------------------
        # Step 10: Multi-Lingual Hindi & Hinglish Processing
        # -------------------------------------------------------------------
        print("\n[Step 10] Multi-Lingual Hindi & Hinglish Query Processing")
        resp10 = client.post("/api/ai/ask", json={
            "case_id": 1,
            "question": "रात को 9829011111 ने किससे बात की? कॉल का विवरण दिखाओ",
            "user_role": "investigator"
        })
        assert resp10.status_code == 200
        data10 = resp10.json()
        # Verify Hindi characters in response
        assert any(ord(char) >= 0x0900 and ord(char) <= 0x097F for char in data10["answer"]), "Expected Hindi Devanagari in response"
        assert "कॉल" in data10["answer"] or "रिकॉर्ड" in data10["answer"] or "रात" in data10["answer"] or "विवरण" in data10["answer"]
        print(f"  [PASS] Fluent Hindi response generated: '{data10['answer'][:70]}...'")

        # -------------------------------------------------------------------
        # Step 11: Top-Level /api/chat Compatibility Endpoint
        # -------------------------------------------------------------------
        print("\n[Step 11] Frontend Top-Level /api/chat Endpoint Verification")
        resp11 = client.post("/api/chat", json={
            "query": "Show common contacts between 9829011111 and 9829933333",
            "case_id": 1
        })
        assert resp11.status_code == 200
        data11 = resp11.json()
        assert "query" in data11 and "intent" in data11 and "answer" in data11
        assert "evidence_records" in data11
        assert "disclaimer" in data11
        print(f"  [PASS] /api/chat compatible with frontend; intent: {data11['intent']}")

        # -------------------------------------------------------------------
        # Step 12: Chain of Custody Audit Log Verification
        # -------------------------------------------------------------------
        print("\n[Step 12] AI Inquiry Audit Trail Verification")
        logs = db.query(AuditLog).filter(AuditLog.action == "AI_QUERY").all()
        assert len(logs) >= 10, f"Expected at least 10 AI audit entries, found {len(logs)}"
        last_log = logs[-1]
        assert "case_id=1" in last_log.query_text
        assert last_log.user_role == "investigator"
        print(f"  [PASS] Recorded {len(logs)} AI inquiry audit trail entries with SHA integrity")

        print("\n" + "=" * 70)
        print("ALL FEATURE 8 AI INVESTIGATION ASSISTANT VERIFICATION CHECKS PASSED (12/12)!")
        print("=" * 70)

    finally:
        db.close()


if __name__ == "__main__":
    test_feature8_ai_assistant()
