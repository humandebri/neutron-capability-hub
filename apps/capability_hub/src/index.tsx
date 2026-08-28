import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { callTool, createMsgBusClient, isJsonObject, type JsonObject, type JsonValue, type MsgBusEndpointId } from "neutron-tools/app";
import "./style.scss";

const APPS = [
  { id: "github_driver", tile: "github", name: "GitHub", role: "Source control", accent: "mint", tools: ["repositories", "issues", "create"] },
  { id: "task_board", tile: "tasks", name: "Tasks", role: "Durable work", accent: "lime", tools: ["list", "create", "complete"] },
  { id: "cycles_checkout", tile: "cycles", name: "Cycles", role: "Canister fuel", accent: "amber", tools: ["quote", "checkout", "status"] },
  { id: "x402_guard", tile: "guard", name: "x402 Guard", role: "Spend policy", accent: "pink", tools: ["inspect", "allow/deny"] },
] as const;
const SUMMARIES = {
  github_driver: "github_driver_summary",
  task_board: "tasks_summary",
  cycles_checkout: "cycles_checkout_summary",
  x402_guard: "x402_policy_summary",
} as const;

function App() {
  const client = useMemo(() => createMsgBusClient(), []);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [live, setLive] = useState<Set<string>>(new Set());
  const [audit, setAudit] = useState<JsonValue[]>([]);
  const [summaries, setSummaries] = useState<Record<string, JsonValue>>({});
  const [summaryErrors, setSummaryErrors] = useState<Record<string, string>>({});
  const [connectedSummaries, setConnectedSummaries] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      const [appsValue, endpointsValue, auditValue] = await Promise.all([
        client.listApps(), client.listEndpoints(), callTool({ target: "kernel", name: "audit.list", arguments: {} }),
      ]);
      setInstalled(new Set(arrayRecords(appsValue, "apps").map((row) => text(row.id))));
      setLive(new Set(arrayRecords(endpointsValue, "endpoints").map((row) => text(row.appId))));
      setAudit(arrayRecords(auditValue, "entries").slice(-8).reverse()); setError(null);
    } catch (reason) { setError(message(reason)); }
  }, [client]);
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 15_000); return () => clearInterval(timer); }, [refresh]);
  useEffect(() => {
    if (connectedSummaries.size === 0) return;
    const timer = setInterval(() => void refreshSummaries([...connectedSummaries]), 15_000);
    return () => clearInterval(timer);
  }, [connectedSummaries]);
  async function open(appId: string, tileId: string) { await callTool({ target: "kernel", name: "workspace.open_tile", arguments: { appId, tileId, reuseExisting: true } }, 30); }
  async function refreshSummaries(appIds: string[]) {
    const nextValues: Record<string, JsonValue> = {};
    const nextErrors: Record<string, string> = {};
    const successful = new Set<string>();
    for (const appId of appIds) {
      const tool = SUMMARIES[appId as keyof typeof SUMMARIES];
      if (!tool) continue;
      try {
        nextValues[appId] = await callTool({ target: `app:${appId}:background` as MsgBusEndpointId, name: tool, arguments: {} }, 30);
        successful.add(appId);
      } catch (reason) { nextErrors[appId] = message(reason); }
    }
    setSummaries((current) => ({ ...current, ...nextValues }));
    setSummaryErrors(nextErrors);
    return successful;
  }
  async function connectSummaries() {
    setConnecting(true);
    try {
      const candidates = APPS.filter((app) => installed.has(app.id)).map((app) => app.id);
      setConnectedSummaries(await refreshSummaries(candidates));
    } finally { setConnecting(false); }
  }
  const ready = APPS.filter((app) => installed.has(app.id)).length;
  return <main className="hub-app">
    <header><div><p className="eyebrow">PERSONAL CAPABILITY PLANE</p><h1>Everything you can do,<br/><em>without sharing the keys.</em></h1></div><div className="readiness"><strong>{ready}/{APPS.length}</strong><span>capability nodes installed</span></div></header>
    {error && <div className="error">{error}</div>}
    <section className="circuit" aria-label="Capability circuit">
      <div className="bus"><span>NEUTRON</span><i></i><b>Kernel consent</b></div>
      <div className="nodes">{APPS.map((app) => <article key={app.id} className={`node ${app.accent} ${installed.has(app.id) ? "installed" : "missing"}`}>
        <div className="node-head"><i></i><span>{live.has(app.id) ? "LIVE" : installed.has(app.id) ? "INSTALLED" : "ABSENT"}</span></div>
        <h2>{app.name}</h2><p>{app.role}</p><div className="chips">{app.tools.map((tool) => <code key={tool}>{tool}</code>)}</div>
        <button disabled={!installed.has(app.id)} onClick={() => void open(app.id, app.tile)}>{installed.has(app.id) ? "Open node" : "Not installed"}</button>
      </article>)}</div>
    </section>
    <section className="lower">
      <article className="panel summaries"><div className="panel-title"><span>DRIVER SUMMARIES</span><button disabled={connecting || ready === 0} onClick={() => void connectSummaries()}>{connecting ? "Connecting…" : "Connect summaries"}</button></div>
        {APPS.map((app) => <div className="summary" key={app.id}><b>{app.name}</b><code>{summaryErrors[app.id] ?? summaryText(app.id, summaries[app.id])}</code></div>)}
        <p>Each Driver returns a purpose-built redacted view. Connecting may request Kernel consent once per endpoint.</p>
      </article>
      <article className="panel"><div className="panel-title"><span>HUB ACTIVITY</span><b>{audit.length}</b></div>{audit.length === 0 ? <p>No Hub-initiated tool calls yet.</p> : audit.map((entry, index) => <code className="audit" key={index}>{summarize(entry)}</code>)}</article>
    </section>
    <footer><span>Hub owns no credential</span><span>Driver owns execution</span><span>Kernel owns consent</span></footer>
  </main>;
}
function arrayRecords(value: JsonValue, key: string): JsonObject[] { if (!isJsonObject(value) || !Array.isArray(value[key])) return []; return value[key].filter(isJsonObject) as JsonObject[]; }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function summaryText(appId: string, value: JsonValue | undefined): string {
  if (!isJsonObject(value)) return "not connected";
  if (appId === "github_driver") { const counts = isJsonObject(value.counts) ? value.counts : {}; const connection = isJsonObject(value.connection) && value.connection.connected === true ? "connected" : "offline"; return `${connection} · ${number(counts.pending)} pending · ${number(counts.outcomeUnknown)} uncertain`; }
  if (appId === "task_board") return `${number(value.open)} open · ${number(value.completed)} completed`;
  if (appId === "cycles_checkout") { const last = isJsonObject(value.lastOrder) ? text(value.lastOrder.status) : "no order"; return `${value.configured === true ? "configured" : "not configured"} · ${last}`; }
  if (appId === "x402_guard") return `${value.enabled === true ? "enabled" : "disabled"} · max ${text(value.maxAmountAtomic)}`;
  return "connected";
}
function number(value: unknown): number { return typeof value === "number" && Number.isFinite(value) ? value : 0; }
function summarize(value: JsonValue): string { if (!isJsonObject(value)) return "activity"; const target = isJsonObject(value.target) ? text(value.target.appId) : text(value.target); return `${text(value.name) || text(value.tool) || "tool call"}${target ? ` → ${target}` : ""}`; }
function message(reason: unknown) { return reason instanceof Error ? reason.message : String(reason); }
const root = document.getElementById("root"); if (!root) throw new Error("Root element not found"); createRoot(root).render(<App />);
