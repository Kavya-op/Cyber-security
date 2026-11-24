import os
import random
from datetime import datetime, timedelta
import pandas as pd

# Set fixed random seed for reproducibility
random.seed(42)

def generate_imei(prefix="35"):
    """Generate a realistic 15-digit IMEI number."""
    return prefix + "".join([str(random.randint(0, 9)) for _ in range(13)])

def generate_ip(is_source=True):
    """Generate source (private/CGNAT) or destination (public) IP."""
    if is_source:
        # Cellular CGNAT or private IP range
        return f"10.{random.randint(10, 199)}.{random.randint(1, 254)}.{random.randint(1, 254)}"
    else:
        # Public destination IP
        return f"{random.randint(11, 210)}.{random.randint(1, 254)}.{random.randint(1, 254)}.{random.randint(1, 254)}"

def random_timestamp(start_dt, end_dt, exclude_hours=None):
    """Generate a random timestamp between start_dt and end_dt, optionally excluding specific hour ranges."""
    total_seconds = int((end_dt - start_dt).total_seconds())
    while True:
        offset = random.randint(0, total_seconds)
        dt = start_dt + timedelta(seconds=offset)
        if exclude_hours and dt.hour in exclude_hours:
            continue
        return dt

def main():
    # Create data directory
    output_dir = "data"
    os.makedirs(output_dir, exist_ok=True)

    print("Generating synthetic telecommunications data...")

    # ==========================================
    # 1. towers.csv - 15 cell towers in Jaipur
    # ==========================================
    towers_data = [
        {"tower_id": "TOW-001", "latitude": 26.9100, "longitude": 75.8020, "area_name": "C-Scheme"},
        {"tower_id": "TOW-002", "latitude": 26.9180, "longitude": 75.8140, "area_name": "MI Road"},
        {"tower_id": "TOW-003", "latitude": 26.8530, "longitude": 75.8050, "area_name": "Malviya Nagar"},
        {"tower_id": "TOW-004", "latitude": 26.8920, "longitude": 75.8280, "area_name": "Raja Park"},
        {"tower_id": "TOW-005", "latitude": 26.8570, "longitude": 75.7650, "area_name": "Mansarovar"},
        {"tower_id": "TOW-006", "latitude": 26.9060, "longitude": 75.7380, "area_name": "Vaishali Nagar"},
        {"tower_id": "TOW-007", "latitude": 26.8700, "longitude": 75.7950, "area_name": "Tonk Road"},
        {"tower_id": "TOW-008", "latitude": 26.9290, "longitude": 75.7900, "area_name": "Bani Park"},
        {"tower_id": "TOW-009", "latitude": 26.8220, "longitude": 75.8450, "area_name": "Jagatpura"},
        {"tower_id": "TOW-010", "latitude": 26.8150, "longitude": 75.7720, "area_name": "Sanganer"},
        {"tower_id": "TOW-011", "latitude": 26.8950, "longitude": 75.7480, "area_name": "Ajmer Road"},
        {"tower_id": "TOW-012", "latitude": 26.7750, "longitude": 75.8400, "area_name": "Sitapura"},
        {"tower_id": "TOW-013", "latitude": 26.9600, "longitude": 75.7750, "area_name": "Vidhyadhar Nagar"},
        {"tower_id": "TOW-014", "latitude": 26.9450, "longitude": 75.7350, "area_name": "Jhotwara"},
        {"tower_id": "TOW-015", "latitude": 26.9050, "longitude": 75.7850, "area_name": "Civil Lines"}
    ]
    df_towers = pd.DataFrame(towers_data)
    towers_path = os.path.join(output_dir, "towers.csv")
    df_towers.to_csv(towers_path, index=False)
    print(f"Saved {towers_path} ({len(df_towers)} rows)")

    tower_ids = [t["tower_id"] for t in towers_data]

    # Key suspect entities & constants
    SUSPECT_1 = "9829011111"
    SUSPECT_2 = "9829022222"
    NEW_SIM_S1 = "9829033333"
    HANDLER = "9829099999"
    SHARED_IMEI = "356789012345678"
    SUSPECT_2_IMEI = "358901234567890"
    HANDLER_IMEI = "359876543210123"

    # Simulation timeline: 7 days
    START_DATE = datetime(2026, 10, 10, 0, 0, 0)
    SWITCH_DATE = datetime(2026, 10, 14, 0, 0, 0)  # On Oct 14, S1 switches to NEW_SIM_S1
    END_DATE = datetime(2026, 10, 16, 23, 59, 59)
    NIGHT_EVENT_DATE = datetime(2026, 10, 12)       # Night event between 01:00 AM and 03:00 AM

    # Generate pool of background phone numbers & IMEIs
    bg_numbers = [f"98290{i:05d}" for i in range(10000, 10040)]
    phone_imei_map = {num: generate_imei() for num in bg_numbers}
    phone_imei_map[SUSPECT_1] = SHARED_IMEI
    phone_imei_map[NEW_SIM_S1] = SHARED_IMEI
    phone_imei_map[SUSPECT_2] = SUSPECT_2_IMEI
    phone_imei_map[HANDLER] = HANDLER_IMEI

    # ==========================================
    # 2. cdr.csv - exactly 600 rows
    # ==========================================
    cdr_rows = []

    # Plant Clue 1: Suspect 1 (9829011111) frequently calls Handler (9829099999) before switch date
    for _ in range(12):
        ts = random_timestamp(START_DATE, SWITCH_DATE - timedelta(seconds=1), exclude_hours=[1, 2])
        dur = random.randint(30, 360)
        call_type = random.choices(["VOICE", "SMS"], weights=[0.85, 0.15])[0]
        if call_type == "SMS":
            dur = 0
        cdr_rows.append({
            "caller_num": SUSPECT_1,
            "receiver_num": HANDLER,
            "timestamp": ts,
            "duration_sec": dur,
            "call_type": call_type,
            "tower_id": random.choice(tower_ids),
            "imei": SHARED_IMEI
        })

    # Plant Clue 1: Suspect 2 (9829022222) frequently calls Handler (9829099999) across full timeline
    for _ in range(14):
        ts = random_timestamp(START_DATE, END_DATE)
        dur = random.randint(30, 360)
        call_type = random.choices(["VOICE", "SMS"], weights=[0.85, 0.15])[0]
        if call_type == "SMS":
            dur = 0
        cdr_rows.append({
            "caller_num": SUSPECT_2,
            "receiver_num": HANDLER,
            "timestamp": ts,
            "duration_sec": dur,
            "call_type": call_type,
            "tower_id": random.choice(tower_ids),
            "imei": SUSPECT_2_IMEI
        })

    # Plant Clue 2: Suspect 1 normal calls on primary SIM (before SWITCH_DATE, zero during 01:00-03:00)
    for _ in range(16):
        ts = random_timestamp(START_DATE, SWITCH_DATE - timedelta(seconds=1), exclude_hours=[1, 2])
        dur = random.randint(20, 280)
        call_type = random.choices(["VOICE", "SMS"], weights=[0.8, 0.2])[0]
        if call_type == "SMS":
            dur = 0
        cdr_rows.append({
            "caller_num": SUSPECT_1,
            "receiver_num": random.choice(bg_numbers),
            "timestamp": ts,
            "duration_sec": dur,
            "call_type": call_type,
            "tower_id": random.choice(tower_ids),
            "imei": SHARED_IMEI
        })

    # Plant Clue 2: On SWITCH_DATE, 9829011111 stops; new number 9829033333 starts on exact same IMEI
    for _ in range(15):
        ts = random_timestamp(SWITCH_DATE, END_DATE, exclude_hours=[1, 2])
        # Sometimes call handler, sometimes other numbers
        rec = HANDLER if random.random() < 0.35 else random.choice(bg_numbers)
        dur = random.randint(20, 300)
        call_type = random.choices(["VOICE", "SMS"], weights=[0.8, 0.2])[0]
        if call_type == "SMS":
            dur = 0
        cdr_rows.append({
            "caller_num": NEW_SIM_S1,
            "receiver_num": rec,
            "timestamp": ts,
            "duration_sec": dur,
            "call_type": call_type,
            "tower_id": random.choice(tower_ids),
            "imei": SHARED_IMEI
        })

    # Suspect 2 other regular calls
    for _ in range(15):
        ts = random_timestamp(START_DATE, END_DATE)
        dur = random.randint(20, 300)
        call_type = random.choices(["VOICE", "SMS"], weights=[0.8, 0.2])[0]
        if call_type == "SMS":
            dur = 0
        cdr_rows.append({
            "caller_num": SUSPECT_2,
            "receiver_num": random.choice(bg_numbers),
            "timestamp": ts,
            "duration_sec": dur,
            "call_type": call_type,
            "tower_id": random.choice(tower_ids),
            "imei": SUSPECT_2_IMEI
        })

    # Fill remaining rows up to 600 with background CDR traffic
    remaining_cdr = 600 - len(cdr_rows)
    for _ in range(remaining_cdr):
        caller = random.choice(bg_numbers)
        receiver = random.choice([n for n in bg_numbers if n != caller])
        ts = random_timestamp(START_DATE, END_DATE)
        dur = random.randint(15, 600)
        call_type = random.choices(["VOICE", "SMS"], weights=[0.75, 0.25])[0]
        if call_type == "SMS":
            dur = 0
        cdr_rows.append({
            "caller_num": caller,
            "receiver_num": receiver,
            "timestamp": ts,
            "duration_sec": dur,
            "call_type": call_type,
            "tower_id": random.choice(tower_ids),
            "imei": phone_imei_map[caller]
        })

    # Convert to DataFrame, sort chronologically, assign CDR-xxx record_id
    df_cdr = pd.DataFrame(cdr_rows)
    df_cdr = df_cdr.sort_values(by="timestamp").reset_index(drop=True)
    df_cdr["record_id"] = [f"CDR-{i+1:03d}" for i in range(len(df_cdr))]
    df_cdr["timestamp"] = df_cdr["timestamp"].dt.strftime("%Y-%m-%d %H:%M:%S")

    # Reorder columns as requested
    cdr_columns = ["record_id", "caller_num", "receiver_num", "timestamp", "duration_sec", "call_type", "tower_id", "imei"]
    df_cdr = df_cdr[cdr_columns]
    cdr_path = os.path.join(output_dir, "cdr.csv")
    df_cdr.to_csv(cdr_path, index=False)
    print(f"Saved {cdr_path} ({len(df_cdr)} rows)")

    # ==========================================
    # 3. ipdr.csv - exactly 400 rows
    # ==========================================
    ipdr_rows = []

    # Plant Clue 3: Between 01:00 AM and 03:00 AM on NIGHT_EVENT_DATE (2026-10-12),
    # 9829011111 has massive Telegram data spikes (>50MB) moving across 4 specific towers.
    four_towers = ["TOW-001", "TOW-004", "TOW-007", "TOW-010"]  # C-Scheme -> Raja Park -> Tonk Road -> Sanganer
    spike_times = [
        datetime(2026, 10, 12, 1, 14, 20),
        datetime(2026, 10, 12, 1, 45, 10),
        datetime(2026, 10, 12, 2, 18, 35),
        datetime(2026, 10, 12, 2, 51, 15),
    ]
    spike_volumes = [68.45, 94.20, 128.75, 82.50]  # All > 50 MB

    telegram_dest_ips = ["149.154.167.99", "149.154.167.120", "149.154.175.50", "91.108.56.165"]

    for i in range(4):
        ipdr_rows.append({
            "phone_num": SUSPECT_1,
            "source_ip": generate_ip(is_source=True),
            "dest_ip": telegram_dest_ips[i],
            "app_protocol": "Telegram",
            "start_time": spike_times[i],
            "data_vol_mb": spike_volumes[i],
            "tower_id": four_towers[i]
        })

    # Additional regular IPDR sessions for Suspect 1 (before SWITCH_DATE, normal volumes < 25MB, none 01:00-03:00)
    for _ in range(20):
        ts = random_timestamp(START_DATE, SWITCH_DATE - timedelta(seconds=1), exclude_hours=[1, 2])
        ipdr_rows.append({
            "phone_num": SUSPECT_1,
            "source_ip": generate_ip(is_source=True),
            "dest_ip": generate_ip(is_source=False),
            "app_protocol": random.choice(["WhatsApp", "HTTPS"]),
            "start_time": ts,
            "data_vol_mb": round(random.uniform(0.5, 22.0), 2),
            "tower_id": random.choice(tower_ids)
        })

    # Regular IPDR sessions for NEW_SIM_S1 (from SWITCH_DATE onwards, normal volumes)
    for _ in range(16):
        ts = random_timestamp(SWITCH_DATE, END_DATE)
        ipdr_rows.append({
            "phone_num": NEW_SIM_S1,
            "source_ip": generate_ip(is_source=True),
            "dest_ip": generate_ip(is_source=False),
            "app_protocol": random.choice(["WhatsApp", "Telegram", "HTTPS"]),
            "start_time": ts,
            "data_vol_mb": round(random.uniform(0.5, 25.0), 2),
            "tower_id": random.choice(tower_ids)
        })

    # Regular IPDR sessions for Suspect 2
    for _ in range(25):
        ts = random_timestamp(START_DATE, END_DATE)
        ipdr_rows.append({
            "phone_num": SUSPECT_2,
            "source_ip": generate_ip(is_source=True),
            "dest_ip": generate_ip(is_source=False),
            "app_protocol": random.choice(["WhatsApp", "Telegram", "HTTPS"]),
            "start_time": ts,
            "data_vol_mb": round(random.uniform(0.5, 28.0), 2),
            "tower_id": random.choice(tower_ids)
        })

    # Fill remaining rows up to 400 with background IPDR traffic (normal volumes < 35MB)
    remaining_ipdr = 400 - len(ipdr_rows)
    for _ in range(remaining_ipdr):
        phone = random.choice(bg_numbers)
        ts = random_timestamp(START_DATE, END_DATE)
        proto = random.choice(["WhatsApp", "Telegram", "HTTPS"])
        ipdr_rows.append({
            "phone_num": phone,
            "source_ip": generate_ip(is_source=True),
            "dest_ip": generate_ip(is_source=False),
            "app_protocol": proto,
            "start_time": ts,
            "data_vol_mb": round(random.uniform(0.1, 32.0), 2),
            "tower_id": random.choice(tower_ids)
        })

    # Convert to DataFrame, sort chronologically, assign IPDR-xxx session_id
    df_ipdr = pd.DataFrame(ipdr_rows)
    df_ipdr = df_ipdr.sort_values(by="start_time").reset_index(drop=True)
    df_ipdr["session_id"] = [f"IPDR-{i+1:03d}" for i in range(len(df_ipdr))]
    df_ipdr["start_time"] = df_ipdr["start_time"].dt.strftime("%Y-%m-%d %H:%M:%S")

    # Reorder columns as requested
    ipdr_columns = ["session_id", "phone_num", "source_ip", "dest_ip", "app_protocol", "start_time", "data_vol_mb", "tower_id"]
    df_ipdr = df_ipdr[ipdr_columns]
    ipdr_path = os.path.join(output_dir, "ipdr.csv")
    df_ipdr.to_csv(ipdr_path, index=False)
    print(f"Saved {ipdr_path} ({len(df_ipdr)} rows)")

    # ==========================================
    # Verification & Clue Validation Summary
    # ==========================================
    print("\n--- DATA VALIDATION ---")
    print(f"Towers count: {len(df_towers)} (Expected: 15)")
    print(f"CDR count: {len(df_cdr)} (Expected: 600)")
    print(f"IPDR count: {len(df_ipdr)} (Expected: 400)")

    print("\n--- CLUE 1 VALIDATION ---")
    s1_to_h = len(df_cdr[(df_cdr['caller_num'] == SUSPECT_1) & (df_cdr['receiver_num'] == HANDLER)])
    s2_to_h = len(df_cdr[(df_cdr['caller_num'] == SUSPECT_2) & (df_cdr['receiver_num'] == HANDLER)])
    print(f"Calls from 9829011111 to handler (9829099999): {s1_to_h}")
    print(f"Calls from 9829022222 to handler (9829099999): {s2_to_h}")

    print("\n--- CLUE 2 VALIDATION ---")
    s1_cdr = df_cdr[df_cdr['caller_num'] == SUSPECT_1]
    new_s1_cdr = df_cdr[df_cdr['caller_num'] == NEW_SIM_S1]
    print(f"9829011111 active range: {s1_cdr['timestamp'].min()} to {s1_cdr['timestamp'].max()}")
    print(f"9829011111 IMEI used: {s1_cdr['imei'].unique()}")
    print(f"9829033333 active range: {new_s1_cdr['timestamp'].min()} to {new_s1_cdr['timestamp'].max()}")
    print(f"9829033333 IMEI used: {new_s1_cdr['imei'].unique()}")
    print(f"Identical IMEI check: {set(s1_cdr['imei']) == set(new_s1_cdr['imei']) == {SHARED_IMEI}}")

    print("\n--- CLUE 3 VALIDATION ---")
    df_cdr['dt'] = pd.to_datetime(df_cdr['timestamp'])
    s1_night_voice = df_cdr[
        (df_cdr['caller_num'] == SUSPECT_1) & 
        (df_cdr['dt'].dt.hour.isin([1, 2])) & 
        (df_cdr['call_type'] == 'VOICE')
    ]
    print(f"9829011111 voice calls in CDR between 01:00 AM and 03:00 AM: {len(s1_night_voice)}")

    df_ipdr['dt'] = pd.to_datetime(df_ipdr['start_time'])
    s1_spikes = df_ipdr[
        (df_ipdr['phone_num'] == SUSPECT_1) & 
        (df_ipdr['dt'].dt.hour.isin([1, 2])) & 
        (df_ipdr['app_protocol'] == 'Telegram') & 
        (df_ipdr['data_vol_mb'] > 50)
    ]
    print(f"9829011111 Telegram spikes (>50MB) between 01:00 AM and 03:00 AM: {len(s1_spikes)}")
    print(f"Towers traversed during spikes: {list(s1_spikes['tower_id'])}")
    print(f"Data volumes (MB): {list(s1_spikes['data_vol_mb'])}")

if __name__ == "__main__":
    main()
