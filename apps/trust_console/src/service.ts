import { exposeTool, type JsonObject } from "neutron-tools/app";
import { connectionStatus, listJobs } from "./modules/github/backend.ts";
import { listTasks } from "./modules/tasks/api.ts";
import { loadConfig } from "./modules/cycles/api.ts";
import "./modules/github/service.ts";
import "./modules/tasks/service.ts";
import "./modules/cycles/service.ts";

const natural: JsonObject = { type: "integer", minimum: 0 };
exposeTool("trust_console_summary", {
  title: "Read Trust Console Summary",
  description: "Read redacted readiness and outcome counts without credentials, task content, or checkout secrets.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  outputSchema: { type: "object", required: ["github", "tasks", "cycleMint", "secretsExposed"], properties: {
    github: { type: "object", required: ["connected", "pending", "succeeded", "uncertain"], properties: { connected: { type: "boolean" }, pending: natural, succeeded: natural, uncertain: natural }, additionalProperties: false },
    tasks: { type: "object", required: ["open", "completed"], properties: { open: natural, completed: natural }, additionalProperties: false },
    cycleMint: { type: "object", required: ["configured", "backendReserved", "lastStatus"], properties: { configured: { type: "boolean" }, backendReserved: { type: "boolean" }, lastStatus: { type: "string" } }, additionalProperties: false },
    secretsExposed: { const: 0 },
  }, additionalProperties: false }, annotations: { "neutron:effects": ["read"] },
}, async () => {
  const [connection, jobs, taskPage, cycles] = await Promise.all([connectionStatus(), listJobs(), listTasks(), loadConfig()]);
  return { github: { connected: connection.connected, pending: jobs.jobs.filter((job) => job.status === "pending" || job.status === "failed_retryable").length, succeeded: jobs.jobs.filter((job) => job.status === "succeeded").length, uncertain: jobs.jobs.filter((job) => job.status === "outcome_unknown").length }, tasks: { open: taskPage.tasks.filter((task) => task.status === "open").length, completed: taskPage.tasks.filter((task) => task.status === "completed").length }, cycleMint: { configured: cycles.configured, backendReserved: cycles.backendReserved, lastStatus: cycles.lastOrderStatus }, secretsExposed: 0 };
});
