# x402 Guard

Read-only x402 quote policy evaluator. The MVP has no wallet, signer, token
allowance, or network transport. It defaults to deny and can allow only the
demo `.example` origin, Base Sepolia, USDC, canonical recipients, unexpired
quotes, and an atomic-unit maximum.

```sh
npm --workspace neutron-x402-guard test
```
