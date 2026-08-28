import { exposeTool, type JsonObject } from "neutron-tools/app";
import { loadPolicy } from "./backend.ts";
import { evaluateX402 } from "./policy.ts";
const text = (maxLength: number): JsonObject => ({ type: "string", minLength: 1, maxLength });
exposeTool("x402_policy_evaluate", {
  title: "Evaluate x402 Payment Policy", description: "Inspect one x402 payment requirement. This tool has no wallet, signer, network send, or funds.",
  inputSchema: { type: "object", required: ["resourceUrl", "network", "asset", "amountAtomic", "payTo", "expiresAt"], properties: { resourceUrl: text(500), network: text(64), asset: text(32), amountAtomic: { type: "string", pattern: "^(0|[1-9][0-9]{0,79})$" }, payTo: text(128), expiresAt: { type: "string", pattern: "^(0|[1-9][0-9]{0,39})$" } }, additionalProperties: false },
  outputSchema: { type: "object", required: ["allowed", "code", "reason", "canonicalResourceUrl"], properties: { allowed: { type: "boolean" }, code: { type: "string" }, reason: { type: "string" }, canonicalResourceUrl: { type: "string" } }, additionalProperties: false },
  annotations: { "neutron:effects": ["read"] },
}, async (args) => evaluateX402({ resourceUrl: required(args.resourceUrl), network: required(args.network), asset: required(args.asset), amountAtomic: required(args.amountAtomic), payTo: required(args.payTo), expiresAt: required(args.expiresAt) }, await loadPolicy()));
exposeTool("x402_policy_summary", {
  title: "Read x402 Policy Summary", description: "Read the demo policy state without payment requirements, recipients, wallets, or funds.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  outputSchema: { type: "object", required: ["enabled", "maxAmountAtomic", "revision"], properties: { enabled: { type: "boolean" }, maxAmountAtomic: { type: "string", pattern: "^(0|[1-9][0-9]*)$" }, revision: { type: "string", pattern: "^(0|[1-9][0-9]*)$" } }, additionalProperties: false },
  annotations: { "neutron:effects": ["read"] },
}, async () => { const policy = await loadPolicy(); return { enabled: policy.demoExampleEnabled, maxAmountAtomic: policy.maxAmountAtomic, revision: policy.revision }; });
function required(value: unknown): string { if (typeof value !== "string" || !value) throw new Error("Invalid x402 requirement"); return value; }
