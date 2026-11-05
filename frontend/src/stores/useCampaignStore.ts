import { create } from "zustand";
import { AttackGraphData, GraphNode, RunnerStatus, MockLabStatus, FindingItem, CredentialItem } from "../types";

interface CampaignState {
  target: string;
  prompt: string;
  agent: string;
  model: string;
  maxTurns: number;
  isAutonomy: boolean;
  isRunning: boolean;
  statusText: string;
  currentPhase: string;
  turnsUsed: number;
  sessionId: string;

  graphData: AttackGraphData | null;
  selectedNode: GraphNode | null;
  runnerStatus: RunnerStatus | null;
  labStatus: MockLabStatus | null;
  findings: FindingItem[];
  credentials: CredentialItem[];

  // Actions
  setTarget: (target: string) => void;
  setPrompt: (prompt: string) => void;
  setAgent: (agent: string) => void;
  setModel: (model: string) => void;
  setMaxTurns: (turns: number) => void;
  setIsAutonomy: (val: boolean) => void;
  setSelectedNode: (node: GraphNode | null) => void;

  fetchGraph: () => Promise<void>;
  fetchRunnerStatus: () => Promise<void>;
  fetchLabStatus: () => Promise<void>;
  fetchMemorySummary: () => Promise<void>;
  toggleLab: () => Promise<void>;
  fillMockLabTarget: () => void;
  startMission: () => Promise<void>;
  stopMission: () => Promise<void>;
}

export const useCampaignStore = create<CampaignState>((set, get) => ({
  target: "http://127.0.0.1:8888",
  prompt: "Khảo sát và đánh giá bảo mật toàn diện mục tiêu http://127.0.0.1:8888. Tìm kiếm các lỗ hổng OWASP Top 10, khai thác để chiếm cờ CTF và lập báo cáo.",
  agent: "red_team_swarm_agent",
  model: "",
  maxTurns: 30,
  isAutonomy: true,
  isRunning: false,
  statusText: "Sẵn sàng tác chiến",
  currentPhase: "ready",
  turnsUsed: 0,
  sessionId: "",

  graphData: null,
  selectedNode: null,
  runnerStatus: null,
  labStatus: null,
  findings: [],
  credentials: [],

  setTarget: (target) => set({ target }),
  setPrompt: (prompt) => set({ prompt }),
  setAgent: (agent) => set({ agent }),
  setModel: (model) => set({ model }),
  setMaxTurns: (maxTurns) => set({ maxTurns }),
  setIsAutonomy: (isAutonomy) => set({ isAutonomy }),
  setSelectedNode: (selectedNode) => set({ selectedNode }),

  fetchGraph: async () => {
    try {
      const { target } = get();
      const q = target ? `?target=${encodeURIComponent(target)}` : "";
      const res = await fetch(`/api/v1/memory/graph${q}`);
      if (!res.ok) return;
      const data: AttackGraphData = await res.json();
      set({ graphData: data });
    } catch (_) {}
  },

  fetchRunnerStatus: async () => {
    try {
      const res = await fetch("/api/v1/runner/status");
      if (!res.ok) return;
      const data: RunnerStatus = await res.json();
      set({ runnerStatus: data });
    } catch (_) {}
  },

  fetchLabStatus: async () => {
    try {
      const res = await fetch("/api/v1/lab/status");
      if (!res.ok) return;
      const data: MockLabStatus = await res.json();
      set({ labStatus: data });
    } catch (_) {}
  },

  fetchMemorySummary: async () => {
    try {
      const { target } = get();
      const q = target ? `?target=${encodeURIComponent(target)}` : "";
      const res = await fetch(`/api/v1/memory/summary${q}`);
      if (!res.ok) return;
      const data = await res.json();
      set({
        findings: data.findings || [],
        credentials: data.credentials || [],
      });
    } catch (_) {}
  },

  toggleLab: async () => {
    const { labStatus, fetchLabStatus } = get();
    try {
      if (labStatus?.running) {
        await fetch("/api/v1/lab/stop", { method: "POST" });
      } else {
        await fetch("/api/v1/lab/start", { method: "POST" });
      }
      await fetchLabStatus();
    } catch (_) {}
  },

  fillMockLabTarget: () => {
    set({
      target: "http://127.0.0.1:8888",
      prompt: "Khảo sát và đánh giá bảo mật toàn diện mục tiêu http://127.0.0.1:8888. Tìm kiếm các lỗ hổng OWASP Top 10 (SQL Injection, CSRF, IDOR, Command Injection, Path Traversal, XSS), khai thác để chiếm các lá cờ (CTF Flags) và lập báo cáo tổng kết hoàn chỉnh.",
    });
  },

  startMission: async () => {
    const { target, prompt, agent, model, maxTurns, isAutonomy } = get();
    set({ isRunning: true, statusText: "Đang khởi tạo phiên tác chiến...", turnsUsed: 1 });

    try {
      // 1. Set RoE Scope
      if (target) {
        await fetch("/api/v1/security/scope", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: target, enabled: true }),
        });
      }

      // 2. Create session
      const sessRes = await fetch("/api/v1/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: agent || "red_team_swarm_agent",
          model: model || undefined,
          metadata: { target, max_turns: maxTurns, autonomy: isAutonomy },
        }),
      });

      if (!sessRes.ok) {
        set({ isRunning: false, statusText: "Lỗi khởi tạo phiên" });
        return;
      }
      const sessData = await sessRes.json();
      const sid = sessData.session_id || sessData.id;
      set({ sessionId: sid, statusText: "Đang tấn công mục tiêu..." });

      // 3. Dispatch execution
      fetch(`/api/v1/sessions/${sid}/messages/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: prompt,
          context: { target, autonomy: isAutonomy },
          max_turns: maxTurns,
        }),
      }).then(() => {
        set({ isRunning: false, statusText: "Chiến dịch hoàn tất" });
        get().fetchGraph();
        get().fetchMemorySummary();
      }).catch(() => {
        set({ isRunning: false, statusText: "Phiên kết thúc hoặc bị gián đoạn" });
      });

    } catch (err: any) {
      set({ isRunning: false, statusText: `Lỗi: ${err.message}` });
    }
  },

  stopMission: async () => {
    const { sessionId } = get();
    if (!sessionId) {
      set({ isRunning: false, statusText: "Đã dừng" });
      return;
    }
    try {
      await fetch(`/api/v1/sessions/${sessionId}/interrupt`, { method: "POST" });
    } catch (_) {}
    set({ isRunning: false, statusText: "Chiến dịch đã dừng bởi người điều hành" });
  },
}));

