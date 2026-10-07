# Fresh environment setup

This repository contains the Steward app source, dependency lockfile, tests, and documentation. It excludes `.env.local`, API credentials, database files and encryption keys, dependencies, build output, and temporary files. A fresh checkout starts with an empty application database.

## Runtime and network

Use Node.js 24 or later. Allow `api.openai.com` through the environment's supported network settings for live AI. Package installation also needs access to the npm registry. Preserve inherited proxy settings and CA trust; the app's Node startup uses the environment proxy. Editing `/etc/codex/network-policy.json` cannot grant network access.

Configure `OPENAI_API_KEY` through a secure environment secret binding, or in the ignored server-side `.env.local` with mode 0600. The credential from the previous workspace is not transferred by Git. Set `OPENAI_MODEL=gpt-4.1-mini` unless another accessible model is preferred. Keep credentials out of chat, browser code, logs, and source control.

## Start

From the repository root:

```sh
npm ci
npm run build
npm start
```

The default address is `http://127.0.0.1:3000`. Local commands work without a provider key. The server's `/api/session` reports `aiConfigured`, `aiAvailable`, and `aiBlockedReason` without returning the credential. An available/configured status does not establish a successful live API request; verify the provider separately with a small request before claiming the connection works.

## Verification

The source was verified with 36 domain/database/API tests, 7 Chromium workflow/accessibility tests, and a production build. Live OpenAI credentials and quota have not yet been verified.

```sh
npm test
npm run test:ui
```

UI tests need Chromium. Use the existing `/usr/bin/chromium`, set `CHROMIUM_PATH`, or install it with `npx playwright install chromium`. Tests use isolated synthetic data under ignored `work/`.

The app is a responsive web application, not a native iOS release. See [Phase report](PHASE_REPORT.md) for supported capabilities and production limitations.
