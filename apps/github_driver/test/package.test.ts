import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { validate_neutron_conf } from "neutron-tools/src/validate_schema.js";
import { executeJob, type ExecutorBackend } from "../src/executor.ts";
import type { GitHubJob } from "../src/backend.ts";
import { GitHubTransport, GITHUB_API_VERSION, issueBodyWithMarker } from "../src/github.ts";

const JOB_UID = "123e4567-e89b-42d3-a456-426614174000";

test("GitHub Driver manifest and secret boundary validate", async () => {
  const manifest = JSON.parse(await readFile(new URL("../neutron.json", import.meta.url), "utf8"));
  expect(validate_neutron_conf(manifest).valid).toBe(true);
  expect(manifest.capabilities.preapproved_self_calls.methods).toContain("github_connection_secret");
  const service = await readFile(new URL("../src/service.ts", import.meta.url), "utf8");
  expect(service).not.toContain('exposeTool("github_connection_secret"');
  expect(service).not.toContain("Authorization:");
});

test("issue marker is deterministic and transport pins current API version", async () => {
  expect(issueBodyWithMarker("Body", JOB_UID)).toBe(`Body\n\n<!-- neutron-job:${JOB_UID} -->`);
  let request: RequestInit | undefined;
  const fetcher: typeof fetch = async (_url, init) => { request = init; return new Response(JSON.stringify({ login: "octo" }), { status: 200 }); };
  expect(await new GitHubTransport("secret-token", fetcher).currentUser()).toEqual({ login: "octo" });
  expect(new Headers(request?.headers).get("X-GitHub-Api-Version")).toBe(GITHUB_API_VERSION);
});

test("ambiguous issue create can be reconciled by hidden marker without a second POST", async () => {
  let posts = 0;
  const fetcher: typeof fetch = async (url, init) => {
    if (init?.method === "POST") { posts += 1; throw new TypeError("connection reset"); }
    return new Response(JSON.stringify([{ number: 7, title: "T", state: "open", html_url: "https://github.test/o/r/issues/7", body: `<!-- neutron-job:${JOB_UID} -->` }]), { status: 200 });
  };
  const api = new GitHubTransport("token", fetcher);
  await expect(api.createIssue("o", "r", "T", issueBodyWithMarker("", JOB_UID))).rejects.toThrow();
  expect((await api.findIssueByMarker("o", "r", `<!-- neutron-job:${JOB_UID} -->`))?.number).toBe(7);
  expect(posts).toBe(1);
});

test("credential failure happens before a durable lease is claimed", async () => {
  let claims = 0;
  const backend = fakeBackend({
    connectionSecret: async () => { throw new Error("not connected"); },
    claimJob: async () => { claims += 1; return job(); },
  });
  await expect(executeJob(job(), fetch, backend)).rejects.toThrow("not connected");
  expect(claims).toBe(0);
});

test("a recovered send-started lease reconciles without another POST", async () => {
  let posts = 0;
  let completion = "";
  const recovered = job({ status: "leased", leaseId: "old-lease", externalSendStarted: true });
  const backend = fakeBackend({
    claimJob: async () => ({ ...recovered, leaseId: "new-lease" }),
    completeJob: async (input) => { completion = input.status; return { ...recovered, status: input.status, leaseId: "" }; },
  });
  const fetcher: typeof fetch = async (_url, init) => {
    if (init?.method === "POST") posts += 1;
    return new Response(JSON.stringify([{ number: 8, title: "T", state: "open", html_url: "https://github.test/o/r/issues/8", body: `<!-- neutron-job:${JOB_UID} -->` }]), { status: 200 });
  };
  await executeJob(recovered, fetcher, backend);
  expect(posts).toBe(0);
  expect(completion).toBe("succeeded");
});

function job(overrides: Partial<GitHubJob> = {}): GitHubJob {
  return { id: "1", jobUid: JOB_UID, consumerAppId: "task_board", operation: "issue_create", owner: "o", repo: "r", issueNumber: "0", title: "T", body: "", clientRequestId: "request-1", status: "pending", leaseId: "", leasedAt: "0", attemptCount: "0", externalSendStarted: false, resultSummary: "", externalUrl: "", externalNumber: "0", errorCode: "", createdAt: "1", updatedAt: "1", ...overrides };
}
function fakeBackend(overrides: Partial<ExecutorBackend>): ExecutorBackend {
  return {
    connectionSecret: async () => "token",
    claimJob: async () => job({ status: "leased", leaseId: "lease" }),
    completeJob: async (input) => job({ status: input.status }),
    listJobs: async () => ({ jobs: [], revision: "0" }),
    markSendStarted: async () => job({ status: "leased", leaseId: "lease", externalSendStarted: true }),
    ...overrides,
  };
}
