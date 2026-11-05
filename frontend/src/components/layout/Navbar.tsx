import React, { useEffect, useState } from "react";
import { Shield, Radio, Terminal, Cpu, Clock, RefreshCw } from "lucide-react";
import { useCampaignStore } from "../../stores/useCampaignStore";

export const Navbar: React.FC = () => {
  const { runnerStatus, target, isRunning, fetchRunnerStatus, fetchGraph } = useCampaignStore();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let interval: any = null;
    if (isRunning) {
      interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      setSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (total: number) => {
    const mins = Math.floor(total / 60).toString().padStart(2, "0");
    const secs = (total % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const isRunnerOnline = runnerStatus?.active;
  const runnerInfo = runnerStatus?.runners?.[0];

  return (
    <header className="h-14 border-b border-cyber-border bg-cyber-panel/90 backdrop-blur-md px-4 flex items-center justify-between z-20">
      {/* Brand & Identity */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-cyber-panel2 border border-cyber-border text-cyber-neon shadow-neon">
          <Shield className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyber-neon animate-ping" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-wider text-sm text-cyber-text">CAI_LO</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyber-neon/10 text-cyber-neon border border-cyber-neon/30">
              C2 MATRIX 3D
            </span>
          </div>
          <div className="text-[11px] font-mono text-cyber-muted flex items-center gap-2">
            <span>Target:</span>
            <b className="text-cyber-cyan">{target || "None"}</b>
          </div>
        </div>
      </div>

      {/* Center Tactical Telemetry */}
      <div className="hidden md:flex items-center gap-6 text-xs font-mono">
        <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-cyber-panel2 border border-cyber-border">
          <Clock className="w-3.5 h-3.5 text-cyber-muted" />
          <span className="text-cyber-muted">TIME:</span>
          <span className="font-semibold text-cyber-text">{formatTime(seconds)}</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-cyber-panel2 border border-cyber-border">
          <Cpu className="w-3.5 h-3.5 text-cyber-cyan" />
          <span className="text-cyber-muted">SWARM:</span>
          <span className="text-cyber-neon font-medium">4 Specialists Active</span>
        </div>
      </div>

      {/* Right: Kali Runner & Sync */}
      <div className="flex items-center gap-3">
        {/* Kali VM Pill */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono border transition-all ${
            isRunnerOnline
              ? "bg-cyber-neon/10 border-cyber-neon/40 text-cyber-neon shadow-neon"
              : "bg-cyber-panel2 border-cyber-border text-cyber-muted"
          }`}
          title={
            isRunnerOnline
              ? `Connected: ${runnerInfo?.hostname} (${runnerInfo?.ip}) | ${runnerInfo?.tools?.length} pentest tools ready`
              : "No Kali Runner connected"
          }
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isRunnerOnline ? "bg-cyber-neon animate-pulse" : "bg-cyber-muted"
            }`}
          />
          <Radio className="w-3.5 h-3.5" />
          <span className="font-semibold">
            {isRunnerOnline ? `Kali VM (${runnerInfo?.tools?.length || 28} tools)` : "Kali VM Offline"}
          </span>
        </div>

        {/* Refresh Graph button */}
        <button
          onClick={() => {
            fetchGraph();
            fetchRunnerStatus();
          }}
          className="p-1.5 rounded-lg bg-cyber-panel2 border border-cyber-border text-cyber-muted hover:text-cyber-cyan hover:border-cyber-cyan/50 transition-all"
          title="Làm mới trạng thái"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

