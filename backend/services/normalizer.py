import hashlib
import io
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
import pandas as pd

CDR_CANONICAL_FIELDS: Dict[str, List[str]] = {
    "caller_num": [
        "callerno", "callingno", "callingnumber", "callernum", "caller", "callernumber",
        "aparty", "anum", "msisdna", "sourcenumber", "source", "from",
        "callingparty", "callerparty", "sourceparty", "srcnum", "callingmsisdn", "calloriginator"
    ],
    "receiver_num": [
        "calledno", "callednumber", "receivernum", "receiver", "callednum", "receivernumber",
        "bparty", "bnum", "msisdnb", "destnumber", "destination", "to",
        "calledparty", "receiverparty", "destparty", "dstnum", "calledmsisdn", "callterminator"
    ],
    "call_type": [
        "calltype", "type", "servicetype", "direction", "calldirection", "eventtype",
        "telecomservice", "trafficdirection", "callnature"
    ],
    "start_time": [
        "starttime", "calltime", "calldate", "datetime", "timestamp", "date",
        "time", "startdatetime", "callstart", "callstartdate", "callstartdatetime",
        "eventtime", "seizuretime", "answertime"
    ],
    "duration_sec": [
        "durationsec", "duration", "callduration", "calldurationsec", "durations",
        "calldur", "secs", "seconds", "dur", "airtimeduration", "converseduration"
    ],
    "imei": ["imei", "imeinum", "imeinumber", "firstimei", "deviceimei", "handsetimei", "tac"],
    "imsi": ["imsi", "imsinum", "imsinumber", "simimsi", "simcardnumber"],
    "tower_id": [
        "towerid", "cellid", "firstcell", "cgi", "siteid", "celltower",
        "firstcellid", "locationid", "tower", "cell", "btsid", "sectorid", "lac", "ci"
    ],
}

IPDR_CANONICAL_FIELDS: Dict[str, List[str]] = {
    "subscriber_num": [
        "subscribernum", "subscriber", "msisdn", "phonenumber", "phone",
        "callingno", "callingnumber", "mobileno", "mobilenumber", "userid", "username",
        "allocatednumber", "useridentifier"
    ],
    "public_ip": [
        "publicip", "sourceip", "srcip", "clientip", "translatedip", "natip",
        "allocatedip", "ipaddress", "ip", "srcipaddress", "sourceipv4", "publicipv4"
    ],
    "source_port": [
        "sourceport", "srcport", "port", "translatedport", "clientport", "natport", "srcportno",
        "sourceportnumber"
    ],
    "dest_ip": [
        "destip", "destinationip", "dstip", "serverip", "remoteip", "targetip", "destinationipaddress",
        "destinationipv4", "targethost"
    ],
    "start_time": [
        "starttime", "sessionstart", "startdatetime", "datetime", "timestamp", "begintime", "startdate",
        "sessiontime", "logintime", "connectiontime"
    ],
    "end_time": [
        "endtime", "sessionend", "enddatetime", "stoptime", "terminatetime", "enddate",
        "logouttime", "disconnectiontime"
    ],
    "service_hint": [
        "servicehint", "service", "servicetype", "app", "application", "protocol",
        "domain", "url", "destination", "servicename", "appservice", "protocolsignaling"
    ],
}

TOWER_CANONICAL_FIELDS: Dict[str, List[str]] = {
    "tower_id": ["towerid", "cellid", "siteid", "cgi", "tower", "cell", "id"],
    "latitude": ["latitude", "lat", "sitelatitude", "sitelat"],
    "longitude": ["longitude", "long", "lon", "lng", "sitelongitude", "sitelon"],
    "address": ["address", "siteaddress", "location", "sitelocation", "celladdress", "sitename", "name"],
    "operator": ["operator", "telecomoperator", "provider", "telco", "isp", "circle"],
}


def normalize_header(header: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(header).lower())


def read_tabular_file(contents: bytes, filename: str) -> pd.DataFrame:
    lower_name = filename.lower()
    if lower_name.endswith((".xlsx", ".xls")):
        return pd.read_excel(io.BytesIO(contents))
    elif lower_name.endswith((".csv", ".tsv", ".txt")):
        try:
            return pd.read_csv(
                io.BytesIO(contents),
                index_col=False,
                quotechar='"',
                skipinitialspace=True,
            )
        except UnicodeDecodeError:
            return pd.read_csv(
                io.BytesIO(contents),
                encoding="latin-1",
                index_col=False,
                quotechar='"',
                skipinitialspace=True,
            )
    else:
        try:
            return pd.read_csv(
                io.BytesIO(contents),
                index_col=False,
                quotechar='"',
                skipinitialspace=True,
            )
        except Exception:
            return pd.read_excel(io.BytesIO(contents))


def map_columns(
    df: pd.DataFrame,
    canonical_map: Dict[str, List[str]],
    user_mapping: Optional[Dict[str, str]] = None,
) -> pd.DataFrame:
    df_copy = df.copy()
    rename_dict: Dict[Any, str] = {}
    mapped_targets = set()

    if user_mapping:
        for original_col, target_field in user_mapping.items():
            if original_col in df_copy.columns:
                rename_dict[original_col] = target_field
                mapped_targets.add(target_field)

    for col in df_copy.columns:
        if col in rename_dict:
            continue
        col_norm = normalize_header(col)
        for target, aliases in canonical_map.items():
            if target in mapped_targets:
                continue
            if col_norm in aliases or col_norm == normalize_header(target):
                rename_dict[col] = target
                mapped_targets.add(target)
                break

    df_copy.rename(columns=rename_dict, inplace=True)
    return df_copy


def clean_phone_number(val: Any) -> Optional[str]:
    if val is None or pd.isna(val):
        return None
    if isinstance(val, float):
        if val.is_integer():
            val = int(val)
        else:
            val = f"{val:.0f}"
    val_str = str(val).strip()
    if val_str.endswith(".0"):
        val_str = val_str[:-2]
    digits = re.sub(r"\D", "", val_str)
    if not digits:
        return None
    if len(digits) >= 10:
        return digits[-10:]
    return digits


def clean_identifier(val: Any) -> Optional[str]:
    if val is None or pd.isna(val):
        return None
    if isinstance(val, float):
        if val.is_integer():
            val = int(val)
        else:
            val = f"{val:.0f}"
    val_str = str(val).strip()
    if val_str.endswith(".0"):
        val_str = val_str[:-2]
    return val_str or None


def parse_datetime(val: Any) -> Optional[datetime]:
    if val is None or pd.isna(val):
        return None
    if isinstance(val, datetime):
        return val
    try:
        dt = pd.to_datetime(val, errors="coerce")
        if pd.isna(dt):
            return None
        return dt.to_pydatetime()
    except Exception:
        return None


def clean_duration(val: Any) -> Optional[int]:
    if val is None or pd.isna(val):
        return None
    if isinstance(val, (int, float)):
        return int(val)
    val_str = str(val).strip()
    if ":" in val_str:
        parts = val_str.split(":")
        try:
            if len(parts) == 3:
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(float(parts[2]))
            elif len(parts) == 2:
                return int(parts[0]) * 60 + int(float(parts[1]))
        except Exception:
            pass
    try:
        return int(float(val_str))
    except (ValueError, TypeError):
        return None


def clean_int(val: Any) -> Optional[int]:
    if val is None or pd.isna(val):
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def clean_float(val: Any) -> Optional[float]:
    if val is None or pd.isna(val):
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def compute_file_sha256(contents: bytes) -> str:
    return hashlib.sha256(contents).hexdigest()


def detect_carrier_and_schema(headers: List[str]) -> Dict[str, str]:
    headers_norm = [normalize_header(h) for h in headers]
    header_str = " ".join(headers_norm)

    if any(k in header_str for k in ["publicip", "clientip", "sourceip", "destip", "destinationip", "appservice", "subscribernum", "domain"]):
        schema_type = "ipdr"
        carrier = "IPDR Internet Session Logs"
    elif any(k in header_str for k in ["latitude", "longitude", "sitelat", "sitelon"]):
        schema_type = "towers"
        carrier = "Cell Tower Coordinates Master"
    else:
        schema_type = "cdr"
        if any(k in header_str for k in ["aparty", "bparty"]):
            carrier = "Reliance Jio (A/B Party Format)"
        elif any(k in header_str for k in ["callerno", "calledno", "durationsec", "firstcell"]):
            carrier = "Bharti Airtel (FirstCell CGI Format)"
        elif any(k in header_str for k in ["callingno", "callednumber", "cgi"]):
            carrier = "Vodafone Idea / Vi (Standard CDR)"
        elif any(k in header_str for k in ["msisdna", "msisdnb"]):
            carrier = "BSNL (MSISDN A/B Format)"
        else:
            carrier = "Generic Telecom CDR Export"

    return {"schema_type": schema_type, "carrier": carrier}


def suggest_mappings(headers: List[str], schema_type: str = "cdr") -> Dict[str, str]:
    if schema_type == "ipdr":
        canonical_map = IPDR_CANONICAL_FIELDS
    elif schema_type == "towers":
        canonical_map = TOWER_CANONICAL_FIELDS
    else:
        canonical_map = CDR_CANONICAL_FIELDS

    mappings: Dict[str, str] = {}
    mapped_targets = set()

    for header in headers:
        h_norm = normalize_header(header)
        for target, aliases in canonical_map.items():
            if target in mapped_targets:
                continue
            if h_norm in aliases or h_norm == normalize_header(target):
                mappings[str(header)] = target
                mapped_targets.add(target)
                break
    return mappings


def validate_dataset(
    df: pd.DataFrame,
    schema_type: str = "cdr",
    user_mapping: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    if schema_type == "ipdr":
        canonical_map = IPDR_CANONICAL_FIELDS
    elif schema_type == "towers":
        canonical_map = TOWER_CANONICAL_FIELDS
    else:
        canonical_map = CDR_CANONICAL_FIELDS

    df_mapped = map_columns(df, canonical_map, user_mapping)
    total_rows = len(df_mapped)

    valid_rows = []
    invalid_rows = []

    for row_idx, (_, row) in enumerate(df_mapped.iterrows(), start=2):
        reasons = []
        clean_row: Dict[str, Any] = {"row_number": row_idx}

        if schema_type == "cdr":
            caller = clean_phone_number(row.get("caller_num"))
            receiver = clean_phone_number(row.get("receiver_num"))
            raw_start = row.get("start_time")
            start_dt = parse_datetime(raw_start)
            raw_dur = row.get("duration_sec")
            dur = clean_duration(raw_dur)
            imei = clean_identifier(row.get("imei"))
            tower_id = clean_identifier(row.get("tower_id"))

            if not caller and not receiver:
                reasons.append("Missing both Calling (A-Party) and Called (B-Party) numbers")
            elif caller and len(re.sub(r"\D", "", str(caller))) < 10:
                reasons.append(f"Incomplete Calling number: '{caller}' (<10 digits)")

            if raw_start is not None and not (isinstance(raw_start, float) and pd.isna(raw_start)) and start_dt is None:
                reasons.append(f"Unparseable datetime format: '{raw_start}'")

            if raw_dur is not None and not (isinstance(raw_dur, float) and pd.isna(raw_dur)) and dur is None:
                reasons.append(f"Invalid duration format: '{raw_dur}'")
            elif dur is not None and dur < 0:
                reasons.append("Negative call duration")

            clean_row.update({
                "caller_num": caller,
                "receiver_num": receiver,
                "start_time": start_dt.strftime("%Y-%m-%d %H:%M:%S") if start_dt else None,
                "duration_sec": dur or 0,
                "imei": imei,
                "imsi": clean_identifier(row.get("imsi")),
                "tower_id": tower_id,
                "call_type": str(row.get("call_type")).strip() if pd.notna(row.get("call_type")) else "Voice",
            })

        elif schema_type == "ipdr":
            sub = clean_phone_number(row.get("subscriber_num")) or clean_identifier(row.get("subscriber_num"))
            pub_ip = clean_identifier(row.get("public_ip"))
            dst_ip = clean_identifier(row.get("dest_ip"))
            start_dt = parse_datetime(row.get("start_time"))
            end_dt = parse_datetime(row.get("end_time"))
            port = clean_int(row.get("source_port"))

            if not sub and not pub_ip and not dst_ip:
                reasons.append("Missing subscriber MSISDN and public/destination IP addresses")
            if port is not None and (port < 1 or port > 65535):
                reasons.append(f"Invalid TCP/UDP port: {port}")

            clean_row.update({
                "subscriber_num": sub,
                "public_ip": pub_ip,
                "dest_ip": dst_ip,
                "source_port": port,
                "start_time": start_dt.strftime("%Y-%m-%d %H:%M:%S") if start_dt else None,
                "end_time": end_dt.strftime("%Y-%m-%d %H:%M:%S") if end_dt else None,
                "service_hint": clean_identifier(row.get("service_hint")) or "Web/SSL",
            })
        else:  # towers
            t_id = clean_identifier(row.get("tower_id"))
            lat = clean_float(row.get("latitude"))
            lng = clean_float(row.get("longitude"))
            if not t_id:
                reasons.append("Missing Cell Tower ID")
            if lat is not None and (lat < -90 or lat > 90):
                reasons.append(f"Invalid latitude: {lat}")
            if lng is not None and (lng < -180 or lng > 180):
                reasons.append(f"Invalid longitude: {lng}")

            clean_row.update({
                "tower_id": str(t_id) if t_id else None,
                "latitude": lat,
                "longitude": lng,
                "address": clean_identifier(row.get("address")),
                "operator": clean_identifier(row.get("operator")),
            })

        raw_dict = {str(k): str(v) for k, v in row.to_dict().items() if pd.notna(v)}
        if reasons:
            invalid_rows.append({
                "row_number": row_idx,
                "reasons": reasons,
                "data": raw_dict,
            })
        else:
            valid_rows.append(clean_row)

    valid_count = len(valid_rows)
    invalid_count = len(invalid_rows)
    quality_score = round((valid_count / total_rows * 100), 1) if total_rows > 0 else 100.0

    return {
        "total_rows": total_rows,
        "valid_count": valid_count,
        "invalid_count": invalid_count,
        "quality_score": quality_score,
        "invalid_rows": invalid_rows[:100],
        "sample_valid": valid_rows[:10],
        "columns_mapped": list(df_mapped.columns),
    }
