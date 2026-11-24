import os
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# Auto-load .env file if present
def _load_env():
    env_paths = [
        Path(__file__).resolve().parent.parent / ".env",
        Path(__file__).resolve().parent / ".env",
        Path(".env").resolve(),
    ]
    for p in env_paths:
        if p.exists():
            with open(p, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if k and k not in os.environ:
                            os.environ[k] = v
            break

_load_env()

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

try:
    from backend.database import AuditLog, Case, CellTower, CDRRecord, IPDRRecord, get_db, init_db
    from backend.routers.ai_assistant import router as ai_router
    from backend.routers.analytics import router as analytics_router
    from backend.routers.reports import router as reports_router
    from backend.routers.upload import router as upload_router
    from backend.routers.ai_assistant import AskRequest, AskResponse, router as ai_router
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
    from database import AuditLog, Case, CellTower, CDRRecord, IPDRRecord, get_db, init_db
    from routers.ai_assistant import router as ai_router
    from routers.analytics import router as analytics_router
    from routers.reports import router as reports_router
    from routers.upload import router as upload_router
    from routers.ai_assistant import AskRequest, AskResponse, router as ai_router
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Auto-seed if database is empty
    try:
        from seed_data import seed_database
        seed_database()
    except Exception as e:
        print(f"Startup seed notice: {e}")
    yield


app = FastAPI(
    title="Rajasthan Police CDR/IPDR Intelligence Platform API",
    description="Unified Forensic Intelligence API for Call Detail Records & IP Detail Records Analysis",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core Routers
app.include_router(upload_router, prefix="/api/upload", tags=["upload"])
app.include_router(analytics_router, prefix="/api/cases", tags=["analytics"])
app.include_router(analytics_router, prefix="/api/analytics", tags=["analytics"])
app.include_router(reports_router, prefix="/api/cases", tags=["reports"])
app.include_router(reports_router, prefix="/api", tags=["reports"])
app.include_router(ai_router, prefix="/api/ai", tags=["ai"])


# =====================================================================
# Request & Response Schemas
# =====================================================================

class CaseCreate(BaseModel):
    case_name: str


class CaseResponse(BaseModel):
    id: int
    case_name: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    user_role: Optional[str] = None
    action: str
    query_text: Optional[str] = None
    timestamp: Optional[datetime] = None

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    query: str = Field(..., description="Natural language investigative query.")
    case_id: Optional[int] = 1


# =====================================================================
# General System Endpoints
# =====================================================================

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "Rajasthan Police CDR/IPDR Intelligence Platform",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post("/api/load-demo")
def trigger_load_demo():
    try:
        from seed_data import seed_database
        seed_database()
        return {"status": "success", "message": "Demo forensic dataset loaded and indexed."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/cases", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
def create_case(case: CaseCreate, db: Session = Depends(get_db)):
    db_case = Case(case_name=case.case_name)
    db.add(db_case)
    db.commit()
    db.refresh(db_case)
    return db_case


@app.get("/api/cases", response_model=List[CaseResponse])
def list_cases(db: Session = Depends(get_db)):
    return db.query(Case).all()


@app.get("/api/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    return db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()


# =====================================================================
# Active Case Top-Level Convenience Endpoints (Compatible with both frontends)
# =====================================================================

@app.get("/api/stats")
def get_stats(case_id: int = 1, db: Session = Depends(get_db)):
    """Returns high-level forensic dashboard metrics."""
    total_cdr = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).count()
    total_ipdr = db.query(IPDRRecord).filter(IPDRRecord.case_id == case_id).count()
    total_towers = db.query(CellTower).count()

    # Calculate active numbers
    records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
    top_contacts = get_top_contacts(records)[:10]

    # Detect anomalies count
    anomalies = detect_imei_sim_changes(records)

    return {
        "case_id": case_id,
        "total_cdr_records": total_cdr,
        "total_ipdr_records": total_ipdr,
        "total_cell_towers": total_towers,
        "total_anomalies": len(anomalies),
        "top_active_numbers": top_contacts,
        "status": "ACTIVE_INVESTIGATION",
    }


@app.get("/api/graph")
def get_graph(case_id: int = 1, db: Session = Depends(get_db)):
    """Returns communication network graph with nodes and edges."""
    records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
    return build_network_graph(records)


@app.get("/api/suspicious-patterns")
@app.get("/api/patterns")
def get_suspicious_patterns(
    case_id: int = 1,
    phone_number: Optional[str] = Query(None),
    burst_window_minutes: int = Query(20, ge=5, le=60),
    burst_min_calls: int = Query(3, ge=2, le=20),
    db: Session = Depends(get_db),
):
    """Detects late-night calling bursts, high-frequency calling storms, and short-duration ping signaling."""
    target_num = clean_phone_number(phone_number) if phone_number else None
    towers = db.query(CellTower).all()
    towers_map = {t.tower_id: f"{t.address} ({t.operator or 'Telecom'})" for t in towers if t.tower_id}
    records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
    return analyze_suspicious_patterns(
        records,
        phone_number=target_num,
        towers_map=towers_map,
        burst_window_minutes=burst_window_minutes,
        burst_min_calls=burst_min_calls,
    )


@app.get("/api/ipdr-correlation")
def get_ipdr_correlation(
    case_id: int = 1,
    phone_number: Optional[str] = Query(None),
    window_minutes: int = Query(15, ge=5, le=60),
    db: Session = Depends(get_db),
):
    """Correlates GSM cellular CDRs with IPDR data, classifying WhatsApp VoIP, Telegram Voice, DarkWeb/Tor, and cellular silence."""
    target_num = clean_phone_number(phone_number) if phone_number else None
    cdr_records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
    ipdr_records = db.query(IPDRRecord).filter(IPDRRecord.case_id == case_id).all()
    return correlate_ipdr_cdr(
        cdr_records=cdr_records,
        ipdr_records=ipdr_records,
        phone_number=target_num,
        window_minutes=window_minutes,
    )


@app.get("/api/voip-sessions")
def get_voip_sessions(
    case_id: int = 1,
    phone_number: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Returns high-risk VoIP sessions, Tor/DarkWeb proxy events, and Section 65B citations."""
    target_num = clean_phone_number(phone_number) if phone_number else None
    cdr_records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
    ipdr_records = db.query(IPDRRecord).filter(IPDRRecord.case_id == case_id).all()
    res = correlate_ipdr_cdr(
        cdr_records=cdr_records,
        ipdr_records=ipdr_records,
        phone_number=target_num,
    )
    return {
        "case_id": case_id,
        "phone_number": target_num,
        "total_voip_sessions": len(res["priority_sessions"]),
        "sessions": res["priority_sessions"],
    }


@app.get("/api/anomalies")
def get_anomalies(case_id: int = 1, db: Session = Depends(get_db)):
    """Returns IMEI anomalies, device swaps, and burner phone alerts."""
    towers = db.query(CellTower).all()
    towers_map = {t.tower_id: f"{t.address} ({t.operator or 'Telecom'})" for t in towers if t.tower_id}
    records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
    return detect_imei_sim_changes(records, towers_map=towers_map)


@app.get("/api/hardware-tracker")
def get_hardware_tracker(case_id: int = 1, db: Session = Depends(get_db)):
    """Returns comprehensive multi-SIM and hardware swap analytics with TAC device identification."""
    towers = db.query(CellTower).all()
    towers_map = {t.tower_id: f"{t.address} ({t.operator or 'Telecom'})" for t in towers if t.tower_id}
    records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
    return analyze_hardware_tracker(records, towers_map=towers_map)


@app.get("/api/timeline/{phone_num}")
def get_timeline(phone_num: str, case_id: int = 1, db: Session = Depends(get_db)):
    """Returns chronological tower coordinates and metadata for a given phone number."""
    target_num = clean_phone_number(phone_num) or phone_num

    query = (
        db.query(CDRRecord, CellTower)
        .outerjoin(CellTower, CDRRecord.tower_id == CellTower.tower_id)
        .filter(CDRRecord.case_id == case_id)
        .filter(
            (CDRRecord.caller_num == target_num) | (CDRRecord.receiver_num == target_num)
        )
        .order_by(CDRRecord.start_time.asc())
    )

    results = query.all()
    sequence = []
    for cdr, tower in results:
        sequence.append({
            "timestamp": cdr.start_time.isoformat() if cdr.start_time else None,
            "record_id": f"CDR-{cdr.id}",
            "caller_num": cdr.caller_num,
            "receiver_num": cdr.receiver_num,
            "call_type": cdr.call_type,
            "duration_sec": cdr.duration_sec,
            "imei": cdr.imei,
            "tower_id": cdr.tower_id,
            "latitude": tower.latitude if tower else 26.9124,
            "longitude": tower.longitude if tower else 75.7873,
            "area_name": tower.address if tower else "Jaipur Sector",
            "source_file": cdr.source_file,
            "row_number": cdr.row_number,
        })
    return sequence


@app.get("/api/movement-trail")
@app.get("/api/movement-trail/{phone_num}")
def get_movement_trail(
    phone_num: Optional[str] = None,
    phone_number: Optional[str] = Query(None),
    case_id: int = 1,
    db: Session = Depends(get_db)
):
    """Returns chronological movement trail with distance, implied velocity, and impossible travel alerts."""
    num = phone_num or phone_number or "9829011111"
    target_num = clean_phone_number(num) or num
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
    return reconstruct_movement_trail(records, target_num, towers_map)


@app.get("/api/co-location")
def get_co_location(
    num1: Optional[str] = Query(None),
    num2: Optional[str] = Query(None),
    suspects: Optional[str] = Query(None),
    window_minutes: int = Query(30, ge=1, le=1440),
    case_id: int = 1,
    db: Session = Depends(get_db),
):
    """Detects physical meeting / co-location events where multiple suspects were present at the same cell site."""
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
    return {
        "case_id": case_id,
        "window_minutes": window_minutes,
        "total_co_locations": len(co_locs),
        "results": co_locs,
    }


@app.get("/api/common-contacts")
def get_common_contacts(
    num1: Optional[str] = Query(None),
    num2: Optional[str] = Query(None),
    suspects: Optional[str] = Query(None),
    case_id: int = 1,
    db: Session = Depends(get_db),
):
    """Detects common contacts between suspect phone numbers."""
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

    if len(suspect_list) < 2:
        # Fallback to suspect alpha & beta
        suspect_list = ["9829011111", "9829933333"]

    records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
    shared = find_common_contacts(suspect_list, records)
    return {
        "case_id": case_id,
        "suspects": suspect_list,
        "common_contacts_count": len(shared),
        "common_contacts": shared,
    }


@app.get("/api/network-graph")
def get_network_graph(
    case_id: int = 1,
    min_calls: int = Query(1, ge=1),
    phone_number: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Calculates network topology with degree/betweenness centrality, bridge nodes, communities, and 2D layout."""
    records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
    cleaned_num = clean_phone_number(phone_number) if phone_number else None
    res = build_network_graph(records, min_calls=min_calls, phone_filter=cleaned_num)
    return {
        "case_id": case_id,
        **res,
    }


@app.get("/api/shortest-path")
def get_shortest_path(
    source: Optional[str] = Query(None),
    target: Optional[str] = Query(None),
    source_number: Optional[str] = Query(None),
    target_number: Optional[str] = Query(None),
    case_id: int = 1,
    db: Session = Depends(get_db),
):
    """Finds the shortest communication path and degrees of separation between two suspects."""
    src_raw = source or source_number or ""
    tgt_raw = target or target_number or ""
    src = clean_phone_number(src_raw) or src_raw
    tgt = clean_phone_number(tgt_raw) or tgt_raw
    records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
    res = find_shortest_path(src, tgt, records)
    return {
        "case_id": case_id,
        **res,
    }


@app.post("/api/chat")
def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    """Translates natural language questions into evidence-backed AI answers with citations."""
    try:
        from backend.routers.ai_assistant import ask_ai, AskRequest
    except ImportError:
        from routers.ai_assistant import ask_ai, AskRequest

    req = AskRequest(
        case_id=request.case_id or 1,
        question=request.query,
        user_role="investigator"
    )
    res = ask_ai(req=req, db=db)
    return {
        "query": request.query,
        "intent": res.intent,
        "answer": res.answer,
        "evidence_records": res.evidence,
        "disclaimer": res.disclaimer
    }


# =====================================================================
# Serve Frontend Assets (Single Combined Deployment)
# =====================================================================

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Don't intercept API routes
        if full_path.startswith("api/") or full_path == "health" or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            raise HTTPException(status_code=404, detail="API route not found")

        file_candidate = FRONTEND_DIST / full_path
        if file_candidate.is_file():
            return FileResponse(file_candidate)

        index_file = FRONTEND_DIST / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"status": "Frontend dist found, but index.html missing."}
