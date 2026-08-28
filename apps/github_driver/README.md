# GitHub Driver

GitHub adapter and durable external-effect Job queue. A fine-grained PAT is
stored in this app's managed stable memory on the trusted SEV Neutron and is
never returned by a tool, audit result, or message-bus payload.

Issue creation uses a deterministic hidden marker to reconcile ambiguous
responses without sending a second POST. Unresolved effects become
`outcome_unknown` and require an explicit operator decision.

```sh
npm --workspace neutron-github-driver test
```
