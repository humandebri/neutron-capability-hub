import { isJsonObject, querySelf, updateSelf, type JsonObject, type JsonValue, type SelfCallValue } from "neutron-tools/app";

export type Task = {
  id: string; revision: string; title: string; status: "open" | "completed";
  sourceKind: "manual" | "github_issue"; sourceOwner: string; sourceRepo: string;
  sourceIssueNumber: string; sourceUrl: string; clientRequestId: string;
  createdAt: string; updatedAt: string;
};

export async function listTasks(): Promise<{ tasks: Task[]; bookRevision: string }> {
  const value = object(await querySelf<SelfCallValue>("tasks_list"), "task page");
  if (!Array.isArray(value.tasks)) throw new Error("Invalid task list");
  return { tasks: value.tasks.map(parseTask), bookRevision: decimal(value.book_revision, "book revision") };
}

export async function createTask(input: { title: string; clientRequestId: string; sourceKind?: "manual" | "github_issue"; sourceOwner?: string; sourceRepo?: string; sourceIssueNumber?: string; sourceUrl?: string }): Promise<Task> {
  const value = object(await updateSelf<SelfCallValue>("tasks_create", [
    input.title, input.clientRequestId, input.sourceKind ?? "manual", input.sourceOwner ?? "", input.sourceRepo ?? "",
    input.sourceIssueNumber ?? "0", input.sourceUrl ?? "",
  ]), "create task result");
  if (value.ok !== true) throw new Error(string(value.error, "create task error", true));
  return parseTask(value.task);
}

export async function completeTask(id: string, expectedRevision: string): Promise<Task> {
  const value = object(await updateSelf<SelfCallValue>("tasks_complete", [id, expectedRevision]), "complete task result");
  if (value.ok !== true) throw new Error(string(value.error, "complete task error", true));
  return parseTask(value.task);
}

export async function deleteCompletedTasks(items: Array<{ id: string; expectedRevision: string }>): Promise<{ deleted: string; bookRevision: string }> {
  const value = object(await updateSelf<SelfCallValue>("tasks_delete_completed", [items.map((item) => ({ id: item.id, expected_revision: item.expectedRevision }))]), "delete completed tasks result");
  if (value.ok !== true) throw new Error(string(value.error, "delete tasks error", true));
  return { deleted: decimal(value.deleted, "deleted tasks"), bookRevision: decimal(value.book_revision, "book revision") };
}

export function parseTask(value: JsonValue | undefined): Task {
  const row = object(value, "task");
  const status = string(row.status, "task status") as Task["status"];
  const sourceKind = string(row.source_kind, "source kind") as Task["sourceKind"];
  if (status !== "open" && status !== "completed") throw new Error("Invalid task status");
  if (sourceKind !== "manual" && sourceKind !== "github_issue") throw new Error("Invalid task source");
  return {
    id: decimal(row.id, "task id"), revision: decimal(row.revision, "task revision"), title: string(row.title, "task title"), status,
    sourceKind, sourceOwner: string(row.source_owner, "source owner", true), sourceRepo: string(row.source_repo, "source repo", true),
    sourceIssueNumber: decimal(row.source_issue_number, "issue number"), sourceUrl: string(row.source_url, "source url", true),
    clientRequestId: string(row.client_request_id, "request id"), createdAt: integer(row.created_at, "created time"), updatedAt: integer(row.updated_at, "updated time"),
  };
}

export function asJson(value: unknown): JsonValue { return JSON.parse(JSON.stringify(value)) as JsonValue; }
function object(value: unknown, label: string): JsonObject { if (!isJsonObject(value)) throw new Error(`Invalid ${label}`); return value as JsonObject; }
function string(value: unknown, label: string, empty = false): string { if (typeof value !== "string" || (!empty && value.length === 0)) throw new Error(`Invalid ${label}`); return value; }
function decimal(value: unknown, label: string): string { const parsed = integer(value, label); if (parsed.startsWith("-")) throw new Error(`Invalid ${label}`); return parsed; }
function integer(value: unknown, label: string): string { if (typeof value !== "string" || !/^-?[0-9]+$/.test(value)) throw new Error(`Invalid ${label}`); return BigInt(value).toString(); }
