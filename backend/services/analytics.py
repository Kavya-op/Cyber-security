import os
import json
import sqlite3
import pandas as pd
import networkx as nx
from typing import Dict, List, Any, Optional

try:
    from database import get_connection, DEFAULT_DB_PATH, query_df
except ImportError:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DEFAULT_DB_PATH = os.path.join(BASE_DIR, "obsydia.db")

    def get_connection(db_path: str = DEFAULT_DB_PATH) -> sqlite3.Connection:
        conn = sqlite3.connect(db_path)
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def query_df(sql: str, params: tuple = (), db_path: str = DEFAULT_DB_PATH) -> pd.DataFrame:
        with get_connection(db_path) as conn:
            return pd.read_sql_query(sql, conn, params=params)


def get_overview_stats(db_path: str = DEFAULT_DB_PATH) -> Dict[str, Any]:
    """
    CDR & IPDR Summary:
    Uses Pandas .groupby() to return:
    1. Hourly call and data volume (00:00 to 23:00 formatted for Recharts).
    2. Top 10 active phone numbers by total interaction volume.
    """
    cdr_df = query_df("SELECT record_id, caller_num, receiver_num, timestamp, duration_sec, call_type FROM cdr", db_path=db_path)
    ipdr_df = query_df("SELECT session_id, phone_num, start_time, data_vol_mb, app_protocol FROM ipdr", db_path=db_path)

    # 1. Hourly Call & Data Volume (00 to 23)
    cdr_df["dt"] = pd.to_datetime(cdr_df["timestamp"])
    cdr_df["hour"] = cdr_df["dt"].dt.hour

    ipdr_df["dt"] = pd.to_datetime(ipdr_df["start_time"])
    ipdr_df["hour"] = ipdr_df["dt"].dt.hour

    cdr_hourly = cdr_df.groupby("hour").agg(
        call_count=("record_id", "count"),
        voice_calls=("call_type", lambda s: (s == "VOICE").sum()),
        sms_count=("call_type", lambda s: (s == "SMS").sum()),
        total_duration_sec=("duration_sec", "sum")
    ).reset_index()

    ipdr_hourly = ipdr_df.groupby("hour").agg(
        session_count=("session_id", "count"),
        data_vol_mb=("data_vol_mb", lambda s: round(s.sum(), 2))
    ).reset_index()

    # Combine all 24 hours (0-23) for seamless Recharts consumption
    hours_df = pd.DataFrame({"hour": list(range(24))})
    merged_hourly = hours_df.merge(cdr_hourly, on="hour", how="left").merge(ipdr_hourly, on="hour", how="left").fillna(0)
    merged_hourly["hour_label"] = merged_hourly["hour"].apply(lambda h: f"{h:02d}:00")

    hourly_chart_data = []
    for _, row in merged_hourly.iterrows():
        hourly_chart_data.append({
            "hour": row["hour_label"],
            "hour_num": int(row["hour"]),
            "call_count": int(row["call_count"]),
            "voice_calls": int(row["voice_calls"]),
            "sms_count": int(row["sms_count"]),
            "total_duration_sec": int(row["total_duration_sec"]),
            "session_count": int(row["session_count"]),
            "data_vol_mb": round(float(row["data_vol_mb"]), 2)
        })

    # 2. Top 10 Active Numbers
    # Count outgoing and incoming interactions
    outgoing = cdr_df.groupby("caller_num").agg(
        outgoing_calls=("record_id", "count"),
        outgoing_duration=("duration_sec", "sum")
    )
    incoming = cdr_df.groupby("receiver_num").agg(
        incoming_calls=("record_id", "count"),
        incoming_duration=("duration_sec", "sum")
    )
    
    activity = outgoing.join(incoming, how="outer").fillna(0)
    activity.index.name = "phone_num"
    activity["total_calls"] = (activity["outgoing_calls"] + activity["incoming_calls"]).astype(int)
    activity["total_duration_sec"] = (activity["outgoing_duration"] + activity["incoming_duration"]).astype(int)
    activity = activity.sort_values(by="total_calls", ascending=False).head(10).reset_index()

    # Also capture IPDR data volume if available
    ipdr_vol = ipdr_df.groupby("phone_num")["data_vol_mb"].sum().to_dict()

    top_10_active = []
    for _, row in activity.iterrows():
        p_num = str(row["phone_num"])
        top_10_active.append({
            "phone_num": p_num,
            "total_calls": int(row["total_calls"]),
            "outgoing_calls": int(row["outgoing_calls"]),
            "incoming_calls": int(row["incoming_calls"]),
            "total_duration_sec": int(row["total_duration_sec"]),
            "data_vol_mb": round(float(ipdr_vol.get(p_num, 0.0)), 2)
        })

    return {
        "hourly_volume": hourly_chart_data,
        "top_active_numbers": top_10_active,
        "summary": {
            "total_cdr_records": len(cdr_df),
            "total_ipdr_records": len(ipdr_df),
            "total_data_volume_mb": round(float(ipdr_df["data_vol_mb"].sum()), 2),
            "unique_callers": int(cdr_df["caller_num"].nunique()),
            "unique_receivers": int(cdr_df["receiver_num"].nunique())
        }
    }


def find_common_contacts(num1: str, num2: str, db_path: str = DEFAULT_DB_PATH) -> Dict[str, Any]:
    """
    Common Contact Detection:
    Filters cdr for all numbers contacted by num1 and num2, converts both to Python set(),
    and returns set1.intersection(set2) along with the matching record_ids.
    """
    cdr_df = query_df("""
        SELECT c.record_id, c.caller_num, c.receiver_num, c.timestamp, 
               c.call_type, c.duration_sec, c.tower_id, t.area_name, c.imei
        FROM cdr c
        LEFT JOIN towers t ON c.tower_id = t.tower_id
    """, db_path=db_path)

    # Numbers contacted by num1 and num2
    contacted_by_num1 = cdr_df[cdr_df["caller_num"] == num1]["receiver_num"]
    contacted_by_num2 = cdr_df[cdr_df["caller_num"] == num2]["receiver_num"]

    # Convert both to Python set()
    set1 = set(contacted_by_num1)
    set2 = set(contacted_by_num2)

    # set1.intersection(set2)
    common_contacts = set1.intersection(set2)

    # Matching record_ids where num1 or num2 contacted these common contacts
    matching_records_df = cdr_df[
        ((cdr_df["caller_num"] == num1) & (cdr_df["receiver_num"].isin(common_contacts))) |
        ((cdr_df["caller_num"] == num2) & (cdr_df["receiver_num"].isin(common_contacts)))
    ].sort_values(by="timestamp")

    record_ids = matching_records_df["record_id"].tolist()

    records_detail = []
    for _, row in matching_records_df.iterrows():
        records_detail.append({
            "record_id": row["record_id"],
            "caller_num": row["caller_num"],
            "receiver_num": row["receiver_num"],
            "timestamp": row["timestamp"],
            "call_type": row["call_type"],
            "duration_sec": int(row["duration_sec"]),
            "tower_id": row["tower_id"],
            "area_name": row.get("area_name", "Unknown"),
            "imei": row.get("imei", "")
        })

    return {
        "num1": num1,
        "num2": num2,
        "common_contacts": sorted(list(common_contacts)),
        "record_ids": record_ids,
        "matching_records": records_detail,
        "total_common_contacts": len(common_contacts),
        "total_matching_records": len(record_ids)
    }


def build_network_graph(db_path: str = DEFAULT_DB_PATH, as_json_string: bool = False) -> Any:
    """
    Communication Graph:
    Uses NetworkX (nx.Graph()) to add phone numbers as nodes and call/message counts as edge weights.
    Calculates nx.degree_centrality(G) so the frontend can size/color the most connected suspect node.
    Outputs JSON formatted as { "nodes": [...], "links": [...] }.
    """
    cdr_df = query_df("SELECT caller_num, receiver_num, call_type, duration_sec FROM cdr", db_path=db_path)

    G = nx.Graph()

    # Aggregate interaction counts between pairs of phone numbers
    edge_weights = {}
    for _, row in cdr_df.iterrows():
        u = str(row["caller_num"])
        v = str(row["receiver_num"])
        if u == v:
            continue
        edge = tuple(sorted([u, v]))
        edge_weights[edge] = edge_weights.get(edge, 0) + 1

    # Add edges with weights to NetworkX Graph
    for (u, v), weight in edge_weights.items():
        G.add_edge(u, v, weight=weight)

    # Calculate degree centrality
    centrality = nx.degree_centrality(G)

    # Prepare nodes list
    nodes = []
    for node in G.nodes():
        nodes.append({
            "id": node,
            "degree_centrality": round(centrality.get(node, 0.0), 4),
            "degree": G.degree(node),
            "neighbors_count": len(list(G.neighbors(node)))
        })

    # Sort nodes descending by degree centrality for quick identification of key targets
    nodes.sort(key=lambda n: n["degree_centrality"], reverse=True)

    # Prepare links list
    links = []
    for u, v, data in G.edges(data=True):
        links.append({
            "source": u,
            "target": v,
            "weight": data["weight"]
        })

    result = {
        "nodes": nodes,
        "links": links
    }

    if as_json_string:
        return json.dumps(result, indent=2)
    return result


def get_tower_timeline(phone_num: str, db_path: str = DEFAULT_DB_PATH) -> List[List[Any]]:
    """
    Tower Timeline:
    Merges cdr and ipdr records for phone_num, joins with towers on tower_id,
    sorts chronologically by timestamp, and returns the sequence of
    [timestamp, latitude, longitude, area_name, record_id] for Leaflet.
    """
    with get_connection(db_path) as conn:
        # 1. CDR records where phone_num is caller (where tower is registered for the device)
        cdr_query = """
            SELECT 
                c.timestamp AS timestamp,
                t.latitude AS latitude,
                t.longitude AS longitude,
                t.area_name AS area_name,
                c.record_id AS record_id,
                'CDR' AS record_type,
                c.call_type AS details
            FROM cdr c
            JOIN towers t ON c.tower_id = t.tower_id
            WHERE c.caller_num = ?
        """
        cdr_df = pd.read_sql_query(cdr_query, conn, params=(phone_num,))

        # 2. IPDR records for phone_num
        ipdr_query = """
            SELECT 
                i.start_time AS timestamp,
                t.latitude AS latitude,
                t.longitude AS longitude,
                t.area_name AS area_name,
                i.session_id AS record_id,
                'IPDR' AS record_type,
                i.app_protocol || ' (' || printf('%.2f', i.data_vol_mb) || ' MB)' AS details
            FROM ipdr i
            JOIN towers t ON i.tower_id = t.tower_id
            WHERE i.phone_num = ?
        """
        ipdr_df = pd.read_sql_query(ipdr_query, conn, params=(phone_num,))

    # Merge and sort chronologically
    combined_df = pd.concat([cdr_df, ipdr_df], ignore_index=True)
    if combined_df.empty:
        return []

    combined_df = combined_df.sort_values(by="timestamp").reset_index(drop=True)

    # Format sequence as [timestamp, latitude, longitude, area_name, record_id]
    sequence = [
        [
            row["timestamp"],
            float(row["latitude"]),
            float(row["longitude"]),
            row["area_name"],
            row["record_id"]
        ]
        for _, row in combined_df.iterrows()
    ]

    return sequence


def detect_device_anomalies(db_path: str = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    """
    Device / IMEI Anomaly Detection:
    Groups cdr by imei and counts nunique() of caller_num.
    Any IMEI with > 1 phone number is flagged as a SIM Swap / Burner Alert,
    returning the IMEI, linked numbers, and exact record_ids.
    """
    cdr_df = query_df("SELECT record_id, caller_num, timestamp, call_type, imei FROM cdr", db_path=db_path)

    # Group by IMEI and count unique caller numbers
    grouped = cdr_df.groupby("imei")
    imei_user_counts = grouped["caller_num"].nunique()

    # Identify any IMEI with > 1 phone number
    flagged_imeis = imei_user_counts[imei_user_counts > 1].index.tolist()

    anomalies = []
    for imei in flagged_imeis:
        subset = cdr_df[cdr_df["imei"] == imei].sort_values(by="timestamp")
        linked_numbers = sorted(subset["caller_num"].unique().tolist())
        record_ids = subset["record_id"].tolist()

        # Detailed breakdown of phone numbers and their active periods
        number_history = []
        for num in linked_numbers:
            num_subset = subset[subset["caller_num"] == num]
            number_history.append({
                "phone_num": num,
                "first_seen": num_subset["timestamp"].min(),
                "last_seen": num_subset["timestamp"].max(),
                "call_count": len(num_subset)
            })

        anomalies.append({
            "imei": str(imei),
            "alert": "SIM Swap / Burner Alert",
            "phone_count": len(linked_numbers),
            "linked_numbers": linked_numbers,
            "record_ids": record_ids,
            "history": number_history
        })

    return anomalies


if __name__ == "__main__":
    print("Testing analytics module functions against obsydia.db...\n")

    # 1. Overview stats
    stats = get_overview_stats()
    print("1. Overview Stats Summary:")
    print(f"Total CDR: {stats['summary']['total_cdr_records']}, Total IPDR: {stats['summary']['total_ipdr_records']}")
    print(f"Hourly volume slots returned: {len(stats['hourly_volume'])} (Sample: {stats['hourly_volume'][1]})")
    print(f"Top active numbers count: {len(stats['top_active_numbers'])} (Top 1: {stats['top_active_numbers'][0]})")

    # 2. Common Contact Detection
    print("\n2. Common Contact Detection (9829011111 & 9829022222):")
    cc = find_common_contacts("9829011111", "9829022222")
    print(f"Common contacts found: {cc['common_contacts']}")
    print(f"Total matching records: {len(cc['record_ids'])}")

    # 3. Network Graph
    print("\n3. Network Graph:")
    graph_data = build_network_graph()
    print(f"Total nodes: {len(graph_data['nodes'])}, Total links: {len(graph_data['links'])}")
    print(f"Top 3 central nodes: {graph_data['nodes'][:3]}")

    # 4. Tower Timeline for Suspect
    print("\n4. Tower Timeline (9829011111):")
    timeline = get_tower_timeline("9829011111")
    print(f"Timeline entries: {len(timeline)}")
    print(f"Sample entry: {timeline[0]}")
    # Inspect 01:00 to 03:00 on 2026-10-12
    night_spikes = [entry for entry in timeline if "2026-10-12T01:" in entry[0] or "2026-10-12T02:" in entry[0]]
    print(f"Late night movement sequence across towers (01:00 - 03:00):")
    for s in night_spikes:
        print(f"  {s}")

    # 5. Device / IMEI Anomaly Detection
    print("\n5. Device / IMEI Anomaly Detection:")
    anomalies = detect_device_anomalies()
    print(f"Anomalies detected: {len(anomalies)}")
    for a in anomalies:
        print(f"Alert: {a['alert']} | IMEI: {a['imei']} | Linked Numbers: {a['linked_numbers']} | Total Records: {len(a['record_ids'])}")
