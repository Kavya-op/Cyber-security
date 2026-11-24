"""
Feature 4: Advanced Communication Network Graph & Common Contacts Verification
Validates:
1. Force/topological network graph generation with degree, betweenness, and closeness centrality.
2. Automatic role identification (Kingpins, Bridge Brokers, Field Operatives).
3. Community / syndicate cell detection via NetworkX modularity algorithms.
4. Multi-suspect common contact link analysis with per-suspect call breakdowns and Section 65B citations.
5. Degrees of separation & shortest communication chain discovery.
6. REST API endpoints (/api/network-graph, /api/common-contacts, /api/shortest-path).
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))

from fastapi.testclient import TestClient
from main import app
from services.graph_engine import (
    build_network_graph,
    find_common_contacts,
    find_shortest_path,
)
from database import SessionLocal, CDRRecord

def test_feature4_network_graph():
    print("=" * 70)
    print("FEATURE 4: ADVANCED COMMUNICATION NETWORK GRAPH & COMMON CONTACTS VERIFICATION")
    print("=" * 70)

    db = SessionLocal()
    try:
        records = db.query(CDRRecord).filter(CDRRecord.case_id == 1).all()
        assert len(records) > 0, "Expected case records in database"

        # 1. Network Graph Structure & Centrality Metrics Test
        print("\n[Step 1] Network Graph Construction & Centrality Metrics")
        graph = build_network_graph(records, min_calls=1)
        nodes = graph["nodes"]
        edges = graph["edges"]
        summary = graph["summary"]
        communities = graph["communities"]

        assert summary["total_nodes"] >= 20, f"Expected at least 20 nodes, got {summary['total_nodes']}"
        assert summary["total_edges"] >= 50, f"Expected at least 50 edges, got {summary['total_edges']}"
        assert summary["density"] > 0, "Graph density should be positive"
        assert len(communities) >= 2, f"Expected modular communities, got {len(communities)}"
        print(f"  [PASS] Built network graph: {summary['total_nodes']} nodes, {summary['total_edges']} edges (Density: {summary['density']})")
        print(f"  [PASS] Identified {len(communities)} distinct syndicate community cells")

        # Verify Node Roles and Centralities
        kingpin_nodes = [n for n in nodes if n["role"] == "KINGPIN"]
        broker_nodes = [n for n in nodes if n["role"] == "BROKER"]
        assert len(kingpin_nodes) >= 1, "Expected at least 1 kingpin node"
        print(f"  [PASS] Kingpin orchestrators identified: {len(kingpin_nodes)} (e.g. {kingpin_nodes[0]['id']} with degree {kingpin_nodes[0]['degree']})")
        print(f"  [PASS] Bridge brokers identified: {len(broker_nodes)} (e.g. {broker_nodes[0]['id'] if broker_nodes else 'None'})")

        sample_node = nodes[0]
        assert "centrality" in sample_node
        assert "betweenness" in sample_node
        assert "closeness" in sample_node
        assert "x" in sample_node and "y" in sample_node
        assert 0 <= sample_node["x"] <= 760 and 0 <= sample_node["y"] <= 400
        print(f"  [PASS] Node coordinates scaled to SVG canvas: ({sample_node['x']}, {sample_node['y']})")

        # 2. Common Contacts Link Analysis Test
        print("\n[Step 2] Multi-Suspect Common Contacts & Link Analysis")
        suspects = ["9829011111", "9829933333"]
        common = find_common_contacts(suspects, records)
        assert len(common) >= 1, f"Expected common contacts between {suspects}, got {len(common)}"
        print(f"  [PASS] Found {len(common)} mutual contacts between {suspects[0]} and {suspects[1]}")

        first_mutual = common[0]
        assert "contact" in first_mutual
        assert "total_shared_calls" in first_mutual
        assert "evidence" in first_mutual
        assert len(first_mutual["evidence"]) > 0
        sample_ev = first_mutual["evidence"][0]
        assert "source_file" in sample_ev and "row_number" in sample_ev
        print(f"  [PASS] Mutual Contact: {first_mutual['contact']} ({first_mutual['total_shared_calls']} shared calls)")
        print(f"         Section 65B Line Citation: {sample_ev['source_file']}#L{sample_ev['row_number']}")

        # 3. Shortest Path & Degrees of Separation Test
        print("\n[Step 3] Degrees of Separation & Shortest Communication Chain")
        # Direct or 2-hop path between suspect alpha and target
        path_res = find_shortest_path("9829011111", "9829010000", records)
        assert path_res["has_path"] is True, "Expected valid communication path"
        assert path_res["degrees_of_separation"] >= 1
        assert len(path_res["path"]) == path_res["degrees_of_separation"] + 1
        assert len(path_res["hops"]) == path_res["degrees_of_separation"]
        print(f"  [PASS] Degrees of Separation between 9829011111 and 9829010000: {path_res['degrees_of_separation']}")
        print(f"         Communication Chain: {' ➔ '.join(path_res['path'])}")
        print(f"         Hop #1 Citation: {path_res['hops'][0]['evidence_ref']}")

        # 4. REST API Endpoints Verification via TestClient
        print("\n[Step 4] REST API Verification (FastAPI TestClient)")
        client = TestClient(app)

        # 4a. Network Graph Endpoint
        resp_net = client.get("/api/network-graph?min_calls=1")
        assert resp_net.status_code == 200, f"Expected 200, got {resp_net.status_code}"
        net_json = resp_net.json()
        assert "nodes" in net_json and "edges" in net_json and "communities" in net_json
        print(f"  [PASS] GET /api/network-graph -> 200 OK ({len(net_json['nodes'])} nodes, {len(net_json['communities'])} communities)")

        # 4b. Common Contacts Endpoint
        resp_com = client.get(f"/api/common-contacts?suspects={','.join(suspects)}")
        assert resp_com.status_code == 200, f"Expected 200, got {resp_com.status_code}"
        com_json = resp_com.json()
        assert "common_contacts" in com_json
        assert com_json["common_contacts_count"] >= 1
        print(f"  [PASS] GET /api/common-contacts -> 200 OK ({com_json['common_contacts_count']} common contacts)")

        # 4c. Shortest Path Endpoint
        resp_path = client.get("/api/shortest-path?source=9829011111&target=9829010000")
        assert resp_path.status_code == 200, f"Expected 200, got {resp_path.status_code}"
        path_json = resp_path.json()
        assert path_json["has_path"] is True
        print(f"  [PASS] GET /api/shortest-path -> 200 OK (Degrees: {path_json['degrees_of_separation']})")

        # 4d. Case-specific analytics endpoints
        resp_case_net = client.get("/api/cases/1/network-graph")
        assert resp_case_net.status_code == 200
        print(f"  [PASS] GET /api/cases/1/network-graph -> 200 OK")

        resp_case_com = client.get(f"/api/cases/1/common-contacts?suspects={','.join(suspects)}")
        assert resp_case_com.status_code == 200
        print(f"  [PASS] GET /api/cases/1/common-contacts -> 200 OK")

        resp_case_path = client.get("/api/cases/1/shortest-path?source=9829011111&target=9829010000")
        assert resp_case_path.status_code == 200
        print(f"  [PASS] GET /api/cases/1/shortest-path -> 200 OK")

    finally:
        db.close()

    print("\n" + "=" * 70)
    print("ALL FEATURE 4 VERIFICATION CHECKS PASSED (100.0%)")
    print("=" * 70)

if __name__ == "__main__":
    test_feature4_network_graph()
