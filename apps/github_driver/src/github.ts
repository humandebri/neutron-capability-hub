export const GITHUB_API_VERSION = "2026-03-10";
export const GITHUB_API_ROOT = "https://api.github.com";
export type GitHubIssue = { number: number; title: string; state: string; html_url: string; body: string | null };
export type GitHubRepository = { full_name: string; private: boolean; html_url: string; permissions?: { push?: boolean } };

export class GitHubHttpError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = "GitHubHttpError"; }
}

export class GitHubTransport {
  constructor(private readonly token: string, private readonly fetcher: typeof fetch = fetch) {}
  async currentUser(): Promise<{ login: string }> { return this.request("/user", { method: "GET" }); }
  async listRepositories(): Promise<GitHubRepository[]> { return this.request("/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member", { method: "GET" }); }
  async listIssues(owner: string, repo: string, state = "open"): Promise<GitHubIssue[]> { return this.request(`/repos/${segment(owner)}/${segment(repo)}/issues?state=${state === "all" ? "all" : state === "closed" ? "closed" : "open"}&per_page=100`, { method: "GET" }); }
  async createIssue(owner: string, repo: string, title: string, body: string): Promise<GitHubIssue> { return this.request(`/repos/${segment(owner)}/${segment(repo)}/issues`, { method: "POST", body: JSON.stringify({ title, body }) }); }
  async findIssueByMarker(owner: string, repo: string, marker: string): Promise<GitHubIssue | null> {
    const issues = await this.request<GitHubIssue[]>(`/repos/${segment(owner)}/${segment(repo)}/issues?state=all&per_page=100&sort=created&direction=desc`, { method: "GET" });
    return issues.find((issue) => issue.body?.includes(marker)) ?? null;
  }
  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.fetcher(`${GITHUB_API_ROOT}${path}`, { ...init, headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${this.token}`, "X-GitHub-Api-Version": GITHUB_API_VERSION, ...(init.body ? { "Content-Type": "application/json" } : {}) } });
    const text = await response.text();
    if (!response.ok) {
      let detail = `GitHub API returned ${response.status}`;
      try { const parsed = JSON.parse(text) as { message?: unknown }; if (typeof parsed.message === "string") detail = parsed.message; } catch { /* response is untrusted text */ }
      throw new GitHubHttpError(response.status, detail.slice(0, 300));
    }
    return (text ? JSON.parse(text) : null) as T;
  }
}

export function jobMarker(jobUid: string): string { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobUid)) throw new Error("Invalid GitHub Job uid"); return `<!-- neutron-job:${jobUid.toLowerCase()} -->`; }
export function issueBodyWithMarker(body: string, jobUid: string): string { const marker = jobMarker(jobUid); return body.trim() ? `${body.trim()}\n\n${marker}` : marker; }
function segment(value: string): string { if (!/^[A-Za-z0-9_.-]{1,100}$/.test(value) || value === "." || value === "..") throw new Error("Invalid GitHub repository path"); return encodeURIComponent(value); }
