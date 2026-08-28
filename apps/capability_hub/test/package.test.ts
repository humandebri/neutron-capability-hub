import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { validate_neutron_conf } from "neutron-tools/src/validate_schema.js";
test("Capability Hub is a valid redacted frontend-only app", async () => {
  const manifest = JSON.parse(await readFile(new URL("../neutron.json", import.meta.url), "utf8"));
  expect(validate_neutron_conf(manifest).valid).toBe(true); expect(manifest.func).toEqual({});
  const source = await readFile(new URL("../src/index.tsx", import.meta.url), "utf8");
  expect(source).not.toContain("github_connection_secret"); expect(source).not.toContain("client_secret");
  for (const summary of ["github_driver_summary", "tasks_summary", "cycles_checkout_summary", "x402_policy_summary"]) expect(source).toContain(summary);
  expect(source).toContain("HUB ACTIVITY");
  expect(source).not.toContain("RECENT KERNEL AUDIT");
});
