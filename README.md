<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).


## HomeHero Support — backend checkpoint

Support follows the existing NestJS resolver/service/module and Mongoose patterns. FAQ and announcements reuse the existing `notices` collection and `Notice` schema; `ANNOUNCEMENT` is additive and legacy `FAQ`, `TERMS`, `INQUIRY`, `HOLD`, `ACTIVE` and `DELETE` values are preserved. The new APIs manage only FAQ/ANNOUNCEMENT records in HOLD/ACTIVE, without delete/close operations. Public reads always require ACTIVE. Existing schema defaults remain unchanged, while the new create API explicitly defaults to HOLD.

English `noticeTitle` (3–100 trimmed characters) and `noticeContent` (1–5000) are required. Optional `translations.kr` and `translations.ru` each require a complete title/content pair with the same bounds. The API returns English plus optional translations; the upcoming frontend selects the active locale and falls back to English without automatic translation. Updates require the English content; category and original author cannot change. Omitted translations are retained, explicit null clears the translations, and a supplied translations object replaces the optional language set.

Support requests are separate documents in `supportRequests`: authenticated `memberId`, subject (3–100 trimmed characters), content (1–2000), OPEN/ANSWERED status, nullable reply/adminId/repliedAt and server timestamps. Replies contain 1–2000 trimmed characters. Client-supplied owner, status, author and timestamps never enter create payloads. Only an ACTIVE USER/AGENT may create or read their own requests. Only an ACTIVE ADMIN may manage notices, list all requests or reply. Current roles/status are rechecked in Member records, in addition to existing resolver guards. A conditional atomic update on `_id`, OPEN and null reply permits exactly one admin reply and prevents overwrites. There is no close, delete, reopen, support chat, global badge, polling, email or notification module.

GraphQL operations:

| Operation | Access | Result |
| --- | --- | --- |
| `getSupportNotices(input: SupportNoticesInquiry!)` | Public; ACTIVE FAQ/ANNOUNCEMENT only | `SupportNotices!` |
| `getSupportNoticesByAdmin(input: AdminSupportNoticesInquiry!)` | ACTIVE ADMIN; optional HOLD/ACTIVE filter | `SupportNotices!` |
| `createSupportNotice(input: CreateSupportNoticeInput!)` | ACTIVE ADMIN | `SupportNotice!` |
| `updateSupportNotice(input: UpdateSupportNoticeInput!)` | ACTIVE ADMIN; existing HOLD/ACTIVE FAQ/ANNOUNCEMENT | `SupportNotice!` |
| `createSupportRequest(input: CreateSupportRequestInput!)` | ACTIVE USER/AGENT | `SupportRequest!` |
| `getMySupportRequests(input: SupportRequestsInquiry!)` | ACTIVE USER/AGENT; actor-scoped | `SupportRequests!` |
| `getSupportRequestsByAdmin(input: SupportRequestsInquiry!)` | ACTIVE ADMIN; defaults to OPEN | `SupportRequests!` |
| `replySupportRequest(input: ReplySupportRequestInput!)` | ACTIVE ADMIN; one reply only | `SupportRequest!` |

Lists use `{ list, metaCounter: [{ total }] }`, integer page 1–2147483647, integer limit 1–50, and stable `createdAt DESC, _id DESC` sorting. Empty totals normalize to zero. Notice search is a case-insensitive literal match across English/Korean/Russian title/content; regex metacharacters are escaped. Public notice output excludes its creator ID. Private request member projection contains only `_id`, `memberNick`, `memberType` and is nullable for missing members. On the admin OPEN tab, filtered `metaCounter.total` supplies the unanswered count; no separate summary operation is needed. Render all content as plain text in the frontend.

Source responsibilities (all source paths below are relative to `apps/homehero-api/src`):

- `components/support/support.resolver.ts`: eight GraphQL entrypoints, existing auth/role guards and sanitized unexpected errors.
- `components/support/support.service.ts`: current account checks, validation, explicit payloads, list filters/pagination and atomic reply.
- `components/support/support.module.ts`, `components/components.module.ts`: dependency injection and model/module registration.
- `libs/dto/support/support.input.ts`, `libs/dto/support/support.ts`: code-first input/output contracts and nested translations.
- `libs/enums/support.enum.ts`, `libs/enums/notice.enum.ts`: request states and additive announcement category.
- `schemas/SupportRequest.model.ts`, `schemas/Notice.model.ts`: persistence, request indexes and optional notice translations.
- `components/support/support.spec.ts`: offline validation, permissions, ownership, projection, atomic conflict and real code-first schema tests.

Interview walkthrough: GraphQL input is validated, the resolver obtains the actor from authentication, the service verifies the current Member record, constructs an allowlisted database query/write, and returns the typed result. Private ownership belongs in the database match, not in client-provided memberId. Reply uses a single conditional database update because reading OPEN and then writing a reply in two separate steps would allow concurrent overwrites.

Validation: both API and batch TypeScript checks passed with `--noEmit --incremental false`; backend `npm run build` passed. Jest passed six offline suites and 145 tests, including Support and existing Service/Messaging/Review/Socket/Batch regressions. The initial plain Jest invocation hit an existing absolute-import resolution issue; running with CLI `--modulePaths=.` resolved it without configuration changes. No automatic lint, dependency installation, live mutation, seed or database connection was used for this checkpoint. Source/config/manifest hashes were compared with the phase baseline without Git operations.

Runtime limitation: the existing Nest watch parent was stopped before editing so model registration could not automatically restart the application and create collections/indexes. Its already-running API child was left serving the previous bundle on port 3007; it does not expose these new operations yet. The compiled build was not started. A separately approved live activation/restart can create the new Mongoose collections/indexes, and live integration must be reported separately. Frontend admin/public Support integration is the next checkpoint, after review of this backend work.
