---
name: homehero-migration
description: Plan and implement explicitly approved incremental migrations of the HomeHero NestJS backend while preserving its architecture.
---

# HomeHero Migration Skill

## When to Use

Use this skill for approved HomeHero backend migration tasks, including:

- Nestar → HomeHero project identity rename.
- Property → Service domain migration.
- GraphQL resolver, service, DTO, enum, and Mongoose schema changes.
- API and batch application integration changes.

## Workflow

1. Read root `AGENTS.md`, `SKILLS.md`, and relevant source code.
2. Inspect the affected source code and dependencies.
3. Prepare a small, clearly scoped implementation plan.
4. Wait for explicit user approval before modifying anything.
5. Implement only the approved changes.
6. Run relevant validation without unauthorized database writes.
7. Report completed changes, validation results, and remaining risks.
8. Stop before the next phase.

## Constraints

- Preserve the existing NestJS architecture.
- Keep resolvers thin and business logic in services.
- Preserve `MemberType.USER`, `MemberType.AGENT`, and `MemberType.ADMIN`.
- Do not introduce unnecessary dependencies or frameworks.
- Do not perform Git commits, pushes, deployments, or database operations without separate authorization.
- Prefer minimal changes that are easy to explain during technical interviews.

## Expected Report

Summarize affected files, implemented behavior, validation results, unresolved risks, and the next proposed step.

## Default Rule

Analyze and prepare a plan only. DO NOT CHANGE ANYTHING. Wait for my explicit approval.
