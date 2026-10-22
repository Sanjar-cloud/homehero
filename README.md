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


## Deployment readiness — focused Member security fixes

Public signup now accepts only USER or AGENT, defaults an omitted/null role to USER, and rejects ADMIN/invalid roles before hashing or writing. Creation uses explicit signup fields; callers cannot inject account status, counters or IDs. The existing password hashing and token creation remain intact.

Self-service `updateMember` rejects supplied role, status and password fields (including null) and sends only nickname, phone, full name, avatar, address and description using `$set`. Ownership still comes from the authenticated member ID and the existing database ACTIVE filter. Successful updates continue returning a fresh token. The shared GraphQL DTOs remain unchanged because the separate guarded `updateMemberByAdmin` operation uses them; its existing behavior is preserved. No password-change API or authentication redesign was introduced.

Signup no longer logs input; login no longer logs the member document/hash/token. Signup database failures use a static diagnostic rather than a raw error message. Existing operation-name diagnostics remain. Both upload operations reject targets outside `member`, `service`, `article` and the existing legacy `property` before opening a stream. Existing MIME checks and returned upload paths are preserved. This is a target allowlist fix, not a complete file-content validation or upload-system redesign; existing multi-upload partial-failure behavior remains unchanged.

Scope: only `apps/homehero-api/src/components/member/member.service.ts`, `apps/homehero-api/src/components/member/member.resolver.ts`, the new `apps/homehero-api/src/components/member/member.security.spec.ts`, and this README. No GraphQL DTO/schema, frontend, dependency, environment, database or Git changes were made. Backend `docs/ai` is absent, so this validation record remains in the existing README.

Validation: API and batch TypeScript checks passed with `--noEmit --incremental false`. The new Jest suite passed 27 offline tests covering allowed/default signup roles, ADMIN/invalid-role denial, injected signup fields, protected self-update fields/nulls, USER/AGENT/ADMIN profile editing, authenticated ownership, separate admin operation/guard preservation, inactive/missing update failure, refreshed tokens, safe logging, allowed upload paths, traversal/invalid-target rejection before streams, and existing single-upload MIME rejection. Member models, token operations and filesystem writes are mocked; no database connection, account creation, token issuance, live upload or real file write was performed by the tests. Existing installed tools were used without new dependencies.

One `npm run build` passed in `/private/tmp/homehero-security-build-br4mxgo2` with the existing dependency directory linked, excluding environment files, uploads and previous build output. Compilation did not use or modify the project's `dist` directory. No server/watch process was started, stopped or restarted. Auto-fixing lint was not run. Live API/browser integration and VPS deployment have not been performed; these focused fixes do not certify a complete production security audit. Previously issued credentials/tokens or historical logs were not rotated/deleted in this checkpoint.

## VPS deployment — Docker/Nginx configuration checkpoint

This checkpoint prepares deployment files; it does not deploy the application. The two repositories must remain siblings (`homehero` and `homehero-next`). Run the documented Compose commands from the `homehero` repository root. Docker Compose v2 is required.

### Files and service responsibilities

- `Dockerfile`: multi-stage API build using Node 22 Debian slim, the existing `package-lock.json`/`npm ci`, `npm run build`, production dependency pruning, and the existing `dist/apps/homehero-api/main.js` entry point. The final application runs as `node`, not root.
- `.dockerignore`: excludes local environment files, registry credentials, private keys, source-control metadata, installed dependencies, compiled output, uploads and the deployment directory from the image context.
- `deploy/compose.yaml`: frontend/backend/Nginx services, application liveness checks, startup dependencies, bounded container logs, restart policies and the persistent `homehero_uploads` volume. Only Nginx publishes a host port. No MongoDB container, batch scheduler, PM2 or database migration/seed is started.
- `deploy/nginx.conf`: proxies `/` to `frontend:3000`, exact `/graphql` and `/ws` plus `/uploads/` to `backend:3007`. WebSocket upgrade headers are explicit; the idle read timeout is one hour. Access logs omit query strings; this is not a claim that every upstream/error log is sanitized. The 160 MiB proxy body limit accommodates the existing ten-file/15,000,000-byte-per-file backend limit plus multipart overhead.
- `deploy/.env.example`: blank placeholders and public endpoint examples only. It is not a runtime credential file. This README records preparation, commands, validation and remaining gates.

Frontend `Dockerfile`, `.dockerignore` and README changes are the other three files in the approved nine-file, two-repository scope. Application source, dependency versions, lockfiles and existing `.env` files remain unchanged.

### Environment and persistence

The frontend embeds its three public endpoint values at build time. `PUBLIC_ORIGIN` must be the browser-reachable origin without a trailing slash (for example, `http://127.0.0.1:8080` for an isolated local check). `PUBLIC_WS_URL` must have the matching host/port and protocol, ending in `/ws`. For HTTPS use `https://<public-ip>` and `wss://<public-ip>/ws`. Do not use Docker service names as browser URLs. Changing origin or HTTP to HTTPS requires rebuilding the frontend; changing runtime environment alone will not update its bundle.

Backend runtime values are `NODE_ENV=production`, `PORT_API=3007`, a dedicated `SECRET_TOKEN` and the explicitly approved `MONGO_PROD` URI. `MONGO_DEV` is not supplied. Verify the database name and approved content before activation: starting Mongoose can connect/write indexes even without a manual mutation. MongoDB must be reachable from the container; `localhost` in a container refers to that container, not the VPS or developer's Mac. This checkpoint does not choose, create, copy or seed a database. Never put secrets in frontend arguments, Dockerfiles, images, shell history, documentation, chat or Git. The existing code expects environment variables, so use a private server-side environment file with mode 0600 and restricted server access; Docker administrators can inspect container environment values.

The API working directory is `/app`; existing relative paths therefore write to `/app/uploads`. The named volume survives container/image recreation. A new volume is initialized from the image's node-owned `member`, `service`, `article` and legacy `property` directories. Existing volumes/imported files still need a write-permission check for UID/GID 1000 before activation. Local uploads are deliberately excluded from images; existing images need an approved backup/import into the volume with relative paths preserved. No data copy or provisioning was executed here. Never run `docker compose down -v` or remove `homehero_uploads` to fix an application problem. Back up uploads and database separately, and test restoration before relying on them.

### Staged validation and activation — commands for a later approved step

Do not run `up` against a real database until the runtime/database step is approved. For syntax validation only, dummy values allow rendering without reading or printing secrets:

```bash
PUBLIC_ORIGIN=http://127.0.0.1:8080 \
PUBLIC_WS_URL=ws://127.0.0.1:8080/ws \
MONGO_PROD=offline-validation-only SECRET_TOKEN=offline-validation-only \
docker compose -f deploy/compose.yaml config --quiet
```

During the approved runtime step, create a private `deploy/.env` from the example, set mode 0600, enter confirmed values locally, then validate/build. Never print the full resolved Compose configuration; it contains secrets. `config --quiet` validates without displaying them.

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml config --quiet
docker compose --env-file deploy/.env -f deploy/compose.yaml build
```

Only after database, upload, TLS and public-exposure checks are approved:

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d
docker compose --env-file deploy/.env -f deploy/compose.yaml ps
docker compose --env-file deploy/.env -f deploy/compose.yaml exec nginx nginx -t
```

Check homepage/locales, read-only GraphQL, existing upload images and authenticated `/ws` handshake. Live signup/profile/upload/Follow/message writes need their own approved test scope. Health checks are liveness checks, not complete database/API/security tests. Restart policies recover exited containers, not merely containers marked unhealthy.

Safe defaults bind Nginx to `127.0.0.1:8080`. A remote browser cannot access that VPS binding directly; use an SSH tunnel for controlled bootstrap checks. The current Nginx configuration serves HTTP only. Do not expose real login/messages on public HTTP. Public IP binding, firewall, IP certificate issuance/automatic renewal, certificate mounts, HTTPS redirect and WSS checks belong to the next VPS checkpoint. An IP certificate is planned; no paid domain is required. Enabling HTTPS will require editing the proxy/Compose configuration and rebuilding the frontend with HTTPS/WSS origins. None of that activation happened here.

Use a unique `RELEASE_TAG` per release and retain the last known-good frontend/backend images. After recreating app containers, recreate Nginx so its startup-resolved upstream addresses are refreshed:

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --force-recreate nginx
```

For rollback, restore the previous image tag and matching public origin configuration, use `up -d --no-build`, then recreate Nginx as above. Do not delete the volume or restore a database blindly. A change in signing secret invalidates existing sessions; deployment should use a new dedicated secret rather than copying leaked development credentials.

### Validation performed and remaining gates

PASS: frontend/API/batch TypeScript with `--noEmit --incremental false`; offline parsing of Compose YAML/interpolation, exact build contexts, internal-only application ports, loopback proxy defaults, required environment values, backend-only secrets, health dependencies and persistent-volume wiring. Dockerfile structural checks and the actual frontend endpoint guard passed for HTTP/HTTPS values and rejection of missing/mismatched/credential-bearing values. Static Nginx checks confirmed matching route/upstream names, upgrade headers, body limit and query-free access format. These checks used an already installed YAML parser through a temporary harness; no test dependency was installed.

BLOCKED: `docker --version` returns `docker: command not found`, and no local Nginx executable is available. Docker image builds, frozen dependency installation inside Linux/Node 22, `docker compose config`, `nginx -t`, container health, Linux upload permissions and end-to-end HTTP/WebSocket behavior were not executed or certified. No duplicate host `yarn build`/backend build was run: host Node 20 builds would not certify the new container environment. No server, database, upload volume or VPS was started/changed.

Before public release, verify Node 22 compatibility and select/pin tested image digests, inspect the existing Next.js 14.2.0/security-patch support and other dependency advisories, and review the currently permissive backend CORS and public GraphQL playground settings. No dependency upgrade or backend hardening outside the previous approved Member fixes was silently included. These are release-readiness gates, not evidence that the configuration has already passed production testing.

## Live VPS activation — 2026-10-22

This update supersedes the bootstrap-only preparation status in the preceding checkpoint. The approved deployment is running at **https://187.127.209.174**. The user executed the VPS commands and supplied successful output for both Node 22/Linux image builds, backend/frontend health, Nginx syntax validation, upload import/ownership, trusted IP-certificate issuance, a successful renewal dry run, and an active `homehero-cert-renew.timer`.

Current `deploy/compose.yaml` exposes only Nginx on public IPv4 ports 80/443, retaining the existing loopback diagnostic port 8080. `deploy/nginx.conf` serves ACME files from `/var/www/certbot` on HTTP and otherwise redirects to HTTPS; TLS proxies the existing `/graphql`, `/ws`, `/uploads/` and frontend routes. Certificates are mounted read-only from `/etc/letsencrypt`; the ACME webroot is mounted read-only from `/var/lib/homehero-acme`. TLS validation must follow certificate issuance; the current configuration cannot boot without its certificate files.

On the VPS, the renewal oneshot service runs the pinned Certbot 5.4.0 container against the shared certificate/webroot directories and validates/reloads Nginx on success. Its timer runs twice daily with a randomized delay. The unit files live under `/etc/systemd/system/` on the VPS, not inside either application image. Keep HTTP port 80 available for renewal. The existing Atlas `homehero` database and a new private deployment JWT secret were explicitly approved; uploads were imported into `homehero_uploads`. No seed or batch process was started.

Independent read-only public validation confirmed HTTP 200 for the main public pages and EN/KR/RU Support, trusted TLS 1.3 with the matching IP SAN, HTTP-to-HTTPS redirect, GraphQL `Query` response, guest rejection for own-support and conversation queries, and WSS 101 followed by unauthenticated close code 1008. Browser checks confirmed public service/provider/community data, uploaded images, Support search/clear and content, and focused desktop/mobile layouts. These checks do not certify authenticated message delivery, real mutations, database recovery or a full security audit.

The frontend [README](../homehero-next/README.md#live-vps-validation-and-portfolio-handover--2026-10-22) contains the detailed validation matrix, known Korean HTML-language inconsistency, proposed separately approved Next.js update and interview walkthrough. Next.js 14.2.0 remains deployed and unsupported; no dependency/source hardening was silently included. No new live business records or credentials were created for this review. Authenticated USER/AGENT/ADMIN checks and live writes remain unverified until an appropriate session and approved test scope are available.

For operational inspection, connect as `deploy`, run commands from `/home/deploy/apps/homehero`, and use `sudo docker compose --env-file deploy/.env -f deploy/compose.yaml ps`, `sudo docker compose --env-file deploy/.env -f deploy/compose.yaml exec -T nginx nginx -t`, `systemctl status homehero-cert-renew.timer`, and `sudo journalctl -u homehero-cert-renew.service`. Never display the resolved private Compose environment or share unredacted logs. After replacing app containers, recreate Nginx to refresh its resolved upstream addresses. Preserve the named uploads volume and retain rollback images; `down -v` is not a repair step.


## Notification backend checkpoint — October 22, 2026

The approved notification backend is implemented locally. The Header bell and
frontend integration were completed in the subsequent frontend checkpoint
(see ../homehero-next/README.md); this feature is not deployed yet.

- `NotificationModule` reuses the existing `notifications` collection and legacy
  enum values. New types are `MESSAGE`, `SUPPORT_REPLY`, and `SERVICE_STATUS`.
- Successful private messages notify the other participant; successful ADMIN
  Support replies notify the request owner; actual ADMIN Service status changes
  notify the owning AGENT. Same-status saves and AGENT edits do not create alerts.
- `getNotifications(input: NotificationsInquiry!)` returns `list`, `total`,
  `unreadCount`, and `readBefore`; page starts at 1 and limit is at most 50.
- Mutations: `markNotificationRead(notificationId: String!)`,
  `markAllNotificationsRead(before: DateTime!)`, and
  `markMessageNotificationsRead(input: ReadMessageNotificationsInput!)`.
  The message input contains `conversationId` and at most 100 displayed `messageIds`.
- Every operation checks the database account is ACTIVE and USER/AGENT. All
  notification reads and writes are scoped to that receiver. Message read receipts
  additionally verify conversation ownership and the exact persisted received IDs.
- Mark-all uses the query's `readBefore` cutoff. Hidden read receipts prevent a
  late message producer from reviving unread state; reading historical messages
  does not backfill the notification inbox. Full private message/reply text is not
  copied into notification payloads.
- A partial unique `eventKey` index deduplicates new events without requiring a
  legacy-data migration. `Model.init()` waits for index initialization on writes.
  ADMIN status transitions get a distinct key only after the atomic update wins.
- Authenticated `/ws` sends receiver-only `notification:changed` invalidations;
  clients should refetch their own list/count, including after reconnect. Read
  changes also signal other tabs. Existing private chat events are preserved.
- Delivery is best effort: no outbox, retries, historical backfill job, email,
  browser push, or new dependency was added. A notification persistence failure
  logs a generic warning and does not fail an already-saved source operation;
  process/database failures can therefore lose an alert.
- Notification APIs are additive. The internal `updateServiceByAdmin` service
  method now requires the authenticated ADMIN ID; its GraphQL input is unchanged.
- Validation uses mocked persistence and the generated GraphQL schema, with no
  live database writes. API and batch TypeScript checks and an isolated backend
  build pass. Live browser/Atlas integration remains unverified for this feature.

Focused tests (the existing absolute imports need this CLI-only Jest mapping):

```bash
npm test -- --runInBand --moduleNameMapper '{"^apps/(.*)$":"<rootDir>/apps/$1"}' \
  apps/homehero-api/src/components/notification/notification.spec.ts \
  apps/homehero-api/src/components/messaging/messaging.spec.ts \
  apps/homehero-api/src/components/support/support.spec.ts \
  apps/homehero-api/src/components/service/service.migration.spec.ts \
  apps/homehero-api/src/socket/socket.gateway.spec.ts
```
