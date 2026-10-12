# HomeHero — AI Agent Instructions

## 1. Project Context

HomeHero is a portfolio-oriented home services platform with production-readiness goals, built by gradually transforming a duplicated copy of the original Nestar backend.

The project will eventually be deployed to a VPS using production DevOps practices.

HomeHero V1 focuses on:

- Service discovery, search, filtering, and service details.
- Service creation and management by service providers.
- Private messaging between customers and service providers.
- User favorites, reviews, community, and support features where approved.

Formal booking workflows, advanced scheduling, online payments, and quote management are outside the initial V1 scope.

### Member Roles

Preserve the existing roles:

- `MemberType.USER` — customer.
- `MemberType.AGENT` — service provider.
- `MemberType.ADMIN` — administrator.

Do not introduce new member roles without explicit approval.

### Messaging Model

- One conversation per USER–AGENT pair.
- Include the selected service as inquiry context.
- Only authorized participants may access private conversations.
- Do not broadcast private messages to unrelated users.

### Database

- Use a fresh HomeHero MongoDB database.
- Do not migrate Nestar or Petoria records.
- Do not modify existing databases without explicit approval.
- Verify database isolation before application startup or integration tests.
- Development and production databases must be isolated before deployment.

## 2. Read First

Before planning or implementing:

1. Read this `AGENTS.md`.
2. Read the root `SKILLS.md`.
3. Read the relevant project skill when applicable.
4. Inspect the affected source code.
5. Verify assumptions against the actual implementation.

The latest explicit user instructions take precedence.
Report conflicting instructions instead of silently changing scope.

## 3. Mandatory Approval-First Workflow

**Default instruction for every new development task:**

Analyze and prepare a plan only. DO NOT CHANGE ANYTHING. Wait for my explicit approval.

Follow this workflow:

1. Analyze the current implementation without modifying files.
2. Explain the proposed changes, affected files, expected behavior, risks, and validation steps.
3. Wait for explicit user approval for that specific implementation phase.
4. Implement only the approved changes.
5. If the scope materially expands, stop and request new approval.
6. Run approved validation and update relevant documentation.
7. Summarize the actual changes, test results, limitations, and remaining risks.
8. Stop before beginning another phase.

Approval of an overall roadmap does not authorize every implementation phase. Migration roadmaps are proposals, not completion records.

Once a specific phase and file scope are explicitly approved, continue within that scope without requesting the same approval again. Material scope expansion still requires new approval.

Never assume permission to modify code based only on a discussion, recommendation, or proposed plan.

The following actions require separate explicit authorization:

- Git commits and pushes.
- Deployment and infrastructure changes.
- Installing or upgrading dependencies.
- Database writes or migrations.
- Destructive operations.
- Changes to credentials or secrets.

## 4. Architecture Rules

Preserve the existing NestJS monorepo architecture unless an approved phase requires a change.

Current architectural patterns include:

- NestJS modules and dependency injection.
- GraphQL resolvers and services.
- DTOs and enums.
- MongoDB with Mongoose schemas.
- Separate API and batch applications.

Rules:

- Keep GraphQL resolvers thin.
- Place business logic in services.
- Follow existing project conventions and source directories.
- Preserve the original Nestar architecture and existing working behavior wherever practical. Change them only when required by the approved HomeHero scope.
- Preserve existing file organization, naming conventions, and local TypeScript formatting.
- Do not copy legacy defects or introduce abstractions solely to imitate old code.
- Preserve existing application names until the rename phase is approved.
- Keep GraphQL contract changes explicit.
- Preserve existing GraphQL contracts and frontend integration unless an explicitly approved change requires otherwise.
- Trace affected filters, counters, social interactions, notifications, and batch dependencies.
- Avoid unrelated refactoring.
- Do not introduce unnecessary frameworks, microservices, message brokers, or new dependencies.
- Prefer small, understandable, testable changes.

HomeHero should remain understandable to a developer preparing for technical interviews.

Explain important architectural decisions in clear language.

## 5. Migration Rules

The migration must be incremental.

Planned major phases include:

1. AI agent workflow and documentation setup.
2. Nestar → HomeHero project identity rename.
3. Security foundation improvements.
4. Property → Service domain migration.
5. Private messaging implementation.
6. Frontend integration, production validation, and VPS deployment.

These phases are proposals, not automatic implementation approvals.

During migration:

- Preserve working architecture.
- Keep legacy contracts temporarily when needed for safe transitions.
- Do not migrate legacy database records.
- Do not introduce compatibility layers without a clear requirement.
- Do not remove unrelated functionality without approval.
- Validate each completed phase before continuing.

## 6. Security Requirements

HomeHero is intended for production use. Security must be considered in every implementation plan.

### Authentication and Authorization

- Public signup must not allow administrative privilege escalation.
- Profile updates must not permit unauthorized role changes.
- Password changes must be securely hashed.
- Validate account status and current permissions.
- Enforce resource ownership and role-based authorization.
- Do not trust client-supplied member identities.

### Privacy

- Protect private conversations and messages.
- Do not expose private account information through public GraphQL responses.
- Do not use global WebSocket broadcasts for private messaging.
- Restrict access to resources based on authenticated identity.

### Secrets and Database Safety

- Never print, commit, or document passwords, JWTs, database credentials, connection strings, or secret tokens.
- Do not expose `.env` contents in reports.
- Never connect to or modify production data without explicit authorization.
- Treat application startup and batch jobs as potentially state-changing operations.

### Validation

- Validate incoming data.
- Check uploaded files and their destinations.
- Do not trust client-provided MIME metadata alone.
- Report inherited security vulnerabilities rather than silently fixing them outside the approved scope.

## 7. Testing and Validation

Use the project's existing tools and conventions.

- Prefer installed local dependencies.
- Avoid commands that download packages without approval.
- During read-only analysis, use checks that do not modify files or databases.
- Do not run automatic formatting or rewriting lint commands without approval.
- The existing `npm run lint` script uses `--fix` and rewrites files. Do not use it for read-only checks. Use the installed ESLint executable without fixes against approved files.
- Keep npm and the existing `package-lock.json` for backend commands; the frontend Yarn convention does not apply to this repository.
- Run focused tests for approved changes.
- Validate both API and batch applications when relevant.
- Distinguish typechecking, builds, unit tests, integration tests, and live runtime verification.

Never claim a feature works in production solely because TypeScript compilation passed.

Report unverified behavior explicitly.

## 8. Progress Tracking

Keep documentation minimal.

After major changes affecting setup, architecture, public contracts, or important user flows, update relevant existing documentation only within the approved file scope. Include documentation paths in the implementation plan before approval. Update the existing `README.md` when relevant; small fixes do not require updates to every document.

If a strict file scope excludes documentation, do not modify additional files. Report the documentation gap in the final report. Create new documentation files only with explicit approval.

After each approved implementation phase:

- Summarize the actual changes.
- Report validation results and limitations.
- Identify remaining security or production risks.
- Suggest the next step without implementing it.
- Keep Git commits small and descriptive when explicitly authorized.

Do not create additional documentation files unless requested.

## 9. Communication and Learning

- Communicate with the user in Uzbek unless requested otherwise.
- Use English for code, identifiers, technical prompts, and documentation.
- Explain significant changes in simple, understandable terms.
- Help the user understand the implementation rather than only generating code.
- Identify new concepts worth studying.
- Prefer maintainable solutions over unnecessary complexity.

The goal is to build a real production-oriented HomeHero platform while ensuring its developer can explain the architecture, business logic, security, and implementation during technical interviews.

## 10. Final Rule

**Analyze and prepare a plan only. DO NOT CHANGE ANYTHING. Wait for my explicit approval.**

This is the default behavior for new development requests. Implementation may begin only after the user explicitly approves the specific phase and scope.
