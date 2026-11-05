import React, { useState } from "react";
import { Bot, Terminal, History, Maximize2, Minimize2 } from "lucide-react";
import { LiveTerminal } from "./LiveTerminal";
import { AgentLogStream } from "./AgentLogStream";
import { AuditHistoryDeck } from "./AuditHistoryDeck";
import { useCampaignStore } from "../../stores/useCampaignStore";

export const DockedWorkspace: React.FC = () => {
  const { activeDockTab, setActiveDockTab, agentSteps, auditSessions } = useCampaignStore();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`border-t border-cyber-border bg-cyber-panel flex flex-col font-mono transition-all duration-200 ${
        isExpanded ? "h-[450px]" : "h-72"
      }`}
    >
      {/* Docked Navigation Tabs */}
      <div className="h-9 px-3 border-b border-cyber-border bg-[#090d14] flex items-center justify-between text-xs select-none">
        {/* Tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveDockTab("agent_log")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-semibold transition-all border-b-2 ${
              activeDockTab === "agent_log"
                ? "bg-cyber-panel text-cyber-neon border-cyber-neon"
                : "text-cyber-muted hover:text-cyber-text border-transparent"
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-cyber-neon" />
            <span>🤖 Nhật ký Agent (Live Stream)</span>
            {agentSteps.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyber-neon/10 text-cyber-neon border border-cyber-neon/30">
                {agentSteps.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveDockTab("terminal")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-semibold transition-all border-b-2 ${
              activeDockTab === "terminal"
                ? "bg-cyber-panel text-cyber-cyan border-cyber-cyan"
                : "text-cyber-muted hover:text-cyber-text border-transparent"
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-cyber-cyan" />
            <span>🖥️ Kali Terminal & CLI</span>
          </button>

          <button
            onClick={() => setActiveDockTab("history")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-semibold transition-all border-b-2 ${
              activeDockTab === "history"
                ? "bg-cyber-panel text-cyber-amber border-cyber-amber"
                : "text-cyber-muted hover:text-cyber-text border-transparent"
            }`}
          >
            <History className="w-3.5 h-3.5 text-cyber-amber" />
            <span>📜 Lịch sử các phiên pentest</span>
            {auditSessions.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyber-amber/10 text-cyber-amber border border-cyber-amber/30">
                {auditSessions.length}
              </span>
            )}
          </button>
        </div>

        {/* Height toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded text-cyber-muted hover:text-cyber-text"
          title={isExpanded ? "Thu nhỏ cửa sổ" : "Mở rộng cửa sổ tác chiến"}
        >
          {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Dock Content */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <div className={`h-full ${activeDockTab === "agent_log" ? "block" : "hidden"}`}>
          <AgentLogStream />
        </div>
        <div className={`h-full ${activeDockTab === "terminal" ? "block" : "hidden"}`}>
          <LiveTerminal />
        </div>
        <div className={`h-full ${activeDockTab === "history" ? "block" : "hidden"}`}>
          <AuditHistoryDeck />
        </div>
      </div>
    </div>
  );
};

