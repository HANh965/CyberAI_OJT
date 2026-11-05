import React, { useState, useRef, useEffect } from "react";
import { Bot, Terminal, Wrench, ShieldAlert, CheckCircle2, ChevronRight, Copy, Search, Trash2, Download, Lock, Unlock, ArrowDown } from "lucide-react";
import { useCampaignStore } from "../../stores/useCampaignStore";
import { AgentStep } from "../../types";

export const AgentLogStream: React.FC = () => {
  const { agentSteps, isRunning, clearAgentSteps, sessionId, isRedactEnabled, toggleRedact } = useCampaignStore();
  const [filterKind, setFilterKind] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agentSteps]);

  const filteredSteps = agentSteps.filter((s) => {
    if (filterKind !== "all") {
      if (filterKind === "tool" && s.type !== "call") return false;
      if (filterKind === "output" && s.type !== "output") return false;
      if (filterKind === "agent" && s.type !== "message") return false;
      if (filterKind === "autonomy" && s.type !== "autonomy_checkpoint") return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const content = `${s.tool || ""} ${s.command || ""} ${s.output || ""} ${s.text || ""} ${s.reason || ""}`.toLowerCase();
      if (!content.includes(q)) return false;
    }
    return true;
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex flex-col h-full bg-[#06090e] font-mono text-xs overflow-hidden">
      {/* Filter and Search Bar */}
      <div className="h-9 px-3 border-b border-cyber-border bg-cyber-panel2 flex items-center justify-between gap-3 text-[11px]">
        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {["all", "tool", "output", "agent", "autonomy"].map((k) => (
            <button
              key={k}
              onClick={() => setFilterKind(k)}
              className={`px-2 py-0.5 rounded uppercase tracking-wider text-[10px] transition-all ${
                filterKind === k
                  ? "bg-cyber-cyan text-black font-bold"
                  : "bg-cyber-panel text-cyber-muted hover:text-cyber-text"
              }`}
            >
              {k === "all" ? "Tất cả" : k === "tool" ? "Lệnh Tool" : k === "output" ? "Kết quả" : k === "agent" ? "Tư duy" : "Vòng lặp"}
            </button>
          ))}
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="w-3 h-3 text-cyber-muted absolute left-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Lọc dòng log..."
              className="bg-cyber-panel border border-cyber-border rounded pl-7 pr-2 py-0.5 text-[11px] text-cyber-text focus:outline-none focus:border-cyber-cyan w-32 md:w-48"
            />
          </div>

          <button
            onClick={clearAgentSteps}
            className="p-1 rounded text-cyber-muted hover:text-cyber-red"
            title="Xóa nhật ký stream"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Streaming Logs View */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
        {agentSteps.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-cyber-muted/60 space-y-2">
            <Bot className="w-8 h-8 text-cyber-muted/40 animate-pulse" />
            <p className="text-xs">Chưa có luồng tác chiến nào. Hãy bấm <b>PHÁT ĐỘNG</b> ở cột trái để bắt đầu.</p>
          </div>
        ) : (
          filteredSteps.map((s, idx) => {
            if (s.type === "call") {
              const argStr = s.args ? (typeof s.args === "object" ? JSON.stringify(s.args) : String(s.args)) : "";
              return (
                <div key={idx} className="space-y-1 animate-fadeIn">
                  <div className="text-[10px] text-cyber-muted flex items-center gap-2">
                    <span className="text-cyber-cyan">[{s.time}]</span>
                    <span className="px-1.5 py-0.2 rounded bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20">TOOL CALL</span>
                  </div>
                  <div className="p-2 rounded bg-cyber-panel2/80 border border-cyber-border/70 flex items-start gap-2">
                    <Wrench className="w-4 h-4 text-cyber-cyan mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0 break-all font-mono">
                      <b className="text-cyber-neon mr-1.5">{s.tool}</b>
                      <span className="text-slate-300">{s.command || argStr}</span>
                    </div>
                  </div>
                </div>
              );
            }

            if (s.type === "output") {
              const outText = s.output || "";
              const lineCount = outText.split("\\n").length;
              return (
                <div key={idx} className="ml-4 space-y-1 animate-fadeIn">
                  <div className="text-[10px] text-cyber-muted flex items-center gap-2">
                    <span className="text-emerald-400">[{s.time}]</span>
                    <span className="text-slate-400">↳ Kết quả lệnh ({lineCount} dòng, {outText.length} ký tự)</span>
                  </div>
                  <details className="rounded bg-[#04060a] border border-slate-800 text-slate-300 overflow-hidden" open={lineCount <= 15}>
                    <summary className="px-2.5 py-1 bg-cyber-panel2/50 text-[11px] text-cyber-muted cursor-pointer hover:text-cyber-text flex items-center justify-between">
                      <span>Xem chi tiết output</span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          copyToClipboard(outText);
                        }}
                        className="text-cyber-muted hover:text-cyber-neon"
                        title="Sao chép output"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </summary>
                    <pre className="p-2.5 max-h-60 overflow-y-auto text-[11px] font-mono leading-relaxed select-text whitespace-pre-wrap break-all text-slate-300">
                      {outText}
                    </pre>
                  </details>
                </div>
              );
            }

            if (s.type === "message") {
              return (
                <div key={idx} className="p-2.5 rounded-lg bg-cyber-panel2 border border-cyber-cyan/20 space-y-1 animate-fadeIn">
                  <div className="text-[10px] text-cyber-cyan flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Bot className="w-3.5 h-3.5" />
                      {s.agent ? `Agent: ${s.agent}` : "Agent Pentester"}
                    </span>
                    <span className="text-cyber-muted">{s.time}</span>
                  </div>
                  <div className="text-slate-200 whitespace-pre-wrap leading-relaxed select-text">
                    {s.text}
                  </div>
                </div>
              );
            }

            if (s.type === "autonomy_checkpoint") {
              return (
                <div key={idx} className="p-2.5 rounded-lg bg-emerald-950/20 border-l-4 border-cyber-neon text-xs space-y-1 animate-fadeIn">
                  <div className="flex items-center justify-between font-bold text-cyber-neon">
                    <span>
                      🔄 [Autonomy Loop · Vòng {s.cycle || 1}/{s.max_cycles || 8} · Lượt {s.turns_used || 0}/{s.max_turns || 30}]
                    </span>
                    <span className="text-[10px] text-cyber-muted">{s.time}</span>
                  </div>
                  <div className="text-slate-300">
                    Pha tác chiến: <b className="text-cyber-cyan">{s.phase_label || s.phase}</b>
                  </div>
                  {s.reason && (
                    <div className="text-cyber-muted text-[11px]">↳ {s.reason}</div>
                  )}
                </div>
              );
            }

            if (s.type === "final") {
              return (
                <div key={idx} className="p-3.5 rounded-xl bg-gradient-to-br from-cyber-panel2 to-emerald-950/30 border border-cyber-neon/40 space-y-2 animate-fadeIn shadow-neon">
                  <div className="flex items-center justify-between text-cyber-neon font-bold text-xs">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Báo cáo Kết quả Chiến dịch Hoàn tất
                    </span>
                    <button
                      onClick={() => copyToClipboard(s.final_message || "")}
                      className="flex items-center gap-1 text-[11px] text-cyber-muted hover:text-cyber-neon"
                    >
                      <Copy className="w-3 h-3" /> Sao chép
                    </button>
                  </div>
                  <pre className="p-3 rounded bg-black/60 border border-cyber-border text-slate-200 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto select-text">
                    {s.final_message}
                  </pre>
                </div>
              );
            }

            if (s.type === "error") {
              return (
                <div key={idx} className="p-2.5 rounded bg-red-950/30 border border-red-500/40 text-red-300 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-cyber-red shrink-0 mt-0.5" />
                  <div>
                    <b>Lỗi:</b> {s.text}
                  </div>
                </div>
              );
            }

            return null;
          })
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
};

