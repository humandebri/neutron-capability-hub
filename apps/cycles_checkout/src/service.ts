import { exposeTool, type JsonObject } from "neutron-tools/app";
import { loadConfig } from "./api.ts";

const decimal: JsonObject = { type: "string", pattern: "^(0|[1-9][0-9]*)$" };

exposeTool("cycles_checkout_summary", {
  title: "Read Cycles Checkout Summary",
  description: "Read configuration and the last public order outcome without a Stripe client secret or checkout URL.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  outputSchema: {
    type: "object",
    required: ["configured", "backendReserved", "neutronCanister", "revision", "lastOrder"],
    properties: {
      configured: { type: "boolean" },
      backendReserved: { type: "boolean" },
      neutronCanister: { type: "string" },
      revision: decimal,
      lastOrder: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            required: ["status", "cyclesAmount", "grossUsdCents", "hasError"],
            properties: {
              status: { type: "string" },
              cyclesAmount: decimal,
              grossUsdCents: decimal,
              hasError: { type: "boolean" },
            },
            additionalProperties: false,
          },
        ],
      },
    },
    additionalProperties: false,
  },
  annotations: { "neutron:effects": ["read"] },
}, async () => {
  const config = await loadConfig();
  return {
    configured: config.configured,
    backendReserved: config.backendReserved,
    neutronCanister: config.neutronCanister,
    revision: config.revision,
    lastOrder: config.lastOrderId ? {
      status: config.lastOrderStatus,
      cyclesAmount: config.lastCyclesAmount,
      grossUsdCents: config.lastGrossUsdCents,
      hasError: config.lastError.length > 0,
    } : null,
  };
});
