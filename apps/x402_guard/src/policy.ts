export type X402Policy = { demoExampleEnabled: boolean; maxAmountAtomic: string; revision: string };
export type X402Request = { resourceUrl: string; network: string; asset: string; amountAtomic: string; payTo: string; expiresAt: string };
export type X402Decision = { allowed: boolean; code: string; reason: string; canonicalResourceUrl: string };

export function evaluateX402(request: X402Request, policy: X402Policy, nowSeconds = BigInt(Math.floor(Date.now() / 1000))): X402Decision {
  let url: URL;
  try { url = new URL(request.resourceUrl); } catch { return deny("invalid_resource_url", "Resource URL is not valid."); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443")) return deny("noncanonical_resource_url", "Only canonical HTTPS resource URLs are allowed.");
  const hostname = url.hostname.toLowerCase();
  if (!policy.demoExampleEnabled || !(hostname === "example" || hostname.endsWith(".example"))) return deny("merchant_not_allowed", "Merchant domain is not on the allowlist.");
  if (request.network !== "base-sepolia") return deny("network_not_allowed", "Only the Base Sepolia demo network is allowed.");
  if (request.asset !== "USDC") return deny("asset_not_allowed", "Only demo USDC is allowed.");
  if (!/^(0|[1-9][0-9]*)$/.test(request.amountAtomic) || !/^(0|[1-9][0-9]*)$/.test(policy.maxAmountAtomic)) return deny("invalid_amount", "Amount must be an unsigned atomic-unit integer.");
  if (BigInt(request.amountAtomic) > BigInt(policy.maxAmountAtomic)) return deny("amount_over_limit", "Amount exceeds the configured per-request limit.");
  if (!/^0x[0-9a-fA-F]{40}$/.test(request.payTo)) return deny("invalid_recipient", "Recipient is not a canonical EVM address.");
  if (!/^(0|[1-9][0-9]*)$/.test(request.expiresAt) || BigInt(request.expiresAt) <= nowSeconds) return deny("quote_expired", "The payment requirement has expired.");
  return { allowed: true, code: "demo_policy_allowed", reason: "Policy allows this demo requirement. No payment was signed or sent.", canonicalResourceUrl: url.toString() };
}
function deny(code: string, reason: string): X402Decision { return { allowed: false, code, reason, canonicalResourceUrl: "" }; }
