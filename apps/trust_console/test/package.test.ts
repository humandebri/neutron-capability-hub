import { expect, test } from "bun:test";
import { readFile, stat } from "node:fs/promises";
import { validate_neutron_conf } from "neutron-tools/src/validate_schema.js";

test("Trust Console has one tile, one service, and three focused capability memories", async () => {
  const manifest = JSON.parse(await readFile(new URL("../neutron.json", import.meta.url), "utf8"));
  expect(validate_neutron_conf(manifest).valid).toBe(true); expect(manifest.id).toBe("trust_console"); expect(manifest.tiles).toHaveLength(1); expect(manifest.background.path).toBe("service.html");
  expect(Object.keys(manifest.memory).sort()).toEqual(["cycles_checkout", "github_driver", "tasks"]);
  expect(manifest.capabilities.preapproved_self_calls.methods).toHaveLength(26);
  expect(manifest.capabilities.preapproved_self_calls.methods).toContain("github_demo_run");
  expect(JSON.stringify(manifest)).not.toContain("x402");
});

test("service exposes aggregate and module tools without returning credentials", async () => {
  const service = await readFile(new URL("../src/service.ts", import.meta.url), "utf8");
  expect(service).toContain("trust_console_summary"); expect(service).toContain("secretsExposed: 0"); expect(service).not.toContain("connectionSecret"); expect(service).not.toContain("clientSecret");
  for (const module of ["github", "tasks", "cycles"]) expect(service).toContain(`./modules/${module}/service.ts`);
  expect(service).not.toContain("x402");
});

test("setup copy distinguishes owner credentials from the external Stripe service", async () => {
  const view = await readFile(new URL("../src/view.tsx", import.meta.url), "utf8");
  expect(view).toContain("Your GitHub personal access token");
  expect(view).toContain("SEV-protected canister state");
  expect(view).toContain("NO STRIPE KEY HERE");
  expect(view).toContain("Stripe secrets stay with the external CycleMint service operator");
});

test("release archive stays below the submission limit and contains no demo fixture", async () => {
  const archive = new URL("../trust_console.v0.1.0.neutron", import.meta.url); expect((await stat(archive)).size).toBeLessThanOrEqual(1_850_000);
  const bytes = await readFile(archive); const text = bytes.toString("utf8"); expect(text).not.toContain("Illustrative demo data"); expect(text).not.toContain("github_pat_12345678901234567890");
});
