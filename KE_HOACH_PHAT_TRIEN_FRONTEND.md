# KẾ HOẠCH PHÁT TRIỂN FRONT-END CAI_LO (NEXT-GEN CYBER DASHBOARD)
**Công nghệ chủ đạo:** Node.js (v24) · Vite · React 18 · TypeScript · Tailwind CSS · Three.js (R3F) · xterm.js  
**Mục tiêu:** Nâng tầm CAI_LO thành một **Trung tâm Chỉ huy Tác chiến Không gian mạng (Cyber Operations Center / Red Team C2 HUD)** với đồ họa 3D tương tác không gian tấn công, terminal thời gian thực và thẩm mỹ Cyberpunk chuyên nghiệp.  
**Cập nhật:** 04/11/2026  

---

## 1. Tầm Nhìn & Triết Lý Thiết Kế UI/UX

1. **Thẩm mỹ Cyber Tactical HUD (Chỉ huy Tác chiến):**
   - Tông màu chủ đạo: Dark Obsidian/Onyx (`#0a0e14`, `#0f141c`), điểm xuyết Neon Emerald (`#3ddc84`), Cyber Cyan (`#00f0ff`), Alert Crimson (`#ff3366`), Amber Gold (`#fcee0a`).
   - Tối ưu cho màn hình rộng (1080p, 2K, 4K) nhưng tự động co giãn linh hoạt (responsive split-pane).
   - Glassmorphism tinh tế (acrylic blur), viền bo góc sắc sảo kèm scanlines/gridlines tinh tế (có công tắc bật/tắt).
2. **Trải nghiệm 3D Không gian Tấn công (Three.js Attack Topography):**
   - Thay thế biểu đồ tĩnh 2D bằng một **vũ trụ mạng 3D sống động (Holographic Cyber Grid)**.
   - Các thực thể (Attacker, Target Host, Open Port, Web Endpoint, Finding, CTF Flag) là các khối hình học 3D phát sáng, liên kết bằng các chùm tia laser hạt (particle beams).
   - Xoay 360 độ (OrbitControls), zoom cận cảnh từng máy mục tiêu, nhấp chọn để khóa camera và mở bảng trinh sát tức thì.
3. **Thao tác 2 chiều (Autonomous AI + Human In The Loop):**
   - Quan sát AI Swarm tự động ra lệnh trên Kali Linux theo thời gian thực.
   - Can thiệp gõ tay bất kỳ lúc nào qua Terminal xterm.js tích hợp sẵn.
4. **Vận hành Độc lập & Tích hợp 1-Click:**
   - Hỗ trợ cả 2 chế độ:
     - **Dev Mode**: `npm run dev` (Vite Hot-Reload tốc độ mili-giây, proxy ngầm về backend cổng 8000).
     - **Production Mode**: `npm run build` xuất gói nén nhẹ (< 1.5MB) phục vụ thẳng qua FastAPI cổng 8000 — **người dùng chỉ cần chạy file `.bat` duy nhất**, không cần cài thêm Node.js hay mở 2 cửa sổ server.

---

## 2. Kiến Trúc Công Nghệ (Tech Stack)

```mermaid
flowchart TD
    subgraph Frontend["Front-end Architecture (frontend/)"]
        Vite[⚡ Vite 6 + React 18 + TypeScript]
        Tailwind[🎨 Tailwind CSS + Lucide Icons]
        Zustand[📦 Zustand Global State Store]
        
        subgraph View3D["3D Cyber Engine"]
            R3F[Three.js / @react-three/fiber]
            Drei[@react-three/drei Controls & Shaders]
            Particles[Particle Laser Streams & Hologram Grid]
        end
        
        subgraph TerminalUI["Terminal & Telemetry"]
            Xterm[xterm.js + WebLinks Addon]
            SSEClient[SSE Event Stream Reader]
        end
    end

    subgraph Backend["FastAPI Controller (Port 8000)"]
        API["/api/v1/memory/graph\n/api/v1/runner/terminal/*\n/api/v1/lab/*\n/api/v1/sessions"]
        SQLite[(SQLite Campaign Memory)]
        RunnerMgr[RunnerManager]
    end

    Vite --> Tailwind & Zustand
    Zustand --> View3D & TerminalUI
    SSEClient <-->|SSE Stream & JSON REST| API
    TerminalUI <-->|HTTP Long-polling / WS| RunnerMgr
    View3D <-->|Real-time Node/Edge Data| SQLite
```

| Tầng | Công nghệ lựa chọn | Lý do |
| :--- | :--- | :--- |
| **Runtime & Build** | Node.js v24 + Vite 6 | Tốc độ bundle và HMR cực nhanh, hỗ trợ module ESM hiện đại |
| **Framework** | React 18/19 + TypeScript | Hệ sinh thái 3D Three.js và Component phong phú nhất, typing an toàn |
| **Styling** | Tailwind CSS + CSS Variables | Dễ tạo theme Cyber Dark, tuỳ biến glow neon, gọn nhẹ |
| **State Management**| Zustand | Nhẹ hơn Redux 90%, đồng bộ state ngoài React lifecycle không gây giật lag 3D |
| **3D Rendering** | Three.js + React Three Fiber (R3F) | Quản lý vòng đời 3D bằng React component, tối ưu WebGL hiệu năng cao |
| **Terminal** | `@xterm/xterm` + `@xterm/addon-fit` | Chuẩn công nghiệp cho terminal web, render chữ sắc nét, hỗ trợ ANSI màu |
| **Icons & SFX** | Lucide-React + Web Audio API | Bộ icon mạng/bảo mật tinh tế; âm thanh tác chiến điện tử nhẹ |

---

## 3. Lộ Trình Triển Khai Chi Tiết (5 Pha)

### Pha 1: Khởi Tạo Nền Tảng & Cấu Trúc Dự Án (Scaffolding & Layout)
- [ ] Khởi tạo thư mục `frontend/` bằng Vite template React + TypeScript.
- [ ] Cài đặt các gói phụ thuộc lõi: `tailwindcss`, `lucide-react`, `zustand`, `clsx`, `tailwind-merge`.
- [ ] Cấu hình `vite.config.ts`: Proxy toàn bộ request `/api`, `/cai_runner.py` và `/ws` về backend `http://127.0.0.1:8000`.
- [ ] Xây dựng khung giao diện **Cyber Dashboard Grid Layout**:
  - **Top Navigation Bar**: Logo CAI_LO, Trạng thái Kali Runner (Live Pulse dot), Nút chọn Agent/Model, Đồng hồ chiến dịch.
  - **Left Rail (Control Panel)**: Cấu hình Scope RoE, Form giao chỉ thị, Nút Khởi động/Dừng, Bảng điều khiển Mock Lab 1-click.
  - **Center Stage (The Cyber Matrix)**: Không gian chuyển đổi linh hoạt giữa Sơ đồ 3D Three.js và Sơ đồ Mindmap 2D.
  - **Right Panel (Intelligence & Triage)**: Danh sách Lỗ hổng (Findings), Credentials/Flags đã thu thập, Bộ đếm Severity.
  - **Bottom Dock (Live Console)**: Màn hình xterm.js đa tab (Terminal Agent, Shell tương tác Kali, Nhật ký Hệ thống).

### Pha 2: Quản Lý Trạng Thái Toàn Cục & Kết Nối Backend (Zustand & Real-time Client)
- [ ] Thiết lập `stores/useCampaignStore.ts`:
  - Quản lý dữ liệu trinh sát (Hosts, Ports, Endpoints, Findings, Credentials, CTF Flags).
  - Tự động thăm dò (polling) `/api/v1/memory/graph` mỗi 4 giây hoặc khi có sự kiện mới.
- [ ] Thiết lập `stores/useTerminalStore.ts`:
  - Đồng bộ nhật ký lệnh với backend qua `/api/v1/runner/terminal/logs`.
  - Hỗ trợ gõ lệnh tay và gửi qua `/api/v1/runner/terminal/exec`.
- [ ] Thiết lập `stores/useAgentRunnerStore.ts`:
  - Bắt luồng SSE streaming từ `/api/v1/sessions/{id}/messages/stream`.
  - Tách pha tự động (`Recon` -> `Scan` -> `Enum` -> `Exploit` -> `Report`).

### Pha 3: Xây Dựng 3D Cyber Attack Space (Three.js & R3F)
- [ ] **Scene & Environment**:
  - Không gian chiều sâu vô cực với lưới tọa độ không gian (Holographic Ground Grid).
  - Ánh sáng neon động (PointLights đổi màu theo mức độ nguy hiểm của mục tiêu).
  - Bụi sao không gian mạng (Cyber Space Dust / Floating Matrix Particles).
- [ ] **3D Network Nodes & Topography**:
  - **Attacker Node (Kali / Swarm)**: Đặt ở tọa độ gốc `(0, 0, 0)`, phát sáng xanh ngọc lục bảo (Emerald Neon).
  - **Target Host Nodes**: Các khối cầu hoặc lăng trụ đa giác (Polyhedral Spheres) trôi nổi trong không gian, mang màu xanh Cyber Cyan.
  - **Port / Endpoint Satellites**: Các node vệ tinh xoay quanh Host tương ứng.
  - **Vulnerability Orbs**: Các quả cầu màu đỏ rực rỡ đập theo nhịp tim (pulsing crimson shader) đại diện cho lỗ hổng CRITICAL/HIGH.
  - **Loot Diamonds**: Khối tinh thể vàng kim lấp lánh đại diện cho `FLAG{...}` và tài khoản chiếm đoạt.
- [ ] **Laser Data Beams (Curves & Particles)**:
  - Đường nối Bezier 3D giữa Attacker và Target.
  - Các hạt electron chạy dọc theo đường nối khi có lệnh quét hoặc dữ liệu truyền tải.
- [ ] **Camera Controls & Raycasting Interaction**:
  - Dùng `OrbitControls` cho phép người dùng xoay 360 độ, cuộn chuột để zoom.
  - Raycaster hover/click: Khi di chuột vào node, node phát sáng rực rỡ và hiển thị tooltip HUD 3D (Billboard).
  - Nhấp đúp vào Host: Camera mượt mà lướt tới gần máy mục tiêu (smooth camera transition), mở panel chi tiết và nạp sẵn lệnh kiểm thử.

### Pha 4: Tích Hợp Live Terminal (xterm.js) & Cyber Audio/Visuals
- [ ] Nhúng component `XTerminal.tsx` sử dụng `@xterm/xterm` và `@xterm/addon-fit`.
- [ ] Giao diện Terminal Cyberpunk:
  - Font chữ monospace sắc nét (`JetBrains Mono` / `Consolas`).
  - Màu sắc phân định rõ: `[AGENT] $ ...` (màu xanh dương), `[MANUAL] $ ...` (màu xanh lá), kết quả trả về (màu bạc), thông báo lỗi (màu đỏ neon).
  - Nút lệnh tắt nhanh: `id & uname`, `ip -br a`, `ss -tulnp`, `check Mock Lab`.
- [ ] Trình điều khiển Mock Lab tích hợp:
  - Nút bật/tắt Micro-Lab cổng 8888 với hoạt ảnh radar quét.
  - Thanh tiến độ giải cờ CTF (`x/7 cờ`).
- [ ] Tùy chọn hiệu ứng âm thanh (Cyber Audio Feedback - có công tắc Mute):
  - Tiếng beep ngắn tinh tế khi Agent tìm ra lỗ hổng mới.
  - Âm thanh kết nối khi máy ảo Kali bắt tay thành công.

### Pha 5: Đóng Gói Production & Khởi Động 1-Click
- [ ] Cấu hình Vite build: tối ưu chunk splitting, gzip compression.
- [ ] Tích hợp xuất tĩnh (Static Export): Gói build xuất thẳng vào thư mục `d:/CAI_LO/webui/dist` hoặc được backend FastAPI mount tự động tại `/ui`.
- [ ] Cập nhật file [run_webui.bat](file:///d:/CAI_LO/run_webui.bat):
  - Tự động nhận diện thư mục build mới để phục vụ giao diện Next-Gen.
  - Khởi động đồng thời cả Controller và Giao diện 3D chỉ với 1 cú nhấp đúp chuột.

---

## 4. Bảng Tiến Độ Dự Kiến

| Giai đoạn Front-end | Hạng mục thực hiện | Thời lượng dự kiến | Kết quả nghiệm thu |
| :--- | :--- | :---: | :--- |
| **GĐ 8.1: Setup & HUD Layout** | Vite + React + TS + Tailwind + Cyberpunk Layout | 1 lượt | Khung UI Cyber HUD chạy mượt, giao tiếp API OK |
| **GĐ 8.2: State & SSE Engine** | Zustand stores, SSE stream parser, API connector | 1 lượt | Đầy đủ dữ liệu Real-time, phân pha và findings |
| **GĐ 8.3: 3D Three.js Matrix** | R3F Scene, Hologram Grid, 3D Attack Graph, Raycast | 1-2 lượt | Không gian 3D tương tác xoay 360 độ, click node |
| **GĐ 8.4: xterm.js Terminal** | Nhúng terminal live, đồng bộ 2 chiều Kali runner | 1 lượt | Gõ lệnh tay + xem agent chạy live trên terminal |
| **GĐ 8.5: Build & 1-Click .bat** | Bundle production, tích hợp vào FastAPI & .bat | 1 lượt | Nhấp đúp `.bat` là mở ngay Dashboard 3D hoàn chỉnh |

