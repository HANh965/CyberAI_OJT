import React, { useState } from "react";
import { ShieldAlert, Download, FileJson, FileText, CheckCircle2, AlertTriangle, Search, Filter } from "lucide-react";
import { useCampaignStore } from "../../stores/useCampaignStore";
import { FindingItem } from "../../types";

export const FindingsTriageTab: React.FC = () => {
  const { findings, target } = useCampaignStore();
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filtered = findings.filter((f) => {
    if (filterSeverity !== "ALL" && f.severity !== filterSeverity) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const content = `${f.title} ${f.host} ${f.evidence || ""} ${f.source_tool || ""}`.toLowerCase();
      if (!content.includes(q)) return false;
    }
    return true;
  });

  const exportMarkdown = () => {
    let md = `# BÁO CÁO PHÁT HIỆN LỖ HỔNG (FINDINGS TRIAGE REPORT)\n`;
    md += `**Mục tiêu:** \`${target || "None"}\`\n`;
    md += `**Thời gian xuất:** \`${new Date().toISOString()}\`\n`;
    md += `**Tổng số phát hiện:** ${findings.length}\n\n---\n\n`;

    findings.forEach((f, idx) => {
      md += `### ${idx + 1}. [${f.severity}] ${f.title}\n`;
      md += `- **Host:** \`${f.host}\`\n`;
      if (f.source_tool) md += `- **Nguồn phát hiện:** \`${f.source_tool}\`\n`;
      if (f.updated_at) md += `- **Thời gian:** \`${f.updated_at}\`\n`;
      if (f.evidence) {
        md += `\n**Bằng chứng (Evidence):**\n\`\`\`\n${f.evidence}\n\`\`\`\n`;
      }
      md += `\n---\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `findings_report_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const data = JSON.stringify({ target, export_date: new Date().toISOString(), findings }, null, 2);
    const blob = new Blob([data], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `findings_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-[#06090e] font-mono text-xs overflow-hidden">
      {/* Top Header & Export Buttons */}
      <div className="h-10 px-3 border-b border-cyber-border bg-cyber-panel2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-cyber-red" />
          <span className="font-semibold text-cyber-text">🔎 Phát hiện · nghi ngờ — cần xác minh</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyber-panel border border-cyber-border text-cyber-cyan">
            {findings.length} mục
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportMarkdown}
            className="px-2.5 py-1 rounded bg-cyber-panel border border-cyber-border text-[11px] text-cyber-muted hover:text-cyber-text hover:border-cyber-cyan/50 flex items-center gap-1.5 transition-all"
            title="Xuất danh sách dạng Markdown"
          >
            <FileText className="w-3.5 h-3.5 text-cyber-cyan" />
            <span>Xuất .md</span>
          </button>

          <button
            onClick={exportJson}
            className="px-2.5 py-1 rounded bg-cyber-panel border border-cyber-border text-[11px] text-cyber-muted hover:text-cyber-text hover:border-cyber-amber/50 flex items-center gap-1.5 transition-all"
            title="Xuất danh sách dạng JSON"
          >
            <FileJson className="w-3.5 h-3.5 text-cyber-amber" />
            <span>.json</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-2.5 border-b border-cyber-border bg-[#080d14] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-2 py-0.5 rounded text-[11px] border transition-all ${
                filterSeverity === sev
                  ? sev === "CRITICAL"
                    ? "bg-cyber-red/20 border-cyber-red text-cyber-red font-bold"
                    : sev === "HIGH"
                    ? "bg-orange-500/20 border-orange-500 text-orange-400 font-bold"
                    : "bg-cyber-neon/20 border-cyber-neon text-cyber-neon font-bold"
                  : "bg-cyber-panel2 border-cyber-border text-cyber-muted hover:text-cyber-text"
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-cyber-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tiêu đề, host, evidence..."
            className="w-full bg-cyber-panel border border-cyber-border rounded px-2 py-1 text-xs text-cyber-text focus:outline-none focus:border-cyber-cyan"
          />
        </div>
      </div>

      {/* Findings List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-cyber-muted space-y-2 font-mono text-center">
            <CheckCircle2 className="w-8 h-8 text-cyber-muted/40" />
            <p className="text-xs">Chưa có phát hiện nào. Các kết quả nghi có lỗ hổng sẽ hiện ở đây để bạn phân loại.</p>
          </div>
        ) : (
          filtered.map((f, idx) => {
            const isCrit = f.severity === "CRITICAL";
            const isHigh = f.severity === "HIGH";
            return (
              <div
                key={idx}
                className={`p-3 rounded-lg border font-mono transition-all ${
                  isCrit
                    ? "bg-cyber-red/5 border-cyber-red/30 hover:border-cyber-red"
                    : isHigh
                    ? "bg-amber-500/5 border-amber-500/30 hover:border-amber-500"
                    : "bg-cyber-panel2 border-cyber-border hover:border-cyber-cyan/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isCrit
                            ? "bg-cyber-red/20 text-cyber-red border border-cyber-red/40"
                            : isHigh
                            ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
                            : "bg-cyber-panel text-cyber-cyan border border-cyber-border"
                        }`}
                      >
                        {f.severity}
                      </span>
                      <span className="font-semibold text-cyber-text text-xs break-all">{f.title}</span>
                    </div>

                    <div className="text-[11px] text-cyber-muted flex items-center gap-3">
                      <span>Host: <b className="text-cyber-text">{f.host}</b></span>
                      {f.source_tool && <span>Tool: <b className="text-cyber-cyan">{f.source_tool}</b></span>}
                      {f.updated_at && <span>{f.updated_at.split("T")[1]?.slice(0, 8)}</span>}
                    </div>
                  </div>
                </div>

                {f.evidence && (
                  <details className="mt-2 text-[11px] cursor-pointer">
                    <summary className="text-cyber-cyan hover:underline select-none">Xem bằng chứng kỹ thuật (Evidence)</summary>
                    <pre className="mt-1.5 p-2 rounded bg-[#040609] border border-cyber-border text-cyber-muted text-[11px] overflow-x-auto whitespace-pre-wrap word-break-all max-h-48">
                      {f.evidence}
                    </pre>
                  </details>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
