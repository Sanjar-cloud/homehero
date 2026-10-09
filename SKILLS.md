# HomeHero — Project Skills

## Purpose

This file lists the project-specific AI agent skills available for HomeHero.

All skills must follow the rules defined in the root `AGENTS.md`.

Skills do not grant permission to modify files. Every implementation phase requires explicit user approval.

## Available Skills

### 1. homehero-migration

**Location:** `skills/homehero-migration/SKILL.md`

**Purpose:** Plan and execute approved, incremental migration tasks while preserving the existing NestJS architecture.

Use this skill for:

- Nestar → HomeHero project identity migration.
- Property → Service domain migration.
- GraphQL resolvers, services, DTOs, enums, and Mongoose schema changes.
- Changes involving API and batch application dependencies.
- Approved migration validation and documentation.

Before implementation:

1. 1. Read `AGENTS.md`, `SKILLS.md`, and the relevant project skill.
2. Inspect the affected source code.
3. Prepare a bounded implementation plan.
4. Wait for explicit user approval.
5. Implement only the approved scope.
6. Validate and document results.

### 2. homehero-review

**Location:** `skills/homehero-review/SKILL.md`

**Purpose:** Perform read-only architecture, security, privacy, and production-readiness reviews.

Use this skill for:

- Authentication and authorization reviews.
- USER, AGENT, and ADMIN permission checks.
- GraphQL contract consistency.
- Private messaging and conversation isolation.
- MongoDB database isolation.
- Upload security and sensitive data exposure.
- Production risks and technical debt.

Review tasks must not modify source code, documentation, dependencies, databases, or Git state.

Reports should include concrete findings, severity, evidence, and recommended next steps.

## Skill Usage Rules

- Read the relevant skill before starting its task.
- Follow the root `AGENTS.md` instructions.
- Do not introduce unnecessary frameworks or dependencies.
- Do not automatically install external skills.
- Keep implementation changes small and understandable.
- Report any conflicts between skill instructions and approved scope.

## Default Workflow

**Analyze and prepare a plan only. DO NOT CHANGE ANYTHING. Wait for my explicit approval.**

This rule applies to new development tasks unless the user explicitly approves a specific implementation phase.
