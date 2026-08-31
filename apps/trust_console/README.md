# Trust Console

Trust Console combines policy-scoped GitHub operations, durable Tasks, and CycleMint top-ups in one user-owned Neutron app. Its credential-free GitHub simulation runs the real policy, durable Job, lease, and reconciliation path without contacting GitHub. CycleMint tops up existing cycles; it does not issue a new asset.

## Owner setup

- For real GitHub writes, the owner creates a personal access token in their GitHub account and saves it in Trust Console. The token stays in the Neutron's SEV-protected canister state; consumer apps receive only owner-approved repository operations.
- For CycleMint, the owner enters an approved service canister and hosted checkout URL. Stripe secrets remain with the external CycleMint service operator and are never entered into Trust Console.
