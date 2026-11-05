# KẾ HOẠCH PHÁT TRIỂN CAI_LO

> **Agent pentest tự động hóa end-to-end** — điều khiển Kali VM từ Windows, tự suy luận chuỗi tấn công.  
> **Phạm vi sử dụng:** Lab nội bộ, CTF, và pentest các hệ thống được yêu cầu / ủy quyền.  
> **Cập nhật:** 04/11/2026

---

## 1. Mục tiêu
Nâng **CAI_LO** từ trạng thái gọi tool theo từng lượt thành một agent tự chủ kiểu **“HackerAI”**:
- Nhận 1 mục tiêu, tự lập kế hoạch, tự chạy nhiều bước, tự điều chỉnh và báo cáo.
- **Kiến trúc:** Bộ não (LLM + agent) chạy trên Windows, tay chân thực thi nằm trên máy ảo Kali Linux qua Reverse Runner.

---

## 2. Hiện trạng — Nền tảng Đã Hoàn Thành

| Thành phần | Vai trò | Trạng thái |
| :--- | :--- | :---: |
| **LLM reasoning** | Bộ não — Groq Qwen / LiteLLM / Gemini |  Đã có |
| **Thực thi host (`executor.py`)** | PTY/subprocess, Docker, SSH, CTF |  Đã có |
| **~30 agent chuyên trách** | `kali_pentester`, `web_pentester`, `red_teamer`, `bug_bounter`… |  Đã có |
| **API + WebUI dashboard** | FastAPI, SSE streaming, quan sát real-time |  Đã có |
| **Reverse Runner Kali VM** | Đóng 0 port, cô lập Kali hoàn toàn với Windows |  Đã có |
| **Scope guard + audit log** | Chặn ngoài phạm vi, ghi JSONL + xuất báo cáo .md bền vững |  Đã có |
| **Vòng lặp tự chủ (autonomy loop)** | Tự lặp nhiều bước (`Perceive→Plan→Act→Observe→Reflect`), budget, checkpoint |  Đã có |
| **Trí nhớ chiến dịch (state store)** | SQLite (`logs/campaign_memory.db`) lưu host/port/endpoint/cred/finding & tự nạp context |  Đã có |
| **Exploit & Payload Engine** | Sinh PoC (CSRF/XSS/SQLi), quản lý listener netcat, dispatch lên Exploit Server |  Đã có |
| **Built-in Mock Lab** | Micro-webapp 7 lỗi OWASP Top 10 tích hợp sẵn tại cổng 8888 |  Đã có |
| **Multi-Agent Swarm** | Bầy đàn 4 chuyên gia (`Recon`, `Web`, `Infra`, `Report`) dưới quyền `RedTeamLead` |  Đã có |
| **WebUI Pro & Visual Graph** | Sơ đồ cây tấn công SVG Mindmap + Terminal tương tác trực tiếp thời gian thực |  Đã có |
| **Next-Gen 3D Cyber HUD** | Node.js, Vite, React 18, Three.js (R3F) 3D Attack Topography, xterm.js live shell |  Đã có |

---

## 3. Lộ trình phát triển

| Giai đoạn | Nội dung | “Xong” nghĩa là | Trạng thái |
| :--- | :--- | :--- | :---: |
| **GĐ 0 — Windows→Kali** | Reverse Runner (`cai_runner.py`), `RunnerManager`, `kali_pentester_agent` | Đóng 100% port Kali; gõ lệnh Windows → chạy Kali |  **HOÀN THÀNH** |
| **GĐ 1 — Scope + audit** | `ScopeGuard` (chặn ngoài scope); `AuditLogger` (lưu JSONL/Report disk) | Agent không lạc IP; tắt máy không mất log; tải report .md |  **HOÀN THÀNH** |
| **GĐ 2 — Autonomy loop** | `AutonomyController` (`plan→act→observe→reflect→replan`); budget; checkpoint | Giao 1 mục tiêu → agent tự chuyển pha & chạy tới flag/report |  **HOÀN THÀNH** |
| **GĐ 3 — Trí nhớ** | `CampaignMemoryStore` SQLite lưu host/port/service/cred/finding; tự nạp lại context | Agent nối chuỗi tấn công xuyên phiên, không quên |  **HOÀN THÀNH** |
| **GĐ 4 — Exploit & Payload Engine** | `generate_payload`, `deliver_exploit`, `manage_listener` (PoC CSRF, XSS, Reverse Shell, Listener) | Sinh mã khai thác không lỗi escape dấu nháy, giải PortSwigger lab tự động |  **HOÀN THÀNH** |
| **GĐ 5 — Built-in Mock Lab** | Micro-webapp giả lập lỗi OWASP Top 10 tích hợp sẵn (SQLi, CSRF, IDOR, RCE, LFI) 1-click | Test agent offline trực tiếp trên máy mà không cần cài thêm lab ngoài |  **HOÀN THÀNH** |
| **GĐ 6 — Multi-Agent Swarm** | Phân vai Recon Agent, Web Exploiter, Infra Agent và Lead Orchestrator | Tác chiến bầy đàn chuyên sâu, tự chia việc qua SQLite Memory |  **HOÀN THÀNH** |
| **GĐ 7 — WebUI Pro & Visual Graph** | Sơ đồ cây tấn công trực quan (Mindmap) + Terminal xterm.js nhúng trực tiếp | Quan sát chuỗi tấn công real-time, can thiệp lệnh tay khi cần |  **HOÀN THÀNH** |
| **GĐ 8 — 3D Cyber Dashboard** | Node.js + Three.js (R3F) + React + Tailwind + xterm.js live C2 HUD | Trực quan hóa 3D không gian tấn công 360°, can thiệp terminal trực tiếp |  **HOÀN THÀNH** |
