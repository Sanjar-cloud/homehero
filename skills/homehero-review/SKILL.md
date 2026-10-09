---
name: homehero-review
description: Perform read-only architecture, security, privacy, and production-readiness reviews of the HomeHero backend.
---

# HomeHero Review Skill

## When to Use

Use this skill for:

- NestJS architecture and GraphQL contract reviews.
- Authentication and authorization checks.
- USER, AGENT, and ADMIN permission reviews.
- Private messaging and conversation isolation.
- MongoDB database isolation.
- Mongoose schemas, DTOs, enums, and service consistency.
- File upload security and sensitive data exposure.
- Production risks and technical debt.

## Review Workflow

1. Read root `AGENTS.md`, `SKILLS.md`, and relevant source code.
2. Inspect relevant source code without modifying files.
3. Identify concrete issues and verify them against the implementation.
4. Assess severity, impact, and affected components.
5. Recommend small, understandable solutions.
6. Report validation gaps and unresolved risks.

## Security Checklist

- Public signup cannot grant ADMIN privileges.
- Profile updates cannot bypass role restrictions.
- Password updates use secure hashing.
- Resource ownership and role permissions are enforced.
- Private conversations are accessible only to participants.
- Private messages are not globally broadcast.
- Public GraphQL responses exclude sensitive account information.
- Database connections use the intended environment.
- Uploads are validated and restricted appropriately.
- Batch jobs cannot unintentionally modify production data.

## Constraints

- Review tasks are strictly read-only.
- Do not modify source code or documentation.
- Do not install packages.
- Do not perform database writes.
- Do not change Git state.
- Do not automatically fix discovered vulnerabilities.
- Follow all root `AGENTS.md` rules.

## Expected Report

For each finding, provide:

- Issue and severity.
- Affected file or component.
- Evidence from the source code.
- Potential impact.
- Recommended next step.
- Verification status.

## Default Rule

Analyze and prepare a plan only. DO NOT CHANGE ANYTHING. Wait for my explicit approval.
