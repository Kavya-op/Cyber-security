from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

try:
    from backend.database import Case, CellTower, CDRRecord, IPDRRecord, get_db, log_audit_entry
    from backend.services.graph_engine import (
        analyze_hardware_tracker,
        analyze_suspicious_patterns,
        build_network_graph,
        correlate_ipdr_cdr,
        detect_co_locations,
        detect_imei_sim_changes,
        find_common_contacts,
        find_shortest_path,
        get_top_contacts,
        reconstruct_movement_trail,
    )
    from backend.services.normalizer import clean_phone_number
except ImportError:
    from database import Case, CellTower, CDRRecord, IPDRRecord, get_db, log_audit_entry
    from services.graph_engine import (
        analyze_hardware_tracker,
        analyze_suspicious_patterns,
        build_network_graph,
        correlate_ipdr_cdr,
        detect_co_locations,
        detect_imei_sim_changes,
        find_common_contacts,
        find_shortest_path,
        get_top_contacts,
        reconstruct_movement_trail,
    )
    from services.normalizer import clean_phone_number

router = APIRouter()


@router.get("/{case_id}/top-contacts")
def top_contacts(
    case_id: int,
    phone_number: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    target_num = clean_phone_number(phone_number) if phone_number else None
    log_audit_entry(
        db,
        action="ANALYTICS_TOP_CONTACTS",
        query_text=f"case_id={case_id}, phone={target_num}",
    )

    query = db.query(CDRRecord).filter(CDRRecord.case_id == case_id)
    if target_num:
        query = query.filter(
            (CDRRecord.caller_num == target_num) | (CDRRecord.receiver_num == target_num)
        )

    records = query.all()
    contacts = get_top_contacts(records, phone_number=target_num)
    return {
        "case_id": case_id,
        "phone_number": target_num,
        "total_contacts": len(contacts),
        "contacts": contacts,
    }


@router.get("/{case_id}/common-contacts")
def common_contacts(
    case_id: int,
    suspects: str = Query(..., description="Comma-separated phone numbers, e.g. 9876543210,9988776655"),
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    raw_list = [s.strip() for s in suspects.split(",") if s.strip()]
    suspect_list = []
    for s in raw_list:
        cleaned = clean_phone_number(s) or s
        if cleaned not in suspect_list:
            suspect_list.append(cleaned)

    if not suspect_list:
        raise HTTPException(status_code=400, detail="Please provide at least one valid suspect phone number")

    log_audit_entry(
        db,
        action="ANALYTICS_COMMON_CONTACTS",
        query_text=f"case_id={case_id}, suspects={','.join(suspect_list)}",
    )

    records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
    shared = find_common_contacts(suspect_list, records)
    return {
        "case_id": case_id,
        "suspects": suspect_list,
        "common_contacts_count": len(shared),
        "common_contacts": shared,
    }


@router.get("/{case_id}/network-graph")
def network_graph(
    case_id: int,
    min_calls: int = Query(1, ge=1),
    phone_number: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    target_num = clean_phone_number(phone_number) if phone_number else None
    log_audit_entry(
        db,
        action="ANALYTICS_NETWORK_GRAPH",
        query_text=f"case_id={case_id}, min_calls={min_calls}, phone={target_num}",
    )

    records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
    graph_data = build_network_graph(records, min_calls=min_calls, phone_filter=target_num)
    return {
        "case_id": case_id,
        **graph_data,
    }


@router.get("/{case_id}/shortest-path")
def shortest_path(
    case_id: int,
    source: str = Query(..., description="Source phone number"),
    target: str = Query(..., description="Target phone number"),
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    src = clean_phone_number(source) or source
    tgt = clean_phone_number(target) or target

    log_audit_entry(
        db,
        action="ANALYTICS_SHORTEST_PATH",
        query_text=f"case_id={case_id}, source={src}, target={tgt}",
    )

    records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
    res = find_shortest_path(src, tgt, records)
    return {
        "case_id": case_id,
        **res,
    }


@router.get("/{case_id}/tower-timeline")
def tower_timeline(
    case_id: int,
    phone_number: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    target_num = clean_phone_number(phone_number) if phone_number else None
    log_audit_entry(
        db,
        action="ANALYTICS_TOWER_TIMELINE",
        query_text=f"case_id={case_id}, phone={target_num}",
    )

    query = (
        db.query(CDRRecord, CellTower)
        .outerjoin(CellTower, CDRRecord.tower_id == CellTower.tower_id)
        .filter(CDRRecord.case_id == case_id)
        .filter(CDRRecord.tower_id.isnot(None))
    )

    if target_num:
        query = query.filter(
            (CDRRecord.caller_num == target_num) | (CDRRecord.receiver_num == target_num)
        )

    results = query.order_by(CDRRecord.start_time.asc()).all()

    timeline = []
    for cdr, tower in results:
        timeline.append(
            {
                "start_time": cdr.start_time.isoformat() if cdr.start_time else None,
                "tower_id": cdr.tower_id,
                "latitude": tower.latitude if tower else None,
                "longitude": tower.longitude if tower else None,
                "address": tower.address if tower else None,
                "operator": tower.operator if tower else None,
                "source_file": cdr.source_file,
                "row_number": cdr.row_number,
                "caller_num": cdr.caller_num,
                "receiver_num": cdr.receiver_num,
            }
        )

    return {
        "case_id": case_id,
        "phone_number": target_num,
        "total_records": len(timeline),
        "timeline": timeline,
    }


@router.get("/{case_id}/imei-sim-changes")
def imei_sim_changes(
    case_id: int,
    phone_number: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    target_num = clean_phone_number(phone_number) if phone_number else None
    log_audit_entry(
        db,
        action="ANALYTICS_IMEI_SIM_CHANGES",
        query_text=f"case_id={case_id}, phone={target_num}",
    )

    query = db.query(CDRRecord).filter(CDRRecord.case_id == case_id)
    if target_num:
        query = query.filter(
            (CDRRecord.caller_num == target_num) | (CDRRecord.receiver_num == target_num)
        )

    records = query.all()
    towers = db.query(CellTower).all()
    towers_map = {t.tower_id: f"{t.address} ({t.operator or 'Telecom'})" for t in towers if t.tower_id}

    changes = detect_imei_sim_changes(records, phone_number=target_num, towers_map=towers_map)

    return {
        "case_id": case_id,
        "phone_number": target_num,
        "total_detected": len(changes),
        "results": changes,
    }


@router.get("/{case_id}/hardware-tracker")
def hardware_tracker(
    case_id: int,
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    towers = db.query(CellTower).all()
    towers_map = {t.tower_id: f"{t.address} ({t.operator or 'Telecom'})" for t in towers if t.tower_id}

    records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
    result = analyze_hardware_tracker(records, towers_map=towers_map)
    return {
        "case_id": case_id,
        **result,
    }


@router.get("/{case_id}/ipdr-analysis")
def ipdr_analysis(
    case_id: int,
    phone_number: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    target_num = clean_phone_number(phone_number) if phone_number else None
    log_audit_entry(
        db,
        action="ANALYTICS_IPDR",
        query_text=f"case_id={case_id}, phone={target_num}",
    )

    ipdr_query = db.query(IPDRRecord).filter(IPDRRecord.case_id == case_id)
    if target_num:
        ipdr_query = ipdr_query.filter(IPDRRecord.subscriber_num == target_num)
    ipdr_records = ipdr_query.order_by(IPDRRecord.start_time.asc()).all()

    cdr_query = db.query(CDRRecord).filter(CDRRecord.case_id == case_id)
    if target_num:
        cdr_query = cdr_query.filter(
            (CDRRecord.caller_num == target_num) | (CDRRecord.receiver_num == target_num)
        )
    cdr_records = cdr_query.all()

    sessions = []
    for r in ipdr_records:
        correlated = []
        if r.start_time:
            time_start = r.start_time - timedelta(minutes=10)
            time_end = (r.end_time or r.start_time) + timedelta(minutes=10)

            for c in cdr_records:
                if c.start_time and time_start <= c.start_time <= time_end:
                    if not target_num and r.subscriber_num:
                        if c.caller_num != r.subscriber_num and c.receiver_num != r.subscriber_num:
                            continue
                    correlated.append(
                        {
                            "id": c.id,
                            "start_time": c.start_time.isoformat() if c.start_time else None,
                            "caller_num": c.caller_num,
                            "receiver_num": c.receiver_num,
                            "call_type": c.call_type,
                            "duration_sec": c.duration_sec,
                            "tower_id": c.tower_id,
                        }
                    )

        sessions.append(
            {
                "id": r.id,
                "subscriber_num": r.subscriber_num,
                "public_ip": r.public_ip,
                "source_port": r.source_port,
                "dest_ip": r.dest_ip,
                "start_time": r.start_time.isoformat() if r.start_time else None,
                "end_time": r.end_time.isoformat() if r.end_time else None,
                "service_hint": r.service_hint,
                "source_file": r.source_file,
                "row_number": r.row_number,
                "correlated_cdr_count": len(correlated),
                "correlated_cdr": correlated,
            }
        )

    return {
        "case_id": case_id,
        "phone_number": target_num,
        "total_sessions": len(sessions),
        "sessions": sessions,
    }


@router.get("/{case_id}/movement-trail/{phone_num}")
def movement_trail(
    case_id: int,
    phone_num: str,
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    target_num = clean_phone_number(phone_num) or phone_num
    log_audit_entry(
        db,
        action="ANALYTICS_MOVEMENT_TRAIL",
        query_text=f"case_id={case_id}, phone={target_num}",
    )

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

    records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
    trail = reconstruct_movement_trail(records, target_num, towers_map)
    return {
        "case_id": case_id,
        **trail,
    }


@router.get("/{case_id}/co-location")
def co_location_analysis(
    case_id: int,
    num1: Optional[str] = Query(None),
    num2: Optional[str] = Query(None),
    suspects: Optional[str] = Query(None),
    window_minutes: int = Query(30, ge=1, le=1440),
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    suspect_list = []
    if suspects:
        for s in suspects.split(","):
            c = clean_phone_number(s.strip()) or s.strip()
            if c and c not in suspect_list:
                suspect_list.append(c)
    if num1:
        c1 = clean_phone_number(num1) or num1
        if c1 not in suspect_list:
            suspect_list.append(c1)
    if num2:
        c2 = clean_phone_number(num2) or num2
        if c2 not in suspect_list:
            suspect_list.append(c2)

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

    records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
    co_locs = detect_co_locations(
        records,
        towers_map,
        window_minutes=window_minutes,
        suspect_numbers=suspect_list if suspect_list else None,
    )

    log_audit_entry(
        db,
        action="ANALYTICS_CO_LOCATION",
        query_text=f"case_id={case_id}, suspects={suspect_list}, window={window_minutes}m, matches={len(co_locs)}",
    )

    return {
        "case_id": case_id,
        "window_minutes": window_minutes,
        "suspects_queried": suspect_list,
        "total_co_locations": len(co_locs),
        "results": co_locs,
    }


@router.get("/{case_id}/suspicious-patterns")
@router.get("/{case_id}/patterns")
def suspicious_patterns(
    case_id: int,
    phone_number: Optional[str] = Query(None),
    burst_window_minutes: int = Query(20, ge=5, le=60),
    burst_min_calls: int = Query(3, ge=2, le=20),
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    target_num = clean_phone_number(phone_number) if phone_number else None
    log_audit_entry(
        db,
        action="ANALYTICS_SUSPICIOUS_PATTERNS",
        query_text=f"case_id={case_id}, phone={target_num}, window={burst_window_minutes}m",
    )

    towers = db.query(CellTower).all()
    towers_map = {
        t.tower_id: f"{t.address} ({t.operator or 'Telecom'})" for t in towers if t.tower_id
    }
    records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
    patterns = analyze_suspicious_patterns(
        records,
        phone_number=target_num,
        towers_map=towers_map,
        burst_window_minutes=burst_window_minutes,
        burst_min_calls=burst_min_calls,
    )
    return {
        "case_id": case_id,
        "phone_number": target_num,
        **patterns,
    }


@router.get("/{case_id}/ipdr-correlation")
def ipdr_correlation(
    case_id: int,
    phone_number: Optional[str] = Query(None),
    window_minutes: int = Query(15, ge=5, le=60),
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    target_num = clean_phone_number(phone_number) if phone_number else None
    log_audit_entry(
        db,
        action="ANALYTICS_IPDR_CORRELATION",
        query_text=f"case_id={case_id}, phone={target_num}, window={window_minutes}m",
    )

    cdr_records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
    ipdr_records = db.query(IPDRRecord).filter(IPDRRecord.case_id == case_id).all()

    correlation = correlate_ipdr_cdr(
        cdr_records=cdr_records,
        ipdr_records=ipdr_records,
        phone_number=target_num,
        window_minutes=window_minutes,
    )
    return {
        "case_id": case_id,
        "phone_number": target_num,
        **correlation,
    }


@router.get("/{case_id}/voip-sessions")
def voip_sessions(
    case_id: int,
    phone_number: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    target_num = clean_phone_number(phone_number) if phone_number else None
    cdr_records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
    ipdr_records = db.query(IPDRRecord).filter(IPDRRecord.case_id == case_id).all()

    correlation = correlate_ipdr_cdr(
        cdr_records=cdr_records,
        ipdr_records=ipdr_records,
        phone_number=target_num,
    )
    return {
        "case_id": case_id,
        "phone_number": target_num,
        "total_voip_sessions": len(correlation["priority_sessions"]),
        "sessions": correlation["priority_sessions"],
    }

