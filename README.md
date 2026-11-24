# Rajasthan Police CDR & IPDR Telecom Forensics Intelligence Platform

> **Submission Action Plan: PPT · Wireframe · HTML Prototype**  
> *Rajasthan Police Hackathon 2026 (PS03) | Submission Deadline: 24 Nov 2026*  
> **Live Interactive HTML Prototype:** [https://kavya-op.github.io/Cyber-security/](https://kavya-op.github.io/Cyber-security/)

A unified, production-ready forensic intelligence platform combining an **Interactive HTML Prototype (React + Tailwind + Leaflet + Firebase)** with an **Air-Gapped Python Forensic Engine (FastAPI + SQLite + NetworkX)** for telecom investigations under Section 91 CrPC and Section 65B of the Indian Evidence Act.

---

## 🌟 Instant Evaluation: Standalone HTML Prototype

The prototype is bundled as a self-contained, client-side interactive HTML application in the [`docs/`](./docs) folder:

- **Option A (Zero-Install Browser):** Visit the deployed GitHub Pages link: [https://kavya-op.github.io/Cyber-security/](https://kavya-op.github.io/Cyber-security/)
- **Option B (Local Offline):** Clone this repo and double-click [`index.html`](./index.html) or [`docs/index.html`](./docs/index.html) in any modern browser (Chrome, Edge, Firefox, Safari).

All interactive features—GIS Leaflet Map, Multi-Suspect Venn Selector, Suspicious Calling Patterns, Hardware Tracker, IPDR VoIP Correlator, Section 65B Report Generator, and AI Forensic Assistant—work 100% out-of-the-box in standalone mode with embedded baseline datasets.

---

## 📁 Repository Architecture

```
Cyber-security/
├── docs/                     # 🌐 Standalone Interactive HTML Prototype (GitHub Pages)
│   ├── index.html            # Entry point for judges / evaluators
│   └── assets/               # Bundled JavaScript, CSS, and Leaflet assets
├── index.html                # Root launcher redirecting to HTML prototype
├── backend/                  # FastAPI Core, Routers, Services & Database
│   ├── main.py               # Combined API Server & Static SPA Mount
│   ├── database.py           # SQLite ORM models & session management
│   ├── investigation.db      # Unified Forensic SQLite Database
│   ├── seed_data.py          # Data ingestion script for telecom datasets
│   ├── routers/              # Modular API endpoints
│   │   ├── analytics.py      # Network graph, tower timeline, anomalies
│   │   ├── reports.py        # Official Section 91 CrPC PDF & Excel export
│   │   ├── upload.py         # Multi-carrier normalizer (Airtel, Jio, Vi, BSNL)
│   │   └── ai_assistant.py   # Zero-hallucination evidence citation assistant
│   └── services/             # Graph analysis, normalizer, and telecom analytics
├── data/                     # Raw datasets & test upload samples
│   ├── cdr.csv               # 600+ Call Detail Records
│   ├── ipdr.csv              # 400+ IP Detail Records (VoIP, Web sessions)
│   ├── towers.csv            # 24 Cell Towers in Jaipur & Ajmer
│   └── sample_files/         # Multi-operator sample files for testing file upload
│       ├── OperatorA_Airtel_CDR.csv
│       ├── OperatorB_Jio_CDR.csv
│       └── Carrier_IPDR_SessionLogs.csv
├── frontend/                 # React + Vite Application Source
│   ├── src/                  # Components, Neumorphic styles, and dashboards
│   │   ├── components/       # Map, Timeline, Graph, AI Copilot, Audit Log
│   │   ├── firebase/         # Firebase Auth, Firestore sync, and Storage service
│   │   └── dummyData.json    # Case baseline records
│   ├── dist/                 # Compiled production assets
│   └── vite.config.js        # Vite config with relative base for GitHub Pages
├── firestore.rules           # Section 65B tamper-evident Firestore security rules
├── storage.rules             # Evidence storage security rules
├── firebase.json             # Firebase deployment configuration
├── tests/                    # 9 Automated Test Suites (100% Passing)
├── run.py                    # Single-command Python launcher
└── start.bat                 # 1-Click Windows Batch launcher
```

---

## 🚀 How to Run the Full Platform Locally

### Option 1: Standalone HTML Prototype
Simply open [`docs/index.html`](./docs/index.html) in your browser. No server required.

### Option 2: Full-Stack Platform with Live Python Forensic Engine
Runs FastAPI backend + SQLite Database + React UI on port 8000:

```bash
# Install backend dependencies
pip install -r requirements.txt

# Launch platform with automated browser opening
python run.py --open
```
*Or double-click `start.bat` on Windows.*

- **Web Dashboard:** [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check:** [http://localhost:8000/health](http://localhost:8000/health)

---

## 🔑 Core Features & Innovations

1. **Interactive Leaflet Tile Map & Movement Trail:**
   - Real OpenStreetMap GIS tile layer with Rajasthan Police antenna markers.
   - Chronological GPS breadcrumb trajectory with velocity calculation and impossible travel flags.
   - Co-location meeting pins (`⚠️`) detecting physical multi-suspect meetings at the same cell site.

2. **Dynamic Multi-Suspect Venn Selector:**
   - Dual searchable `<select>` pickers to compare any two suspects in the case.
   - Interactive SVG Venn Diagram separating private contacts (`Only A`, `Only B`) and shared mutual intermediaries (`Intersection`).
   - Direct Call Lightning Bridge showing total calls and duration between targets.

3. **Multi-Carrier Ingestion & Schema Normalizer:**
   - Automatically maps non-standard operator column headers (Airtel, Jio, Vi, BSNL) into unified schemas.
   - Cleans Indian phone formats (`+91`, `0`, spaces, hyphens) into canonical 10-digit MSISDNs.

4. **Multi-SIM & Hardware Tracker (IMEI/IMSI Swap):**
   - Detects burner phone swaps (same SIM in multiple handsets; same handset with multiple SIMs).
   - TAC-based device identification (e.g. Samsung Galaxy, OnePlus, iPhone).

5. **Suspicious Calling Pattern Engine:**
   - Detects late-night bursts (00:00 - 05:00 AM) and rapid call storms (≥3 calls in 20 minutes).
   - Identifies short-duration ping signaling (<5s missed calls).

6. **IPDR / VoIP & Cellular Silence Correlation:**
   - Correlates cellular silence intervals with encrypted IPDR traffic (WhatsApp VoIP, Telegram Voice, Tor).

7. **Court-Admissible Section 65B & Section 91 CrPC Reports:**
   - Generates official PDF dossiers with SHA-256 cryptographic hashes, officer sign-offs, and exact source file citations (`OperatorA_Airtel_CDR.csv#L3`).

8. **AI-Powered Natural Language Forensic Assistant:**
   - Ingests investigator questions in natural language and outputs deterministic, evidence-backed answers citing exact source files and rows.

9. **Firebase Cloud & Police Officer RBAC:**
   - Integrated with official Firebase Auth and Cloud Firestore.
   - Section 65B tamper-evident immutable audit trail rules in `firestore.rules`.
