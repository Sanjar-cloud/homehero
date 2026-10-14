# HomeHero Backend Agent Instruction

HomeHero is a NestJS GraphQL monorepo migrated from a real estate
platform into a home services marketplace platform.

## Read First

- Read AGENTS.md, SKILLS.md and the relevant project skill.
- Read existing migration documentation when available.
- Verify API contracts and business logic from actual source code.
- Do not assume missing documentation exists.

## Project Shape

- Backend apps are homehero-api and homehero-batch.
- Keep the existing NestJS resolver/service/module pattern and DI.
- Keep resolvers thin and business logic in services.
- Keep DTOs and enums under apps/homehero-api/src/libs.
- Keep Mongoose schemas under apps/homehero-api/src/schemas.
- Preserve existing folders, naming conventions and imports.
- Keep shared modules reusable: auth, member, service, like, view,
  comment, follow, messaging, review and socket.
- Follow existing HomeHero/Nestar coding conventions.
- Write simple, readable TypeScript with focused functions and
  readable multiline queries and aggregation pipelines.
- Prefer existing patterns over unnecessary abstractions.

## Domain Rules

- Use HomeHero/Service terminology for the main catalog entity.
- Do not reintroduce Property or real estate fields.
- Keep MemberType.USER, MemberType.AGENT and MemberType.ADMIN unchanged.
- Service ownership continues to use MemberType.AGENT.
- Use existing ServiceCategory, ServiceStatus and ServiceLocation enums.
- Do not introduce new fields, APIs or business rules without approval.
- Preserve existing authorization, ownership, counters, pagination,
  messaging participant restrictions and Review behavior.

## Workflow

1. Analyze before editing.
2. Treat questions, explanations, analysis and planning as read-only.
3. Prepare a small plan and wait for explicit implementation approval.
4. Do not modify files, install dependencies or change project state
   during read-only work.
5. Make small changes within the approved file scope.
6. Do not remove working logic unless replaced safely.
7. Add or update focused tests when behavior changes.
8. Briefly explain changed files, their purpose and validation results.
9. Do not modify database records, environment files, dependencies,
   commit, push or deploy without separate approval.
10. Never expose passwords, tokens or database connection strings.

## Validation

Use installed local tools and npm for backend commands:

./node_modules/.bin/tsc -p apps/homehero-api/tsconfig.app.json --noEmit --incremental false
./node_modules/.bin/tsc -p apps/homehero-batch/tsconfig.app.json --noEmit --incremental false
npm run build

Run relevant focused tests. Report existing failures separately
from new regressions.

npm run lint uses --fix. Do not run it unless automatic file
rewriting is explicitly approved.

Do not claim live integration passed unless it was actually tested.
Use mocked tests without live database writes unless separately approved.

## Communication

- Use English for code, comments, documentation, development
  instructions and naming.
- Communicate with the user in Uzbek.
- Keep technical terms, file names, class names, function names,
  commands and identifiers in English.
- Use Uzbek for explanations, technical reasoning, plans,
  questions, summaries and final reports.
