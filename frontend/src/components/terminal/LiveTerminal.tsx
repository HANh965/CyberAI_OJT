import React, { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Terminal as TermIcon, Trash2, Send } from "lucide-react";
import { useCampaignStore } from "../../stores/useCampaignStore";

export const LiveTerminal: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastSeqRef = useRef<number>(0);
  const [inputVal, setInputVal] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const { target, runnerStatus, fetchGraph, fetchMemorySummary } = useCampaignStore();

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      theme: {
        background: "#06090e",
        foreground: "#cbd5e1",
        cursor: "#3ddc84",
        selectionBackground: "rgba(61, 220, 132, 0.3)",
        black: "#000000",
        red: "#ff3366",
        green: "#3ddc84",
        yellow: "#fcee0a",
        blue: "#00f0ff",
        magenta: "#b026ff",
        cyan: "#00f0ff",
        white: "#ffffff",
      },
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 12,
      lineHeight: 1.4,
      cursorBlink: true,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    term.writeln("\x1b[1;32m[CAI_LO Cyber Terminal]\x1b[0m Kết nối thời gian thực với Kali Linux Reverse Runner.");
    term.writeln("\x1b[90mGõ lệnh shell trực tiếp bên dưới để can thiệp tác chiến...\x1b[0m\r\n");

    xtermInstance.current = term;
    fitAddonRef.current = fitAddon;

    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      term.dispose();
    };
  }, []);

  // Poll logs from backend
  useEffect(() => {
    const pollLogs = async () => {
      try {
        const res = await fetch(`/api/v1/runner/terminal/logs?since_seq=${lastSeqRef.current}`);
        if (!res.ok) return;
        const data = await res.json();
        const events = data.events || [];
        if (data.last_seq !== undefined && data.last_seq > lastSeqRef.current) {
          lastSeqRef.current = data.last_seq;
        }

        if (xtermInstance.current && events.length > 0) {
          events.forEach((ev: any) => {
            if (ev.seq > lastSeqRef.current) lastSeqRef.current = ev.seq;
            if (ev.kind === "command") {
              const tag = ev.source === "manual" ? "\x1b[1;32m[MANUAL]\x1b[0m" : "\x1b[1;36m[AGENT]\x1b[0m";
              xtermInstance.current?.writeln(`\r\n${tag} \x1b[1;37m$ ${ev.text}\x1b[0m`);
            } else if (ev.kind === "output") {
              xtermInstance.current?.write(ev.text);
            }
          });
        }
      } catch (_) {}
    };

    const interval = setInterval(pollLogs, 1500);
    return () => clearInterval(interval);
  }, []);

  const runCommand = async (cmdToRun: string) => {
    const cmd = cmdToRun.trim();
    if (!cmd || isExecuting) return;

    setIsExecuting(true);
    setInputVal("");

    try {
      await fetch("/api/v1/runner/terminal/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: cmd,
          timeout: 60,
          target: target,
        }),
      });

      fetchGraph();
      fetchMemorySummary();
    } catch (err: any) {
      xtermInstance.current?.writeln(`\r\n\x1b[1;31m[ERROR] ${err.message}\x1b[0m`);
    } finally {
      setIsExecuting(false);
    }
  };

  const clearTerminal = async () => {
    if (xtermInstance.current) {
      xtermInstance.current.clear();
      lastSeqRef.current = 0;
    }
    try {
      await fetch("/api/v1/runner/terminal/logs", { method: "DELETE" });
    } catch (_) {}
  };

  const quickCommands = [
    { label: "id & uname", cmd: "id && uname -a" },
    { label: "ip a", cmd: "ip -br a" },
    { label: "ss -tulnp", cmd: "ss -tulnp" },
    { label: "nmap nhanh", cmd: "nmap -F 127.0.0.1" },
    { label: "check MockLab", cmd: "curl -I http://127.0.0.1:8888" },
  ];

  return (
    <div className="h-64 border-t border-cyber-border bg-cyber-panel flex flex-col font-mono">
      {/* Terminal Top Bar */}
      <div className="h-9 px-3 border-b border-cyber-border bg-cyber-panel2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <TermIcon className="w-4 h-4 text-cyber-neon" />
          <span className="font-semibold text-cyber-text">Kali Interactive Terminal</span>
          <span className="text-[10px] text-cyber-muted px-1.5 py-0.5 rounded bg-cyber-panel">
            {runnerStatus?.active ? "🟢 Kali Runner Active" : "🟡 Local Shell Fallback"}
          </span>
        </div>

        {/* Quick Action Chips */}
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="text-[11px] text-cyber-muted mr-1">Lệnh nhanh:</span>
          {quickCommands.map((q, idx) => (
            <button
              key={idx}
              onClick={() => runCommand(q.cmd)}
              className="px-2 py-0.5 rounded bg-cyber-panel text-cyber-muted hover:text-cyber-cyan hover:border-cyber-cyan/40 border border-cyber-border text-[11px] transition-all"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Tools */}
        <button
          onClick={clearTerminal}
          className="p-1 rounded text-cyber-muted hover:text-cyber-red transition-all"
          title="Xóa màn hình terminal"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Terminal Canvas */}
      <div className="flex-1 p-2 bg-[#06090e] overflow-hidden" ref={terminalRef} />

      {/* Input Row */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runCommand(inputVal);
        }}
        className="h-10 border-t border-cyber-border bg-[#080d14] px-3 flex items-center gap-2"
      >
        <span className="text-xs font-bold text-cyber-neon whitespace-nowrap">
          {runnerStatus?.active ? "kali@kali-vm:~#" : "local@cai-host:~$"}
        </span>
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Nhập lệnh bash/zsh (Enter để chạy)..."
          className="flex-1 bg-transparent border-none text-xs text-cyber-text font-mono focus:outline-none"
        />
        <button
          type="submit"
          disabled={isExecuting || !inputVal.trim()}
          className="px-3 py-1 rounded bg-cyber-panel2 border border-cyber-border text-xs text-cyber-cyan hover:border-cyber-cyan/50 disabled:opacity-50 flex items-center gap-1 transition-all"
        >
          <Send className="w-3 h-3" /> Chạy
        </button>
      </form>
    </div>
  );
};

