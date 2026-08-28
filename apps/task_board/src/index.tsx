import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { callTool, loadTileContext, onAppStateChange, type JsonObject, type JsonValue, type MsgBusEndpointId } from "neutron-tools/app";
import { deleteCompletedTasks, parseTask, type Task } from "./api.ts";
import "./style.scss";

function App() {
  const context = useMemo(() => loadTileContext(), []);
  const target = `app:${context.app ?? "task_board"}:background` as MsgBusEndpointId;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invoke = useCallback((name: string, args: JsonObject) => callTool({ target, name, arguments: args }, 60), [target]);
  const refresh = useCallback(async () => {
    try {
      const value = await invoke("tasks_list", {});
      if (typeof value !== "object" || value === null || !("tasks" in value) || !Array.isArray(value.tasks)) throw new Error("Invalid task list");
      setTasks(value.tasks.map((item) => parseTask(item as JsonValue)));
      setError(null);
    } catch (reason) { setError(message(reason)); }
  }, [invoke]);
  useEffect(() => { void refresh(); return onAppStateChange("tasks", () => void refresh()); }, [refresh]);

  async function add() {
    const clean = title.trim(); if (!clean) return;
    setBusy(true);
    try {
      await invoke("tasks_create", { title: clean, clientRequestId: crypto.randomUUID() });
      setTitle(""); await refresh();
    } catch (reason) { setError(message(reason)); } finally { setBusy(false); }
  }
  async function complete(task: Task) {
    setBusy(true);
    try { await invoke("tasks_complete", { id: task.id, expectedRevision: task.revision }); await refresh(); }
    catch (reason) { setError(message(reason)); } finally { setBusy(false); }
  }
  async function clearCompleted() {
    const completed = tasks.filter((task) => task.status === "completed").slice(0, 100);
    if (!completed.length || !confirm(`Delete ${completed.length} completed tasks? Their idempotency receipts will also be removed.`)) return;
    setBusy(true);
    try { await deleteCompletedTasks(completed.map((task) => ({ id: task.id, expectedRevision: task.revision }))); await refresh(); }
    catch (reason) { setError(message(reason)); } finally { setBusy(false); }
  }

  const open = tasks.filter((task) => task.status === "open");
  const done = tasks.length - open.length;
  return <main className="tasks-app">
    <header className="tasks-header">
      <div><p className="eyebrow">DURABLE WORK QUEUE</p><h1>Tasks that survive the tab.</h1><p>Agents and apps add work here through one revisioned contract.</p></div>
      <div className="task-meter" aria-label={`${done} of ${tasks.length} tasks complete`}><strong>{open.length}</strong><span>open circuit{open.length === 1 ? "" : "s"}</span>{done > 0 && <button disabled={busy} onClick={() => void clearCompleted()}>Delete completed</button>}</div>
    </header>
    <section className="composer" aria-label="Create a task">
      <input value={title} maxLength={240} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void add(); }} placeholder="What needs to move next?" />
      <button disabled={busy || !title.trim()} onClick={() => void add()}>Add task</button>
    </section>
    {error && <div className="error" role="alert">{error}</div>}
    <section className="task-list" aria-label="Tasks">
      {tasks.length === 0 ? <div className="empty"><span>○</span><h2>The queue is clear.</h2><p>Add a task here or ask Agent to create one.</p></div> : tasks.map((task) => <article key={task.id} className={task.status === "completed" ? "task done" : "task"}>
        <button className="check" disabled={busy || task.status === "completed"} onClick={() => void complete(task)} aria-label={`Complete ${task.title}`}>{task.status === "completed" ? "✓" : ""}</button>
        <div><h2>{task.title}</h2><p>{task.sourceKind === "github_issue" ? `${task.sourceOwner}/${task.sourceRepo} #${task.sourceIssueNumber}` : "Created in Neutron"}</p></div>
        <code>r{task.revision}</code>
      </article>)}
    </section>
  </main>;
}
function message(reason: unknown) { return reason instanceof Error ? reason.message : String(reason); }
const root = document.getElementById("root"); if (!root) throw new Error("Root element not found"); createRoot(root).render(<App />);
