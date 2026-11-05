import React, { useEffect } from "react";
import { Navbar } from "./components/layout/Navbar";
import { ControlRail } from "./components/layout/ControlRail";
import { TriageDeck } from "./components/layout/TriageDeck";
import { DockedWorkspace } from "./components/terminal/DockedWorkspace";
import { CyberMatrix3D } from "./components/cyber3d/CyberMatrix3D";
import { useCampaignStore } from "./stores/useCampaignStore";

export const App: React.FC = () => {
  const { fetchGraph, fetchRunnerStatus, fetchLabStatus, fetchMemorySummary, fetchAgents, fetchModels, fetchAuditSessions, show3DMatrix } = useCampaignStore();

  useEffect(() => {
    // Initial data fetch
    fetchGraph();
    fetchRunnerStatus();
    fetchLabStatus();
    fetchMemorySummary();
    fetchAgents();
    fetchModels();
    fetchAuditSessions();

    // Periodic telemetry sync
    const interval = setInterval(() => {
      fetchGraph();
      fetchRunnerStatus();
      fetchLabStatus();
      fetchMemorySummary();
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-cyber-bg text-cyber-text">
      {/* Top Tactical Navigation */}
      <Navbar />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Mission Control Rail */}
        <ControlRail />

        {/* Center: 3D Cyber Matrix Canvas OR Full-height Docked Workspace */}
        <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
          {show3DMatrix ? (
            <>
              {/* 3D Attack Topography Canvas */}
              <div className="flex-1 relative overflow-hidden min-h-0">
                <CyberMatrix3D />
              </div>
              {/* Bottom: Docked xterm.js Terminal */}
              <DockedWorkspace isStandalone={false} />
            </>
          ) : (
            /* Full-Height Standalone Workspace */
            <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden">
              <DockedWorkspace isStandalone={true} />
            </div>
          )}
        </div>

        {/* Right: Intelligence & Triage Deck */}
        <TriageDeck />
      </div>
    </div>
  );
};

export default App;

