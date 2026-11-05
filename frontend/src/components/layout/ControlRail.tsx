import React, { useState } from "react";
import {
  Play,
  Square,
  Crosshair,
  Target,
  Bot,
  Zap,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Trash2,
  Lock,
  Unlock,
  ChevronDown,
  Layout,
  Layers,
} from "lucide-react";
import { useCampaignStore } from "../../stores/useCampaignStore";

export const ControlRail: React.FC = () => {
  const {
    target,
    prompt,
    agent,
    model,
    maxTurns,
    isAutonomy,
    isRunning,
    statusText,
    labStatus,
    availableAgents,
    availableModels,
    isRedactEnabled,
    setTarget,
    setPrompt,
    setAgent,
    setModel,
    setMaxTurns,
    setIsAutonomy,
    toggleRedact,
    clearTerminalLogs,
    startMission,
    stopMission,
    toggleLab,
    fillMockLabTarget,
  } = useCampaignStore();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  // Popular quick-pick models
  const quickModels = [
    { label: "Gemini 3.5 Lite", val: "gemini/gemini-3.5-flash-lite" },
    { label: "Gemini 2.5 Pro", val: "gemini/gemini-2.5-pro" },
    { label: "GPT-4o", val: "openai/gpt-4o" },
    { label: "Claude 3.5", val: "anthropic/claude-3-5-sonnet-20241022" },
    { label: "Ollama Local", val: "ollama/qwen2.5-coder:7b" },
  ];

  return (
    <div className="w-80 md:w-96 border-r border-cyber-border bg-cyber-panel/60 backdrop-blur-md flex flex-col h-[calc(100vh-3.5rem)] overflow-y-auto p-4 space-y-4">
      {/* 1. Scope & Target */}
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
          placeholder="vd: http://192.168.95.1:24001/basic/level2.php"
          className="w-full bg-cyber-panel2 border border-cyber-border rounded-lg px-3 py-2 text-xs font-mono text-cyber-text focus:outline-none focus:border-cyber-cyan transition-all"
        />
      </div>

      {/* 2. Mission Prompt */}
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

      {/* 3. Agent & Model Row */}
      <div className="space-y-3">
        {/* Agent Selector */}
        <div className="space-y-1">
          <label className="text-[11px] text-cyber-muted font-mono flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-cyber-cyan" /> Agent phụ trách
            </span>
            <span className="text-[10px] text-cyber-muted">
              {availableAgents.length > 0 ? `${availableAgents.length} agents sẵn sàng` : "Mặc định"}
            </span>
          </label>
          <select
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            className="w-full bg-cyber-panel2 border border-cyber-border rounded-lg px-2.5 py-1.5 text-xs text-cyber-text focus:outline-none focus:border-cyber-cyan"
          >
            <optgroup label="⭐ Khuyên dùng (Đơn Agent - Trực tiếp Kali VM)">
              <option value="kali_pentester_agent">🎯 Kali Pentester (Agent chính — Thao tác trực tiếp Kali VM)</option>
              <option value="web_pentester_agent">🌐 Web Pentester (Chuyên sâu kiểm thử Web/API)</option>
              <option value="ctf_agent">🚩 CTF Agent (Chuyên giải mã Flag & Challenge)</option>
            </optgroup>
            <optgroup label="🧪 Thử nghiệm đa Agent ảo (Simulation)">
              <option value="red_team_swarm_agent">Swarm Orchestrator (Mô phỏng phối hợp nhiều vai trò ảo)</option>
              <option value="apt_agent">APT Simulation Agent (Mô phỏng tấn công diện rộng)</option>
            </optgroup>
            {availableAgents.length > 0 && (
              <optgroup label="📋 Toàn bộ Agent hệ thống">
                {availableAgents.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.name} ({a.key})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Model (LLM) Combobox / Custom input */}
        <div className="space-y-1">
          <label className="text-[11px] text-cyber-muted font-mono flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3 text-cyber-neon" /> Model (LLM) — gõ để tìm / tự nhập
            </span>
          </label>
          <input
            list="cai-models-list"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="(tự động — theo cấu hình .env)"
            className="w-full bg-cyber-panel2 border border-cyber-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-cyber-text focus:outline-none focus:border-cyber-neon"
          />
          <datalist id="cai-models-list">
            <option value="gemini/gemini-3.5-flash-lite">Google Gemini 3.5 Flash Lite (Tối ưu nhất)</option>
            <option value="gemini/gemini-2.5-flash">Google Gemini 2.5 Flash</option>
            <option value="gemini/gemini-2.5-pro">Google Gemini 2.5 Pro</option>
            <option value="openai/gpt-4o">OpenAI GPT-4o</option>
            <option value="openai/gpt-4o-mini">OpenAI GPT-4o Mini</option>
            <option value="anthropic/claude-3-5-sonnet-20241022">Anthropic Claude 3.5 Sonnet</option>
            <option value="deepseek/deepseek-chat">DeepSeek V3 (Chat API)</option>
            <option value="ollama/qwen2.5-coder:7b">Ollama Local (qwen2.5-coder)</option>
            {availableModels.slice(0, 50).map((m, idx) => (
              <option key={idx} value={m.name}>
                {m.provider ? `[${m.provider}] ` : ""}{m.name}
              </option>
            ))}
          </datalist>

          {/* Quick Model Pills */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {quickModels.map((qm) => (
              <button
                key={qm.val}
                type="button"
                onClick={() => setModel(qm.val)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all ${
                  model === qm.val
                    ? "bg-cyber-neon/20 border-cyber-neon text-cyber-neon"
                    : "bg-cyber-panel2 border-cyber-border text-cyber-muted hover:text-cyber-text hover:border-cyber-cyan/50"
                }`}
              >
                {qm.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Budget & Autonomy Switch */}
      <div className="grid grid-cols-2 gap-3">
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

        <div className="flex items-center justify-between p-2 rounded-lg bg-cyber-panel2/80 border border-cyber-border self-end h-[34px]">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-cyber-neon" />
            <span className="text-[11px] font-medium text-cyber-text">HackerAI Loop</span>
          </div>
          <input
            type="checkbox"
            checked={isAutonomy}
            onChange={(e) => setIsAutonomy(e.target.checked)}
            className="w-4 h-4 accent-cyber-neon cursor-pointer"
          />
        </div>
      </div>

      {/* 5. Main Action Buttons */}
      <div className="space-y-2 pt-1">
        <div className="flex gap-2">
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

        {/* Quick Utility Tools (Clear Log & Redact Credentials) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={clearTerminalLogs}
            className="py-1.5 px-2 rounded-lg bg-cyber-panel2 border border-cyber-border text-cyber-muted hover:text-cyber-text hover:border-cyber-cyan/50 text-[11px] font-mono flex items-center justify-center gap-1.5 transition-all"
            title="Xóa bộ đệm log terminal hiện tại"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Xóa Log
          </button>

          <button
            onClick={toggleRedact}
            className={`py-1.5 px-2 rounded-lg border text-[11px] font-mono flex items-center justify-center gap-1.5 transition-all ${
              isRedactEnabled
                ? "bg-cyber-neon/10 border-cyber-neon/40 text-cyber-neon"
                : "bg-cyber-panel2 border-cyber-border text-cyber-muted hover:text-cyber-text"
            }`}
            title="Tự động che giấu mật khẩu, token, API keys trong log"
          >
            {isRedactEnabled ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            {isRedactEnabled ? "Che Secret: Bật" : "Che Secret: Tắt"}
          </button>
        </div>
      </div>

      {/* 6. Mission Status Callout */}
      <div className="p-3 rounded-lg bg-cyber-panel2 border border-cyber-border font-mono text-xs">
        <div className="text-[10px] text-cyber-muted uppercase tracking-wider mb-1">Trạng thái tác chiến</div>
        <div className="text-cyber-cyan flex items-center gap-2">
          {isRunning && <span className="w-2 h-2 rounded-full bg-cyber-cyan animate-ping" />}
          <span>{statusText}</span>
        </div>
      </div>

      {/* 7. Switch View: Classic 2D Link */}
      <a
        href="/ui/classic"
        className="p-2.5 rounded-lg bg-cyber-panel2 border border-cyber-cyan/30 text-cyber-cyan hover:bg-cyber-cyan/10 hover:border-cyber-cyan text-xs font-mono flex items-center justify-between transition-all"
      >
        <span className="flex items-center gap-2">
          <Layout className="w-4 h-4" />
          <span>Mở giao diện Classic (2D)</span>
        </span>
        <ExternalLink className="w-3.5 h-3.5" />
      </a>

      {/* 8. Built-in Mock Lab Panel */}
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

      {/* 9. Advanced Connection Config (Collapsible) */}
      <div className="border border-cyber-border rounded-lg overflow-hidden bg-cyber-panel2/40">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full p-2.5 text-xs text-cyber-muted font-mono flex items-center justify-between hover:text-cyber-text"
        >
          <span>Cấu hình kết nối API & Bảo mật</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        </button>

        {showAdvanced && (
          <div className="p-3 pt-0 space-y-2 border-t border-cyber-border text-xs font-mono">
            <div>
              <label className="text-[10px] text-cyber-muted">API Base URL</label>
              <input
                type="text"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="/ (cùng máy chủ) hoặc http://127.0.0.1:8000"
                className="w-full bg-cyber-panel border border-cyber-border rounded p-1.5 text-xs text-cyber-text"
              />
            </div>
            <div>
              <label className="text-[10px] text-cyber-muted">API Key (bỏ trống nếu dev-mode)</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="X-CAI-API-Key"
                className="w-full bg-cyber-panel border border-cyber-border rounded p-1.5 text-xs text-cyber-text"
              />
            </div>
            <div className="text-[10px] text-cyber-muted leading-relaxed pt-1">
              ⚠️ Chỉ sử dụng cho mục tiêu được ủy quyền kiểm thử. Không công khai ra mạng Internet nếu chưa bật xác thực.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
