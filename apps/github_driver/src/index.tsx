import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createMsgBusClient, isJsonObject } from "neutron-tools/app";
import { connectionSecret, connectionStatus, deleteTerminalJobs, disconnectConnection, listJobs, listPolicies, removePolicy, saveConnection, savePolicy, type ConnectionStatus, type GitHubJob, type GitHubPolicy } from "./backend.ts";
import { GitHubTransport, type GitHubRepository } from "./github.ts";
import "./style.scss";

function App() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [jobs, setJobs] = useState<GitHubJob[]>([]); const [policies, setPolicies] = useState<GitHubPolicy[]>([]);
  const [apps, setApps] = useState<string[]>([]); const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [consumer, setConsumer] = useState(""); const [repository, setRepository] = useState("");
  const [allowRead, setAllowRead] = useState(true); const [allowCreate, setAllowCreate] = useState(false);
  const [token, setToken] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const next = await connectionStatus(); setStatus(next);
    if (!next.connected) { setJobs([]); setPolicies([]); setRepositories([]); return; }
    const [jobPage, policyPage, appsValue] = await Promise.all([listJobs(), listPolicies(), createMsgBusClient().listApps()]);
    setJobs(jobPage.jobs.slice().reverse()); setPolicies(policyPage.policies);
    let secret = await connectionSecret();
    try { setRepositories(await new GitHubTransport(secret).listRepositories()); } finally { secret = ""; }
    if (isJsonObject(appsValue) && Array.isArray(appsValue.apps)) {
      const ids = appsValue.apps.flatMap((app) => isJsonObject(app) && typeof app.id === "string" ? [app.id] : []).filter((id) => id !== "github_driver");
      setApps(ids); setConsumer((current) => current || ids[0] || "");
    }
  }, []);
  useEffect(() => { void refresh().catch((reason) => setError(message(reason))); const timer = setInterval(() => void refresh().catch(() => undefined), 12_000); return () => clearInterval(timer); }, [refresh]);

  async function connect() {
    const candidate = token.trim(); if (candidate.length < 20 || /\s/.test(candidate)) { setError("Paste a valid fine-grained personal access token."); return; }
    await run(async () => { const user = await new GitHubTransport(candidate).currentUser(); await saveConnection(candidate, user.login); setToken(""); await refresh(); });
  }
  async function disconnect() { await run(async () => { await disconnectConnection(); await refresh(); }); }
  async function addPolicy() {
    const selected = repositories.find((item) => item.full_name === repository); if (!selected || !consumer) return;
    const [owner, repo] = selected.full_name.split("/"); if (!owner || !repo) return;
    const existing = policies.find((policy) => policy.consumerAppId === consumer && policy.owner.toLowerCase() === owner.toLowerCase() && policy.repo.toLowerCase() === repo.toLowerCase());
    await run(async () => { await savePolicy({ consumerAppId: consumer, owner, repo, allowIssueRead: allowRead, allowIssueCreate: allowCreate, enabled: true, revision: existing?.revision ?? "0" }); await refresh(); });
  }
  async function deletePolicy(policy: GitHubPolicy) { await run(async () => { await removePolicy(policy.id, policy.revision); await refresh(); }); }
  async function clearTerminal() {
    const ids = jobs.filter((job) => ["succeeded", "failed_terminal", "outcome_unknown"].includes(job.status)).slice(-100).map((job) => job.id);
    if (!ids.length || !confirm(`Delete ${ids.length} terminal Jobs? Their client request idempotency receipts will also be removed.`)) return;
    await run(async () => { await deleteTerminalJobs(ids); await refresh(); });
  }
  async function run(action: () => Promise<void>) { setBusy(true); setError(null); try { await action(); } catch (reason) { setError(message(reason)); } finally { setBusy(false); } }

  return <main className="github-app">
    <header><div className="signal"><i className={status?.connected ? "live" : ""}></i><span>{status?.connected ? "SEV LINK ACTIVE" : "NO LINK"}</span></div><h1>Your GitHub<br/>switchboard.</h1><p>One private connection. Policy-scoped reads and creates. Every write becomes a durable, reconcilable Job.</p></header>
    <section className="connection"><div><span className="label">CONNECTION</span><h2>{status?.connected ? `@${status.label}` : "Fine-grained PAT"}</h2><p>{status?.connected ? `Credential sealed in this Neutron · ends ${status.tokenSuffix}` : "Grant repository access and Issues read/write. The token never enters a tool result."}</p></div>{status?.connected ? <button className="secondary" disabled={busy} onClick={() => void disconnect()}>Disconnect</button> : <div className="connect-form"><input type="password" autoComplete="off" spellCheck={false} value={token} onChange={(event) => setToken(event.target.value)} placeholder="github_pat_…" aria-label="Fine-grained GitHub token"/><button disabled={busy || !token.trim()} onClick={() => void connect()}>Verify & seal</button></div>}</section>
    {error && <div className="error" role="alert">{error}</div>}
    {status?.connected && <section className="connection"><div><span className="label">DRIVER POLICY</span><h2>Bind a Consumer to one repository</h2><p>Kernel consent is necessary; this allowlist is enforced again by the Driver.</p></div><div className="connect-form"><select value={consumer} onChange={(event) => setConsumer(event.target.value)} aria-label="Consumer app">{apps.map((app) => <option key={app}>{app}</option>)}</select><select value={repository} onChange={(event) => setRepository(event.target.value)} aria-label="Repository"><option value="">Select repository</option>{repositories.map((repo) => <option key={repo.full_name}>{repo.full_name}</option>)}</select><label><input type="checkbox" checked={allowRead} onChange={(event) => setAllowRead(event.target.checked)}/> Read</label><label><input type="checkbox" checked={allowCreate} onChange={(event) => setAllowCreate(event.target.checked)}/> Create</label><button disabled={busy || !consumer || !repository || (!allowRead && !allowCreate)} onClick={() => void addPolicy()}>Add policy</button></div></section>}
    <section className="operations">{[["READ", "Repositories"], ["READ", "Issues"], ["WRITE", "Create issue"]].map(([effect, label]) => <div key={label}><span>{effect}</span><strong>{label}</strong><i></i></div>)}</section>
    {policies.length > 0 && <section className="jobs"><div className="section-title"><span>POLICY CIRCUIT</span><strong>{policies.length} exact scopes</strong></div>{policies.map((policy) => <article key={policy.id}><i className={`state ${policy.enabled ? "succeeded" : "failed_terminal"}`}></i><div><strong>{policy.consumerAppId}</strong><span>{policy.owner}/{policy.repo} · {policy.allowIssueRead ? "read " : ""}{policy.allowIssueCreate ? "create" : ""}</span></div><button className="secondary" disabled={busy} onClick={() => void deletePolicy(policy)}>Remove</button></article>)}</section>}
    <section className="jobs"><div className="section-title"><span>JOB CIRCUIT</span><strong>{jobs.length} recorded</strong><button className="secondary" disabled={busy || !jobs.some((job) => ["succeeded", "failed_terminal", "outcome_unknown"].includes(job.status))} onClick={() => void clearTerminal()}>Delete terminal</button></div>{jobs.length === 0 ? <div className="empty">No writes have passed through this Driver.</div> : jobs.slice(0, 12).map((job) => <article key={job.id}><i className={`state ${job.status}`}></i><div><strong>Create issue</strong><span>{job.owner}/{job.repo}{job.externalNumber !== "0" ? ` #${job.externalNumber}` : ""} · {job.consumerAppId}</span></div><code>{job.status}</code></article>)}</section>
    <footer>Trusted boundary: SEV subnet · Neutron owner principals · this Driver code</footer>
  </main>;
}
function message(reason: unknown) { return reason instanceof Error ? reason.message : String(reason); }
const root = document.getElementById("root"); if (!root) throw new Error("Root element not found"); createRoot(root).render(<App />);
