import { create } from "zustand";
import { AttackGraphData, GraphNode, RunnerStatus, MockLabStatus, FindingItem, CredentialItem, AgentItem, ModelItem, AgentStep, AuditSessionItem } from "../types";

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
  availableAgents: AgentItem[];
  availableModels: ModelItem[];
  isRedactEnabled: boolean;
  agentSteps: AgentStep[];
  auditSessions: AuditSessionItem[];
  activeDockTab: "terminal" | "agent_log" | "history";
  show3DMatrix: boolean;

  // Actions
  toggleRedact: () => void;
  setActiveDockTab: (tab: "terminal" | "agent_log" | "history") => void;
  toggle3DMatrix: () => void;
  setShow3DMatrix: (val: boolean) => void;
  clearAgentSteps: () => void;
  fetchAgents: () => Promise<void>;
  fetchModels: () => Promise<void>;
  fetchAuditSessions: () => Promise<void>;
  clearTerminalLogs: () => Promise<void>;
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
  availableAgents: [],
  availableModels: [],
  isRedactEnabled: true,
  agentSteps: [],
  auditSessions: [],
  activeDockTab: "agent_log",
  show3DMatrix: false,

  toggleRedact: () => set((s) => ({ isRedactEnabled: !s.isRedactEnabled })),
  setActiveDockTab: (tab) => set({ activeDockTab: tab }),
  toggle3DMatrix: () => set((s) => ({ show3DMatrix: !s.show3DMatrix })),
  setShow3DMatrix: (val: boolean) => set({ show3DMatrix: val }),
  clearAgentSteps: () => set({ agentSteps: [] }),

  fetchAuditSessions: async () => {
    try {
      const res = await fetch("/api/v1/audit/sessions");
      if (!res.ok) return;
      const data: AuditSessionItem[] = await res.json();
      set({ auditSessions: data || [] });
    } catch (_) {}
  },

  fetchAgents: async () => {
    try {
      const res = await fetch("/api/v1/agents");
      if (!res.ok) return;
      const data = await res.json();
      set({ availableAgents: data.agents || [] });
    } catch (_) {}
  },

  fetchModels: async () => {
    try {
      const res = await fetch("/api/v1/models");
      if (!res.ok) return;
      const data = await res.json();
      set({ availableModels: data.models || [] });
    } catch (_) {}
  },

  clearTerminalLogs: async () => {
    try {
      await fetch("/api/v1/runner/terminal/logs", { method: "DELETE" });
    } catch (_) {}
  },

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

      // 3. Dispatch execution and consume real-time SSE stream
      set({ activeDockTab: "agent_log",
  show3DMatrix: false, agentSteps: [] });
      const streamRes = await fetch(`/api/v1/sessions/${sid}/messages/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: prompt,
          context: { target, autonomy: isAutonomy },
          max_turns: maxTurns,
        }),
      });

      if (!streamRes.ok || !streamRes.body) {
        set({ isRunning: false, statusText: "Lỗi kết nối SSE stream" });
        return;
      }

      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIndex: number;
        while ((sepIndex = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);

          let eventName = "message";
          const dataLines: string[] = [];
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).trim());
            }
          }

          if (dataLines.length === 0) continue;
          let parsedData: any;
          try {
            parsedData = JSON.parse(dataLines.join("\n"));
          } catch (_) {
            parsedData = { raw: dataLines.join("\n") };
          }

          const now = new Date();
          const timeStr = now.toTimeString().split(" ")[0];
          const stepId = Math.random().toString(36).substring(2, 9);

          if (eventName === "reasoning_step") {
            const stepItem: AgentStep = {
              id: stepId,
              time: timeStr,
              type: parsedData.type || "message",
              agent: parsedData.agent,
              tool: parsedData.tool,
              args: parsedData.args,
              command: parsedData.command,
              output: parsedData.output,
              text: parsedData.text,
              phase: parsedData.phase,
              phase_label: parsedData.phase_label,
              cycle: parsedData.cycle,
              max_cycles: parsedData.max_cycles,
              turns_used: parsedData.turns_used,
              max_turns: parsedData.max_turns,
              reason: parsedData.reason,
            };

            set((state) => ({
              agentSteps: [...state.agentSteps, stepItem],
              statusText: parsedData.reason || (parsedData.tool ? `Đang chạy: ${parsedData.tool}` : state.statusText),
              turnsUsed: parsedData.turns_used !== undefined ? parsedData.turns_used : state.turnsUsed,
              currentPhase: parsedData.phase || state.currentPhase,
            }));
          } else if (eventName === "final") {
            const finalMsg = parsedData.final_message || (parsedData.final_output ? JSON.stringify(parsedData.final_output, null, 2) : "");
            const stepItem: AgentStep = {
              id: stepId,
              time: timeStr,
              type: "final",
              final_message: finalMsg,
              final_output: parsedData.final_output,
            };

            set((state) => ({
              agentSteps: [...state.agentSteps, stepItem],
              isRunning: false,
              statusText: "Chiến dịch hoàn tất",
            }));

            get().fetchGraph();
            get().fetchMemorySummary();
            get().fetchAuditSessions();
            try { await reader.cancel(); } catch (_) {}
            return;
          } else if (eventName === "error") {
            const stepItem: AgentStep = {
              id: stepId,
              time: timeStr,
              type: "error",
              text: parsedData.message || JSON.stringify(parsedData),
            };

            set((state) => ({
              agentSteps: [...state.agentSteps, stepItem],
              isRunning: false,
              statusText: `Lỗi: ${stepItem.text}`,
            }));
          }
        }
      }

      set({ isRunning: false, statusText: "Chiến dịch hoàn tất" });
      get().fetchGraph();
      get().fetchMemorySummary();
      get().fetchAuditSessions();

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

