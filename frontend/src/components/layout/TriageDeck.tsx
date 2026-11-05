import React from "react";
import { AlertTriangle, Key, ShieldAlert, Flag, CheckCircle2, Copy } from "lucide-react";
import { useCampaignStore } from "../../stores/useCampaignStore";

export const TriageDeck: React.FC = () => {
  const { findings, credentials, selectedNode } = useCampaignStore();

  const criticalHighCount = findings.filter(
    (f) => f.severity === "CRITICAL" || f.severity === "HIGH"
  ).length;
  const mediumLowCount = findings.filter(
    (f) => f.severity === "MEDIUM" || f.severity === "LOW" || f.severity === "INFO"
  ).length;

  const copyText = (val: string) => {
    navigator.clipboard.writeText(val);
  };

  return (
    <div className="w-80 md:w-96 border-l border-cyber-border bg-cyber-panel/60 backdrop-blur-md flex flex-col h-[calc(100vh-3.5rem)] overflow-y-auto p-4 space-y-4">
      {/* 3D Inspector HUD Card (when a node is clicked in 3D) */}
      {selectedNode && (
        <div className="p-3.5 rounded-xl bg-cyber-panel2 border border-cyber-cyan/40 shadow-cyan space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-cyber-cyan uppercase tracking-wider">
              [3D Node Inspector]
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30">
              {selectedNode.type}
            </span>
          </div>
          <div className="font-mono text-sm font-semibold text-cyber-text break-all">
            {selectedNode.label}
          </div>
          {selectedNode.meta && (
            <div className="text-[11px] font-mono text-cyber-muted space-y-1 pt-1 border-t border-cyber-border">
              {selectedNode.meta.host && <div>Host: <b className="text-cyber-text">{selectedNode.meta.host}</b></div>}
              {selectedNode.meta.port && <div>Port: <b className="text-cyber-neon">{selectedNode.meta.port}/{selectedNode.meta.proto}</b></div>}
              {selectedNode.meta.service && <div>Dịch vụ: {selectedNode.meta.service} {selectedNode.meta.version}</div>}
              {selectedNode.meta.severity && <div>Mức độ: <b className="text-cyber-red">{selectedNode.meta.severity}</b></div>}
              {selectedNode.meta.secret && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-cyber-amber break-all">{selectedNode.meta.secret}</span>
                  <button onClick={() => copyText(selectedNode.meta.secret)} className="text-cyber-muted hover:text-cyber-neon">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Severity Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-cyber-red/10 border border-cyber-red/30 space-y-1">
          <div className="text-[11px] font-mono text-red-300 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-cyber-red" />
            Nghiêm trọng / Cao
          </div>
          <div className="text-2xl font-bold font-mono text-cyber-red">{criticalHighCount}</div>
        </div>

        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
          <div className="text-[11px] font-mono text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-cyber-amber" />
            Trung bình / Thấp
          </div>
          <div className="text-2xl font-bold font-mono text-cyber-amber">{mediumLowCount}</div>
        </div>
      </div>

      {/* Captured Loot (Flags & Credentials) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-cyber-text flex items-center gap-1.5">
            <Flag className="w-3.5 h-3.5 text-cyber-amber" />
            Chiến lợi phẩm (Flags &amp; Passwords)
          </div>
          <span className="text-[11px] font-mono text-cyber-muted">{credentials.length} mục</span>
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {credentials.length === 0 ? (
            <div className="text-xs text-cyber-muted font-mono p-3 rounded-lg bg-cyber-panel2 border border-cyber-border text-center">
              Chưa có cờ hay mật khẩu nào được thu thập.
            </div>
          ) : (
            credentials.map((c, i) => (
              <div
                key={i}
                className="p-2.5 rounded-lg bg-cyber-panel2 border border-cyber-border font-mono text-xs flex items-center justify-between hover:border-cyber-amber/50 transition-all"
              >
                <div className="truncate pr-2">
                  <div className="text-[10px] text-cyber-muted uppercase">[{c.secret_type}] {c.host}</div>
                  <div className="text-cyber-amber font-semibold truncate">
                    {c.username ? `${c.username}:` : ""}{c.secret}
                  </div>
                </div>
                <button
                  onClick={() => copyText(c.secret)}
                  className="p-1 rounded text-cyber-muted hover:text-cyber-neon hover:bg-cyber-panel"
                  title="Sao chép"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Vulnerabilities & Findings List */}
      <div className="space-y-2 flex-1 flex flex-col">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-cyber-text flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-cyber-red" />
            Lỗ hổng đã ghi nhận
          </div>
          <span className="text-[11px] font-mono text-cyber-muted">{findings.length} lỗ hổng</span>
        </div>

        <div className="space-y-2 overflow-y-auto flex-1">
          {findings.length === 0 ? (
            <div className="text-xs text-cyber-muted font-mono p-4 rounded-lg bg-cyber-panel2 border border-cyber-border text-center">
              Chưa phát hiện lỗ hổng. Hệ thống đang tiến hành trinh sát và dò quét.
            </div>
          ) : (
            findings.map((f, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-cyber-panel2 border border-cyber-border space-y-1 hover:border-cyber-red/50 transition-all text-xs"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      f.severity === "CRITICAL"
                        ? "bg-red-500/20 text-red-400 border border-red-500/40"
                        : f.severity === "HIGH"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    }`}
                  >
                    {f.severity}
                  </span>
                  <span className="text-[10px] font-mono text-cyber-muted">{f.host}</span>
                </div>
                <div className="font-semibold text-cyber-text leading-snug">{f.title}</div>
                {f.evidence && (
                  <div className="text-[11px] font-mono text-cyber-muted bg-cyber-panel p-1.5 rounded border border-cyber-border/60 truncate">
                    {f.evidence}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

