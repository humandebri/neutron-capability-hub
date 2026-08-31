# Trust Console — submission bundle

## Form values

- Project: `Trust Console`
- App id: `trust_console`
- Project link: `https://github.com/humandebri/neutron-capability-hub/tree/20d0ff688192e4c4c99c59aa06decbd16309792b/apps/trust_console`
- Extra links: leave blank
- Summary (455/600 characters):

> Trust Console is a user-owned capability control plane for Neutron. Run the GitHub Driver demo without credentials, or bring your own GitHub token for real writes. The token stays in your SEV-protected Neutron while apps receive only approved repository operations. Turn outcomes into revision-safe tasks and top up through an owner-approved CycleMint service—no Stripe secret enters Trust Console. One package, one resident service, zero secrets exposed.

## Upload order

1. `01_overview.png` — capability rail and aggregate evidence
2. `02_github_policy.png` — credential ownership, credential-free simulation, repository policy
3. `03_durable_workflow.png` — GitHub-sourced and revision-safe Tasks
4. `04_cyclemint.png` — owner-approved CycleMint service, external Stripe-secret boundary, completed top-up
5. `05_github_simulation.png` — policy → durable Job → reconciled outcome close-up
6. `06_mobile.png` — responsive overview

Icon: `icon.png`
Package: `trust_console.v0.1.0.neutron`

All screenshot values are illustrative and contain no credentials. The GitHub simulation persists policy and Job transitions but sends no GitHub request. Users provide their own GitHub token for real writes; it stays in the SEV-protected Neutron and is never returned to consumers. CycleMint purchases and tops up existing cycles through an external service whose Stripe secrets never enter Trust Console; it does not issue a new asset.

## Size and SHA-256 evidence

| File | Bytes | SHA-256 |
|---|---:|---|
| `icon.png` | 6,795 | `2d0fb92bbc58c999af0f49f6d62042bcc3713ad9d9246634bc49732453cf6b89` |
| `01_overview.png` | 228,460 | `793801d0f3fb227b20d30cb6a83e5d28ba1d6ce7be320c489906e5581e6bfd91` |
| `02_github_policy.png` | 227,153 | `d94b8a810682c30d1b5c76a93bf56d5aad06acd0c692afd6ea3157dac7d8573f` |
| `03_durable_workflow.png` | 141,836 | `ce16a0efce5f55d59e28fd069d9d383ed9f7a2acfafc8fd023cf29c0e9aecc09` |
| `04_cyclemint.png` | 178,604 | `5b939d3fff710fa6bd1df113f256cf059ebcaffcf48b0c91e09dc36e3da1a093` |
| `05_github_simulation.png` | 34,409 | `427feaeb6e4d3579684f14038bc163721efa533ef956cdab1e0bbad1d2572e41` |
| `06_mobile.png` | 88,396 | `5a1bf402a752a2c389d108b354655222d2e9c37f3c84c14f2680577ca9477b70` |
| `trust_console.v0.1.0.neutron` | 265,718 | `c84d2f678df3d93bb047c03074acd9b2490649e2d258fe4ff19db48897f4b107` |

Limits: icon under 100 KB; each screenshot under 400 KB; package under 1.9 MB.
