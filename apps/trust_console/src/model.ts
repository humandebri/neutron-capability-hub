import type { ConnectionStatus, GitHubJob, GitHubPolicy } from "./modules/github/backend.ts";
import type { Task } from "./modules/tasks/api.ts";
import type { Config, Menu, Order } from "./modules/cycles/api.ts";

export type Section = "overview" | "github" | "tasks" | "cyclemint";
export type TrustConsoleModel = { connection: ConnectionStatus; policies: GitHubPolicy[]; jobs: GitHubJob[]; tasks: Task[]; cycles: Config; menus: Menu[]; order: Order | null; demo: boolean };
export type TrustConsoleActions = {
  navigate(section: Section): void; connectGitHub(token: string, label: string): Promise<void>; saveGitHubPolicy(consumer: string, owner: string, repo: string): Promise<void>;
  createTask(title: string): Promise<void>; completeTask(id: string, revision: string): Promise<void>;
  configureCycleMint(service: string, url: string): Promise<void>; refreshMenus(): Promise<void>; createCycleOrder(menuId: string): Promise<void>;
  runGitHubDemo(): Promise<void>;
};

export const emptyModel: TrustConsoleModel = {
  connection: { connected: false, label: "", tokenSuffix: "", connectedAt: "0", revision: "0" }, policies: [], jobs: [], tasks: [],
  cycles: { configured: false, serviceCanister: "", hostedCheckoutUrl: "", neutronCanister: "", lastOrderId: "", lastOrderStatus: "", lastCyclesAmount: "0", lastGrossUsdCents: "0", lastError: "", backendReserved: false, revision: "0" },
  menus: [], order: null, demo: false,
};
