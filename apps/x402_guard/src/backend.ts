import { isJsonObject, querySelf, updateSelf, type JsonObject } from "neutron-tools/app";
import type { X402Policy } from "./policy.ts";
export async function loadPolicy(): Promise<X402Policy> { return parse(await querySelf("x402_policy_status")); }
export async function savePolicy(enabled: boolean, maxAmountAtomic: string): Promise<X402Policy> { return parse(await updateSelf("x402_policy_save", [enabled, maxAmountAtomic])); }
function parse(value: unknown): X402Policy { if (!isJsonObject(value)) throw new Error("Invalid x402 policy"); const row = value as JsonObject; if (typeof row.demo_example_enabled !== "boolean" || typeof row.max_amount_atomic !== "string" || typeof row.revision !== "string") throw new Error("Invalid x402 policy"); return { demoExampleEnabled: row.demo_example_enabled, maxAmountAtomic: row.max_amount_atomic, revision: row.revision }; }
