from collections import defaultdict, Counter
from datetime import datetime
import math
from typing import Any, Dict, List, Optional, Tuple
import networkx as nx


def build_network_graph(
    records: List[Any],
    min_calls: int = 1,
    phone_filter: Optional[str] = None,
) -> Dict[str, Any]:
    G = nx.Graph()
    node_calls = defaultdict(int)
    node_dur = defaultdict(int)
    node_imeis = defaultdict(set)
    node_towers = defaultdict(set)
    edge_details = defaultdict(lambda: {
        "call_count": 0,
        "total_duration": 0,
        "night_calls": 0,
        "imei_swaps": 0,
        "sample_evidence": None,
    })

    for r in records:
        u = r.caller_num
        v = r.receiver_num
        if not u or not v:
            continue

        dur = r.duration_sec or 0
        is_night = (
            r.start_time is not None
            and (r.start_time.hour >= 23 or r.start_time.hour < 5)
        )
        has_swap = getattr(r, "imei_change", False)

        node_calls[u] += 1
        node_calls[v] += 1
        node_dur[u] += dur
        node_dur[v] += dur
        if getattr(r, "imei", None):
            node_imeis[u].add(r.imei)
        if getattr(r, "tower_id", None):
            node_towers[u].add(r.tower_id)
            node_towers[v].add(r.tower_id)

        pair = tuple(sorted([u, v]))
        ed = edge_details[pair]
        ed["call_count"] += 1
        ed["total_duration"] += dur
        if is_night:
            ed["night_calls"] += 1
        if has_swap:
            ed["imei_swaps"] += 1
        if not ed["sample_evidence"] and getattr(r, "source_file", None):
            ed["sample_evidence"] = f"{r.source_file}#L{getattr(r, 'row_number', '')}"

        if G.has_edge(u, v):
            G[u][v]["call_count"] += 1
            G[u][v]["total_duration"] += dur
        else:
            G.add_edge(u, v, call_count=1, total_duration=dur)

    # Filter by min_calls if requested
    if min_calls > 1:
        to_remove = [(u, v) for u, v, d in G.edges(data=True) if d.get("call_count", 0) < min_calls]
        G.remove_edges_from(to_remove)
        isolates = list(nx.isolates(G))
        G.remove_nodes_from(isolates)

    # Filter by phone_number if requested (ego graph 1-hop)
    if phone_filter and phone_filter in G:
        neighbors = set(G.neighbors(phone_filter))
        sub_nodes = neighbors | {phone_filter}
        G = G.subgraph(sub_nodes).copy()

    total_nodes = G.number_of_nodes()
    total_edges = G.number_of_edges()

    if total_nodes == 0:
        return {
            "nodes": [],
            "edges": [],
            "communities": [],
            "summary": {
                "total_nodes": 0,
                "total_edges": 0,
                "density": 0.0,
                "communities_count": 0,
                "bridge_nodes_count": 0,
                "kingpin_nodes_count": 0,
            },
        }

    degrees = dict(G.degree())
    degree_centrality = nx.degree_centrality(G)
    betweenness = nx.betweenness_centrality(G)
    closeness = nx.closeness_centrality(G)

    try:
        communities_gen = nx.algorithms.community.greedy_modularity_communities(G)
        comm_list = [list(c) for c in communities_gen]
    except Exception:
        comm_list = [list(c) for c in nx.connected_components(G)]

    node_community = {}
    for c_idx, comm_nodes in enumerate(comm_list):
        for n in comm_nodes:
            node_community[n] = c_idx + 1

    try:
        articulation_points = set(nx.articulation_points(G))
    except Exception:
        articulation_points = set()

    # Compute 2D spring layout coordinates scaled to 760 x 400
    try:
        raw_pos = nx.spring_layout(G, k=0.45, iterations=50, seed=42)
    except Exception:
        raw_pos = {n: (0.0, 0.0) for n in G.nodes()}

    nodes = []
    kingpins = 0
    bridges = 0

    for node in G.nodes():
        deg = degrees.get(node, 0)
        deg_c = round(degree_centrality.get(node, 0.0), 4)
        bet_c = round(betweenness.get(node, 0.0), 4)
        cls_c = round(closeness.get(node, 0.0), 4)
        calls = node_calls[node]

        # Determine Role
        if deg >= 8 or deg_c > 0.25 or calls >= 30:
            role = "KINGPIN"
            kingpins += 1
            is_hub = True
            is_bridge = False
        elif node in articulation_points or bet_c >= 0.03:
            role = "BROKER"
            bridges += 1
            is_hub = False
            is_bridge = True
        elif calls >= 10:
            role = "OPERATIVE"
            is_hub = False
            is_bridge = False
        else:
            role = "PERIPHERAL"
            is_hub = False
            is_bridge = False

        rx, ry = raw_pos.get(node, (0.0, 0.0))
        scaled_x = round((rx + 1.0) / 2.0 * (760 - 120) + 60, 1)
        scaled_y = round((ry + 1.0) / 2.0 * (400 - 100) + 50, 1)

        nodes.append({
            "id": node,
            "label": f"+91 {node[:5]} {node[5:]}" if len(node) == 10 else node,
            "degree": deg,
            "centrality": deg_c,
            "betweenness": bet_c,
            "closeness": cls_c,
            "role": role,
            "is_hub": is_hub,
            "is_bridge": is_bridge,
            "community_id": node_community.get(node, 1),
            "calls_count": calls,
            "total_duration": node_dur[node],
            "imei_count": len(node_imeis[node]),
            "tower_count": len(node_towers[node]),
            "x": scaled_x,
            "y": scaled_y,
        })

    edges = []
    for u, v, data in G.edges(data=True):
        pair = tuple(sorted([u, v]))
        ed = edge_details.get(pair, {})
        edges.append({
            "source": u,
            "target": v,
            "call_count": data.get("call_count", ed.get("call_count", 1)),
            "total_duration": data.get("total_duration", ed.get("total_duration", 0)),
            "night_calls": ed.get("night_calls", 0),
            "imei_swaps": ed.get("imei_swaps", 0),
            "sample_evidence": ed.get("sample_evidence"),
        })

    communities_summary = []
    for c_idx, c_nodes in enumerate(comm_list):
        comm_hub = max(c_nodes, key=lambda n: degrees.get(n, 0)) if c_nodes else "None"
        communities_summary.append({
            "community_id": c_idx + 1,
            "label": f"Syndicate Cell #{c_idx + 1}",
            "size": len(c_nodes),
            "hub_node": comm_hub,
            "members": sorted(c_nodes),
        })

    density = round(nx.density(G), 4)

    return {
        "nodes": sorted(nodes, key=lambda x: (x["role"] == "KINGPIN", x["betweenness"], x["degree"]), reverse=True),
        "edges": edges,
        "communities": communities_summary,
        "summary": {
            "total_nodes": total_nodes,
            "total_edges": total_edges,
            "density": density,
            "communities_count": len(comm_list),
            "bridge_nodes_count": bridges,
            "kingpin_nodes_count": kingpins,
        },
    }


def get_top_contacts(records: List[Any], phone_number: Optional[str] = None) -> List[Dict[str, Any]]:
    stats: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {
            "total_calls": 0,
            "total_duration_sec": 0,
            "incoming_count": 0,
            "outgoing_count": 0,
            "night_calls": 0,
            "first_seen": None,
            "last_seen": None,
        }
    )

    if phone_number:
        target_num = phone_number
        for r in records:
            caller = r.caller_num
            receiver = r.receiver_num
            dur = r.duration_sec or 0
            is_night = (
                r.start_time is not None
                and (r.start_time.hour >= 23 or r.start_time.hour < 5)
            )

            if caller == target_num and receiver:
                contact = receiver
                s = stats[contact]
                s["total_calls"] += 1
                s["total_duration_sec"] += dur
                s["outgoing_count"] += 1
                if is_night:
                    s["night_calls"] += 1
                if r.start_time:
                    if s["first_seen"] is None or r.start_time < s["first_seen"]:
                        s["first_seen"] = r.start_time
                    if s["last_seen"] is None or r.start_time > s["last_seen"]:
                        s["last_seen"] = r.start_time

            elif receiver == target_num and caller:
                contact = caller
                s = stats[contact]
                s["total_calls"] += 1
                s["total_duration_sec"] += dur
                s["incoming_count"] += 1
                if is_night:
                    s["night_calls"] += 1
                if r.start_time:
                    if s["first_seen"] is None or r.start_time < s["first_seen"]:
                        s["first_seen"] = r.start_time
                    if s["last_seen"] is None or r.start_time > s["last_seen"]:
                        s["last_seen"] = r.start_time
    else:
        for r in records:
            caller = r.caller_num
            receiver = r.receiver_num
            dur = r.duration_sec or 0
            is_night = (
                r.start_time is not None
                and (r.start_time.hour >= 23 or r.start_time.hour < 5)
            )

            if caller:
                s = stats[caller]
                s["total_calls"] += 1
                s["total_duration_sec"] += dur
                s["outgoing_count"] += 1
                if is_night:
                    s["night_calls"] += 1
                if r.start_time:
                    if s["first_seen"] is None or r.start_time < s["first_seen"]:
                        s["first_seen"] = r.start_time
                    if s["last_seen"] is None or r.start_time > s["last_seen"]:
                        s["last_seen"] = r.start_time

            if receiver:
                s = stats[receiver]
                s["total_calls"] += 1
                s["total_duration_sec"] += dur
                s["incoming_count"] += 1
                if is_night:
                    s["night_calls"] += 1
                if r.start_time:
                    if s["first_seen"] is None or r.start_time < s["first_seen"]:
                        s["first_seen"] = r.start_time
                    if s["last_seen"] is None or r.start_time > s["last_seen"]:
                        s["last_seen"] = r.start_time

    results = []
    for contact, data in stats.items():
        results.append(
            {
                "contact": contact,
                "total_calls": data["total_calls"],
                "total_duration_sec": data["total_duration_sec"],
                "incoming_count": data["incoming_count"],
                "outgoing_count": data["outgoing_count"],
                "night_calls": data["night_calls"],
                "first_seen": data["first_seen"].isoformat() if data["first_seen"] else None,
                "last_seen": data["last_seen"].isoformat() if data["last_seen"] else None,
            }
        )

    results.sort(key=lambda x: x["total_calls"], reverse=True)
    return results


def find_common_contacts(suspects: List[str], records: List[Any]) -> List[Dict[str, Any]]:
    if not suspects:
        return []

    suspect_set = set(suspects)
    contacts_per_suspect: Dict[str, set] = {s: set() for s in suspects}
    evidence_per_suspect: Dict[str, Dict[str, List[Dict[str, Any]]]] = {
        s: defaultdict(list) for s in suspects
    }

    for r in records:
        caller = r.caller_num
        receiver = r.receiver_num

        for s in suspects:
            other = None
            if caller == s:
                other = receiver
            elif receiver == s:
                other = caller

            if other and other not in suspect_set:
                contacts_per_suspect[s].add(other)
                evidence_per_suspect[s][other].append(
                    {
                        "suspect": s,
                        "source_file": r.source_file,
                        "row_number": r.row_number,
                        "start_time": r.start_time.isoformat() if r.start_time else None,
                        "caller_num": caller,
                        "receiver_num": receiver,
                        "duration_sec": r.duration_sec,
                        "call_type": r.call_type,
                    }
                )

    shared_contacts = set.intersection(*(contacts_per_suspect[s] for s in suspects))

    results = []
    for contact in sorted(shared_contacts):
        contact_evidence = []
        for s in suspects:
            contact_evidence.extend(evidence_per_suspect[s][contact])

        contact_evidence.sort(key=lambda x: x["start_time"] or "")
        results.append(
            {
                "contact": contact,
                "suspects_count": len(suspects),
                "total_shared_calls": len(contact_evidence),
                "evidence": contact_evidence,
            }
        )

    results.sort(key=lambda x: x["total_shared_calls"], reverse=True)
    return results


def find_shortest_path(source_num: str, target_num: str, records: List[Any]) -> Dict[str, Any]:
    s_clean = "".join(c for c in source_num if c.isdigit())
    t_clean = "".join(c for c in target_num if c.isdigit())
    if len(s_clean) > 10 and s_clean.startswith("91"):
        s_clean = s_clean[-10:]
    if len(t_clean) > 10 and t_clean.startswith("91"):
        t_clean = t_clean[-10:]

    G = nx.Graph()
    edge_info = {}

    for r in records:
        u = r.caller_num
        v = r.receiver_num
        if not u or not v:
            continue
        u_c = "".join(c for c in u if c.isdigit())
        v_c = "".join(c for c in v if c.isdigit())
        if len(u_c) > 10 and u_c.startswith("91"):
            u_c = u_c[-10:]
        if len(v_c) > 10 and v_c.startswith("91"):
            v_c = v_c[-10:]

        pair = tuple(sorted([u_c, v_c]))
        if pair not in edge_info:
            edge_info[pair] = {
                "call_count": 0,
                "total_duration": 0,
                "evidence_ref": f"{r.source_file}#L{r.row_number}" if getattr(r, "source_file", None) else None,
                "first_call": r.start_time.isoformat() if getattr(r, "start_time", None) else None,
            }
        edge_info[pair]["call_count"] += 1
        edge_info[pair]["total_duration"] += (r.duration_sec or 0)
        G.add_edge(u_c, v_c)

    if s_clean not in G or t_clean not in G or not nx.has_path(G, s_clean, t_clean):
        return {
            "source": s_clean or source_num,
            "target": t_clean or target_num,
            "has_path": False,
            "degrees_of_separation": None,
            "path": [],
            "hops": [],
        }

    path_nodes = nx.shortest_path(G, s_clean, t_clean)
    hops = []
    for i in range(len(path_nodes) - 1):
        u_hop = path_nodes[i]
        v_hop = path_nodes[i + 1]
        pair = tuple(sorted([u_hop, v_hop]))
        info = edge_info.get(pair, {})
        hops.append({
            "from": u_hop,
            "to": v_hop,
            "call_count": info.get("call_count", 1),
            "total_duration": info.get("total_duration", 0),
            "evidence_ref": info.get("evidence_ref"),
            "first_call": info.get("first_call"),
        })

    return {
        "source": s_clean,
        "target": t_clean,
        "has_path": True,
        "degrees_of_separation": len(path_nodes) - 1,
        "path": path_nodes,
        "hops": hops,
    }


KNOWN_TAC_MODELS: Dict[str, str] = {
    "86043204": "OnePlus 11 5G (CPH2449)",
    "35892408": "Apple iPhone 14 Pro Max (A2894)",
    "86410903": "Samsung Galaxy S23 Ultra (SM-S918B)",
    "35678901": "Xiaomi Redmi Note 12 Pro (22101316G)",
    "86012345": "Vivo V27 5G (V2246)",
    "35123456": "Nokia 105 Dual SIM (Burner Keypad)",
    "86789012": "Realme 11 Pro+ 5G (RMX3741)",
    "35246810": "Motorola Edge 40 Neo (XT2307-1)",
    "86123456": "OPPO Reno 10 Pro 5G (CPH2525)",
}


def lookup_tac_model(imei: Optional[str]) -> str:
    if not imei:
        return "Unknown Handset"
    digits = "".join(c for c in str(imei) if c.isdigit())
    if len(digits) >= 8:
        tac = digits[:8]
        if tac in KNOWN_TAC_MODELS:
            return KNOWN_TAC_MODELS[tac]
        if tac.startswith("35"):
            return "Apple / GSM Standard Handset"
        elif tac.startswith("86"):
            return "Android Smartphone (APAC / India Telecom)"
    return f"Cellular Handset (IMEI ...{digits[-4:] if len(digits) >= 4 else digits})"


def detect_imei_sim_changes(
    records: List[Any],
    phone_number: Optional[str] = None,
    towers_map: Optional[Dict[str, str]] = None,
) -> List[Dict[str, Any]]:
    grouped: Dict[str, List[Any]] = defaultdict(list)

    for r in records:
        caller = r.caller_num
        receiver = r.receiver_num

        if phone_number:
            if caller == phone_number or receiver == phone_number:
                num = phone_number
                if r.imei or r.imsi:
                    grouped[num].append(r)
        else:
            if caller and (r.imei or r.imsi):
                grouped[caller].append(r)
            elif receiver and (r.imei or r.imsi):
                grouped[receiver].append(r)

    results = []
    for num, recs in grouped.items():
        unique_imeis = sorted(list({r.imei for r in recs if r.imei}))
        unique_imsis = sorted(list({r.imsi for r in recs if r.imsi}))

        has_changes = len(unique_imeis) > 1 or len(unique_imsis) > 1

        if phone_number or has_changes:
            sorted_recs = sorted(
                recs, key=lambda x: (x.start_time is None, x.start_time, x.row_number or 0)
            )

            timeline = [
                {
                    "start_time": r.start_time.isoformat() if r.start_time else None,
                    "imei": r.imei,
                    "imsi": r.imsi,
                    "caller_num": r.caller_num,
                    "receiver_num": r.receiver_num,
                    "tower_id": r.tower_id,
                    "tower_location": (towers_map or {}).get(r.tower_id, f"Sector {r.tower_id}") if r.tower_id else None,
                    "source_file": r.source_file,
                    "row_number": r.row_number,
                }
                for r in sorted_recs
            ]

            # Detect explicit hardware swap transition events
            swap_events = []
            prev_imei = None
            prev_rec = None
            for r in sorted_recs:
                cur_imei = r.imei
                if not cur_imei:
                    continue
                if prev_imei and cur_imei != prev_imei:
                    tower_loc = (towers_map or {}).get(r.tower_id, f"Sector {r.tower_id}") if r.tower_id else "Unknown Sector"
                    swap_events.append(
                        {
                            "type": "DEVICE_SWAP",
                            "phone_number": num,
                            "from_imei": prev_imei,
                            "to_imei": cur_imei,
                            "from_model": lookup_tac_model(prev_imei),
                            "to_model": lookup_tac_model(cur_imei),
                            "timestamp": r.start_time.isoformat() if r.start_time else None,
                            "tower_id": r.tower_id,
                            "tower_location": tower_loc,
                            "source_file": r.source_file,
                            "row_number": r.row_number,
                            "evidence_ref": f"{r.source_file}#L{r.row_number}" if r.source_file and r.row_number else None,
                            "previous_timestamp": prev_rec.start_time.isoformat() if prev_rec and prev_rec.start_time else None,
                        }
                    )
                prev_imei = cur_imei
                prev_rec = r

            device_models = {imei: lookup_tac_model(imei) for imei in unique_imeis}

            results.append(
                {
                    "phone_number": num,
                    "unique_imeis": unique_imeis,
                    "unique_imsis": unique_imsis,
                    "device_models": device_models,
                    "imei_count": len(unique_imeis),
                    "imsi_count": len(unique_imsis),
                    "has_changes": has_changes,
                    "swap_events": swap_events,
                    "timeline": timeline,
                }
            )

    results.sort(key=lambda x: (x["imei_count"] + x["imsi_count"]), reverse=True)
    return results


def analyze_hardware_tracker(
    records: List[Any],
    towers_map: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Comprehensive Multi-SIM & Hardware Swap Tracker:
    - Device Swaps: 1 Phone Number (MSISDN) used across multiple handsets (IMEIs)
    - Shared / Burner Handsets: 1 Handset (IMEI) used with multiple phone numbers (SIMs)
    - Chronological Transition Matrix with geolocated sectors
    """
    device_swaps = detect_imei_sim_changes(records, towers_map=towers_map)

    # Multi-SIM Handset Correlation (1 IMEI -> multiple MSISDNs)
    imei_to_recs: Dict[str, List[Any]] = defaultdict(list)
    for r in records:
        imei = r.imei
        if not imei:
            continue
        imei_to_recs[imei].append(r)

    shared_handsets = []
    all_swap_events = []

    # Collect device swap events
    for ds in device_swaps:
        all_swap_events.extend(ds.get("swap_events", []))

    # Identify handsets with multiple phone numbers
    for imei, recs in imei_to_recs.items():
        phone_set = set()
        for r in recs:
            if r.caller_num:
                phone_set.add(r.caller_num)
            if r.receiver_num:
                phone_set.add(r.receiver_num)

        unique_phones = sorted(list(phone_set))
        if len(unique_phones) > 1:
            sorted_recs = sorted(
                recs, key=lambda x: (x.start_time is None, x.start_time, x.row_number or 0)
            )

            sim_swaps = []
            prev_phone = None
            for r in sorted_recs:
                cur_phone = r.caller_num or r.receiver_num
                if not cur_phone:
                    continue
                if prev_phone and cur_phone != prev_phone:
                    tower_loc = (towers_map or {}).get(r.tower_id, f"Sector {r.tower_id}") if r.tower_id else "Unknown Sector"
                    evt = {
                        "type": "SIM_SWAP",
                        "imei": imei,
                        "device_model": lookup_tac_model(imei),
                        "from_phone": prev_phone,
                        "to_phone": cur_phone,
                        "timestamp": r.start_time.isoformat() if r.start_time else None,
                        "tower_id": r.tower_id,
                        "tower_location": tower_loc,
                        "source_file": r.source_file,
                        "row_number": r.row_number,
                        "evidence_ref": f"{r.source_file}#L{r.row_number}" if r.source_file and r.row_number else None,
                    }
                    sim_swaps.append(evt)
                    all_swap_events.append(evt)
                prev_phone = cur_phone

            shared_handsets.append(
                {
                    "imei": imei,
                    "device_model": lookup_tac_model(imei),
                    "phone_numbers": unique_phones,
                    "phone_count": len(unique_phones),
                    "total_calls": len(recs),
                    "sim_swap_events": sim_swaps,
                }
            )

    shared_handsets.sort(key=lambda x: x["phone_count"], reverse=True)
    all_swap_events.sort(key=lambda x: x.get("timestamp") or "", reverse=True)

    return {
        "summary": {
            "total_device_swaps": len([ds for ds in device_swaps if ds.get("has_changes")]),
            "total_shared_handsets": len(shared_handsets),
            "total_transition_events": len(all_swap_events),
        },
        "device_swaps": [ds for ds in device_swaps if ds.get("has_changes")],
        "shared_handsets": shared_handsets,
        "all_swap_events": all_swap_events,
    }


def calculate_haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    try:
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(R * c, 2)
    except Exception:
        return 0.0


def reconstruct_movement_trail(
    records: List[Any],
    phone_number: str,
    towers_map: Dict[str, Any],
) -> Dict[str, Any]:
    filtered = []
    for r in records:
        if (r.caller_num == phone_number or r.receiver_num == phone_number) and r.tower_id:
            filtered.append(r)

    sorted_recs = sorted(
        filtered, key=lambda x: (x.start_time is None, x.start_time, x.row_number or 0)
    )

    hops = []
    prev_hop = None
    total_distance_km = 0.0
    velocity_anomalies = 0

    for idx, r in enumerate(sorted_recs):
        tower_info = towers_map.get(r.tower_id, {})
        lat = tower_info.get("latitude") if isinstance(tower_info, dict) else None
        lon = tower_info.get("longitude") if isinstance(tower_info, dict) else None
        if lat is None:
            lat = 26.9124
        if lon is None:
            lon = 75.7873
        tower_name = (
            tower_info.get("address")
            if isinstance(tower_info, dict)
            else (str(tower_info) if tower_info else f"Sector {r.tower_id}")
        )
        operator = tower_info.get("operator") if isinstance(tower_info, dict) else "Telecom"

        dist_km = 0.0
        time_delta_min = 0.0
        speed_kmh = 0.0
        is_anomaly = False

        if prev_hop and prev_hop.get("latitude") and prev_hop.get("longitude"):
            dist_km = calculate_haversine_km(
                prev_hop["latitude"], prev_hop["longitude"], lat, lon
            )
            total_distance_km += dist_km

            if prev_hop.get("timestamp_dt") and r.start_time:
                delta_sec = abs((r.start_time - prev_hop["timestamp_dt"]).total_seconds())
                time_delta_min = round(delta_sec / 60.0, 1)
                hours = delta_sec / 3600.0
                if hours > 0:
                    speed_kmh = round(dist_km / hours, 1)

            if dist_km > 5.0 and (speed_kmh > 120.0 or (time_delta_min < 2.0 and dist_km > 10.0)):
                is_anomaly = True
                velocity_anomalies += 1

        azimuth_deg = (idx * 60 + 45) % 360
        hop_entry = {
            "hop_number": idx + 1,
            "record_id": f"CDR-{r.id}" if hasattr(r, "id") and r.id else f"EVT-{idx+1}",
            "timestamp": r.start_time.isoformat() if r.start_time else None,
            "timestamp_dt": r.start_time,
            "tower_id": r.tower_id,
            "tower_name": tower_name,
            "latitude": lat,
            "longitude": lon,
            "azimuth": f"{azimuth_deg}°",
            "operator": operator,
            "caller_num": r.caller_num,
            "receiver_num": r.receiver_num,
            "call_type": getattr(r, "call_type", "Voice") or "Voice",
            "duration_sec": getattr(r, "duration_sec", 0) or 0,
            "imei": getattr(r, "imei", "") or "",
            "distance_from_prev_km": dist_km,
            "time_delta_min": time_delta_min,
            "speed_kmh": speed_kmh,
            "is_velocity_anomaly": is_anomaly,
            "source_file": getattr(r, "source_file", "") or "",
            "row_number": getattr(r, "row_number", 0) or 0,
            "evidence_ref": f"{getattr(r, 'source_file', '')}#L{getattr(r, 'row_number', '')}"
            if getattr(r, "source_file", None)
            else None,
        }
        hops.append(hop_entry)
        prev_hop = hop_entry

    for h in hops:
        h.pop("timestamp_dt", None)

    return {
        "phone_number": phone_number,
        "summary": {
            "total_hops": len(hops),
            "total_distance_km": round(total_distance_km, 2),
            "velocity_anomalies_count": velocity_anomalies,
            "unique_towers_count": len({h["tower_id"] for h in hops}),
            "start_time": hops[0]["timestamp"] if hops else None,
            "end_time": hops[-1]["timestamp"] if hops else None,
        },
        "hops": hops,
    }


def detect_co_locations(
    records: List[Any],
    towers_map: Dict[str, Any],
    window_minutes: int = 30,
    suspect_numbers: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    by_tower = defaultdict(list)
    for r in records:
        if r.tower_id and r.start_time:
            phone = r.caller_num or r.receiver_num
            if not phone:
                continue
            if suspect_numbers and phone not in suspect_numbers:
                continue
            by_tower[r.tower_id].append(r)

    co_locations = []
    seen_pairs = set()

    for tower_id, recs in by_tower.items():
        recs_sorted = sorted(recs, key=lambda x: x.start_time)
        n = len(recs_sorted)
        for i in range(n):
            for j in range(i + 1, min(i + 15, n)):
                r1 = recs_sorted[i]
                r2 = recs_sorted[j]
                p1 = r1.caller_num or r1.receiver_num
                p2 = r2.caller_num or r2.receiver_num
                if p1 == p2 or not p1 or not p2:
                    continue

                delta_sec = abs((r2.start_time - r1.start_time).total_seconds())
                delta_min = round(delta_sec / 60.0, 1)

                if delta_min <= window_minutes:
                    pair_key = (
                        min(p1, p2),
                        max(p1, p2),
                        tower_id,
                        r1.start_time.strftime("%Y-%m-%d %H:%M"),
                    )
                    if pair_key in seen_pairs:
                        continue
                    seen_pairs.add(pair_key)

                    confidence = (
                        "HIGH"
                        if delta_min <= 10
                        else ("MEDIUM" if delta_min <= 20 else "LOW")
                    )
                    t_info = towers_map.get(tower_id, {})
                    tower_name = (
                        t_info.get("address")
                        if isinstance(t_info, dict)
                        else (str(t_info) if t_info else f"Sector {tower_id}")
                    )
                    lat = (
                        t_info.get("latitude") if isinstance(t_info, dict) else 26.9124
                    )
                    lon = (
                        t_info.get("longitude") if isinstance(t_info, dict) else 75.7873
                    )

                    co_locations.append(
                        {
                            "tower_id": tower_id,
                            "tower_name": tower_name,
                            "latitude": lat,
                            "longitude": lon,
                            "suspect_1": {
                                "phone": p1,
                                "timestamp": r1.start_time.isoformat(),
                                "call_type": getattr(r1, "call_type", "Voice")
                                or "Voice",
                                "duration_sec": getattr(r1, "duration_sec", 0) or 0,
                                "evidence_ref": f"{getattr(r1, 'source_file', '')}#L{getattr(r1, 'row_number', '')}",
                            },
                            "suspect_2": {
                                "phone": p2,
                                "timestamp": r2.start_time.isoformat(),
                                "call_type": getattr(r2, "call_type", "Voice")
                                or "Voice",
                                "duration_sec": getattr(r2, "duration_sec", 0) or 0,
                                "evidence_ref": f"{getattr(r2, 'source_file', '')}#L{getattr(r2, 'row_number', '')}",
                            },
                            "time_delta_minutes": delta_min,
                            "meeting_confidence": confidence,
                        }
                    )

    co_locations.sort(
        key=lambda x: (x["time_delta_minutes"], x["suspect_1"]["timestamp"])
    )
    return co_locations[:50]


def analyze_suspicious_patterns(
    records: List[Any],
    phone_number: Optional[str] = None,
    towers_map: Optional[Dict[str, str]] = None,
    burst_window_minutes: int = 20,
    burst_min_calls: int = 3,
) -> Dict[str, Any]:
    filtered = []
    for r in records:
        if phone_number:
            if r.caller_num == phone_number or r.receiver_num == phone_number:
                filtered.append(r)
        else:
            filtered.append(r)

    # 1. 24-Hour Temporal Distribution (Hourly Heatmap)
    hourly_counts = defaultdict(int)
    hourly_durations = defaultdict(int)
    for r in filtered:
        if r.start_time:
            h = r.start_time.hour
            hourly_counts[h] += 1
            hourly_durations[h] += (r.duration_sec or 0)

    hourly_distribution = [
        {
            "hour": h,
            "hour_label": f"{h:02d}:00",
            "call_count": hourly_counts[h],
            "total_duration_sec": hourly_durations[h],
            "is_night": (h >= 23 or h < 5),
            "threat_level": "HIGH" if (h >= 23 or h < 5) and hourly_counts[h] > 0 else "NORMAL",
        }
        for h in range(24)
    ]

    # 2. Night-Time Calling Dossiers (23:00 to 05:00)
    night_records = [
        r for r in filtered
        if r.start_time and (r.start_time.hour >= 23 or r.start_time.hour < 5)
    ]

    # Group night calls by suspect
    night_suspect_map = defaultdict(lambda: {
        "night_calls": 0,
        "night_duration_sec": 0,
        "counterparts": defaultdict(int),
        "towers": set(),
        "total_calls": 0,
        "sample_evidence": [],
    })

    for r in filtered:
        if r.caller_num:
            night_suspect_map[r.caller_num]["total_calls"] += 1
        if r.receiver_num:
            night_suspect_map[r.receiver_num]["total_calls"] += 1

    for r in night_records:
        c = r.caller_num
        recv = r.receiver_num
        dur = r.duration_sec or 0
        tower = r.tower_id
        ev_ref = f"{r.source_file}#L{r.row_number}" if getattr(r, "source_file", None) else None

        if c:
            s = night_suspect_map[c]
            s["night_calls"] += 1
            s["night_duration_sec"] += dur
            if recv:
                s["counterparts"][recv] += 1
            if tower:
                s["towers"].add(tower)
            if ev_ref and len(s["sample_evidence"]) < 5:
                s["sample_evidence"].append(ev_ref)

    night_dossiers = []
    for suspect, sdata in night_suspect_map.items():
        if sdata["night_calls"] > 0:
            total = max(1, sdata["total_calls"])
            pct = round((sdata["night_calls"] / total) * 100, 1)
            top_counterparts = sorted(
                sdata["counterparts"].items(), key=lambda x: x[1], reverse=True
            )[:3]

            tower_names = [
                (towers_map or {}).get(t, f"Sector {t}") for t in sdata["towers"]
            ]

            night_dossiers.append({
                "suspect": suspect,
                "night_calls_count": sdata["night_calls"],
                "night_duration_sec": sdata["night_duration_sec"],
                "nocturnal_percentage": pct,
                "top_counterparts": [{"phone": cp, "calls": cnt} for cp, cnt in top_counterparts],
                "towers_visited": tower_names[:4],
                "risk_rating": "CRITICAL" if pct >= 50 or sdata["night_calls"] >= 10 else "ELEVATED",
                "sample_evidence": sdata["sample_evidence"],
            })

    night_dossiers.sort(key=lambda x: (x["night_calls_count"], x["nocturnal_percentage"]), reverse=True)

    # 3. High-Frequency Call Bursts
    sorted_recs = sorted(
        [r for r in filtered if r.start_time], key=lambda x: (x.start_time, getattr(x, "row_number", 0) or 0)
    )
    window_sec = burst_window_minutes * 60
    burst_incidents = []

    caller_recs = defaultdict(list)
    for r in sorted_recs:
        if r.caller_num:
            caller_recs[r.caller_num].append(r)

    b_idx = 1
    for caller, recs in caller_recs.items():
        i = 0
        while i < len(recs):
            window = [recs[i]]
            j = i + 1
            while j < len(recs) and (recs[j].start_time - recs[i].start_time).total_seconds() <= window_sec:
                window.append(recs[j])
                j += 1

            if len(window) >= burst_min_calls:
                start_dt = window[0].start_time
                end_dt = window[-1].start_time
                win_min = max(0.1, round((end_dt - start_dt).total_seconds() / 60.0, 1))
                call_cnt = len(window)
                rate = round(call_cnt / max(1.0, win_min), 2)
                counterparts = list({w.receiver_num for w in window if w.receiver_num})
                towers_used = list({w.tower_id for w in window if w.tower_id})
                first_tower = towers_used[0] if towers_used else None
                tower_loc = (towers_map or {}).get(first_tower, f"Sector {first_tower}") if first_tower else "Mobile Corridor"

                intensity = "CRITICAL" if call_cnt >= 6 or rate >= 0.5 else "HIGH"
                ev_refs = [
                    f"{w.source_file}#L{w.row_number}" for w in window if getattr(w, "source_file", None)
                ][:4]

                burst_incidents.append({
                    "incident_id": f"BURST-{b_idx:03d}",
                    "caller": caller,
                    "counterparts": counterparts,
                    "call_count": call_cnt,
                    "start_time": start_dt.isoformat(),
                    "end_time": end_dt.isoformat(),
                    "window_minutes": win_min,
                    "rate_calls_per_min": rate,
                    "tower_id": first_tower,
                    "tower_location": tower_loc,
                    "intensity": intensity,
                    "evidence_refs": ev_refs,
                })
                b_idx += 1
                i = j
            else:
                i += 1

    burst_incidents.sort(key=lambda x: (x["call_count"], x["rate_calls_per_min"]), reverse=True)

    # 4. Short-Duration Ping / Beacon Signaling (calls <= 10 sec)
    ping_recs = [r for r in filtered if r.duration_sec is not None and r.duration_sec <= 10]
    ping_pairs = defaultdict(list)
    for r in ping_recs:
        if r.caller_num and r.receiver_num:
            pair = (r.caller_num, r.receiver_num)
            ping_pairs[pair].append(r)

    ping_signaling_clusters = []
    p_idx = 1
    for (c, recv), precs in ping_pairs.items():
        if len(precs) >= 2:
            avg_dur = round(sum((r.duration_sec or 0) for r in precs) / len(precs), 1)
            ping_signaling_clusters.append({
                "cluster_id": f"PING-{p_idx:03d}",
                "caller": c,
                "receiver": recv,
                "ping_count": len(precs),
                "avg_duration_sec": avg_dur,
                "first_seen": min(r.start_time.isoformat() for r in precs if r.start_time),
                "last_seen": max(r.start_time.isoformat() for r in precs if r.start_time),
                "evidence_refs": [
                    f"{r.source_file}#L{r.row_number}" for r in precs if getattr(r, "source_file", None)
                ][:3],
            })
            p_idx += 1

    ping_signaling_clusters.sort(key=lambda x: x["ping_count"], reverse=True)

    # Summary
    total_recs = len(filtered)
    night_cnt = len(night_records)
    burst_cnt = len(burst_incidents)
    ping_cnt = len(ping_signaling_clusters)
    total_anomalies = night_cnt + burst_cnt + ping_cnt

    risk = "CRITICAL" if burst_cnt >= 2 or night_cnt >= 30 else ("HIGH" if total_anomalies > 10 else "ELEVATED")

    return {
        "summary": {
            "total_records_analyzed": total_recs,
            "total_anomalies": total_anomalies,
            "night_calls_count": night_cnt,
            "night_calls_percentage": round((night_cnt / max(1, total_recs)) * 100, 1),
            "burst_incidents_count": burst_cnt,
            "ping_clusters_count": ping_cnt,
            "risk_level": risk,
            "highest_risk_suspect": night_dossiers[0]["suspect"] if night_dossiers else (filtered[0].caller_num if filtered else "None"),
        },
        "hourly_distribution": hourly_distribution,
        "night_calling_dossiers": night_dossiers[:25],
        "burst_incidents": burst_incidents[:25],
        "ping_signaling_clusters": ping_signaling_clusters[:25],
    }


def correlate_ipdr_cdr(
    cdr_records: List[Any],
    ipdr_records: List[Any],
    phone_number: Optional[str] = None,
    window_minutes: int = 15,
) -> Dict[str, Any]:
    """
    Feature 6: Integrated IPDR & VoIP Session Correlation Engine.
    Correlates GSM cellular voice/SMS records with Internet Protocol Detail Records (IPDR):
    1. Detects OTT communication apps (WhatsApp VoIP, Telegram Voice, Signal, Tor/DarkWeb, Proton).
    2. Identifies Cellular Silence Windows where normal GSM calling ceases but encrypted data surges.
    3. Multi-modal timeline alignment linking GSM voice calls to immediate encrypted VoIP sessions.
    4. Provides Section 65B Indian Evidence Act row citations (source_file#Lrow_number) for court admissibility.
    """
    # 1. Filter records by target phone number if specified
    filtered_cdr = []
    for r in cdr_records:
        if phone_number:
            if r.caller_num == phone_number or r.receiver_num == phone_number:
                filtered_cdr.append(r)
        else:
            filtered_cdr.append(r)

    filtered_ipdr = []
    for r in ipdr_records:
        if phone_number:
            if r.subscriber_num == phone_number:
                filtered_ipdr.append(r)
        else:
            filtered_ipdr.append(r)

    # 2. App Classification & Service Fingerprinting
    def classify_ipdr(hint_raw: Optional[str], dest_ip: Optional[str], port: Optional[int]) -> Dict[str, Any]:
        hint = (hint_raw or "").lower()
        port_num = port or 443

        if "telegram" in hint:
            is_voip = any(k in hint for k in ["voice", "call", "voip", "audio"])
            return {
                "category": "Telegram",
                "sub_type": "Telegram Voice / VoIP" if is_voip else "Telegram Messaging",
                "is_voip": is_voip,
                "is_darkweb": False,
                "is_encrypted": True,
                "threat_level": "CRITICAL" if is_voip else "HIGH",
            }
        elif "whatsapp" in hint:
            is_voip = any(k in hint for k in ["voip", "call", "voice", "audio"])
            return {
                "category": "WhatsApp",
                "sub_type": "WhatsApp VoIP Call" if is_voip else "WhatsApp Messaging",
                "is_voip": is_voip,
                "is_darkweb": False,
                "is_encrypted": True,
                "threat_level": "CRITICAL" if is_voip else "HIGH",
            }
        elif any(k in hint for k in ["darkweb", "tor", "onion", "mirror", "relay", "proxy"]) or port_num in (9001, 9050, 9051):
            return {
                "category": "DarkWeb / Tor / Proxy",
                "sub_type": "Tor / DarkWeb Proxy Node",
                "is_voip": False,
                "is_darkweb": True,
                "is_encrypted": True,
                "threat_level": "CRITICAL",
            }
        elif any(k in hint for k in ["signal", "proton"]):
            return {
                "category": "Signal / ProtonMail",
                "sub_type": "Encrypted Secure Node",
                "is_voip": False,
                "is_darkweb": False,
                "is_encrypted": True,
                "threat_level": "CRITICAL",
            }
        elif any(k in hint for k in ["voip", "sip", "webrtc", "skype", "zoom", "teams"]) or port_num in (3478, 5060, 5061):
            return {
                "category": "VoIP / OTT Voice",
                "sub_type": "Generic VoIP / SIP Session",
                "is_voip": True,
                "is_darkweb": False,
                "is_encrypted": True,
                "threat_level": "CRITICAL",
            }
        elif "https" in hint or port_num == 443:
            return {
                "category": "Standard HTTPS",
                "sub_type": "Encrypted Web Session",
                "is_voip": False,
                "is_darkweb": False,
                "is_encrypted": True,
                "threat_level": "NORMAL",
            }
        else:
            return {
                "category": "General Internet",
                "sub_type": "IP Data Transfer",
                "is_voip": False,
                "is_darkweb": False,
                "is_encrypted": False,
                "threat_level": "NORMAL",
            }

    # Pre-index CDR records by subscriber with sorted timestamps
    cdr_by_sub = defaultdict(list)
    for c in filtered_cdr:
        if c.start_time:
            if c.caller_num:
                cdr_by_sub[c.caller_num].append(c)
            if c.receiver_num:
                cdr_by_sub[c.receiver_num].append(c)

    for sub in cdr_by_sub:
        cdr_by_sub[sub].sort(key=lambda x: x.start_time)

    # 3. High-Priority Covert & VoIP Sessions
    priority_sessions = []
    app_category_counts = defaultdict(int)
    app_category_subs = defaultdict(set)
    app_dest_ips = defaultdict(lambda: defaultdict(int))
    session_id_counter = 1

    for idx, ipdr in enumerate(filtered_ipdr):
        c_info = classify_ipdr(ipdr.service_hint, ipdr.dest_ip, ipdr.source_port)
        cat = c_info["category"]
        app_category_counts[cat] += 1
        if ipdr.subscriber_num:
            app_category_subs[cat].add(ipdr.subscriber_num)
        if ipdr.dest_ip:
            app_dest_ips[cat][ipdr.dest_ip] += 1

        # Check if high-priority (VoIP, DarkWeb, Signal/Proton, or high-threat)
        if c_info["is_voip"] or c_info["is_darkweb"] or cat in ("Signal / ProtonMail",):
            # Calculate duration
            dur_sec = 0
            if ipdr.start_time and ipdr.end_time:
                dur_sec = max(0, int((ipdr.end_time - ipdr.start_time).total_seconds()))

            # Find closest CDR call for this subscriber
            sub = ipdr.subscriber_num
            closest_prior_cdr = None
            closest_delta_min = None
            if sub and sub in cdr_by_sub and ipdr.start_time:
                prior_calls = [c for c in cdr_by_sub[sub] if c.start_time <= ipdr.start_time]
                if prior_calls:
                    closest_prior_cdr = prior_calls[-1]
                    delta = (ipdr.start_time - closest_prior_cdr.start_time).total_seconds() / 60.0
                    closest_delta_min = round(delta, 1)

            correlation_note = "Independent IP Session"
            if closest_prior_cdr and closest_delta_min is not None:
                other_party = (
                    closest_prior_cdr.receiver_num
                    if closest_prior_cdr.caller_num == sub
                    else closest_prior_cdr.caller_num
                )
                correlation_note = (
                    f"Initiated {closest_delta_min}m after GSM call with {other_party} "
                    f"at sector {closest_prior_cdr.tower_id or 'Jaipur'}"
                )

            evidence_ref = f"{ipdr.source_file or 'telecom_ipdr.csv'}#L{ipdr.row_number or (idx + 1)}"

            priority_sessions.append({
                "session_id": f"VOIP-{session_id_counter:03d}",
                "subscriber_num": ipdr.subscriber_num,
                "service_hint": ipdr.service_hint or cat,
                "app_category": cat,
                "sub_type": c_info["sub_type"],
                "is_voip": c_info["is_voip"],
                "is_darkweb": c_info["is_darkweb"],
                "public_ip": ipdr.public_ip,
                "source_port": ipdr.source_port,
                "dest_ip": ipdr.dest_ip,
                "start_time": ipdr.start_time.isoformat() if ipdr.start_time else None,
                "end_time": ipdr.end_time.isoformat() if ipdr.end_time else None,
                "duration_sec": dur_sec,
                "threat_level": c_info["threat_level"],
                "evidence_ref": evidence_ref,
                "correlation_note": correlation_note,
                "prior_cdr_ref": (
                    f"{closest_prior_cdr.source_file}#L{closest_prior_cdr.row_number}"
                    if closest_prior_cdr and getattr(closest_prior_cdr, "source_file", None)
                    else None
                ),
            })
            session_id_counter += 1

    # 4. Cellular Silence & Data Surge Anomalies
    # Identify windows where a suspect had 0 GSM calls for >= 3 hours or overnight, but had IPDR activity
    silence_incidents = []
    silence_id_counter = 1

    # Group IPDR by subscriber
    ipdr_by_sub = defaultdict(list)
    for idx, r in enumerate(filtered_ipdr):
        if r.subscriber_num and r.start_time:
            ipdr_by_sub[r.subscriber_num].append((r, idx))

    for sub, ipdr_list in ipdr_by_sub.items():
        ipdr_list.sort(key=lambda x: x[0].start_time)
        cdrs = cdr_by_sub.get(sub, [])
        if not cdrs:
            continue

        # Check gaps between consecutive CDRs
        for i in range(len(cdrs) - 1):
            t_a = cdrs[i].start_time
            t_b = cdrs[i + 1].start_time
            gap_sec = (t_b - t_a).total_seconds()
            gap_hours = gap_sec / 3600.0

            # Gap >= 3.0 hours
            if gap_hours >= 3.0:
                # Find IPDR sessions in this gap
                sessions_in_gap = [
                    (ip, idx) for (ip, idx) in ipdr_list
                    if t_a < ip.start_time < t_b
                ]
                if sessions_in_gap:
                    apps = list(set(
                        classify_ipdr(ip.service_hint, ip.dest_ip, ip.source_port)["category"]
                        for (ip, _) in sessions_in_gap
                    ))
                    has_v = any("voip" in (ip.service_hint or "").lower() for (ip, _) in sessions_in_gap)
                    has_d = any(classify_ipdr(ip.service_hint, ip.dest_ip, ip.source_port)["is_darkweb"] for (ip, _) in sessions_in_gap)

                    evidence_refs = [
                        f"{ip.source_file or 'telecom_ipdr.csv'}#L{ip.row_number or (idx + 1)}"
                        for (ip, idx) in sessions_in_gap[:4]
                    ]
                    flanking_cdr_refs = [
                        f"{cdrs[i].source_file}#L{cdrs[i].row_number}",
                        f"{cdrs[i+1].source_file}#L{cdrs[i+1].row_number}",
                    ]

                    silence_incidents.append({
                        "incident_id": f"SILENCE-{silence_id_counter:03d}",
                        "subscriber_num": sub,
                        "silence_start": t_a.isoformat(),
                        "silence_end": t_b.isoformat(),
                        "duration_hours": round(gap_hours, 1),
                        "ipdr_session_count": len(sessions_in_gap),
                        "apps_used": apps,
                        "has_voip": has_v,
                        "has_darkweb": has_d,
                        "threat_level": "CRITICAL" if (has_v or has_d) else ("HIGH" if len(sessions_in_gap) >= 3 else "ELEVATED"),
                        "evidence_refs": evidence_refs,
                        "flanking_cdr_refs": flanking_cdr_refs,
                    })
                    silence_id_counter += 1

    silence_incidents.sort(key=lambda x: (x["threat_level"] != "CRITICAL", -x["ipdr_session_count"]))

    # 5. Multi-Modal Unified Chronological Timeline (Unified Co-Occurrence Feed)
    # Merges key CDR and IPDR events chronologically
    multimodal_events = []
    evt_counter = 1

    # Select priority events: all priority VoIP/DarkWeb sessions, flanking CDR calls, and sample data events
    priority_subscribers = set(p["subscriber_num"] for p in priority_sessions if p["subscriber_num"])
    if not priority_subscribers and filtered_ipdr:
        priority_subscribers = set(list(ipdr_by_sub.keys())[:5])

    # Add CDR events
    for c in filtered_cdr:
        if c.start_time and (c.caller_num in priority_subscribers or c.receiver_num in priority_subscribers):
            multimodal_events.append({
                "event_id": f"EVT-{evt_counter:04d}",
                "stream": "CDR",
                "event_type": "GSM_VOICE" if (c.duration_sec or 0) > 0 else "GSM_MISSED",
                "timestamp": c.start_time.isoformat(),
                "end_time": None,
                "duration_sec": c.duration_sec or 0,
                "actor": c.caller_num,
                "counterpart": c.receiver_num,
                "service_label": "GSM Voice Call" if (c.duration_sec or 0) > 0 else "Missed Call / Beacon",
                "channel": "Cellular Tower Airtime",
                "network_locator": c.tower_id or "Jaipur Sector",
                "threat_level": "NORMAL" if (c.duration_sec or 0) > 0 else "ELEVATED",
                "evidence_ref": f"{c.source_file}#L{c.row_number}",
            })
            evt_counter += 1

    # Add IPDR events
    for idx, ip in enumerate(filtered_ipdr):
        if ip.start_time and (ip.subscriber_num in priority_subscribers):
            c_info = classify_ipdr(ip.service_hint, ip.dest_ip, ip.source_port)
            dur = 0
            if ip.start_time and ip.end_time:
                dur = max(0, int((ip.end_time - ip.start_time).total_seconds()))

            multimodal_events.append({
                "event_id": f"EVT-{evt_counter:04d}",
                "stream": "IPDR",
                "event_type": (
                    "IPDR_VOIP" if c_info["is_voip"]
                    else ("IPDR_DARKWEB" if c_info["is_darkweb"] else "IPDR_DATA")
                ),
                "timestamp": ip.start_time.isoformat(),
                "end_time": ip.end_time.isoformat() if ip.end_time else None,
                "duration_sec": dur,
                "actor": ip.subscriber_num,
                "counterpart": ip.dest_ip or "Unknown IP",
                "service_label": ip.service_hint or c_info["category"],
                "channel": f"IP Data ({c_info['category']})",
                "network_locator": f"{ip.dest_ip or 'Remote IP'}:{ip.source_port or 443}",
                "threat_level": c_info["threat_level"],
                "evidence_ref": f"{ip.source_file or 'telecom_ipdr.csv'}#L{ip.row_number or (idx + 1)}",
            })
            evt_counter += 1

    multimodal_events.sort(key=lambda x: x["timestamp"])

    # 6. App Breakdown Summary
    app_breakdown = []
    for cat, count in app_category_counts.items():
        top_ips = sorted(app_dest_ips[cat].items(), key=lambda x: x[1], reverse=True)[:3]
        app_breakdown.append({
            "category": cat,
            "session_count": count,
            "distinct_subscribers": len(app_category_subs[cat]),
            "is_encrypted": cat not in ("General Internet",),
            "is_voip": cat in ("Telegram", "WhatsApp", "VoIP / OTT Voice"),
            "top_ips": [{"ip": ip, "count": c} for ip, c in top_ips],
        })
    app_breakdown.sort(key=lambda x: x["session_count"], reverse=True)

    # 7. Suspect IPDR Dossiers
    suspect_dossiers = []
    all_subs = set(ipdr_by_sub.keys()) | set(cdr_by_sub.keys())
    for sub in all_subs:
        if not sub:
            continue
        ipdr_recs = ipdr_by_sub.get(sub, [])
        cdr_recs = cdr_by_sub.get(sub, [])
        if not ipdr_recs and not cdr_recs:
            continue

        voip_count = sum(1 for (r, _) in ipdr_recs if classify_ipdr(r.service_hint, r.dest_ip, r.source_port)["is_voip"])
        dark_count = sum(1 for (r, _) in ipdr_recs if classify_ipdr(r.service_hint, r.dest_ip, r.source_port)["is_darkweb"])
        app_counts = Counter(classify_ipdr(r.service_hint, r.dest_ip, r.source_port)["category"] for (r, _) in ipdr_recs)
        primary_apps = [app for app, _ in app_counts.most_common(3)]
        sub_silence = sum(1 for s in silence_incidents if s["subscriber_num"] == sub)

        sample_ev = [
            f"{r.source_file or 'telecom_ipdr.csv'}#L{r.row_number or (idx + 1)}"
            for (r, idx) in ipdr_recs[:3]
        ]

        risk_rating = "STANDARD"
        if voip_count > 0 or dark_count > 0:
            risk_rating = "CRITICAL"
        elif sub_silence > 0 or len(ipdr_recs) >= 15:
            risk_rating = "HIGH"
        elif len(ipdr_recs) > 0:
            risk_rating = "ELEVATED"

        suspect_dossiers.append({
            "subscriber_num": sub,
            "total_cdr_calls": len(cdr_recs),
            "total_ipdr_sessions": len(ipdr_recs),
            "voip_calls_count": voip_count,
            "darkweb_sessions_count": dark_count,
            "primary_apps": primary_apps,
            "silence_incidents_count": sub_silence,
            "risk_rating": risk_rating,
            "sample_evidence": sample_ev,
        })

    suspect_dossiers.sort(key=lambda x: (
        x["risk_rating"] != "CRITICAL",
        x["risk_rating"] != "HIGH",
        -x["voip_calls_count"],
        -x["total_ipdr_sessions"]
    ))

    # Overall Summary
    total_ipdr = len(filtered_ipdr)
    total_cdr = len(filtered_cdr)
    common_subs = len(set(ipdr_by_sub.keys()) & set(cdr_by_sub.keys()))
    total_voip = len(priority_sessions)
    total_silence = len(silence_incidents)

    overall_risk = "CRITICAL" if total_voip > 0 or any(p["is_darkweb"] for p in priority_sessions) else "ELEVATED"

    return {
        "summary": {
            "total_cdr_records": total_cdr,
            "total_ipdr_records": total_ipdr,
            "correlated_subscribers": common_subs,
            "voip_sessions_count": total_voip,
            "darkweb_sessions_count": sum(1 for p in priority_sessions if p["is_darkweb"]),
            "cellular_silence_incidents_count": total_silence,
            "risk_level": overall_risk,
            "top_target_suspect": suspect_dossiers[0]["subscriber_num"] if suspect_dossiers else "None",
        },
        "app_breakdown": app_breakdown,
        "priority_sessions": priority_sessions,
        "cellular_silence_incidents": silence_incidents[:25],
        "multimodal_timeline": multimodal_events[:150],
        "suspect_dossiers": suspect_dossiers[:35],
    }

