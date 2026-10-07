# Greenfield implementation report

Development began October 6, 2026 (America/New_York).

## Baseline and scope

The original directory contained only Git metadata, with no commits or application files. The configured GitHub remote advertised no branches or tags. No screenshots, existing database, or native project were supplied. The user then authorized starting from scratch.

Steward is now a functional responsive web app, with a Node/Express server, React/TypeScript client, schema validation, and encrypted SQLite persistence. Linux and Chromium were the supported execution environment. No Swift compiler, Xcode, Apple device, or signing configuration was available. No iOS binary, Apple integration, or App Store compliance certification is claimed.

The first coherent release focuses on persistent planning, permissioned local assistant actions, and connected manual life-management workflows. It does not satisfy every long-term feature in the master directive, and it is not a production release.

## Phase results

| Phase                          | What changed                                                                                                                                                                                                         | Verification and limits                                                                                                                                                                                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Baseline and stabilization | Established repository baseline, architecture, validation, authentication, account isolation, versioned migrations, encryption, and regression tests                                                                 | Database restart, owner isolation, stale edits, migration preservation, encryption integrity, auth/session, deletion, and CSRF tested. Independent security review and production operations remain                                                                                    |
| 1 — UX foundation              | Today/Plan/Ask/Discover/Life navigation, semantic design tokens, shared components, desktop/mobile layouts, light/dark appearances, focus traps, keyboard search, reduced motion, safe-area spacing                  | Browser workflows, automated WCAG A/AA checks across all main views in both appearances, and 200% text scaling verified. Manual VoiceOver/TalkBack and real-device checks remain                                                                                                       |
| 2 — Today and Plan             | Unified events, reminders, routines and trips; action inbox; atomic overdue triage; overlap/travel-buffer checks; date navigation; birthdays/bills; daily briefing; event/task/routine/buffer timeline               | Local record creation/editing, persistence, conflict workflow, bulk triage, DST conversion and explicit offsets verified. Calendar synchronization, drag-and-drop, recurrence exceptions, and background reminders remain                                                              |
| 3 — Assistant                  | Schema-defined read/write tools, ownership and mode enforcement, proposals, explicit approval, idempotent execution, output validation, memory controls, action history, cancellation, and partial-failure reporting | Local command workflows verified. Responses API behavior tested with controlled fixtures, including unsupported tools, false completion text, quota failures, and partial execution. A user-supplied key is configured; live AI verification is blocked by the enforced network policy |
| 4 — Provider transactions      | Supported HTTPS handoffs and saved research records                                                                                                                                                                  | Booking state cannot be falsely marked confirmed. Provider URL and schema checks verified. No live availability, payments, submission, cancellation, or reconciliation adapters are implemented                                                                                        |
| 5 — Life workspaces            | Contacts/notes/birthdays/follow-ups; manual bills; document metadata; manual wellness journal; same-unit sleep comparisons; explicit memory; integration requirement screens                                         | Contact/follow-up browser journey and shared schema/ownership controls verified. Health/banking/HomeKit integrations and secure file storage remain                                                                                                                                    |
| 6 — Proactive engine           | Configurable trigger/action suggestions, manual dry-run, pause/edit/delete controls, persisted dry-run results                                                                                                       | Dry-run test verifies zero mutations. Unattended scheduling, notification delivery, event subscriptions, and external automation execution remain                                                                                                                                      |

## Implementation inventory

Classifications apply to the listed scope, not to an entire broader module.

| Capability                                          | Classification                                               | Actual behavior                                                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Password accounts and owner isolation               | Fully functional and verified locally                        | Salted scrypt, hashed sessions, account-specific queries                                                                                      |
| Private payload persistence                         | Fully functional and verified locally                        | AES-256-GCM, restrictive file/key permissions, authenticated reads, restart persistence                                                       |
| Version 1 → 2 storage migration                     | Fully functional and verified locally                        | Transactionally preserves records, relationships, credentials and sessions                                                                    |
| Event/reminder CRUD                                 | Fully functional and verified locally                        | Real database operations; invalid input and stale revisions rejected                                                                          |
| Overdue reminder bulk triage                        | Fully functional and verified locally                        | Atomic completion/rescheduling; no partial overwrite on stale item                                                                            |
| Timezone conversion and DST handling                | Fully functional and verified locally                        | Nonexistent/ambiguous local times rejected; explicit offsets supported                                                                        |
| Conflict/travel-buffer detection                    | Fully functional and verified locally                        | Derived from saved intervals and user-entered buffer duration                                                                                 |
| Today external briefing data                        | Missing entirely                                             | Weather, traffic, packages, and wearable recovery are not fetched                                                                             |
| Routine blocks and trip records                     | Partially implemented                                        | Persistent manual configuration; routines appear as blocks, trips can link to events; no provider synchronization or background notifications |
| Local assistant commands/searches                   | Fully functional and verified within documented syntax       | Deterministic parser and real read/write tool results; explicitly not AI                                                                      |
| Tool approval and execution history                 | Fully functional and verified locally                        | Observe/suggest/approval/limited reminder autopilot enforced in code                                                                          |
| AI provider adapter                                 | Partially implemented; blocked by third-party access         | Server-only adapter and fixture tests exist; user-supplied key configured; live request blocked by network settings                           |
| Memory record controls                              | Fully functional and verified locally                        | Explicit records can be edited, disabled, deleted, and excluded globally; live AI use remains blocked                                         |
| Provider research handoffs                          | Fully functional and verified within handoff scope           | Real provider links and saved records; all remain unverified                                                                                  |
| Live availability and confirmed reservations        | Blocked by third-party access; implementation missing        | Commercial/API access and transaction adapters required                                                                                       |
| Contacts and linked outreach reminders              | Fully functional and verified locally                        | User-entered details and manual contact timestamps; no silent messages                                                                        |
| Wearable/native health ingestion                    | Blocked by platform/provider access; implementation missing  | Manual journal available; no claims of imported metrics                                                                                       |
| Health comparison context                           | Partially implemented                                        | Latest manual sleep entry versus previous entry with the same nonempty unit; no wearable baselines or diagnoses                               |
| Bills                                               | Fully functional and verified within manual tracking scope   | Currency-separated totals, deadlines, and self-reported payment status                                                                        |
| Connected banking or payments                       | Blocked by provider access; implementation missing           | No financial transaction tools                                                                                                                |
| Document metadata                                   | Fully functional within metadata scope                       | Categories, notes, and expiration timestamps use shared persistence                                                                           |
| Encrypted document file vault/OCR                   | Missing entirely                                             | No upload or file contents stored                                                                                                             |
| Home/device control                                 | Blocked by platform/provider access; implementation missing  | Requirements and disconnected state only; no simulated devices                                                                                |
| Automation dry runs                                 | Fully functional and verified within dry-run scope           | Reads local records, produces a suggestion, persists history, executes no changes                                                             |
| Unattended automation scheduling                    | Missing entirely                                             | No false claims of continuous background execution                                                                                            |
| Apple frameworks, widgets, Siri, Live Activities    | Blocked by native build/device setup; implementation missing | Requires native targets, entitlements, supported devices and consent                                                                          |
| Offline persistence, sync queues, provider webhooks | Missing entirely                                             | Browser does not store authoritative account data; server failures preserve form input                                                        |
| Passkeys/OAuth/production telemetry                 | Missing entirely                                             | Not represented as available                                                                                                                  |
| Known broken advertised local workflows             | None found in the tested scope                               | Untested provider/native workflows are explicitly unavailable                                                                                 |
| Simulated personal data/confirmations               | None shipped                                                 | Synthetic data is isolated to tests/benchmarks                                                                                                |

## Files and components

- `server/domain.js`: record schemas, settings, input/output tool contracts, supported scopes, timestamp handling, and conflict detection.
- `server/store.js`: versioned storage, encryption, authentication/session records, owner isolation, revisions, transactions, proposals, verified execution and history.
- `server/assistant.js`: deterministic commands, optional server-side AI proposals, cancellation, finite tool allowlist, grounded results, and partial-failure handling.
- `server/app.js`, `server/index.js`: authenticated API, security headers, bounded requests, CSRF/origin checks, throttling, app serving, and shutdown.
- `src/App.tsx`, `src/context.tsx`, `src/api.ts`, `src/types.ts`: account lifecycle, navigation, shared state, refresh/error behavior, global capture/search, and typed client API.
- `src/Today.tsx`, `src/Plan.tsx`, `src/Ask.tsx`, `src/Discover.tsx`, `src/Life.tsx`: working primary workflows.
- `src/components.tsx`, `src/styles.css`: reusable controls/editors/dialogs/states, semantic appearance tokens, responsive layouts and accessibility behavior.
- `tests/`: domain, database, API, failure/security fixtures, and real Chromium workflow/accessibility tests.
- `scripts/benchmark.mjs`: reproducible synthetic storage-read benchmark.
- `README.md`, `docs/WORKFLOWS.md`, configuration, lockfile, app icon and web manifest: setup, operation, user journeys, and build metadata.

## Verification

- Production TypeScript/Vite build: passed.
- Domain/database/API tests: 36 tests passed, including a configured-key/blocked-network case that retains local commands without exposing credentials.
- Chromium UI tests: 7 workflows passed, covering persistence across reload, approval, conflict detection, linked follow-up creation, mobile provider handoff, light appearance, preserved error input, dialog focus, primary-view accessibility, text enlargement, and explicit DST offsets.
- Automated accessibility: main views passed axe WCAG 2 A/AA and WCAG 2.1 AA rules in dark and light appearances. This does not replace manual assistive-technology and device testing.
- Dependency security check: `npm audit --omit=dev` reported zero known production dependency vulnerabilities at the time of verification. This is not a comprehensive security audit.
- No live OpenAI, booking, banking, calendar-provider, health-provider, smart-home, or Apple-device integration tests were performed.

## Performance findings

The reproducible benchmark read and decrypted 1,000 synthetic reminders 30 times using in-memory SQLite in this environment: median 41.58ms; 95th percentile 73.48ms. These measurements exclude disk, network, client rendering, and password hashing, and are not mobile-device performance claims.

The latest production bundle is approximately 317KB JavaScript (95KB build-reported gzip estimate) plus 43KB CSS (9KB gzip estimate). The local server does not currently configure HTTP compression, so gzip estimates are build information rather than measured transferred bytes.

Pagination, incremental state retrieval, code splitting, cold-launch measurements, large-dataset client profiling, and native battery/memory testing remain priorities before scaling. Synchronous SQLite and password hashing are suitable for this bounded local version, not a high-concurrency service.

## Credentials, setup and limits

OpenAI Platform rejected automated creation of the selected key named Steward without providing a more specific reason. Temporary RSA private key material was removed. The user then supplied a key and explicitly authorized its use. The key is stored only in the ignored server env file with mode 0600. The managed environment currently excludes api.openai.com from its enforced allowlist, so live credentials and quota remain unverified. The app reports the configured key and blocked network separately and keeps local commands available. Live verification requires enabling the host through environment network settings and restarting the app.

Provider integrations need app-owned OAuth/PKCE, narrowly scoped consent, secrets on the server, real API contracts, idempotency and reconciliation, and tested disconnection/revocation. Codex's connected apps have not been substituted for application-owned user integrations.

Apple integrations require a native project, Mac/Xcode build and signing environment, deployment target, entitlements, purpose strings, and supported-device tests. This environment cannot verify them.

The application has not been deployed publicly. It defaults to loopback access. Production TLS, KMS/key rotation, passkeys or stronger authentication, account recovery, distributed rate limiting, managed backups, operational monitoring, a secure file vault, retention scheduling, and independent security/privacy review remain necessary. Account deletion is logical deletion from the active database, not guaranteed physical erasure.

## Remaining work in priority order

1. Provision and verify live AI securely; add grounded read/clarification rounds and evaluation coverage while preserving the existing executor boundaries.
2. Establish the native iOS build/device environment and implement EventKit/Contacts consent and synchronization with stable provider IDs and conflict handling.
3. Add reliable scheduled reminders, recurrence and exceptions, incremental synchronization, offline read policies, and reconciliation tests.
4. Implement one authorized booking provider completely, including real availability, full prices/policies, explicit approval, confirmed provider IDs, unknown-outcome reconciliation, and cancellation.
5. Complete deployment/security operations, stronger authentication, backup/restore, key management, retention controls, and large-dataset performance work.
6. Expand HealthKit/HomeKit and financial integrations only with actual access and real-device/provider tests; add secure document blob storage before introducing uploads.
7. Add server-side automation triggers with deduplication, observed execution states, controlled approvals, scheduling, and provider failure recovery.
