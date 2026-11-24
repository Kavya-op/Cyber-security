"""
Unified Launcher for Rajasthan Police CDR & IPDR Intelligence Platform.
Runs the complete stack (Backend + Database + Frontend) on http://localhost:8000.
"""
import sys
import os
import webbrowser
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

# Load .env
env_file = ROOT_DIR / ".env"
if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k and k not in os.environ:
                    os.environ[k] = v

if __name__ == "__main__":
    import uvicorn
    
    port = 8000
    host = "0.0.0.0"
    url = f"http://localhost:{port}"
    
    print("=" * 65)
    print("  RAJASTHAN POLICE - CDR & IPDR INTELLIGENCE PLATFORM")
    print("  Forensics • Graph Analytics • Section 91 CrPC Dossier")
    print("=" * 65)
    print(f"\n[+] Combined Project Server starting at: {url}")
    print(f"[+] Web UI Dashboard:   {url}")
    print(f"[+] Swagger API Docs:   {url}/docs")
    print(f"[+] Health Endpoint:    {url}/health")
    print("\nPress Ctrl+C to stop the server.\n")

    # Optional: open browser automatically if requested via flag --open
    if "--open" in sys.argv:
        try:
            webbrowser.open(url)
        except Exception:
            pass

    uvicorn.run("main:app", host=host, port=port, reload=True, app_dir=str(BACKEND_DIR))
