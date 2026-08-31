import { claimJob, completeJob, connectionSecret, enqueueJob, listJobs, markSendStarted, type GitHubJob } from "./backend.ts";
import { GitHubHttpError, GitHubTransport, issueBodyWithMarker, jobMarker } from "./github.ts";

let residentRun: Promise<void> | null = null;
export type ExecutorBackend = {
  connectionSecret: typeof connectionSecret;
  claimJob: typeof claimJob;
  completeJob: typeof completeJob;
  listJobs: typeof listJobs;
  markSendStarted: typeof markSendStarted;
};
const defaultBackend: ExecutorBackend = { connectionSecret, claimJob, completeJob, listJobs, markSendStarted };

export async function createIssue(input: { consumerAppId: string; owner: string; repo: string; title: string; body?: string; clientRequestId: string }): Promise<GitHubJob> {
  const job = await enqueueJob({ jobUid: crypto.randomUUID(), consumerAppId: input.consumerAppId, owner: input.owner, repo: input.repo, title: input.title, body: input.body ?? "", clientRequestId: input.clientRequestId });
  return runnable(job) ? executeJob(job) : job;
}

export async function executeJob(job: GitHubJob, fetcher: typeof fetch = fetch, backend: ExecutorBackend = defaultBackend): Promise<GitHubJob> {
  // Do not acquire a durable lease unless execution can access the credential.
  let token = await backend.connectionSecret();
  const leaseId = crypto.randomUUID();
  try {
    const claimed = await backend.claimJob(job.id, leaseId);
    const api = new GitHubTransport(token, fetcher);
    return claimed.externalSendStarted ? reconcileRecoveredCreate(api, claimed, leaseId, backend) : executeCreate(api, claimed, leaseId, backend);
  } finally { token = ""; }
}

export function runResidentOnce(): Promise<void> {
  if (residentRun) return residentRun;
  residentRun = resumePendingJobs().finally(() => { residentRun = null; });
  return residentRun;
}

export async function resumePendingJobs(backend: ExecutorBackend = defaultBackend, fetcher: typeof fetch = fetch): Promise<void> {
  const { jobs } = await backend.listJobs();
  for (const job of jobs) {
    if (job.status !== "pending" && job.status !== "failed_retryable" && job.status !== "leased") continue;
    try { await executeJob(job, fetcher, backend); } catch { /* non-stale leases and unavailable credentials retain durable state */ }
  }
}

async function executeCreate(api: GitHubTransport, job: GitHubJob, leaseId: string, backend: ExecutorBackend): Promise<GitHubJob> {
  const sending = await backend.markSendStarted(job.id, leaseId);
  try {
    const issue = await api.createIssue(sending.owner, sending.repo, sending.title, issueBodyWithMarker(sending.body, sending.jobUid));
    return backend.completeJob({ id: sending.id, leaseId, status: "succeeded", resultSummary: `Created issue #${issue.number}`, externalUrl: issue.html_url, externalNumber: String(issue.number) });
  } catch (reason) {
    if (reason instanceof GitHubHttpError && reason.status >= 400 && reason.status < 500 && reason.status !== 429) {
      return backend.completeJob({ id: sending.id, leaseId, status: "failed_terminal", errorCode: `github_http_${reason.status}`, resultSummary: reason.message });
    }
    return reconcileOrUnknown(api, sending, leaseId, backend);
  }
}

async function reconcileRecoveredCreate(api: GitHubTransport, job: GitHubJob, leaseId: string, backend: ExecutorBackend): Promise<GitHubJob> {
  return reconcileOrUnknown(api, job, leaseId, backend);
}

async function reconcileOrUnknown(api: GitHubTransport, job: GitHubJob, leaseId: string, backend: ExecutorBackend): Promise<GitHubJob> {
  try {
    const issue = await api.findIssueByMarker(job.owner, job.repo, jobMarker(job.jobUid));
    if (issue) return backend.completeJob({ id: job.id, leaseId, status: "succeeded", resultSummary: `Reconciled issue #${issue.number}`, externalUrl: issue.html_url, externalNumber: String(issue.number) });
  } catch { /* preserve unknown outcome */ }
  return backend.completeJob({ id: job.id, leaseId, status: "outcome_unknown", errorCode: "github_create_outcome_unknown", resultSummary: "GitHub may have created the issue; automatic retry is disabled." });
}

function runnable(job: GitHubJob) { return job.status === "pending" || job.status === "failed_retryable"; }
