import { exposeTool, type JsonObject, type JsonValue, type MsgBusToolContext } from "neutron-tools/app";
import { authorizePolicy, connectionSecret, connectionStatus, listJobs, listPolicies, publicJob, toJson } from "./backend.ts";
import { createIssue, runResidentOnce } from "./executor.ts";
import { GitHubTransport } from "./github.ts";

const decimal: JsonObject = { type: "string", pattern: "^0$|^[1-9][0-9]*$" };
const connectionSchema: JsonObject = { type: "object", required: ["connected", "label", "tokenSuffix", "connectedAt", "revision"], properties: { connected: { type: "boolean" }, label: { type: "string" }, tokenSuffix: { type: "string", maxLength: 4 }, connectedAt: { type: "string", pattern: "^-?[0-9]+$" }, revision: decimal }, additionalProperties: false };
const repoSchema: JsonObject = { type: "object", required: ["fullName", "private", "url", "canPush"], properties: { fullName: { type: "string" }, private: { type: "boolean" }, url: { type: "string" }, canPush: { type: "boolean" } }, additionalProperties: false };
const issueSchema: JsonObject = { type: "object", required: ["number", "title", "state", "url"], properties: { number: decimal, title: { type: "string" }, state: { enum: ["open", "closed"] }, url: { type: "string" } }, additionalProperties: false };
const jobSchema: JsonObject = { type: "object", required: ["id", "operation", "repository", "issueNumber", "status", "resultSummary", "externalUrl", "errorCode", "createdAt", "updatedAt"], properties: { id: decimal, operation: { const: "issue_create" }, repository: { type: "string" }, issueNumber: decimal, status: { enum: ["pending", "leased", "succeeded", "failed_retryable", "failed_terminal", "outcome_unknown"] }, resultSummary: { type: "string" }, externalUrl: { type: "string" }, errorCode: { type: "string" }, createdAt: { type: "string", pattern: "^-?[0-9]+$" }, updatedAt: { type: "string", pattern: "^-?[0-9]+$" } }, additionalProperties: false };

exposeTool("github_connection_status", {
  title: "Read GitHub Connection Status", description: "Read redacted connection metadata. The GitHub credential is never returned.",
  inputSchema: empty(), outputSchema: connectionSchema, annotations: { "neutron:effects": ["read"] },
}, async () => toJson(await connectionStatus()));

exposeTool("github_repositories_list", {
  title: "List Policy-Allowed GitHub Repositories", description: "List only repositories allowed to the requesting app by GitHub Driver Policy.",
  inputSchema: empty(), outputSchema: { type: "object", required: ["repositories"], properties: { repositories: { type: "array", items: repoSchema, maxItems: 100 } }, additionalProperties: false }, annotations: { "neutron:effects": ["read", "network"] },
}, async (_args, context) => {
  const consumer = consumerAppId(context);
  return withGitHub(async (api) => {
    const repositories = await api.listRepositories();
    if (consumer === "trust_console") return { repositories: repositories.map(publicRepository) };
    const allowed = new Set((await listPolicies()).policies.filter((policy) => policy.enabled && policy.consumerAppId === consumer && (policy.allowIssueRead || policy.allowIssueCreate)).map((policy) => `${policy.owner}/${policy.repo}`.toLowerCase()));
    return { repositories: repositories.filter((repo) => allowed.has(repo.full_name.toLowerCase())).map(publicRepository) };
  });
});

exposeTool("github_issues_list", {
  title: "List GitHub Issues", description: "List issues from one repository explicitly allowed to the requesting app.",
  inputSchema: { type: "object", required: ["owner", "repo"], properties: { owner: segment(), repo: segment(), state: { enum: ["open", "closed", "all"] } }, additionalProperties: false },
  outputSchema: { type: "object", required: ["issues"], properties: { issues: { type: "array", items: issueSchema, maxItems: 100 } }, additionalProperties: false }, annotations: { "neutron:effects": ["read", "network"] },
}, async (args, context) => {
  const owner = required(args.owner, "owner"); const repo = required(args.repo, "repo"); const consumer = consumerAppId(context);
  if (consumer !== "trust_console" && !(await authorizePolicy(consumer, owner, repo, "issue_read"))) throw new Error("GitHub Driver Policy denied issue_read for this consumer and repository");
  return withGitHub(async (api) => ({ issues: (await api.listIssues(owner, repo, args.state === "all" || args.state === "closed" ? args.state : "open")).filter((issue) => !("pull_request" in issue)).map((issue) => ({ number: String(issue.number), title: issue.title, state: issue.state, url: issue.html_url })) }));
});

exposeTool("github_issue_create", {
  title: "Create GitHub Issue", description: "Create one policy-authorized issue through a durable Job with globally unique reconciliation.",
  inputSchema: { type: "object", required: ["owner", "repo", "title", "clientRequestId"], properties: { owner: segment(), repo: segment(), title: { type: "string", minLength: 1, maxLength: 256 }, body: { type: "string", maxLength: 60000 }, clientRequestId: { type: "string", minLength: 1, maxLength: 128 } }, additionalProperties: false },
  outputSchema: jobSchema, annotations: { "neutron:effects": ["write", "network"] },
}, async (args, context) => toJson(publicJob(await createIssue({ consumerAppId: consumerAppId(context), owner: required(args.owner, "owner"), repo: required(args.repo, "repo"), title: required(args.title, "title"), body: optional(args.body) ?? "", clientRequestId: required(args.clientRequestId, "clientRequestId") }))));

exposeTool("github_driver_summary", {
  title: "Read GitHub Driver Summary", description: "Read redacted connection and recent Job outcomes without credentials, issue titles, bodies, or request ids.",
  inputSchema: empty(), outputSchema: { type: "object", required: ["connection", "counts", "recentJobs", "revision"], properties: {
    connection: connectionSchema,
    counts: { type: "object", required: ["pending", "leased", "succeeded", "failed", "outcomeUnknown"], properties: { pending: { type: "integer", minimum: 0 }, leased: { type: "integer", minimum: 0 }, succeeded: { type: "integer", minimum: 0 }, failed: { type: "integer", minimum: 0 }, outcomeUnknown: { type: "integer", minimum: 0 } }, additionalProperties: false },
    recentJobs: { type: "array", items: jobSchema, maxItems: 8 }, revision: decimal,
  }, additionalProperties: false }, annotations: { "neutron:effects": ["read"] },
}, async () => {
  const [connection, page] = await Promise.all([connectionStatus(), listJobs()]);
  const counts = { pending: 0, leased: 0, succeeded: 0, failed: 0, outcomeUnknown: 0 };
  for (const job of page.jobs) {
    if (job.status === "pending" || job.status === "failed_retryable") counts.pending += 1;
    else if (job.status === "leased") counts.leased += 1;
    else if (job.status === "succeeded") counts.succeeded += 1;
    else if (job.status === "outcome_unknown") counts.outcomeUnknown += 1;
    else counts.failed += 1;
  }
  return toJson({ connection, counts, recentJobs: page.jobs.slice(-8).reverse().map(publicJob), revision: page.revision });
});

setTimeout(() => void runResidentOnce(), 1_000);
setInterval(() => void runResidentOnce(), 15_000);

async function withGitHub<T>(operation: (api: GitHubTransport) => Promise<T>): Promise<JsonValue> { let token = await connectionSecret(); try { return toJson(await operation(new GitHubTransport(token))); } finally { token = ""; } }
function publicRepository(repo: { full_name: string; private: boolean; html_url: string; permissions?: { push?: boolean } }) { return { fullName: repo.full_name, private: repo.private, url: repo.html_url, canPush: repo.permissions?.push === true }; }
function consumerAppId(context: MsgBusToolContext): string { const value = context.caller?.appId; if (typeof value !== "string" || !value) throw new Error("GitHub operation requires an identified requesting app"); return value; }
function empty(): JsonObject { return { type: "object", properties: {}, additionalProperties: false }; }
function segment(): JsonObject { return { type: "string", pattern: "^[A-Za-z0-9_.-]{1,100}$" }; }
function required(value: unknown, label: string): string { if (typeof value !== "string" || !value) throw new Error(`${label} is required`); return value; }
function optional(value: unknown): string | undefined { return typeof value === "string" ? value : undefined; }
