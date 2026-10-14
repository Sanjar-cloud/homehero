---
name: backend-migration
description: Continue the HomeHero backend migration from Nestar property concepts to HomeHero service concepts while preserving the existing NestJS architecture.
---

# HomeHero Backend Migration

Use this skill when changing backend code for the HomeHero service migration.

## Workflow

1. Search for affected property/service references before editing.
2. Preserve the resolver/service/module structure already used by `homehero-api`.
3. Keep DTOs, enums, and schemas in their existing folders.
4. Keep `MemberType.USER | AGENT | ADMIN` unchanged.
5. Use service terminology for catalog behavior and database lookups.
6. Update social modules consistently when service counters, likes, views, comments, or notifications are involved.
7. Update batch logic when service ranking or `memberServices` affects rank calculations.
8. Update `docs/ai/COMPLETED_TASKS.md` after major completed work.
