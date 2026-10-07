# Steward

A functional first version of a personal operating system, built from an empty repository. Today, Plan, Ask, Discover, and Life share one persistent, private workspace. This is a responsive web application; it is **not an iOS binary or an App Store release**.

## Run

Requires Node.js 24 or later.

```sh
npm ci
npm run build
npm start
```

Open `http://127.0.0.1:3000`. Create an account, choose your timezone, and add your own records. The application starts empty. It does not preload fictional personal data.

For development, use `npm run dev`. Port and database path can be configured through `PORT` and `DATABASE_PATH`. The default interface is loopback only. Do not expose the server to a network without TLS, a trusted reverse proxy, and the additional production controls described in the phase report.

For a fresh Codex environment, see [Environment handoff](docs/ENVIRONMENT_HANDOFF.md). API credentials and existing application data are not included in the repository.

## Available now

- Today: saved-data briefing, next focus, overdue reminders with atomic bulk completion/rescheduling, pending approvals, failed actions, birthday and bill notices, event/routine timeline, and daily completion counts.
- Plan: persistent event and reminder creation, editing and deletion; open/completed filters; date navigation; title search; travel buffers; overlap detection; routines; and trip records.
- Ask: real local commands, saved-data searches and summaries, validated tool proposals, permission modes, explicit approvals, and persistent execution history. Double approval cannot duplicate a mutation.
- Discover: real HTTPS links to OpenTable, Google Flights, Booking.com, Google Maps, and Eventbrite. Research links can be saved. Availability, checkout, and booking confirmations remain with the provider.
- Life: contacts, explicit birthdays and relationship notes, linked follow-up reminders, manual last-contact tracking, manual bills, document metadata and expiration dates, wellness journals with same-unit sleep comparisons, routines, user-controlled memory, and manual automation dry runs.
- Account controls: password authentication, isolated accounts, session logout, JSON export, and authenticated account deletion.
- Design: responsive layouts, dark/light appearance, keyboard search, trapped dialog focus, reduced-motion support, and safe-area-aware mobile navigation.

## Assistant examples

The local command engine is deterministic and **is not a language model**. Supported examples:

```text
Remind me to call Grandma tomorrow
Add task: renew insurance
Remind me to renew insurance on 2026-11-01
Complete task: renew insurance
Schedule workout tomorrow at 9am for 60 minutes
Search tasks: insurance
Search events: workout
Search contacts: Jordan
Summarize my day
Help
```

Day-only reminder commands prepare a 6pm deadline in the selected timezone and display it before approval. Unrecognized or ambiguous requests do not execute changes. Repeated daylight-saving hours require explicit offsets; the local form rejects these ambiguous times instead of choosing silently.

OpenAI Platform rejected automated key creation without a more specific reason. The user subsequently supplied a key and explicitly authorized its use. It was saved server-side in the original workspace's ignored `.env.local` with mode 0600. **Live API verification was blocked in that workspace: its enforced network policy did not allow `api.openai.com`.** A new environment must allow that host and have its own server-side credential configured; credentials and quota have not been verified. Ask distinguishes a configured key from available AI and retains local commands while the network is blocked.

The server includes an optional Responses API tool-proposal adapter. `OPENAI_API_KEY` and optional `OPENAI_MODEL` are loaded only on the server, either from the environment or the ignored `.env.local`. Node startup respects inherited environment proxy settings. The browser never receives the key. Do not commit a key. AI proposals use the same validation, ownership, approval, revision, and output checks as local commands. Unsupported model tools cannot run. Free-form model text is not used to claim completed actions; completion is derived from verified tool results.

## Storage and security

`data/steward.sqlite` is the default persistent database. Private record contents, settings, account emails, messages, and action input/result/error payloads are encrypted with AES-256-GCM. The adjacent `data/steward.sqlite.key` is generated with restrictive permissions. Email lookup uses keyed HMAC; passwords use salted scrypt; session tokens are stored as SHA-256 digests. The database stores IDs, kinds, timestamps, revisions, and execution status as queryable metadata.

**Back up the database and its original `.key` file together.** Losing the key makes encrypted content unreadable. The application refuses to generate a replacement key for an existing encrypted database. The key is colocated on the server, so this protects copied database contents and does not protect against a compromised server or an attacker who can read both files. Database encryption is not end-to-end encryption. JSON exports contain plaintext and should be handled accordingly.

Versioned startup migrations are transactional. Version 2 migrates the initial version 1 payloads into encrypted storage while retaining IDs, relationships, revisions, password credentials, and sessions. Older backups may still contain plaintext; physical erasure of deleted data or backups is not guaranteed.

The application has HttpOnly/SameSite cookies, same-origin mutation checks, CSRF request headers, security headers, bounded request bodies, schema validation, prepared SQL statements, and login throttling. The production build uses a restrictive content security policy. Deployment, passkeys, OAuth, account recovery, key management/rotation, backup scheduling, a distributed rate limiter, operational monitoring, and independent security review remain required before production use.

Document support is metadata only; there is no file vault or OCR. Do not treat it as encrypted document storage. Health and money features are manually entered tracking tools, not connected medical or financial services.

## Verify

```sh
npm test
npm run build
npm run test:ui
```

UI tests use Chromium at `/usr/bin/chromium` when available, or Playwright's installed browser. On another machine, run `npx playwright install chromium`, or set `CHROMIUM_PATH`. UI test accounts and databases live in ignored `work/`, separate from the real application database.

See `docs/PHASE_REPORT.md` for the capability inventory, verification results, and next priorities, and `docs/WORKFLOWS.md` for complete user journeys.
