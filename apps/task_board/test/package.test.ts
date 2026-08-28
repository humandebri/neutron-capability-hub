import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { validate_neutron_conf } from "neutron-tools/src/validate_schema.js";

test("Tasks ships a valid resident tool app contract", async () => {
  const manifest = JSON.parse(await readFile(new URL("../neutron.json", import.meta.url), "utf8"));
  expect(validate_neutron_conf(manifest).valid).toBe(true);
  expect(manifest.capabilities.preapproved_self_calls.methods).toEqual(["tasks_list", "tasks_create", "tasks_complete", "tasks_delete_completed"]);
  const service = await readFile(new URL("../src/service.ts", import.meta.url), "utf8");
  for (const tool of ["tasks_list", "tasks_create", "tasks_complete"]) expect(service).toContain(`exposeTool("${tool}"`);
});

test("Tasks contract keeps idempotency and revision guards", async () => {
  const backend = await readFile(new URL("../backend/main.mo", import.meta.url), "utf8");
  expect(backend).toContain("Map.get(mem.request_ids");
  expect(backend).toContain("current.revision != expected_revision");
});
