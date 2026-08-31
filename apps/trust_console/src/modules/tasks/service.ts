import { exposeTool, publishAppStateChange, type JsonObject } from "neutron-tools/app";
import { asJson, completeTask, createTask, listTasks } from "./api.ts";

const decimal: JsonObject = { type: "string", pattern: "^0$|^[1-9][0-9]*$" };
const task: JsonObject = {
  type: "object", required: ["id", "revision", "title", "status", "sourceKind", "sourceOwner", "sourceRepo", "sourceIssueNumber", "sourceUrl", "clientRequestId", "createdAt", "updatedAt"],
  properties: {
    id: decimal, revision: decimal, title: { type: "string" }, status: { enum: ["open", "completed"] }, sourceKind: { enum: ["manual", "github_issue"] },
    sourceOwner: { type: "string" }, sourceRepo: { type: "string" }, sourceIssueNumber: decimal, sourceUrl: { type: "string" }, clientRequestId: { type: "string" },
    createdAt: { type: "string", pattern: "^-?[0-9]+$" }, updatedAt: { type: "string", pattern: "^-?[0-9]+$" },
  }, additionalProperties: false,
};

exposeTool("tasks_list", {
  title: "List Tasks", description: "List durable personal tasks, including their source and completion state.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  outputSchema: { type: "object", required: ["tasks", "bookRevision"], properties: { tasks: { type: "array", items: task, maxItems: 2000 }, bookRevision: decimal }, additionalProperties: false },
  annotations: { "neutron:effects": ["read"] },
}, async () => asJson(await listTasks()));

exposeTool("tasks_create", {
  title: "Create Task", description: "Create one durable task. Reusing clientRequestId returns the original task instead of duplicating it.",
  inputSchema: { type: "object", required: ["title", "clientRequestId"], properties: {
    title: { type: "string", minLength: 1, maxLength: 240 }, clientRequestId: { type: "string", minLength: 1, maxLength: 128 },
    sourceKind: { enum: ["manual", "github_issue"] }, sourceOwner: { type: "string", maxLength: 100 }, sourceRepo: { type: "string", maxLength: 100 },
    sourceIssueNumber: decimal, sourceUrl: { type: "string", maxLength: 500 },
  }, additionalProperties: false }, outputSchema: task,
  annotations: { "neutron:effects": ["write"] },
}, async (args) => {
  const created = await createTask({
    title: required(args.title, "title"), clientRequestId: required(args.clientRequestId, "clientRequestId"),
    sourceKind: args.sourceKind === "github_issue" ? "github_issue" : "manual",
    sourceOwner: optional(args.sourceOwner) ?? "", sourceRepo: optional(args.sourceRepo) ?? "", sourceIssueNumber: optional(args.sourceIssueNumber) ?? "0", sourceUrl: optional(args.sourceUrl) ?? "",
  });
  publishAppStateChange("tasks", created.revision);
  return asJson(created);
});

exposeTool("tasks_complete", {
  title: "Complete Task", description: "Complete one task only if its revision still matches.",
  inputSchema: { type: "object", required: ["id", "expectedRevision"], properties: { id: decimal, expectedRevision: decimal }, additionalProperties: false },
  outputSchema: task, annotations: { "neutron:effects": ["write"] },
}, async (args) => {
  const completed = await completeTask(required(args.id, "id"), required(args.expectedRevision, "expectedRevision"));
  publishAppStateChange("tasks", completed.revision);
  return asJson(completed);
});

exposeTool("tasks_summary", {
  title: "Read Tasks Summary", description: "Read durable task counts without task titles or source URLs.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  outputSchema: { type: "object", required: ["open", "completed", "bookRevision"], properties: { open: { type: "integer", minimum: 0 }, completed: { type: "integer", minimum: 0 }, bookRevision: decimal }, additionalProperties: false },
  annotations: { "neutron:effects": ["read"] },
}, async () => {
  const page = await listTasks();
  const open = page.tasks.filter((item) => item.status === "open").length;
  return { open, completed: page.tasks.length - open, bookRevision: page.bookRevision };
});

function required(value: unknown, label: string): string { if (typeof value !== "string" || value.length === 0) throw new Error(`${label} is required`); return value; }
function optional(value: unknown): string | undefined { return typeof value === "string" ? value : undefined; }
