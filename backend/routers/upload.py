from datetime import datetime
import io
import json
from typing import Optional
import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

try:
    from backend.database import Case, CellTower, CDRRecord, IPDRRecord, get_db, log_audit_entry
    from backend.services.normalizer import (
        CDR_CANONICAL_FIELDS,
        IPDR_CANONICAL_FIELDS,
        TOWER_CANONICAL_FIELDS,
        clean_duration,
        clean_float,
        clean_identifier,
        clean_int,
        clean_phone_number,
        compute_file_sha256,
        detect_carrier_and_schema,
        map_columns,
        parse_datetime,
        read_tabular_file,
        suggest_mappings,
        validate_dataset,
    )
except ImportError:
    from database import Case, CellTower, CDRRecord, IPDRRecord, get_db, log_audit_entry
    from services.normalizer import (
        CDR_CANONICAL_FIELDS,
        IPDR_CANONICAL_FIELDS,
        TOWER_CANONICAL_FIELDS,
        clean_duration,
        clean_float,
        clean_identifier,
        clean_int,
        clean_phone_number,
        compute_file_sha256,
        detect_carrier_and_schema,
        map_columns,
        parse_datetime,
        read_tabular_file,
        suggest_mappings,
        validate_dataset,
    )

router = APIRouter()


@router.post("/cdr")
async def upload_cdr(
    case_id: int = Form(...),
    file: UploadFile = File(...),
    column_mapping: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    user_mapping = None
    if column_mapping:
        try:
            user_mapping = json.loads(column_mapping)
            if not isinstance(user_mapping, dict):
                raise ValueError()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON string in column_mapping")

    contents = await file.read()
    try:
        lower_name = (file.filename or "").lower()
        if lower_name.endswith((".xlsx", ".xls")):
            df = read_tabular_file(contents, file.filename or "uploaded.xlsx")
        else:
            try:
                df = pd.read_csv(
                    io.BytesIO(contents),
                    index_col=False,
                    quotechar='"',
                    skipinitialspace=True,
                )
            except UnicodeDecodeError:
                df = pd.read_csv(
                    io.BytesIO(contents),
                    encoding="latin-1",
                    index_col=False,
                    quotechar='"',
                    skipinitialspace=True,
                )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    if df.empty:
        return {
            "status": "success",
            "case_id": case_id,
            "filename": file.filename,
            "total_rows": 0,
            "valid_rows": 0,
            "invalid_rows": 0,
            "errors": [],
        }

    df = map_columns(df, CDR_CANONICAL_FIELDS, user_mapping)
    df = df.reset_index(drop=True)

    valid_records = []
    invalid_rows = []

    for row_num, (_, row) in enumerate(df.iterrows(), start=2):
        caller = clean_phone_number(row.get("caller_num"))
        receiver = clean_phone_number(row.get("receiver_num"))
        raw_start = row.get("start_time")
        start_dt = parse_datetime(raw_start)

        reasons = []
        if not caller and not receiver:
            reasons.append("Missing both caller and receiver numbers")
        if raw_start is not None and not (isinstance(raw_start, float) and pd.isna(raw_start)) and start_dt is None:
            reasons.append("Invalid timestamp format")

        if reasons:
            invalid_rows.append({
                "row_number": row_num,
                "reasons": reasons,
                "data": {k: str(v) for k, v in row.to_dict().items() if pd.notna(v)},
            })
        else:
            valid_records.append(
                CDRRecord(
                    case_id=case_id,
                    source_file=file.filename,
                    row_number=row_num,
                    caller_num=caller,
                    receiver_num=receiver,
                    call_type=str(row.get("call_type")).strip() if pd.notna(row.get("call_type")) else None,
                    start_time=start_dt,
                    duration_sec=clean_duration(row.get("duration_sec")),
                    imei=clean_identifier(row.get("imei")),
                    imsi=clean_identifier(row.get("imsi")),
                    tower_id=clean_identifier(row.get("tower_id")),
                )
            )

    if valid_records:
        db.add_all(valid_records)
        db.commit()

    log_audit_entry(
        db,
        action="UPLOAD_CDR",
        query_text=f"case_id={case_id}, file={file.filename}, total={len(df)}, valid={len(valid_records)}",
    )

    return {
        "status": "success",
        "case_id": case_id,
        "filename": file.filename,
        "total_rows": len(df),
        "valid_rows": len(valid_records),
        "invalid_rows": len(invalid_rows),
        "errors": invalid_rows[:50],
    }


@router.post("/ipdr")
async def upload_ipdr(
    case_id: int = Form(...),
    file: UploadFile = File(...),
    column_mapping: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    user_mapping = None
    if column_mapping:
        try:
            user_mapping = json.loads(column_mapping)
            if not isinstance(user_mapping, dict):
                raise ValueError()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON string in column_mapping")

    contents = await file.read()
    try:
        lower_name = (file.filename or "").lower()
        if lower_name.endswith((".xlsx", ".xls")):
            df = read_tabular_file(contents, file.filename or "uploaded.xlsx")
        else:
            try:
                df = pd.read_csv(
                    io.BytesIO(contents),
                    index_col=False,
                    quotechar='"',
                    skipinitialspace=True,
                )
            except UnicodeDecodeError:
                df = pd.read_csv(
                    io.BytesIO(contents),
                    encoding="latin-1",
                    index_col=False,
                    quotechar='"',
                    skipinitialspace=True,
                )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    if df.empty:
        return {
            "status": "success",
            "case_id": case_id,
            "filename": file.filename,
            "total_rows": 0,
            "valid_rows": 0,
            "invalid_rows": 0,
            "errors": [],
        }

    df = map_columns(df, IPDR_CANONICAL_FIELDS, user_mapping)
    df = df.reset_index(drop=True)

    valid_records = []
    invalid_rows = []

    for row_num, (_, row) in enumerate(df.iterrows(), start=2):
        subscriber = clean_phone_number(row.get("subscriber_num")) or clean_identifier(row.get("subscriber_num"))
        pub_ip = clean_identifier(row.get("public_ip"))
        dst_ip = clean_identifier(row.get("dest_ip"))
        start_dt = parse_datetime(row.get("start_time"))
        end_dt = parse_datetime(row.get("end_time"))

        reasons = []
        if not subscriber and not pub_ip and not dst_ip:
            reasons.append("Missing subscriber_num and IP addresses")

        if reasons:
            invalid_rows.append({
                "row_number": row_num,
                "reasons": reasons,
                "data": {k: str(v) for k, v in row.to_dict().items() if pd.notna(v)},
            })
        else:
            valid_records.append(
                IPDRRecord(
                    case_id=case_id,
                    source_file=file.filename,
                    row_number=row_num,
                    subscriber_num=subscriber,
                    public_ip=pub_ip,
                    source_port=clean_int(row.get("source_port")),
                    dest_ip=dst_ip,
                    start_time=start_dt,
                    end_time=end_dt,
                    service_hint=clean_identifier(row.get("service_hint")),
                )
            )

    if valid_records:
        db.add_all(valid_records)
        db.commit()

    log_audit_entry(
        db,
        action="UPLOAD_IPDR",
        query_text=f"case_id={case_id}, file={file.filename}, total={len(df)}, valid={len(valid_records)}",
    )

    return {
        "status": "success",
        "case_id": case_id,
        "filename": file.filename,
        "total_rows": len(df),
        "valid_rows": len(valid_records),
        "invalid_rows": len(invalid_rows),
        "errors": invalid_rows[:50],
    }


@router.post("/towers")
async def upload_towers(
    file: UploadFile = File(...),
    column_mapping: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    user_mapping = None
    if column_mapping:
        try:
            user_mapping = json.loads(column_mapping)
            if not isinstance(user_mapping, dict):
                raise ValueError()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON string in column_mapping")

    contents = await file.read()
    try:
        lower_name = (file.filename or "").lower()
        if lower_name.endswith((".xlsx", ".xls")):
            df = read_tabular_file(contents, file.filename or "uploaded.xlsx")
        else:
            try:
                df = pd.read_csv(
                    io.BytesIO(contents),
                    index_col=False,
                    quotechar='"',
                    skipinitialspace=True,
                )
            except UnicodeDecodeError:
                df = pd.read_csv(
                    io.BytesIO(contents),
                    encoding="latin-1",
                    index_col=False,
                    quotechar='"',
                    skipinitialspace=True,
                )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    if df.empty:
        return {
            "status": "success",
            "filename": file.filename,
            "total_rows": 0,
            "valid_rows": 0,
            "invalid_rows": 0,
            "errors": [],
        }

    df = map_columns(df, TOWER_CANONICAL_FIELDS, user_mapping)
    df = df.reset_index(drop=True)

    valid_towers = []
    invalid_rows = []

    for row_num, (_, row) in enumerate(df.iterrows(), start=2):
        raw_tower_id = row.get("tower_id")
        tower_id = clean_identifier(raw_tower_id)
        if tower_id is not None:
            tower_id = str(tower_id)

        if not tower_id:
            invalid_rows.append({
                "row_number": row_num,
                "reasons": ["Missing tower_id"],
                "data": {k: str(v) for k, v in row.to_dict().items() if pd.notna(v)},
            })
        else:
            tower_obj = CellTower(
                tower_id=tower_id,
                latitude=clean_float(row.get("latitude")),
                longitude=clean_float(row.get("longitude")),
                address=clean_identifier(row.get("address")),
                operator=clean_identifier(row.get("operator")),
            )
            valid_towers.append(tower_obj)

    if valid_towers:
        # Use db.merge to upsert records and avoid UNIQUE constraint errors on duplicate tower_id
        for tower in valid_towers:
            db.merge(tower)
        db.commit()

    sha256_hash = compute_file_sha256(contents)
    log_audit_entry(
        db,
        action="UPLOAD_TOWERS",
        query_text=f"file={file.filename}, sha256={sha256_hash}, total={len(df)}, valid={len(valid_towers)}",
    )

    return {
        "status": "success",
        "filename": file.filename,
        "sha256": sha256_hash,
        "total_rows": len(df),
        "valid_rows": len(valid_towers),
        "invalid_rows": len(invalid_rows),
        "errors": invalid_rows[:50],
    }


@router.post("/inspect")
async def inspect_file(
    file: UploadFile = File(...),
):
    """
    Inspects raw tabular file without committing to DB:
    Calculates SHA-256 hash, extracts column headers, detects carrier,
    and returns suggested mappings with sample values.
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    sha256_hash = compute_file_sha256(contents)
    try:
        df = read_tabular_file(contents, file.filename or "uploaded.csv")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    if df.empty:
        return {
            "status": "empty",
            "filename": file.filename,
            "sha256": sha256_hash,
            "total_rows": 0,
            "headers": [],
            "sample_rows": [],
            "suggested_mapping": {},
        }

    raw_headers = [str(col) for col in df.columns]
    detection = detect_carrier_and_schema(raw_headers)
    schema_type = detection["schema_type"]
    carrier = detection["carrier"]
    suggested = suggest_mappings(raw_headers, schema_type)

    # 5-row sample preview
    sample_rows = []
    for idx, (_, r) in enumerate(df.head(5).iterrows()):
        row_dict = {str(k): (str(v) if pd.notna(v) else "") for k, v in r.to_dict().items()}
        sample_rows.append({"_row_num": idx + 2, **row_dict})

    # Canonical targets metadata
    field_metadata = {
        "cdr": {
            "caller_num": {"label": "Calling Party (A-Party)", "required": True},
            "receiver_num": {"label": "Called Party (B-Party)", "required": True},
            "start_time": {"label": "Call Timestamp / Date-Time", "required": True},
            "duration_sec": {"label": "Duration (Seconds)", "required": False},
            "tower_id": {"label": "Cell Tower ID / First CGI", "required": False},
            "imei": {"label": "Handset IMEI", "required": False},
            "imsi": {"label": "SIM IMSI", "required": False},
            "call_type": {"label": "Call Type (Voice/SMS/Data)", "required": False},
        },
        "ipdr": {
            "subscriber_num": {"label": "Subscriber MSISDN / Phone", "required": True},
            "public_ip": {"label": "Public / Source IP Address", "required": True},
            "source_port": {"label": "Source Port", "required": False},
            "dest_ip": {"label": "Destination / Target IP", "required": False},
            "start_time": {"label": "Session Start Timestamp", "required": True},
            "end_time": {"label": "Session End Timestamp", "required": False},
            "service_hint": {"label": "App / Protocol / Domain", "required": False},
        },
        "towers": {
            "tower_id": {"label": "Cell Tower ID / CGI", "required": True},
            "latitude": {"label": "Site Latitude", "required": True},
            "longitude": {"label": "Site Longitude", "required": True},
            "address": {"label": "Location / Sector Address", "required": False},
            "operator": {"label": "Telecom Operator Circle", "required": False},
        },
    }

    return {
        "status": "success",
        "filename": file.filename,
        "sha256": sha256_hash,
        "file_size_bytes": len(contents),
        "file_size_formatted": f"{len(contents) / 1024:.1f} KB",
        "total_rows": len(df),
        "detected_schema": schema_type,
        "carrier_detected": carrier,
        "headers": raw_headers,
        "suggested_mapping": suggested,
        "sample_rows": sample_rows,
        "field_metadata": field_metadata.get(schema_type, {}),
    }


@router.post("/validate")
async def validate_uploaded_file(
    file: UploadFile = File(...),
    schema_type: str = Form("cdr"),
    column_mapping: Optional[str] = Form(None),
):
    """
    Validates file against mapped schema and returns real-time data quality score
    and row-by-row error report before database commit.
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    sha256_hash = compute_file_sha256(contents)
    user_mapping = None
    if column_mapping:
        try:
            user_mapping = json.loads(column_mapping)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON in column_mapping")

    try:
        df = read_tabular_file(contents, file.filename or "uploaded.csv")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    report = validate_dataset(df, schema_type=schema_type, user_mapping=user_mapping)
    return {
        "status": "success",
        "filename": file.filename,
        "sha256": sha256_hash,
        "schema_type": schema_type,
        **report,
    }


@router.post("/commit")
async def commit_ingested_file(
    case_id: int = Form(1),
    file: UploadFile = File(...),
    schema_type: str = Form("cdr"),
    column_mapping: Optional[str] = Form(None),
    skip_invalid: bool = Form(True),
    officer_badge: Optional[str] = Form("RJ-POL-FORENSICS"),
    db: Session = Depends(get_db),
):
    """
    Commits validated tabular data into the case database with Section 65B
    chain-of-custody audit sealing.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    sha256_hash = compute_file_sha256(contents)
    user_mapping = None
    if column_mapping:
        try:
            user_mapping = json.loads(column_mapping)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON in column_mapping")

    try:
        df = read_tabular_file(contents, file.filename or "uploaded.csv")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    report = validate_dataset(df, schema_type=schema_type, user_mapping=user_mapping)
    total_rows = report.get("total_rows", 0)
    valid_count = report.get("valid_count", 0)
    invalid_count = report.get("invalid_count", 0)
    invalid_row_numbers = {inv["row_number"] for inv in report.get("invalid_rows", [])}

    # Re-map full dataframe to insert records
    if schema_type == "ipdr":
        canonical_map = IPDR_CANONICAL_FIELDS
    elif schema_type == "towers":
        canonical_map = TOWER_CANONICAL_FIELDS
    else:
        canonical_map = CDR_CANONICAL_FIELDS

    df_mapped = map_columns(df, canonical_map, user_mapping)
    records_to_insert = []

    for row_num, (_, row) in enumerate(df_mapped.iterrows(), start=2):
        if skip_invalid and row_num in invalid_row_numbers:
            continue

        if schema_type == "cdr":
            caller = clean_phone_number(row.get("caller_num"))
            receiver = clean_phone_number(row.get("receiver_num"))
            start_dt = parse_datetime(row.get("start_time"))
            dur = clean_duration(row.get("duration_sec"))
            imei = clean_identifier(row.get("imei"))
            imsi = clean_identifier(row.get("imsi"))
            tower_id = clean_identifier(row.get("tower_id"))

            records_to_insert.append(
                CDRRecord(
                    case_id=case_id,
                    source_file=file.filename,
                    row_number=row_num,
                    caller_num=caller,
                    receiver_num=receiver,
                    call_type=str(row.get("call_type")).strip() if pd.notna(row.get("call_type")) else None,
                    start_time=start_dt,
                    duration_sec=dur,
                    imei=imei,
                    imsi=imsi,
                    tower_id=tower_id,
                )
            )
        elif schema_type == "ipdr":
            sub = clean_phone_number(row.get("subscriber_num")) or clean_identifier(row.get("subscriber_num"))
            pub_ip = clean_identifier(row.get("public_ip"))
            dst_ip = clean_identifier(row.get("dest_ip"))
            start_dt = parse_datetime(row.get("start_time"))
            end_dt = parse_datetime(row.get("end_time"))
            port = clean_int(row.get("source_port"))

            records_to_insert.append(
                IPDRRecord(
                    case_id=case_id,
                    source_file=file.filename,
                    row_number=row_num,
                    subscriber_num=sub,
                    public_ip=pub_ip,
                    source_port=port,
                    dest_ip=dst_ip,
                    start_time=start_dt,
                    end_time=end_dt,
                    service_hint=clean_identifier(row.get("service_hint")),
                )
            )
        else:  # towers
            tower_id = clean_identifier(row.get("tower_id"))
            if not tower_id:
                continue
            tower_obj = CellTower(
                tower_id=str(tower_id),
                latitude=clean_float(row.get("latitude")),
                longitude=clean_float(row.get("longitude")),
                address=clean_identifier(row.get("address")),
                operator=clean_identifier(row.get("operator")),
            )
            db.merge(tower_obj)

    if schema_type in ("cdr", "ipdr") and records_to_insert:
        db.add_all(records_to_insert)
    db.commit()

    log_audit_entry(
        db,
        action="SECTION_65B_INGESTION_SEAL",
        query_text=(
            f"file={file.filename}, sha256={sha256_hash}, schema={schema_type}, "
            f"total_rows={total_rows}, committed={len(records_to_insert)}, "
            f"skipped={invalid_count if skip_invalid else 0}, officer={officer_badge}"
        ),
        user_role="Senior Investigator",
    )

    return {
        "status": "success",
        "case_id": case_id,
        "filename": file.filename,
        "sha256": sha256_hash,
        "schema_type": schema_type,
        "total_rows": total_rows,
        "committed_rows": len(records_to_insert),
        "skipped_rows": invalid_count if skip_invalid else 0,
        "quality_score": report.get("quality_score", 100.0),
        "certificate": {
            "compliance": "Section 65B Indian Evidence Act",
            "hash_algorithm": "SHA-256",
            "integrity_seal": sha256_hash,
            "certified_by": officer_badge or "RJ-POL-FORENSICS",
            "timestamp": datetime.utcnow().isoformat(),
        },
    }
