import os
import re
import json
from typing import Dict, List, Any, Optional, Literal
from pydantic import BaseModel, Field

import pandas as pd
from google import genai
from google.genai import types

from database import DEFAULT_DB_PATH, query_df
from analytics import (
    find_common_contacts,
    detect_device_anomalies,
    get_tower_timeline,
)

# Load GEMINI_API_KEY from environment or .env file if available
def load_env_key() -> Optional[str]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("GEMINI_API_KEY="):
                        api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                        os.environ["GEMINI_API_KEY"] = api_key
                        break
    return api_key

# Database schema representation for Gemini prompt context
DB_SCHEMA_PROMPT = """
Database Schema for Obsydia Telecom Intelligence System (Jaipur Region):

1. Table: towers (15 Cell towers in Jaipur)
   - tower_id (TEXT, Primary Key): e.g., 'TOW-001' to 'TOW-015'
   - latitude (REAL): e.g., 26.9100
   - longitude (REAL): e.g., 75.8020
   - area_name (TEXT): e.g., 'C-Scheme', 'MI Road', 'Malviya Nagar', 'Raja Park', 'Tonk Road', 'Sanganer'

2. Table: cdr (Call Detail Records - 600 records)
   - record_id (TEXT, Primary Key): e.g., 'CDR-001' to 'CDR-600'
   - caller_num (TEXT): 10-digit caller phone number
   - receiver_num (TEXT): 10-digit receiver phone number
   - timestamp (TEXT, ISO format): 'YYYY-MM-DDTHH:MM:SS'
   - duration_sec (INTEGER): call duration in seconds (0 for SMS)
   - call_type (TEXT): 'VOICE' or 'SMS'
   - tower_id (TEXT, Foreign Key -> towers.tower_id)
   - imei (TEXT): 15-digit device IMEI number

3. Table: ipdr (Internet Protocol Detail Records - 400 records)
   - session_id (TEXT, Primary Key): e.g., 'IPDR-001' to 'IPDR-400'
   - phone_num (TEXT): 10-digit subscriber phone number
   - source_ip (TEXT): Cellular CGNAT IP (e.g. 10.x.x.x)
   - dest_ip (TEXT): Destination IP
   - app_protocol (TEXT): 'WhatsApp', 'Telegram', 'HTTPS'
   - start_time (TEXT, ISO format): 'YYYY-MM-DDTHH:MM:SS'
   - data_vol_mb (REAL): data volume in megabytes
   - tower_id (TEXT, Foreign Key -> towers.tower_id)
"""


# =====================================================================
# Pydantic Schemas for Structured Output
# =====================================================================

class QueryIntent(BaseModel):
    intent: Literal["imei_check", "night_activity", "common_contacts", "suspect_summary"] = Field(
        description="The classified investigative intent based on the user's natural language question."
    )
    target_numbers: List[str] = Field(
        default_factory=list,
        description="List of 10-digit phone numbers extracted from the query."
    )
    reasoning: Optional[str] = Field(
        default=None,
        description="Brief explanation of why this intent was selected."
    )


class GroundedAnswer(BaseModel):
    answer: str = Field(
        description="Grounded markdown response answering the question, citing exact [record_id] or [session_id] for every claim."
    )
    evidence_records: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="List of the exact raw record objects cited in the answer."
    )


def get_genai_client(api_key: Optional[str] = None) -> Optional[genai.Client]:
    """Initialize Google GenAI client if an API key is available."""
    key = api_key or load_env_key()
    if not key:
        return None
    return genai.Client(api_key=key)


# =====================================================================
# STEP A: Query Router
# =====================================================================

def step_a_query_router(
    user_query: str,
    client: Optional[genai.Client] = None,
    model: str = "gemini-2.5-flash"
) -> Dict[str, Any]:
    """
    Step A (Query Router):
    Pass the user's natural language question and database schema to Gemini,
    returning a structured JSON intent with extracted target phone numbers.
    """
    system_instruction = (
        "You are an expert Telecom Intelligence Query Router. "
        "Analyze the user's natural language question and the database schema to determine "
        "the precise investigative intent and extract all 10-digit phone numbers.\n\n"
        "Allowed Intents:\n"
        "- 'imei_check': Check for SIM swaps, burner phones, shared IMEIs, or device changes.\n"
        "- 'night_activity': Inquire about late-night activity, 01:00 AM - 03:00 AM data/calls, Telegram spikes, or nocturnal tower movement.\n"
        "- 'common_contacts': Identify common handlers, shared contacts, or mutual connections between numbers.\n"
        "- 'suspect_summary': Overview of a target's timeline, general activity, or profile."
    )

    prompt = (
        f"{DB_SCHEMA_PROMPT}\n\n"
        f"User Query: {user_query}\n\n"
        "Extract the intent and target phone numbers."
    )

    if client is not None:
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    response_json_schema=QueryIntent.model_json_schema(),
                    temperature=0.0
                )
            )
            return json.loads(response.text)
        except Exception as e:
            print(f"[Warning] Gemini API call in Step A failed: {e}. Falling back to deterministic router.")

    # Graceful heuristic router fallback (if offline or no API key provided)
    return _heuristic_router(user_query)


def _heuristic_router(query: str) -> Dict[str, Any]:
    """Deterministic regex router for offline or fallback operation."""
    # Extract 10-digit numbers
    numbers = re.findall(r"\b9829\d{6}\b|\b\d{10}\b", query)
    lower = query.lower()

    if any(k in lower for k in ["imei", "sim swap", "burner", "swap", "device", "handset", "same phone"]):
        intent = "imei_check"
    elif any(k in lower for k in ["night", "01:00", "03:00", "1 am", "3 am", "telegram", "spike", "movement"]):
        intent = "night_activity"
    elif any(k in lower for k in ["common", "handler", "both call", "mutual", "shared contact", "middleman"]):
        intent = "common_contacts"
    else:
        intent = "suspect_summary"

    return {
        "intent": intent,
        "target_numbers": numbers,
        "reasoning": f"Heuristic classification matched intent '{intent}' with numbers {numbers}."
    }


# =====================================================================
# STEP B: Deterministic Execution
# =====================================================================

def step_b_deterministic_execution(
    intent_data: Dict[str, Any],
    db_path: str = DEFAULT_DB_PATH,
    limit: int = 15
) -> List[Dict[str, Any]]:
    """
    Step B (Deterministic Execution):
    Runs the corresponding Pandas filter / analytics functions to fetch the exact
    matching rows (limited to top 15 relevant rows) as structured records.
    """
    intent = intent_data.get("intent", "suspect_summary")
    target_numbers = intent_data.get("target_numbers", [])

    records: List[Dict[str, Any]] = []

    if intent == "imei_check":
        # Check for device anomalies / SIM swaps on the same IMEI
        anomalies = detect_device_anomalies(db_path=db_path)
        relevant_imeis = []

        if target_numbers:
            # Find IMEIs associated with target numbers
            placeholders = ",".join(["?"] * len(target_numbers))
            imei_df = query_df(
                f"SELECT DISTINCT imei FROM cdr WHERE caller_num IN ({placeholders})",
                params=tuple(target_numbers),
                db_path=db_path
            )
            relevant_imeis = imei_df["imei"].tolist()

        if not relevant_imeis and anomalies:
            relevant_imeis = [a["imei"] for a in anomalies]

        if relevant_imeis:
            placeholders = ",".join(["?"] * len(relevant_imeis))
            sql = f"""
                SELECT c.record_id, c.caller_num, c.receiver_num, c.timestamp, 
                       c.duration_sec, c.call_type, c.tower_id, t.area_name, c.imei
                FROM cdr c
                LEFT JOIN towers t ON c.tower_id = t.tower_id
                WHERE c.imei IN ({placeholders})
                ORDER BY c.timestamp ASC
                LIMIT ?
            """
            rows = query_df(sql, params=(*relevant_imeis, limit), db_path=db_path)
            records = rows.to_dict(orient="records")

    elif intent == "night_activity":
        # Look for 01:00 AM - 03:00 AM IPDR spikes and CDR records
        target_clause = ""
        params = []
        if target_numbers:
            placeholders = ",".join(["?"] * len(target_numbers))
            target_clause = f"AND i.phone_num IN ({placeholders})"
            params.extend(target_numbers)

        # 1. Fetch IPDR sessions during night hours or high data volume
        ipdr_sql = f"""
            SELECT i.session_id, i.phone_num, i.source_ip, i.dest_ip, 
                   i.app_protocol, i.start_time, i.data_vol_mb, i.tower_id, t.area_name
            FROM ipdr i
            LEFT JOIN towers t ON i.tower_id = t.tower_id
            WHERE (SUBSTR(i.start_time, 12, 2) IN ('01', '02') OR i.data_vol_mb > 50)
            {target_clause}
            ORDER BY i.start_time ASC
            LIMIT ?
        """
        ipdr_rows = query_df(ipdr_sql, params=(*params, limit), db_path=db_path)
        records.extend(ipdr_rows.to_dict(orient="records"))

        # 2. Also check if there were any CDR voice calls during that night window to corroborate
        cdr_target_clause = ""
        cdr_params = []
        if target_numbers:
            placeholders = ",".join(["?"] * len(target_numbers))
            cdr_target_clause = f"AND c.caller_num IN ({placeholders})"
            cdr_params.extend(target_numbers)

        cdr_sql = f"""
            SELECT c.record_id, c.caller_num, c.receiver_num, c.timestamp, 
                   c.duration_sec, c.call_type, c.tower_id, t.area_name, c.imei
            FROM cdr c
            LEFT JOIN towers t ON c.tower_id = t.tower_id
            WHERE SUBSTR(c.timestamp, 12, 2) IN ('01', '02')
            {cdr_target_clause}
            ORDER BY c.timestamp ASC
            LIMIT 5
        """
        cdr_rows = query_df(cdr_sql, params=(*cdr_params,), db_path=db_path)
        records.extend(cdr_rows.to_dict(orient="records"))
        records = records[:limit]

    elif intent == "common_contacts":
        if len(target_numbers) >= 2:
            num1, num2 = target_numbers[0], target_numbers[1]
            cc_res = find_common_contacts(num1, num2, db_path=db_path)
            records = cc_res.get("matching_records", [])[:limit]
        elif len(target_numbers) == 1:
            # Single number: find who calls it or who it calls most
            num = target_numbers[0]
            sql = """
                SELECT c.record_id, c.caller_num, c.receiver_num, c.timestamp, 
                       c.duration_sec, c.call_type, c.tower_id, t.area_name, c.imei
                FROM cdr c
                LEFT JOIN towers t ON c.tower_id = t.tower_id
                WHERE c.caller_num = ? OR c.receiver_num = ?
                ORDER BY c.timestamp ASC
                LIMIT ?
            """
            rows = query_df(sql, params=(num, num, limit), db_path=db_path)
            records = rows.to_dict(orient="records")

    else:  # suspect_summary or general
        if target_numbers:
            num = target_numbers[0]
            # Fetch timeline of mixed CDR and IPDR records
            sql = """
                SELECT c.record_id, c.caller_num, c.receiver_num, c.timestamp, 
                       c.duration_sec, c.call_type, c.tower_id, t.area_name, c.imei
                FROM cdr c
                LEFT JOIN towers t ON c.tower_id = t.tower_id
                WHERE c.caller_num = ?
                ORDER BY c.timestamp ASC
                LIMIT ?
            """
            rows = query_df(sql, params=(num, limit), db_path=db_path)
            records = rows.to_dict(orient="records")
        else:
            # Default recent CDR sample
            sql = """
                SELECT c.record_id, c.caller_num, c.receiver_num, c.timestamp, 
                       c.duration_sec, c.call_type, c.tower_id, t.area_name, c.imei
                FROM cdr c
                LEFT JOIN towers t ON c.tower_id = t.tower_id
                ORDER BY c.timestamp ASC
                LIMIT ?
            """
            rows = query_df(sql, params=(limit,), db_path=db_path)
            records = rows.to_dict(orient="records")

    return records


# =====================================================================
# STEP C: Grounded Synthesis
# =====================================================================

def step_c_grounded_synthesis(
    user_query: str,
    evidence_records: List[Dict[str, Any]],
    client: Optional[genai.Client] = None,
    model: str = "gemini-2.5-flash"
) -> Dict[str, Any]:
    """
    Step C (Grounded Synthesis):
    Send the user's question + the fetched JSON rows back to Gemini with the strict
    instruction to answer ONLY using the provided records, citing exact [record_id]
    or [session_id] inline, and returning answer + evidence_records.
    """
    system_instruction = (
        "Answer ONLY using the provided records. Every claim must cite the exact "
        "[record_id] or [session_id]. Return a JSON response with two keys: "
        "answer (markdown text with inline citations) and evidence_records (list of the raw record objects cited)."
    )

    records_json_str = json.dumps(evidence_records, indent=2, default=str)
    prompt = (
        f"User Question:\n{user_query}\n\n"
        f"Provided Records (JSON):\n{records_json_str}\n\n"
        "Synthesize your investigative answer based strictly on the above records."
    )

    if client is not None:
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    response_json_schema=GroundedAnswer.model_json_schema(),
                    temperature=0.0
                )
            )
            return json.loads(response.text)
        except Exception as e:
            print(f"[Warning] Gemini API call in Step C failed: {e}. Falling back to deterministic synthesis.")

    # Deterministic fallback synthesis for offline/testing mode
    return _fallback_synthesis(user_query, evidence_records)


def _fallback_synthesis(user_query: str, evidence_records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Provides a fully grounded synthesis with inline citations without needing network."""
    if not evidence_records:
        return {
            "answer": "No matching records found in the telecommunications database for this query.",
            "evidence_records": []
        }

    # Inspect records to construct a cited summary
    cited_records = []
    lines = [f"### Investigative Findings for: *{user_query}*\n"]

    for r in evidence_records:
        if "record_id" in r:
            rec_id = r["record_id"]
            cited_records.append(r)
            lines.append(
                f"- **[{rec_id}]**: Call from `{r['caller_num']}` to `{r['receiver_num']}` "
                f"at `{r['timestamp']}` via tower `{r.get('tower_id', 'N/A')}` ({r.get('area_name', 'Unknown')}) "
                f"[Type: {r['call_type']}, Duration: {r['duration_sec']}s, IMEI: `{r.get('imei', 'N/A')}`]."
            )
        elif "session_id" in r:
            sess_id = r["session_id"]
            cited_records.append(r)
            lines.append(
                f"- **[{sess_id}]**: Data session on `{r['phone_num']}` using `{r['app_protocol']}` "
                f"at `{r['start_time']}` transferring **{r['data_vol_mb']} MB** via tower "
                f"`{r.get('tower_id', 'N/A')}` ({r.get('area_name', 'Unknown')})."
            )

    return {
        "answer": "\n".join(lines),
        "evidence_records": cited_records
    }


# =====================================================================
# Master Pipeline: Two-step Evidence-Aware Pipeline
# =====================================================================

def run_evidence_pipeline(
    user_query: str,
    db_path: str = DEFAULT_DB_PATH,
    api_key: Optional[str] = None,
    model: str = "gemini-2.5-flash"
) -> Dict[str, Any]:
    """
    Executes the full Evidence-Aware pipeline:
    1. Step A: Route natural language query to structured intent + target numbers.
    2. Step B: Fetch matching database rows (limit 15) using deterministic analytics filters.
    3. Step C: Grounded synthesis citing exact [record_id] or [session_id].
    """
    client = get_genai_client(api_key=api_key)

    # Step A: Query Router
    intent_data = step_a_query_router(user_query, client=client, model=model)

    # Step B: Deterministic Execution
    evidence_records = step_b_deterministic_execution(intent_data, db_path=db_path, limit=15)

    # Step C: Grounded Synthesis
    result = step_c_grounded_synthesis(user_query, evidence_records, client=client, model=model)

    return {
        "query": user_query,
        "intent_classification": intent_data,
        "total_evidence_rows": len(evidence_records),
        "answer": result.get("answer", ""),
        "evidence_records": result.get("evidence_records", [])
    }


if __name__ == "__main__":
    print("=" * 70)
    print("Testing Evidence-Aware AI Pipeline (ai_engine.py)")
    print("=" * 70)

    test_queries = [
        "Did 9829011111 have any unusual late-night data activity or movement between 01:00 AM and 03:00 AM?",
        "Check if 9829011111 and 9829022222 share any common handler or mutual contacts.",
        "Check device history or SIM swap anomalies for suspect 9829011111.",
        "Provide an activity summary for 9829033333."
    ]

    for q in test_queries:
        print(f"\n[QUERY]: {q}")
        output = run_evidence_pipeline(q)
        print(f"-> Intent: {output['intent_classification']['intent']} | Targets: {output['intent_classification']['target_numbers']}")
        print(f"-> Evidence Records Fetched: {output['total_evidence_rows']}")
        print("-> Grounded Answer (Snippet):")
        print(output['answer'][:400] + ("..." if len(output['answer']) > 400 else ""))
        print("-" * 50)
