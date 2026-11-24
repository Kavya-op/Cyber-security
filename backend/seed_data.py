"""
Database seeder for Rajasthan Police CDR & IPDR Intelligence Platform.
Merges datasets from 'data base cyber' and 'frontend ui ux' into backend SQLite database.
"""
import os
import sys
import pandas as pd
from datetime import datetime
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
sys.path.insert(0, str(BASE_DIR))

from database import (
    Base,
    Case,
    CellTower,
    CDRRecord,
    IPDRRecord,
    AuditLog,
    engine,
    SessionLocal,
    init_db,
)

def seed_database():
    print("Initializing database tables...")
    init_db()
    db = SessionLocal()

    try:
        # 1. Cases
        existing_cases = {c.id: c for c in db.query(Case).all()}
        case1_id = 1
        if 1 not in existing_cases:
            case1 = Case(
                id=1,
                case_name="FIR #402/2024 - Operation Cyber Shield (Jaipur Cyber Cell)",
                created_at=datetime(2024, 11, 18, 9, 0, 0),
            )
            db.add(case1)
            db.commit()
            case1_id = case1.id
            print(f"Created default Case 1: {case1.case_name}")
        else:
            case1_id = 1
            print(f"Using existing Case 1: {existing_cases[1].case_name}")

        # 2. Cell Towers
        # Jaipur hackathon core towers
        core_towers = [
            ("TOW-JPR-014", 26.9215, 75.7985, "Sindhi Camp Central, Jaipur", "Airtel Telematics"),
            ("TOW-JPR-029", 26.9160, 75.8090, "MI Road Commercial, Jaipur", "Jio 4G LTE"),
            ("TOW-JPR-088", 26.8980, 75.8320, "Raja Park Node, Jaipur", "Vodafone Idea"),
            ("TOW-JPR-077", 26.8520, 75.8180, "Malviya Nagar Industrial, Jaipur", "Airtel Telematics"),
            ("TOW-JPR-112", 26.8640, 75.7620, "Mansarovar Metro Sector, Jaipur", "BSNL Telecom"),
            ("TOW-AJM-102", 26.4690, 74.6390, "Civil Lines Highway, Ajmer", "Jio 4G LTE"),
        ]

        for tid, lat, lng, addr, op in core_towers:
            tower = db.query(CellTower).filter(CellTower.tower_id == tid).first()
            if not tower:
                db.add(CellTower(tower_id=tid, latitude=lat, longitude=lng, address=addr, operator=op))

        # Add towers from data/towers.csv
        towers_csv = ROOT_DIR / "data" / "towers.csv"
        if towers_csv.exists():
            df_towers = pd.read_csv(towers_csv)
            for _, row in df_towers.iterrows():
                tid = str(row["tower_id"]).strip()
                tower = db.query(CellTower).filter(CellTower.tower_id == tid).first()
                if not tower:
                    db.add(CellTower(
                        tower_id=tid,
                        latitude=float(row["latitude"]),
                        longitude=float(row["longitude"]),
                        address=f"{row['area_name']}, Jaipur",
                        operator="Rajasthan Telecom Circle"
                    ))
        db.commit()
        print(f"Total Cell Towers seeded: {db.query(CellTower).count()}")

        # 3. Critical Hackathon CDR Records (with verified IMEI swap & citations)
        critical_cdrs = [
            {
                "case_id": case1_id,
                "source_file": "OperatorA_Airtel_CDR.csv",
                "row_number": 1,
                "caller_num": "9829011111",
                "receiver_num": "9414022222",
                "call_type": "OUT",
                "start_time": datetime(2024, 11, 18, 2, 14, 32),
                "duration_sec": 482,
                "imei": "860432049102481",
                "imsi": "404101234567890",
                "tower_id": "TOW-JPR-014",
            },
            {
                "case_id": case1_id,
                "source_file": "OperatorA_Airtel_CDR.csv",
                "row_number": 2,
                "caller_num": "9829011111",
                "receiver_num": "9829933333",
                "call_type": "OUT",
                "start_time": datetime(2024, 11, 18, 3, 45, 10),
                "duration_sec": 195,
                "imei": "860432049102481",
                "imsi": "404101234567890",
                "tower_id": "TOW-JPR-029",
            },
            {
                "case_id": case1_id,
                "source_file": "OperatorA_Airtel_CDR.csv",
                "row_number": 3,
                "caller_num": "9829011111",
                "receiver_num": "9784144444",
                "call_type": "IN",
                "start_time": datetime(2024, 11, 18, 8, 30, 15),
                "duration_sec": 724,
                "imei": "358924081290455",  # Device swap!
                "imsi": "404101234567890",
                "tower_id": "TOW-JPR-077",
            },
            {
                "case_id": case1_id,
                "source_file": "OperatorB_Jio_CDR.csv",
                "row_number": 1,
                "caller_num": "9414022222",
                "receiver_num": "9829933333",
                "call_type": "OUT",
                "start_time": datetime(2024, 11, 18, 11, 15, 40),
                "duration_sec": 64,
                "imei": "864109038291047",
                "imsi": "404109876543210",
                "tower_id": "TOW-AJM-102",
            },
            {
                "case_id": case1_id,
                "source_file": "OperatorA_Airtel_CDR.csv",
                "row_number": 4,
                "caller_num": "9829011111",
                "receiver_num": "9602455555",
                "call_type": "OUT",
                "start_time": datetime(2024, 11, 18, 14, 52, 8),
                "duration_sec": 310,
                "imei": "358924081290455",
                "imsi": "404101234567890",
                "tower_id": "TOW-JPR-112",
            },
            {
                "case_id": case1_id,
                "source_file": "OperatorB_Jio_CDR.csv",
                "row_number": 2,
                "caller_num": "9414022222",
                "receiver_num": "9829011111",
                "call_type": "OUT",
                "start_time": datetime(2024, 11, 18, 16, 22, 5),
                "duration_sec": 240,
                "imei": "864109038291047",
                "imsi": "404109876543210",
                "tower_id": "TOW-AJM-102",
            },
            {
                "case_id": case1_id,
                "source_file": "OperatorA_Airtel_CDR.csv",
                "row_number": 5,
                "caller_num": "9829011111",
                "receiver_num": "9829933333",
                "call_type": "OUT",
                "start_time": datetime(2024, 11, 18, 19, 10, 45),
                "duration_sec": 115,
                "imei": "358924081290455",
                "imsi": "404101234567890",
                "tower_id": "TOW-JPR-014",
            },
            {
                "case_id": case1_id,
                "source_file": "OperatorB_Jio_CDR.csv",
                "row_number": 3,
                "caller_num": "9829933333",
                "receiver_num": "9784144444",
                "call_type": "OUT",
                "start_time": datetime(2024, 11, 18, 20, 5, 12),
                "duration_sec": 180,
                "imei": "860432049102481",
                "imsi": "404109876543210",
                "tower_id": "TOW-JPR-029",
            },
            {
                "case_id": case1_id,
                "source_file": "OperatorB_Jio_CDR.csv",
                "row_number": 4,
                "caller_num": "9829933333",
                "receiver_num": "9602455555",
                "call_type": "OUT",
                "start_time": datetime(2024, 11, 18, 22, 40, 19),
                "duration_sec": 92,
                "imei": "860432049102481",
                "imsi": "404109876543210",
                "tower_id": "TOW-JPR-088",
            },
            {
                "case_id": case1_id,
                "source_file": "OperatorB_Jio_CDR.csv",
                "row_number": 5,
                "caller_num": "9602455555",
                "receiver_num": "9829011111",
                "call_type": "OUT",
                "start_time": datetime(2024, 11, 18, 23, 14, 2),
                "duration_sec": 45,
                "imei": "358924081290455",
                "imsi": "404109876543210",
                "tower_id": "TOW-JPR-112",
            },
        ]

        # Check if critical CDRs are already in db
        existing_cdr_count = db.query(CDRRecord).filter(CDRRecord.case_id == case1_id).count()
        if existing_cdr_count < 10:
            for item in critical_cdrs:
                db.add(CDRRecord(**item))
            db.commit()

        # Ingest 600 records from data/cdr.csv
        cdr_csv = ROOT_DIR / "data" / "cdr.csv"
        if cdr_csv.exists() and db.query(CDRRecord).filter(CDRRecord.source_file == "telecom_cdr.csv").count() == 0:
            df_cdr = pd.read_csv(cdr_csv)
            for idx, row in df_cdr.iterrows():
                try:
                    ts = pd.to_datetime(row["timestamp"])
                except Exception:
                    ts = None
                db.add(CDRRecord(
                    case_id=case1_id,
                    source_file="telecom_cdr.csv",
                    row_number=int(idx + 1),
                    caller_num=str(row["caller_num"]).strip(),
                    receiver_num=str(row["receiver_num"]).strip(),
                    call_type=str(row.get("call_type", "VOICE")).upper(),
                    start_time=ts,
                    duration_sec=int(row.get("duration_sec", 0)),
                    imei=str(row.get("imei", "")).strip(),
                    imsi=None,
                    tower_id=str(row.get("tower_id", "")).strip() or None,
                ))
            db.commit()
        print(f"Total CDR Records in database: {db.query(CDRRecord).count()}")

        # 4. Critical Hackathon IPDR Records
        critical_ipdrs = [
            {
                "case_id": case1_id,
                "source_file": "Carrier_IPDR_SessionLogs.csv",
                "row_number": 1,
                "subscriber_num": "9829011111",
                "public_ip": "103.21.244.18",
                "source_port": 443,
                "dest_ip": "149.154.167.51",
                "start_time": datetime(2024, 11, 18, 2, 18, 0),
                "end_time": datetime(2024, 11, 18, 2, 25, 0),
                "service_hint": "Telegram Voice / Encrypted",
            },
            {
                "case_id": case1_id,
                "source_file": "Carrier_IPDR_SessionLogs.csv",
                "row_number": 2,
                "subscriber_num": "9829011111",
                "public_ip": "157.240.198.60",
                "source_port": 443,
                "dest_ip": "31.13.79.52",
                "start_time": datetime(2024, 11, 18, 3, 50, 22),
                "end_time": datetime(2024, 11, 18, 3, 58, 0),
                "service_hint": "WhatsApp VoIP Call",
            },
            {
                "case_id": case1_id,
                "source_file": "Carrier_IPDR_SessionLogs.csv",
                "row_number": 3,
                "subscriber_num": "9414022222",
                "public_ip": "185.199.108.153",
                "source_port": 80,
                "dest_ip": "104.244.42.1",
                "start_time": datetime(2024, 11, 18, 11, 20, 10),
                "end_time": datetime(2024, 11, 18, 11, 40, 0),
                "service_hint": "Tor Relay / Proxy Entry",
            },
            {
                "case_id": case1_id,
                "source_file": "Carrier_IPDR_SessionLogs.csv",
                "row_number": 4,
                "subscriber_num": "9784144444",
                "public_ip": "142.250.190.46",
                "source_port": 443,
                "dest_ip": "185.70.41.1",
                "start_time": datetime(2024, 11, 18, 17, 5, 30),
                "end_time": datetime(2024, 11, 18, 17, 20, 0),
                "service_hint": "ProtonMail / Signal Node",
            },
            {
                "case_id": case1_id,
                "source_file": "Carrier_IPDR_SessionLogs.csv",
                "row_number": 5,
                "subscriber_num": "9829933333",
                "public_ip": "198.51.100.42",
                "source_port": 443,
                "dest_ip": "192.0.2.1",
                "start_time": datetime(2024, 11, 18, 20, 10, 0),
                "end_time": datetime(2024, 11, 18, 20, 30, 0),
                "service_hint": "DarkWeb Mirror Node",
            },
        ]

        if db.query(IPDRRecord).filter(IPDRRecord.case_id == case1_id).count() < 5:
            for item in critical_ipdrs:
                db.add(IPDRRecord(**item))
            db.commit()

        # Ingest 400 records from data/ipdr.csv
        ipdr_csv = ROOT_DIR / "data" / "ipdr.csv"
        if ipdr_csv.exists() and db.query(IPDRRecord).filter(IPDRRecord.source_file == "telecom_ipdr.csv").count() == 0:
            df_ipdr = pd.read_csv(ipdr_csv)
            for idx, row in df_ipdr.iterrows():
                try:
                    ts = pd.to_datetime(row["start_time"])
                except Exception:
                    ts = None
                db.add(IPDRRecord(
                    case_id=case1_id,
                    source_file="telecom_ipdr.csv",
                    row_number=int(idx + 1),
                    subscriber_num=str(row["phone_num"]).strip(),
                    public_ip=str(row.get("source_ip", "")).strip(),
                    source_port=443,
                    dest_ip=str(row.get("dest_ip", "")).strip(),
                    start_time=ts,
                    end_time=None,
                    service_hint=str(row.get("app_protocol", "HTTPS")),
                ))
            db.commit()
        print(f"Total IPDR Records in database: {db.query(IPDRRecord).count()}")

        # 5. Audit Logs
        if db.query(AuditLog).count() == 0:
            initial_logs = [
                AuditLog(
                    user_role="Senior Investigator",
                    action="FINDING_VERIFIED",
                    query_text="Human-in-the-Loop Sign-off: Device Swap & SIM Swap at Malviya Nagar Industrial Area certified under Sec. 65B (OperatorA_Airtel_CDR.csv#L3)",
                    timestamp=datetime(2024, 11, 22, 0, 12, 30),
                ),
                AuditLog(
                    user_role="Senior Investigator",
                    action="REPORT_EXPORT",
                    query_text="Exported Section 91 CrPC Official Dossier (FIR #402/2024) - SHA256 verified",
                    timestamp=datetime(2024, 11, 22, 0, 4, 12),
                ),
                AuditLog(
                    user_role="Cyber Analyst",
                    action="DRAFT_SUBMITTED",
                    query_text="Cleaned multi-carrier CDR/IPDR normalization dataset & technical anomaly draft submitted",
                    timestamp=datetime(2024, 11, 21, 23, 58, 30),
                ),
                AuditLog(
                    user_role="Senior Investigator",
                    action="AI_QUERY",
                    query_text='AI Forensics Query: "Cite exact source file and row for IMEI change" -> OperatorA_Airtel_CDR.csv#L3',
                    timestamp=datetime(2024, 11, 21, 23, 42, 1),
                ),
            ]
            db.add_all(initial_logs)
            db.commit()
            print(f"Total Audit Logs seeded: {db.query(AuditLog).count()}")

        print("\nDatabase seeding completed successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
