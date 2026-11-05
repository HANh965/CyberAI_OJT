export type NodeType = "attacker" | "host" | "port" | "endpoint" | "finding" | "flag" | "credential";

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  layer: number;
  meta: Record<string, any>;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export interface AttackGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    hosts: number;
    ports: number;
    endpoints: number;
    credentials: number;
    findings: number;
  };
}

export interface FindingItem {
  id?: number;
  host: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  evidence?: string;
  source_tool?: string;
  updated_at?: string;
}

export interface CredentialItem {
  id?: number;
  host: string;
  username?: string;
  secret: string;
  secret_type: string;
  service?: string;
  updated_at?: string;
}

export interface TerminalEvent {
  seq: number;
  timestamp: number;
  kind: "command" | "output";
  source: "agent" | "manual";
  task_id: string;
  text: string;
}

export interface RunnerStatus {
  active: boolean;
  count: number;
  token: string;
  preferred_ip: string;
  runners: Array<{
    runner_id: string;
    hostname: string;
    os: string;
    ip: string;
    tools: string[];
    transport: string;
    uptime_seconds: number;
    last_seen_seconds: number;
  }>;
}

export interface MockLabStatus {
  running: boolean;
  port: number;
  url: string;
  challenges_total: number;
  challenges_solved: number;
  challenges: Array<{
    id: string;
    name: string;
    solved: boolean;
    points: number;
  }>;
}


export interface AgentItem {
  name: string;
  key: string;
  description?: string;
  type?: string;
  pattern_type?: string | null;
}

export interface ModelItem {
  name: string;
  provider?: string | null;
  category?: string | null;
  description?: string | null;
}
