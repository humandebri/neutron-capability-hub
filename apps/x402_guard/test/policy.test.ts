import { expect, test } from "bun:test";
import { evaluateX402, type X402Policy, type X402Request } from "../src/policy.ts";

const policy: X402Policy = {
  demoExampleEnabled: true,
  maxAmountAtomic: "1000000",
  revision: "1",
};
const request: X402Request = {
  resourceUrl: "https://api.example/resource?id=7",
  network: "base-sepolia",
  asset: "USDC",
  amountAtomic: "250000",
  payTo: "0x1111111111111111111111111111111111111111",
  expiresAt: "2000000000",
};

test("allows only a complete matching demo requirement without sending funds", () => {
  expect(evaluateX402(request, policy, 1_900_000_000n)).toEqual({
    allowed: true,
    code: "demo_policy_allowed",
    reason: "Policy allows this demo requirement. No payment was signed or sent.",
    canonicalResourceUrl: request.resourceUrl,
  });
});

test("denies disabled policy, lookalike domains, and noncanonical URLs", () => {
  expect(evaluateX402(request, { ...policy, demoExampleEnabled: false }, 1_900_000_000n).code).toBe("merchant_not_allowed");
  expect(evaluateX402({ ...request, resourceUrl: "https://api.example.attacker.test/" }, policy, 1_900_000_000n).code).toBe("merchant_not_allowed");
  expect(evaluateX402({ ...request, resourceUrl: "https://api.example/#secret" }, policy, 1_900_000_000n).code).toBe("noncanonical_resource_url");
});

test("uses atomic-unit BigInt limits and rejects expired quotes", () => {
  expect(evaluateX402({ ...request, amountAtomic: "10000000000000000000000000000000000000000" }, policy, 1_900_000_000n).code).toBe("amount_over_limit");
  expect(evaluateX402({ ...request, expiresAt: "1900000000" }, policy, 1_900_000_000n).code).toBe("quote_expired");
});
