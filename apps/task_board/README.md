# Tasks

Durable Neutron task queue for manual items and GitHub issue references. Create
is idempotent by `client_request_id`; completion uses an expected revision so
two agents cannot silently overwrite each other.

```sh
npm --workspace neutron-tasks test
```

Released memory schemas are immutable. Add a new schema and migration for any
future persistent type change.
