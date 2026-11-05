import React, { useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw, RefreshCw, Terminal, Info, Copy } from "lucide-react";
import { useCampaignStore } from "../../stores/useCampaignStore";
import { GraphNode } from "../../types";

const NODE_COLORS: Record<string, { fill: string; stroke: string; text: string; badge: string }> = {
  attacker: { fill: "#0f291e", stroke: "#3ddc84", text: "#3ddc84", badge: "bg-emerald-500/20 text-emerald-400" },
  host: { fill: "#102338", stroke: "#4ea1ff", text: "#93c5fd", badge: "bg-blue-500/20 text-blue-400" },
  port: { fill: "#211538", stroke: "#a855f7", text: "#d8b4fe", badge: "bg-purple-500/20 text-purple-400" },
  endpoint: { fill: "#1e1b38", stroke: "#818cf8", text: "#c7d2fe", badge: "bg-indigo-500/20 text-indigo-400" },
  finding: { fill: "#311115", stroke: "#ff5c5c", text: "#fca5a5", badge: "bg-red-500/20 text-red-400" },
  flag: { fill: "#332409", stroke: "#fbbf24", text: "#fde68a", badge: "bg-amber-500/20 text-amber-400" },
  credential: { fill: "#2d230c", stroke: "#f59e0b", text: "#fcd34d", badge: "bg-amber-500/20 text-amber-400" },
};

export const Mindmap2D: React.FC = () => {
  const { graphData, fetchGraph, setSelectedNode, setActiveDockTab } = useCampaignStore();
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [inspectNode, setInspectNode] = useState<GraphNode | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".node-group")) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.12 : -0.12;
    setScale((s) => Math.min(2.5, Math.max(0.4, s + delta)));
  };

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  // Group nodes by layer (0..3)
  const layers: Record<number, GraphNode[]> = { 0: [], 1: [], 2: [], 3: [] };
  nodes.forEach((n) => {
    const l = n.layer in layers ? n.layer : 2;
    layers[l].push(n);
  });

  const layerX: Record<number, number> = { 0: 90, 1: 300, 2: 540, 3: 780 };
  const H = 360;
  const posMap: Record<string, { x: number; y: number; node: GraphNode }> = {};

  Object.keys(layers).forEach((lkStr) => {
    const lk = parseInt(lkStr);
    const list = layers[lk];
    const count = list.length;
    list.forEach((n, idx) => {
      const x = layerX[lk] || 400;
      const step = H / (count + 1);
      const y = Math.round(step * (idx + 1));
      posMap[n.id] = { x, y, node: n };
    });
  });

  return (
    <div className="flex flex-col h-full bg-[#06090e] font-mono text-xs overflow-hidden select-none">
      {/* Controls Bar */}
      <div className="h-10 px-3 border-b border-cyber-border bg-cyber-panel2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-cyber-muted">Sơ đồ Cây Tấn Công (2D):</span>
          <span className="text-[11px] text-cyber-cyan font-bold">{nodes.length} nodes · {edges.length} edges</span>
        </div>

        {/* Legend */}
        <div className="hidden md:flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-[#3ddc84]" /> Attacker</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-[#4ea1ff]" /> Host</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-[#a855f7]" /> Port/Web</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-[#ff5c5c]" /> Lỗ hổng</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-[#fbbf24]" /> Flag/Cred</span>
        </div>

        {/* Zoom & Action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
            className="p-1 rounded bg-cyber-panel border border-cyber-border text-cyber-muted hover:text-cyber-text"
            title="Phóng to"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setScale((s) => Math.max(0.4, s - 0.2))}
            className="p-1 rounded bg-cyber-panel border border-cyber-border text-cyber-muted hover:text-cyber-text"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}
            className="p-1 rounded bg-cyber-panel border border-cyber-border text-cyber-muted hover:text-cyber-text"
            title="Căn giữa"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={fetchGraph}
            className="px-2 py-1 rounded bg-cyber-panel border border-cyber-border text-cyber-cyan hover:border-cyber-cyan/50 flex items-center gap-1 text-[11px]"
            title="Làm mới sơ đồ"
          >
            <RefreshCw className="w-3 h-3" /> Làm mới
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing bg-[#05070a]"
      >
        <svg className="w-full h-full" viewBox="0 0 900 400" preserveAspectRatio="xMidYMid meet">
          <defs>
            <pattern id="mindmap-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#15202b" />
            </pattern>
          </defs>
          <rect width="3000" height="2000" x="-1000" y="-1000" fill="url(#mindmap-grid)" />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
            {/* Edges */}
            {edges.map((e, idx) => {
              const src = posMap[e.source];
              const dst = posMap[e.target];
              if (!src || !dst) return null;
              const dx = (dst.x - src.x) * 0.5;
              const isVuln = dst.node.type === "finding";
              const isFlag = dst.node.type === "flag" || dst.node.type === "credential";
              return (
                <path
                  key={idx}
                  d={`M ${src.x} ${src.y} C ${src.x + dx} ${src.y}, ${dst.x - dx} ${dst.y}, ${dst.x} ${dst.y}`}
                  fill="none"
                  stroke={isVuln ? "#7f1d1d" : isFlag ? "#78350f" : "#1e293b"}
                  strokeWidth={isVuln || isFlag ? "2.2" : "1.6"}
                  strokeDasharray={isVuln ? "4 2" : "none"}
                />
              );
            })}

            {/* Nodes */}
            {Object.values(posMap).map(({ x, y, node }) => {
              const cfg = NODE_COLORS[node.type] || NODE_COLORS.host;
              const isSelected = inspectNode?.id === node.id;
              const r = node.type === "attacker" ? 22 : node.type === "host" ? 20 : node.type === "finding" || node.type === "flag" ? 18 : 16;
              return (
                <g
                  key={node.id}
                  className="node-group cursor-pointer transition-transform hover:scale-110"
                  transform={`translate(${x}, ${y})`}
                  onClick={() => {
                    setInspectNode(node);
                    setSelectedNode(node);
                  }}
                >
                  <circle
                    r={r}
                    fill={cfg.fill}
                    stroke={isSelected ? "#ffffff" : cfg.stroke}
                    strokeWidth={isSelected ? "2.5" : "1.6"}
                    className="transition-all"
                  />
                  <text
                    y={r + 14}
                    textAnchor="middle"
                    fill={cfg.text}
                    fontSize="10"
                    fontWeight="600"
                    className="select-none pointer-events-none"
                  >
                    {node.label.length > 20 ? node.label.slice(0, 18) + "…" : node.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Inspector Bottom Pill / Card */}
        {inspectNode ? (
          <div className="absolute bottom-3 left-3 right-3 p-3 rounded-lg bg-cyber-panel2/95 border border-cyber-cyan/50 backdrop-blur shadow-neon flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${NODE_COLORS[inspectNode.type]?.badge}`}>
                {inspectNode.type}
              </span>
              <span className="font-semibold text-cyber-text truncate text-xs">{inspectNode.label}</span>
              {inspectNode.meta && (
                <span className="text-[11px] text-cyber-muted truncate hidden sm:inline">
                  {inspectNode.meta.host && `Host: ${inspectNode.meta.host} `}
                  {inspectNode.meta.port && `| Port: ${inspectNode.meta.port} `}
                  {inspectNode.meta.service && `| Dịch vụ: ${inspectNode.meta.service} `}
                  {inspectNode.meta.secret && `| Secret: ${inspectNode.meta.secret} `}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setActiveDockTab("terminal");
                }}
                className="px-2.5 py-1 rounded bg-cyber-panel border border-cyber-cyan/40 text-cyber-cyan hover:bg-cyber-cyan/10 text-xs flex items-center gap-1"
              >
                <Terminal className="w-3 h-3" /> Sang Terminal
              </button>
              <button
                onClick={() => setInspectNode(null)}
                className="text-cyber-muted hover:text-cyber-text text-xs px-1.5"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <div className="absolute bottom-2 left-3 text-[11px] text-cyber-muted font-mono flex items-center gap-1.5 pointer-events-none">
            <Info className="w-3.5 h-3.5 text-cyber-cyan" />
            <span>Nhấp vào một nút trên sơ đồ để xem chi tiết hoặc gửi lệnh kiểm thử sang Terminal.</span>
          </div>
        )}
      </div>
    </div>
  );
};
