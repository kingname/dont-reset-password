# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Don't Reset Password" (DRP) — a Chrome extension (Manifest V3) that crowdsources and displays password composition rules next to password input fields. Backend is pure Supabase (Edge Functions + PostgreSQL + RLS). UI supports Chinese and English via Chrome's `_locales` i18n.

## Architecture

### Data Flow

```
Content Script → chrome.runtime.sendMessage → Service Worker → DRP_Cache → DRP_API → Supabase Edge Function → PostgreSQL
```

Content scripts detect `<input type="password">` fields (including dynamic ones via MutationObserver), request rules from the service worker, and render a Shadow DOM tooltip below the input.

### Message Protocol (chrome.runtime)

All communication between content scripts, popup, and backend goes through the service worker using these message types: `GET_RULES`, `SUBMIT_RULES`, `VOTE`, `REPORT`, `GET_DOMAIN`, `GET_STATS`.

### Module System

No build step. All utilities attach to `globalThis` (e.g., `globalThis.DRP_Domain`, `globalThis.DRP_Rules`). Content scripts load via manifest `js` array ordering. Service worker uses `importScripts()`.

### Key Globals

- `DRP_Domain` — eTLD+1 extraction (handles multi-level TLDs like `.co.uk`, `.com.cn`)
- `DRP_Rules` — validation, display formatting, confidence levels
- `DRP_Cache` — chrome.storage.local with 1h TTL, 100-entry LRU
- `DRP_API` — Supabase Edge Function calls + direct REST queries
- `DRP_Tooltip` — Shadow DOM component with dark mode, collapse, dismiss, voting
- `DRP_i18n` — wrapper around `chrome.i18n.getMessage()`

### Supabase Edge Functions (TypeScript/Deno)

- `get-rules` — query canonical rules by domain
- `submit-rules` — insert contribution + run consensus algorithm to update canonical rules
- `vote` — upsert vote + update counts + auto-hide if net score < -5
- `report` — insert report + auto-hide after 3 reports

All Edge Functions use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS for writes.

### Database (5 tables)

`domains` → `password_rules` (1:1 canonical) ← `rule_contributions` (N:1 for consensus). Plus `votes` and `reports` with per-fingerprint uniqueness.

### User Identity

Anonymous SHA-256 hash of a random installation UUID. No accounts, no login. Stored in `chrome.storage.local.drp_installation_id`.

## Development

### Running Tests

```bash
npm test                    # run all 116 tests (node:test, zero dependencies)
node --test tests/domain.test.js   # run a single test file
```

Tests mock Chrome APIs (`chrome.storage`, `chrome.i18n`, `chrome.runtime`, `fetch`) via `tests/setup.js`. Available test files: `domain`, `rules-schema`, `cache`, `api`, `i18n`.

### Loading the Extension Locally

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select the `extension/` directory

### Configuring the Backend

Edit `extension/utils/api.js` — replace `SUPABASE_URL` and `SUPABASE_ANON_KEY` with your Supabase project values.

### Database Setup

```sql
-- Run in Supabase SQL Editor, in order:
-- 1. Schema
supabase/migrations/001_initial_schema.sql

-- 2. Seed data (30 popular sites)
supabase/seed.sql
```

### Deploying Edge Functions

```bash
supabase functions deploy get-rules
supabase functions deploy submit-rules
supabase functions deploy vote
supabase functions deploy report
```

### Packaging for Distribution

```bash
cd extension && zip -r ../drp-extension.zip . -x "*.DS_Store"
```

Only the `extension/` directory goes into the zip. A GitHub Actions workflow (`.github/workflows/release.yml`) auto-creates releases on push to main, using the version from `manifest.json` as the tag.

## Conventions

- Tooltip styles are embedded in `tooltip.js` (Shadow DOM), not in external CSS files. `content.css` is a placeholder.
- The popup has 5 discrete states: loading, rules-found, no-rules (contribute form), success, not-on-website.
- Rate limits are enforced inside each Edge Function by querying recent rows per fingerprint, not via middleware.
- Consensus algorithm: for boolean/numeric fields, majority wins; for string fields, most recent non-null wins. Confidence score = average agreement ratio across fields.
- Content script heuristic: also detects `<input type="text">` where name/id/autocomplete contains "passw", "passwd", or "pwd".
- MV3 cannot programmatically open the popup. `OPEN_POPUP` opens `popup.html` in a new tab with `?domain=` param; `popup.js` reads this param to skip `GET_DOMAIN`.
- `DRP_i18n.msg(key, ...substitutions)` uses rest params — pass multiple substitutions as separate args, not an array.
- Bump `version` in `manifest.json` before each release, or the GitHub Actions release will fail (duplicate tag).
