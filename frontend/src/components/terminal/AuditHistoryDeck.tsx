import React, { useEffect, useState } from "react";
import { History, ExternalLink, RefreshCw, FileText, Target, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { useCampaignStore } from "../../stores/useCampaignStore";
import { AuditSessionItem } from "../../types";

export const AuditHistoryDeck: React.FC = () => {
  const { auditSessions, fetchAuditSessions, setTarget, setPrompt } = useCampaignStore();
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    fetchAuditSessions();
  }, []);

  const filtered = auditSessions.filter((s) => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    return (
      s.session_id.toLowerCase().includes(q) ||
      (s.target || "").toLowerCase().includes(q) ||
      (s.agent || "").toLowerCase().includes(q)
    );
  });

  const loadTargetIntoStore = (targetUrl: string) => {
    if (!targetUrl || targetUrl === "—") return;
    setTarget(targetUrl);
    setPrompt(`Đánh giá bảo mật và giải quyết mục tiêu ${targetUrl}.`);
  };

  return (
    <div className="flex flex-col h-full bg-[#06090e] font-mono text-xs overflow-hidden">
      {/* Top action bar */}
      <div className="h-9 px-3 border-b border-cyber-border bg-cyber-panel2 flex items-center justify-between gap-3 text-[11px]">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-cyber-cyan" />
          <span className="font-semibold text-cyber-text">Lịch sử các phiên pentest đã lưu trên đĩa</span>
          <span className="text-[10px] text-cyber-muted px-1.5 py-0.2 rounded bg-cyber-panel border border-cyber-border">
            {auditSessions.length} phiên
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Tìm theo ID, target, agent..."
            className="bg-cyber-panel border border-cyber-border rounded px-2 py-0.5 text-[11px] text-cyber-text focus:outline-none focus:border-cyber-cyan w-36 md:w-56"
          />

          <button
            onClick={fetchAuditSessions}
            className="p-1 rounded text-cyber-muted hover:text-cyber-cyan"
            title="Làm mới lịch sử"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sessions list */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-cyber-muted/60 space-y-2">
            <FileText className="w-8 h-8 text-cyber-muted/40" />
            <p className="text-xs">Chưa có phiên tác chiến nào được ghi lại trên đĩa (logs/sessions/).</p>
          </div>
        ) : (
          filtered.map((s) => {
            const dt = (s.created_at || "").replace("T", " ").slice(0, 19);
            const shortId = s.session_id.slice(0, 8);
            const isCompleted = s.status === "completed";

            return (
              <div
                key={s.session_id}
                className="p-2.5 rounded-lg bg-cyber-panel2 border border-cyber-border/70 hover:border-cyber-cyan/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <b className="text-slate-200">{dt}</b>
                    <span className="text-cyber-muted">({shortId})</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                        isCompleted
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>

                  <div className="text-xs text-cyber-cyan truncate flex items-center gap-1.5">
                    <Target className="w-3 h-3 text-cyber-cyan shrink-0" />
                    <span className="font-semibold">{s.target || "—"}</span>
                  </div>

                  <div className="text-[10.5px] text-cyber-muted">
                    Agent: <span className="text-slate-300">{s.agent}</span> &bull; {s.tool_executions} lệnh đã chạy &bull; Model: {s.model || "mặc định"}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {s.target && s.target !== "—" && (
                    <button
                      onClick={() => loadTargetIntoStore(s.target)}
                      className="px-2 py-1 rounded bg-cyber-panel border border-cyber-border text-cyber-muted hover:text-cyber-cyan text-[11px] transition-all"
                      title="Nạp target này vào ô mục tiêu tác chiến"
                    >
                      Nạp Target
                    </button>
                  )}

                  {s.has_report && (
                    <a
                      href={`/api/v1/audit/sessions/${encodeURIComponent(s.session_id)}/report`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded bg-cyber-cyan/10 border border-cyber-cyan/40 text-cyber-cyan hover:bg-cyber-cyan/20 text-[11px] font-semibold flex items-center gap-1 transition-all"
                    >
                      <span>Xem Báo cáo</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
