import { isJsonObject, querySelf, updateSelf, type JsonObject, type JsonValue, type SelfCallValue } from "neutron-tools/app";

export type ConnectionStatus = { connected: boolean; label: string; tokenSuffix: string; connectedAt: string; revision: string };
export type JobStatus = "pending" | "leased" | "succeeded" | "failed_retryable" | "failed_terminal" | "outcome_unknown";
export type GitHubJob = {
  id: string; jobUid: string; consumerAppId: string; operation: "issue_create"; owner: string; repo: string; issueNumber: string;
  title: string; body: string; clientRequestId: string; status: JobStatus; leaseId: string; leasedAt: string;
  attemptCount: string; externalSendStarted: boolean; resultSummary: string; externalUrl: string; externalNumber: string;
  errorCode: string; createdAt: string; updatedAt: string;
};
export type GitHubPolicy = {
  id: string; consumerAppId: string; owner: string; repo: string; allowIssueRead: boolean; allowIssueCreate: boolean;
  enabled: boolean; revision: string; createdAt: string; updatedAt: string;
};

export async function connectionStatus(): Promise<ConnectionStatus> { return parseConnection(await querySelf("github_connection_status")); }
export async function saveConnection(token: string, label: string): Promise<ConnectionStatus> { return parseConnection(await updateSelf("github_connection_save", [token, label])); }
export async function disconnectConnection(): Promise<ConnectionStatus> { return parseConnection(await updateSelf("github_connection_disconnect")); }
export async function connectionSecret(): Promise<string> {
  const result = object(await querySelf<SelfCallValue>("github_connection_secret"), "GitHub credential response");
  if (result.ok !== true) throw new Error(string(result.error, "GitHub credential error", true));
  return string(result.token, "GitHub credential");
}
export async function listPolicies(): Promise<{ policies: GitHubPolicy[]; revision: string }> {
  const row = object(await querySelf("github_policies_list"), "GitHub policies");
  if (!Array.isArray(row.policies)) throw new Error("Invalid GitHub policy list");
  return { policies: row.policies.map(parsePolicy), revision: decimal(row.revision, "policy revision") };
}
export async function authorizePolicy(consumerAppId: string, owner: string, repo: string, operation: "issue_read" | "issue_create"): Promise<boolean> {
  const result = await querySelf("github_policy_authorize", [consumerAppId, owner, repo, operation]);
  if (typeof result !== "boolean") throw new Error("Invalid GitHub policy decision");
  return result;
}
export async function savePolicy(input: Omit<GitHubPolicy, "id" | "createdAt" | "updatedAt">): Promise<GitHubPolicy> {
  return parsePolicyResult(await updateSelf("github_policy_save", [input.consumerAppId, input.owner, input.repo, input.allowIssueRead, input.allowIssueCreate, input.enabled, input.revision]));
}
export async function removePolicy(id: string, expectedRevision: string): Promise<GitHubPolicy> {
  return parsePolicyResult(await updateSelf("github_policy_remove", [id, expectedRevision]));
}
export async function enqueueJob(input: { jobUid: string; consumerAppId: string; owner: string; repo: string; title: string; body?: string; clientRequestId: string }): Promise<GitHubJob> {
  return parseJobResult(await updateSelf("github_job_enqueue", [input.jobUid, input.consumerAppId, input.owner, input.repo, input.title, input.body ?? "", input.clientRequestId]));
}
export async function listJobs(): Promise<{ jobs: GitHubJob[]; revision: string }> {
  const result = object(await querySelf("github_jobs_list"), "GitHub Jobs");
  if (!Array.isArray(result.jobs)) throw new Error("Invalid GitHub Job list");
  return { jobs: result.jobs.map(parseJob), revision: decimal(result.revision, "Jobs revision") };
}
export async function loadJob(id: string): Promise<GitHubJob> { return parseJobResult(await querySelf("github_job_load", [id])); }
export async function claimJob(id: string, leaseId: string): Promise<GitHubJob> { return parseJobResult(await updateSelf("github_job_claim", [id, leaseId])); }
export async function markSendStarted(id: string, leaseId: string): Promise<GitHubJob> { return parseJobResult(await updateSelf("github_job_mark_send_started", [id, leaseId])); }
export async function completeJob(input: { id: string; leaseId: string; status: Exclude<JobStatus, "pending" | "leased">; resultSummary?: string; externalUrl?: string; externalNumber?: string; errorCode?: string }): Promise<GitHubJob> {
  return parseJobResult(await updateSelf("github_job_complete", [input.id, input.leaseId, input.status, input.resultSummary ?? "", input.externalUrl ?? "", input.externalNumber ?? "0", input.errorCode ?? ""]));
}
export async function deleteTerminalJobs(ids: string[]): Promise<{ deleted: string; revision: string }> {
  const row = object(await updateSelf("github_jobs_delete_terminal", [ids]), "delete GitHub Jobs result");
  if (row.ok !== true) throw new Error(string(row.error, "delete GitHub Jobs error", true));
  return { deleted: decimal(row.deleted, "deleted Jobs"), revision: decimal(row.revision, "Jobs revision") };
}

export function publicJob(job: GitHubJob): JsonObject {
  return { id: job.id, operation: job.operation, repository: `${job.owner}/${job.repo}`, issueNumber: job.externalNumber !== "0" ? job.externalNumber : job.issueNumber, status: job.status, resultSummary: job.resultSummary, externalUrl: job.externalUrl, errorCode: job.errorCode, createdAt: job.createdAt, updatedAt: job.updatedAt };
}
export function toJson(value: unknown): JsonValue { return JSON.parse(JSON.stringify(value)) as JsonValue; }
function parseConnection(value: SelfCallValue): ConnectionStatus { const row = object(value, "GitHub connection status"); return { connected: bool(row.connected), label: string(row.credential_label, "connection label", true), tokenSuffix: string(row.token_suffix, "token suffix", true), connectedAt: integer(row.connected_at, "connection time"), revision: decimal(row.revision, "connection revision") }; }
function parseJobResult(value: SelfCallValue): GitHubJob { const row = object(value, "GitHub Job result"); if (row.ok !== true) throw new Error(string(row.error, "GitHub Job error", true)); return parseJob(row.job); }
function parsePolicyResult(value: SelfCallValue): GitHubPolicy { const row = object(value, "GitHub policy result"); if (row.ok !== true) throw new Error(string(row.error, "GitHub policy error", true)); return parsePolicy(row.policy); }
export function parseJob(value: JsonValue | undefined): GitHubJob {
  const row = object(value, "GitHub Job"); const operation = string(row.operation, "Job operation") as GitHubJob["operation"]; const status = string(row.status, "Job status") as JobStatus;
  if (operation !== "issue_create") throw new Error("Invalid GitHub Job operation");
  if (!["pending", "leased", "succeeded", "failed_retryable", "failed_terminal", "outcome_unknown"].includes(status)) throw new Error("Invalid GitHub Job status");
  return { id: decimal(row.id, "Job id"), jobUid: string(row.job_uid, "Job uid"), consumerAppId: string(row.consumer_app_id, "consumer app"), operation, owner: string(row.owner, "owner"), repo: string(row.repo, "repository"), issueNumber: decimal(row.issue_number, "issue number"), title: string(row.title, "title", true), body: string(row.body, "body", true), clientRequestId: string(row.client_request_id, "client request id"), status, leaseId: string(row.lease_id, "lease id", true), leasedAt: integer(row.leased_at, "leased time"), attemptCount: decimal(row.attempt_count, "attempt count"), externalSendStarted: bool(row.external_send_started), resultSummary: string(row.result_summary, "result", true), externalUrl: string(row.external_url, "external url", true), externalNumber: decimal(row.external_number, "external number"), errorCode: string(row.error_code, "error code", true), createdAt: integer(row.created_at, "created time"), updatedAt: integer(row.updated_at, "updated time") };
}
function parsePolicy(value: JsonValue | undefined): GitHubPolicy {
  const row = object(value, "GitHub policy");
  return { id: decimal(row.id, "policy id"), consumerAppId: string(row.consumer_app_id, "consumer app"), owner: string(row.owner, "policy owner"), repo: string(row.repo, "policy repository"), allowIssueRead: bool(row.allow_issue_read), allowIssueCreate: bool(row.allow_issue_create), enabled: bool(row.enabled), revision: decimal(row.revision, "policy revision"), createdAt: integer(row.created_at, "policy created time"), updatedAt: integer(row.updated_at, "policy updated time") };
}
function object(value: unknown, label: string): JsonObject { if (!isJsonObject(value)) throw new Error(`Invalid ${label}`); return value as JsonObject; }
function string(value: unknown, label: string, empty = false): string { if (typeof value !== "string" || (!empty && !value)) throw new Error(`Invalid ${label}`); return value; }
function bool(value: unknown): boolean { if (typeof value !== "boolean") throw new Error("Invalid boolean"); return value; }
function integer(value: unknown, label: string): string { if (typeof value !== "string" || !/^-?[0-9]+$/.test(value)) throw new Error(`Invalid ${label}`); return BigInt(value).toString(); }
function decimal(value: unknown, label: string): string { const value_ = integer(value, label); if (value_.startsWith("-")) throw new Error(`Invalid ${label}`); return value_; }
