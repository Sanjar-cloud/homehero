---
name: service-logic
description: Review HomeHero service API consistency across GraphQL operations, DTOs, schemas, enums, filters, and remaining legacy terminology.
---

# HomeHero Service API Review

Use this skill for review-only passes or pre-edit analysis of the service API.

## Review Checklist

- Confirm GraphQL operation names use service terminology:
  - `createService`
  - `getService`
  - and where it is related
- Confirm shared operations such as `getFavorites` and `getVisited` return service data.
- Confirm DTOs, schemas, and enums agree on service fields and nullability.
- Confirm filters use service type, category, price and etc.
- Report real findings with paths and behavior impact.
