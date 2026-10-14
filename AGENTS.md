# HomeHero Backend Agent Instruction

HomeHero is a NestJS GraphQL monorepo migrated from a real estate platform into a home services marketplace platform.

## Read First

Before changing code, read the current AI handoff docs:

- `docs/ai/BACKEND_MIGRATION.md`
- `docs/ai/DECISIONS.md`
- `docs/ai/COMPLETED_TASKS.md`
- `docs/ai/NEXT_STEPS.md`

Use those files as the source of truth for AI Agent related migration history, accepted decisions, remaining work and validation status.

## Project Shape

- Backend apps are `homehero-api` and `homehero-batch`.
- Keep the existing NestJS resolver/service/module pattern based on MVC and DI.
- Keep DTOs, enums, schemas under `apps/homehero-api/src/libs`.
- Keep shared modules reusable: auth, member, like, view, comment, follow, board article, socket.

## Domain Rules

- Use HomeHero/service terminology for the main catalog entity.
- Do not reintroduce property or real-estate fields.
- Keep `MemberType.USER`, `MemberType.AGENT` and `MemberType.ADMIN` unchanged.
- Service ownership continues to use `MemberType.AGENT` unless a later migration explicitly changes it.
- Service enum values are:
  - `serviceType`: use the existing HomeHero ServiceType values.
  - `serviceCategory`: use the existing HomeHero service category values.
  - `serviceStatus`: use the existing HomeHero ServiceStatus values.

## Workflow

1. Analyze before editing.
2. Treat questions, explanations, analysis, and planning as read-only unless the user explicitly asks to implement changes.
3. Do not modify files, install dependencies, or run commands that change project state during read-only work.
4. Keep changes small and consistent with existing project patterns.
5. Do not remove working logic unless it is replaced safely.
6. Update `docs/ai/COMPLETED_TASKS.md` after major completed work.
7. Add or update focused tests when behavior changes.

## Validation

Use these checks for backend work:

```bash
npx tsc -p apps/homehero-api/tsconfig.app.json --noEmit
npx tsc -p apps/homehero-batch/tsconfig.app.json --noEmit
npm run build
```

`npm run lint` runs ESLint with `--fix`, so use it only when file rewriting is acceptable!

## Communication

- Use English for coding, technical reasoning, development instructions, code, naming, and project implementation.
- Communicate with the user in Uzbek.
- Keep technical terms, file names, class names, function names, commands, and identifiers in English.
- Use Uzbek for explanations, plans, questions, summaries, and final reports.
