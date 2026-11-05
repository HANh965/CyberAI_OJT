import React from "react";
import { Play, Square, Crosshair, Target, Bot, Zap, ExternalLink, ShieldCheck } from "lucide-react";
import { useCampaignStore } from "../../stores/useCampaignStore";

export const ControlRail: React.FC = () => {
  const {
    target,
    prompt,
    agent,
    maxTurns,
    isAutonomy,
    isRunning,
    statusText,
    labStatus,
    setTarget,
    setPrompt,
    setAgent,
    setMaxTurns,
    setIsAutonomy,
    startMission,
    stopMission,
    toggleLab,
    fillMockLabTarget,
  } = useCampaignStore();

  return (
    <div className="w-80 md:w-96 border-r border-cyber-border bg-cyber-panel/60 backdrop-blur-md flex flex-col h-[calc(100vh-3.5rem)] overflow-y-auto p-4 space-y-4">
      {/* Scope & Target */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-cyber-text flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-cyber-cyan" />
            Mục tiêu (Scope RoE)
          </label>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyber-neon/10 text-cyber-neon border border-cyber-neon/30 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Scope Guard Bật
          </span>
        </div>
        <input
          type="text"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="vd: http://127.0.0.1:8888 hoặc 10.10.14.0/24"
          className="w-full bg-cyber-panel2 border border-cyber-border rounded-lg px-3 py-2 text-xs font-mono text-cyber-text focus:outline-none focus:border-cyber-cyan transition-all"
        />
      </div>

      {/* Mission Prompt */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-cyber-text flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-cyber-neon" />
          Chỉ thị tác chiến (Prompt)
        </label>
        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Chỉ thị cho agent tự lập kế hoạch..."
          className="w-full bg-cyber-panel2 border border-cyber-border rounded-lg p-2.5 text-xs text-cyber-text focus:outline-none focus:border-cyber-neon transition-all resize-none leading-relaxed"
        />
      </div>

      {/* Agent & Budget */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] text-cyber-muted font-mono">Agent</label>
          <select
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            className="w-full bg-cyber-panel2 border border-cyber-border rounded-lg px-2 py-1.5 text-xs text-cyber-text focus:outline-none focus:border-cyber-cyan"
          >
            <option value="red_team_swarm_agent">Swarm Orchestrator (Đa Agent)</option>
            <option value="kali_pentester_agent">Kali Pentester (Độc lập)</option>
            <option value="web_pentester_agent">Web Pentester</option>
            <option value="autonomous_pentester_agent">Autonomy Master</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-cyber-muted font-mono">Ngân sách lượt</label>
          <input
            type="number"
            min={1}
            max={100}
            value={maxTurns}
            onChange={(e) => setMaxTurns(parseInt(e.target.value) || 30)}
            className="w-full bg-cyber-panel2 border border-cyber-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-cyber-text focus:outline-none focus:border-cyber-cyan"
          />
        </div>
      </div>

      {/* Autonomy switch */}
      <div className="flex items-center justify-between p-2.5 rounded-lg bg-cyber-panel2/80 border border-cyber-border">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyber-neon" />
          <span className="text-xs font-medium text-cyber-text">Vòng lặp HackerAI</span>
        </div>
        <input
          type="checkbox"
          checked={isAutonomy}
          onChange={(e) => setIsAutonomy(e.target.checked)}
          className="w-4 h-4 accent-cyber-neon cursor-pointer"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-1">
        {!isRunning ? (
          <button
            onClick={startMission}
            className="flex-1 py-2.5 px-4 rounded-lg bg-gradient-to-r from-emerald-600 to-cyber-neon text-black font-semibold text-xs tracking-wider flex items-center justify-center gap-2 shadow-neon hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <Play className="w-4 h-4 fill-current" />
            PHÁT ĐỘNG
          </button>
        ) : (
          <button
            onClick={stopMission}
            className="flex-1 py-2.5 px-4 rounded-lg bg-cyber-red/20 border border-cyber-red text-cyber-red font-semibold text-xs tracking-wider flex items-center justify-center gap-2 hover:bg-cyber-red/30 active:scale-[0.98] transition-all"
          >
            <Square className="w-4 h-4 fill-current" />
            DỪNG LẠI
          </button>
        )}
      </div>

      {/* Mission Status Callout */}
      <div className="p-3 rounded-lg bg-cyber-panel2 border border-cyber-border font-mono text-xs">
        <div className="text-[10px] text-cyber-muted uppercase tracking-wider mb-1">Trạng thái tác chiến</div>
        <div className="text-cyber-cyan flex items-center gap-2">
          {isRunning && <span className="w-2 h-2 rounded-full bg-cyber-cyan animate-ping" />}
          <span>{statusText}</span>
        </div>
      </div>

      {/* Built-in Mock Lab Panel */}
      <div className="p-3.5 rounded-xl bg-gradient-to-br from-cyber-panel2 to-cyber-panel border border-emerald-900/40 relative overflow-hidden space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-300">Mock Lab (Cổng 8888)</span>
          </div>
          <button
            onClick={toggleLab}
            className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
              labStatus?.running
                ? "bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20"
                : "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20"
            }`}
          >
            {labStatus?.running ? "Dừng Lab" : "Bật Lab"}
          </button>
        </div>

        <div className="text-xs font-mono text-cyber-muted flex items-center justify-between">
          <span>Tiến độ cờ CTF:</span>
          <b className="text-cyber-neon">
            {labStatus?.challenges_solved || 0}/{labStatus?.challenges_total || 7} cờ
          </b>
        </div>

        <div className="flex gap-2 pt-1">
          {labStatus?.running && (
            <a
              href="http://127.0.0.1:8888"
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-1.5 px-2 rounded bg-cyber-panel border border-cyber-border text-[11px] font-mono text-cyber-cyan flex items-center justify-center gap-1 hover:border-cyber-cyan/50"
            >
              Mở Lab <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <button
            onClick={fillMockLabTarget}
            className="flex-1 py-1.5 px-2 rounded bg-cyber-panel border border-cyber-border text-[11px] font-mono text-cyber-muted hover:text-cyber-text hover:border-cyber-border/80"
          >
            Nạp vào mục tiêu
          </button>
        </div>
      </div>
    </div>
  );
};

