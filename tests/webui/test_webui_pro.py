"""Unit tests for Stage 7: WebUI Pro (Visual Attack Mindmap & Live Interactive Terminal)."""

import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from cai.api.app import create_cai_api_app
from cai.memory.store import CampaignMemoryStore
from cai.runner.manager import runner_manager


class TestWebUIProStage7(unittest.TestCase):
    """Verify Attack Graph generation, Live Terminal streaming, and WebUI Pro endpoints."""

    def setUp(self) -> None:
        self.tmp_dir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.db_path = Path(self.tmp_dir.name) / "test_graph.db"
        self.store = CampaignMemoryStore(db_path=self.db_path)
        runner_manager.clear_terminal_logs()

    def tearDown(self) -> None:
        self.tmp_dir.cleanup()

    def test_01_build_attack_graph_structure(self) -> None:
        """Attack graph should construct layered nodes (0..3) and connecting edges."""
        self.store.upsert_host("192.168.100.50", os_guess="Ubuntu Linux")
        self.store.upsert_port("192.168.100.50", 80, "tcp", "http", "Apache 2.4")
        self.store.upsert_endpoint("192.168.100.50", "http://192.168.100.50/sqli", status_code=200)
        self.store.upsert_finding("192.168.100.50", "SQL Injection Auth Bypass", severity="CRITICAL")
        self.store.upsert_credential("192.168.100.50", "FLAG{STAGE7_GRAPH_OK}", secret_type="flag")

        graph = self.store.build_attack_graph(target="192.168.100.50")
        self.assertIn("nodes", graph)
        self.assertIn("edges", graph)

        node_types = {n["type"] for n in graph["nodes"]}
        self.assertIn("attacker", node_types)
        self.assertIn("host", node_types)
        self.assertIn("port", node_types)
        self.assertIn("endpoint", node_types)
        self.assertIn("finding", node_types)
        self.assertIn("flag", node_types)
        self.assertGreaterEqual(len(graph["edges"]), 5)

    def test_02_runner_terminal_event_stream_and_manual_exec(self) -> None:
        """RunnerManager should record manual commands and outputs with monotonic seq IDs."""
        res = runner_manager.execute_manual("echo STAGE7_TERMINAL_READY", timeout=10, allow_local_fallback=True)
        self.assertEqual(res["return_code"], 0)
        self.assertIn("STAGE7_TERMINAL_READY", res["output"])

        logs = runner_manager.get_terminal_logs(since_seq=0)
        self.assertGreaterEqual(len(logs["events"]), 2)
        kinds = [e["kind"] for e in logs["events"]]
        self.assertIn("command", kinds)
        self.assertIn("output", kinds)

        last_seq = logs["last_seq"]
        empty_logs = runner_manager.get_terminal_logs(since_seq=last_seq)
        self.assertEqual(len(empty_logs["events"]), 0)

    def test_03_fastapi_stage7_endpoints_and_ui(self) -> None:
        """FastAPI app should serve /api/v1/memory/graph, /api/v1/runner/terminal/* and WebUI Pro."""
        app = create_cai_api_app()
        client = TestClient(app)

        # 1. Test /api/v1/memory/graph
        r_graph = client.get("/api/v1/memory/graph")
        self.assertEqual(r_graph.status_code, 200)
        g_data = r_graph.json()
        self.assertIn("nodes", g_data)
        self.assertIn("edges", g_data)

        # 2. Test /api/v1/runner/terminal/exec (also ingests output into campaign_memory)
        r_exec = client.post(
            "/api/v1/runner/terminal/exec",
            json={"command": "echo FLAG{TERMINAL_INGEST_TEST}", "timeout": 10, "target": "127.0.0.1"},
        )
        self.assertEqual(r_exec.status_code, 200)
        self.assertIn("FLAG{TERMINAL_INGEST_TEST}", r_exec.json().get("output", ""))

        # 3. Test /api/v1/runner/terminal/logs
        r_logs = client.get("/api/v1/runner/terminal/logs?since_seq=0")
        self.assertEqual(r_logs.status_code, 200)
        self.assertGreaterEqual(len(r_logs.json().get("events", [])), 1)

        # 4. Verify WebUI: /ui serves Next-Gen 3D React UI, /ui/classic serves Classic 2D UI
        r_ui = client.get("/ui")
        self.assertEqual(r_ui.status_code, 200)
        self.assertIn("Cyber Operations Command Center", r_ui.text)

        r_classic = client.get("/ui/classic")
        self.assertEqual(r_classic.status_code, 200)
        self.assertIn("mindmap-svg", r_classic.text)


if __name__ == "__main__":
    unittest.main()
