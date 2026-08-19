---
name: OpenAPI and Zod compatibility
description: Compatibility note for generated API schemas in this workspace.
---

OpenAPI `integer` fields can generate `zod.int()` calls that are incompatible with the workspace's installed Zod runtime. Prefer non-negative `number` fields in contracts unless the generator/runtime versions are aligned.

**Why:** The first Discord dashboard codegen succeeded but the chained library typecheck failed because Zod 3 did not expose the generated `int()` helper.

**How to apply:** After changing `lib/api-spec/openapi.yaml`, always run codegen and the library typecheck before launching a design or backend build.