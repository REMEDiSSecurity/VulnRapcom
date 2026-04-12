# VulnRap.com

## Overview

VulnRap.com — a vulnerability report validation platform (like VirusTotal for bug reports). Allows anonymous users to upload vulnerability reports to check for similarity with other reports and score them for potential AI-generated sloppiness using a multi-axis scoring engine (linguistic fingerprinting + factual verification + LLM semantic analysis via OpenAI-compatible API, fused via Bayesian combination). Reports are auto-redacted before storage to remove PII, secrets, and identifying information.

**Current version: 2.0.0** — Multi-axis scoring engine overhaul, PSIRT-focused LLM prompt, side-by-side similarity comparison, input hardening.

## Recent Additions (post-1.2.0)
- **Batch Upload** (`/batch`) — Multi-file drag-and-drop, sequential processing with progress, results links
- **Compare Two Reports** (`/compare`) — Side-by-side dual text input, independent analysis via /check endpoint, section overlap detection
- **Session History** (`/history`) — localStorage-based history of all submitted/checked reports, clear/remove entries
- **Export/Download** — JSON and TXT export buttons on results page, generates downloadable analysis reports
- **Configurable Thresholds** — Settings panel (localStorage) for custom slop score tiers and similarity thresholds, accessible from results page
- **GitHub repo links** — All "open source" mentions link to https://github.com/REMEDiSSecurity/VulnRapcom, GitHub icon in footer
- **Scoring Engine v2.0** — 4-axis analysis pipeline replacing single-score heuristics (see Multi-Axis Scoring Engine section)

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## User Preferences
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `artifacts/vulnrap/src/assets`.
Do not make changes to the file `artifacts/api-server/src/seed.ts`.
Do not make changes to the file `artifacts/vulnrap/src/components/ui/auto-form.tsx`.
Do not make changes to the file `artifacts/vulnrap/src/components/ui/auto-form-label.tsx`.
Do not make changes to the file `artifacts/vulnrap/src/components/ui/auto-form-object.tsx`.
Do not make changes to the file `artifacts/vulnrap/src/components/ui/multi-select.tsx`.
Do not make changes to the file `artifacts/vulnrap/src/components/ui/number-field.tsx`.
Do not make changes to the file `artifacts/vulnrap/src/components/ui/rating-group.tsx`.
Do not make changes to the file `artifacts/vulnrap/src/components/ui/rich-text-editor.tsx`.
Do not make changes to the file `artifacts/vulnrap/src/components/ui/tag-group.tsx`.
Do not make changes to the file `artifacts/vulnrap/src/components/ui/date-field.tsx`.
Do not make changes to the file `artifacts/vulnrap/src/lib/orval/client-fetch.ts`.
Do not make changes to the file `artifacts/vulnrap/src/lib/orval/orval-plugin.ts`.
Do not make changes to the file `artifacts/api-server/src/openapi.ts`.
Do not make changes to the file `artifacts/api-server/src/db/migrations/meta/_journal.json`.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4 + React Router v7
- **UI library**: Radix UI + shadcn/ui components
- **Data fetching**: TanStack React Query + Orval-generated hooks
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (API server), Vite (frontend)
- **Security**: helmet.js, express-rate-limit, multer (file uploads)
- **Compression**: compression middleware on API server
- **API docs**: swagger-ui-express served at `/api/docs`

## Architecture

### Frontend (`artifacts/vulnrap/`)
- React + Vite app at root path "/"
- Route-level code splitting with React.lazy() + Suspense for faster initial load
- Cyberpunk glassmorphism design system: glass cards with backdrop blur, glow text effects, gradient borders (static + animated), colored icon glow backgrounds, cyber grid background, gradient histogram bars, colored stat accent borders, glass navbar/footer
- Animated laser visual effects: background beams, ambient flashes, scan line (respects prefers-reduced-motion)
- Custom AI-generated logo: synthetic bug inspected by lasers (`src/assets/logo.png`, compressed to ~355KB)
- Pages:
  - `/` — Home/submit with logo hero, 3 feature explainer cards, drag-and-drop upload, privacy mode selector, "How It Works" steps, hover hint tooltips
  - `/results/:id` — Analysis results: slop score, auto-redaction summary, similarity matches, section-level analysis with per-section hashes, feedback, expandable redacted report view, verification badge with copy buttons, user feedback form (rating + helpful + suggestions)
  - `/check` — Receiver flow: paste/upload a report for read-only analysis (no storage), shows slop score, duplicates, redaction analysis
  - `/batch` — Batch upload: drag-and-drop multiple files, sequential processing with progress tracking, individual result links
  - `/compare` — Two-report comparison: paste two reports side by side, independent analysis, section overlap detection
  - `/history` — Session history: localStorage-based log of all analyses performed in this browser
  - `/verify/:id` — Public verification page: lightweight badge view with slop score, match counts, content hash, submission date
  - `/stats` — Platform statistics dashboard (metrics, distribution histogram, recent activity) — auto-refreshes every 30s, interactive stat cards with hover details
  - `/developers` — API documentation: quick start guide, all endpoints with curl examples, Swagger UI link, integration ideas, example scripts (Python batch checker, Bash CI/CD gate, Node.js Slack bot)
  - `/use-cases` — Real-world use cases for bug bounty hunters, PSIRT teams, platforms, CI/CD, researchers, and VDPs
  - `/blog` — Blog with launch post explaining what VulnRap is, why it was built, and why nothing else like it exists
  - `/security` — Responsible disclosure policy: how to report vulnerabilities, what to include, scope, timeline expectations
  - `/terms` — Terms of service: funding model, user agreements, promises, disclaimers, content removal
  - `/privacy` — Honest privacy policy: explains auto-redaction, what gets stored and compared, how comparison works, data lifecycle
- Uses generated API hooks from `@workspace/api-client-react`
- Triple input: file upload (.txt, .md, 20MB max), direct text paste, or URL link (GitHub, Gist, GitLab, Pastebin — HTTPS only, 5MB max, redirect-safe with per-hop allowlist validation)
- Hover explainer tooltips on all key UI elements
- Text paste field is plain text only -- no HTML rendering, no script execution, content auto-escaped by React JSX

### Auto-Redaction Engine (`artifacts/api-server/src/lib/redactor.ts`)
- Deterministic regex-based redaction (same input = same output)
- Redacts: emails, IPs, API keys, JWTs, AWS keys, passwords, connection strings, private keys, phone numbers, SSNs, credit cards, UUIDs, internal hostnames/URLs, company names, usernames
- Runs on every upload before analysis or storage
- Returns redacted text + summary (counts by category)

### Section Parser (`artifacts/api-server/src/lib/section-parser.ts`)
- Parses reports into logical sections (by markdown headers or paragraph breaks)
- Hashes each section independently with SHA-256
- Classifies sections by weight (high/medium/low value)
- Finds exact section matches against existing reports for granular duplicate detection

### Similarity Engine (`artifacts/api-server/src/lib/similarity.ts`)
- MinHash + Locality Sensitive Hashing (LSH) for near-duplicate detection
- Deterministic hash coefficients (SHA-256 seeded, stable across restarts)
- Simhash for structural similarity
- SHA-256 content hashing for exact-match deduplication
- Combined scoring: returns top-N matches above threshold

### Multi-Axis Scoring Engine (v2.0)
The scoring engine uses 4 independent analysis axes fused via Bayesian combination:

**Axis 1: Linguistic AI Fingerprinting** (`artifacts/api-server/src/lib/linguistic-analysis.ts`)
- Weighted AI phrase dictionary (~52 phrases, weights 3-10), log-normalized scoring
- Statistical text features: sentence length variance (CV), passive voice ratio, contraction absence, bigram entropy
- Template detection: 6 known slop patterns (dear security team, dependency dump, OWASP padding, audit checklist, bounty template, generic remediation)
- Combined: lexical 40% + statistical 35% + template 25%

**Axis 2: Quality vs Slop Separation** (`artifacts/api-server/src/lib/sloppiness.ts`)
- Heuristics split into two buckets: **quality signals** (missing version, no code blocks, no repro steps) feed qualityScore only; **AI provenance signals** (AI phrases, sentence uniformity, verbosity) contribute to slopScore
- Returns both qualityScore (0-100, higher = better) and slop-related feedback separately
- A terse real report can have low quality but also low slop

**Axis 3: Factual Verification** (`artifacts/api-server/src/lib/factual-verification.ts`)
- Severity inflation: flags CVSS 9.8/Critical claims without matching exploit evidence
- Placeholder URLs: detects example.com, target.com, localhost, generic API paths
- Fabricated debug output: fake ASan addresses (round numbers), repeating stack frames, sequential GDB registers
- CVE validation: future-year CVEs, pre-1999 CVEs, suspicious year clustering, CWE/taxonomy padding
- Best-effort external verification: CVE ID format validation, function name extraction with hallucination detection hooks; emits `fabricated_cve` and `hallucinated_function` evidence types consumed by score-fusion for dynamic weight boosting

**Axis 4: LLM Semantic Analysis** (`artifacts/api-server/src/lib/llm-slop.ts`)
- 5-dimension structured evaluation: specificity (0.15), originality (0.25), voice (0.20), coherence (0.15), hallucination (0.25)
- Returns llmBreakdown (per-dimension scores), llmRedFlags, llmFeedback (reasoning)
- Temperature 0.1 for consistency, 4000 char truncation, 30s timeout
- Legacy format fallback: handles both new structured and old score/observations format
- Graceful degradation: if LLM unavailable, weight redistributed to linguistic + factual axes
- Uses any OpenAI-compatible API (set OPENAI_API_KEY, optionally OPENAI_BASE_URL and OPENAI_MODEL)
- Default model: gpt-4o-mini (configurable via OPENAI_MODEL env var)

**Score Fusion** (`artifacts/api-server/src/lib/score-fusion.ts`)
- Bayesian combination: linguistic 25% + factual 30% + LLM 35% + template 10%
- Dynamic weight boost: if fabricated evidence found (fake ASan, future CVE, hallucinated function), factual axis boosted to 50%
- No-LLM fallback: LLM weight redistributed 40% to linguistic, 40% to factual, 20% to template
- Confidence calculation: min(1.0, 0.3 + evidenceCount * 0.07 + 0.2 if LLM)
- Uncertainty pull-to-midpoint: finalScore = rawScore * confidence + 50 * (1 - confidence)
- Configurable tier thresholds: env vars SLOP_THRESHOLD_LOW (default 30) and SLOP_THRESHOLD_HIGH (default 70)
- Tiers: Probably Legit, Mildly Suspicious, Questionable, Highly Suspicious, Pure Slop

**API Response Fields** (new in v2.0):
- slopScore: AI likelihood (0-100), from multi-axis fusion
- qualityScore: Report completeness (0-100), separate from slop
- confidence: Scoring confidence (0.0-1.0)
- breakdown: Per-axis scores { linguistic, factual, template, llm, quality }
- evidence: Array of { type, description, weight, matched }
- llmBreakdown: Per-dimension LLM scores { specificity, originality, voice, coherence, hallucination }
- Backward-compatible: slopTier, feedback, llmSlopScore, llmFeedback, llmEnhanced still present

### Input Sanitization (`artifacts/api-server/src/lib/sanitize.ts`)
- Script/style tag stripping with placeholder markers
- Event handler attribute removal (onclick, onerror, etc.)
- JavaScript URI and data URI neutralization
- Control character removal
- Excessive whitespace/newline collapsing
- Max input length guard (20MB)
- Binary content detection for file uploads
- Safe JSON parsing with prototype pollution protection
- Filename sanitization (path traversal prevention, leading dot stripping)

### Upload Pipeline
1. User uploads .txt/.md file OR pastes text directly (plain text only, sanitized server-side)
2. Auto-redaction engine scrubs PII/secrets from raw text
3. All hashing (SHA-256, MinHash, Simhash, LSH, section hashes) runs on redacted text only
4. Similarity comparison against existing redacted reports
5. Section-level hash matching for granular duplicate detection
6. Multi-axis analysis runs: linguistic fingerprinting + factual verification + LLM (on redacted text) + quality heuristics
7. Score fusion combines axes with Bayesian weighting
8. Only redacted text is stored (never raw); in similarity_only mode, not even redacted text is stored

### Privacy Modes
- **full**: Stores redacted report text + all hashes/fingerprints
- **similarity_only**: Stores only hashes/fingerprints, no text at all

### Database Schema (`lib/db/src/schema/`)
- `reports` table: id, delete_token, content_hash, simhash, minhash_signature, content_text (nullable), redacted_text (nullable), content_mode, slop_score, slop_tier, quality_score, confidence (real), breakdown (jsonb), evidence (jsonb), similarity_matches (jsonb), section_hashes (jsonb), section_matches (jsonb), redaction_summary (jsonb), feedback (jsonb), llm_slop_score, llm_feedback (jsonb), llm_breakdown (jsonb), file_name, file_size, created_at
- `report_hashes` table: indexed hash lookup (sha256, simhash per report)
- `similarity_results` table: pairwise similarity scores
- `report_stats` table: aggregate counters
- `user_feedback` table: id, report_id (optional FK to reports), rating (1-5), helpful (boolean), comment (text), created_at

### User Flows
- **Submitters**: Upload/paste a report -> get analysis results -> copy verification badge (markdown or plain text) -> share with bug bounty program
- **Receivers**: Paste/upload an incoming report on `/check` -> see slop score, duplicates, redaction analysis -> nothing stored (read-only check)
- **Verification**: Anyone with a verify link (`/verify/:id`) can independently confirm a report's slop score and uniqueness

### API Endpoints
- `POST /api/reports` — Submit a report for analysis (multipart: file upload or rawText field, 20MB limit). Returns a one-time delete token.
- `DELETE /api/reports/:id` — Delete a report (requires delete token in body). Cascades to hashes, similarity records.
- `POST /api/reports/check` — Check a report without storing (receiver flow, read-only analysis)
- `GET /api/reports/:id` — Get report analysis results (includes redacted text, section hashes, redaction summary)
- `GET /api/reports/:id/verify` — Lightweight verification badge data (slop score, match counts, verify URL)
- `GET /api/reports/:id/compare/:matchId` — Side-by-side comparison of two reports (redacted text snippets, scores, section comparison map, content modes). Access-controlled: only returns data when reports have an existing similarity relationship.
- `GET /api/reports/lookup/:hash` — Look up by SHA-256 hash
- `GET /api/stats` — Platform-wide statistics
- `GET /api/stats/recent` — Recent submission activity
- `GET /api/stats/distribution` — Slop score distribution histogram
- `POST /api/feedback` — Submit user feedback (rating 1-5, helpful boolean, optional comment)
- `GET /api/healthz` — Health check
- `GET /api/docs` — Swagger UI interactive API documentation

### Seed Data
- 6 realistic vulnerability reports seeded via `pnpm --filter @workspace/api-server run seed`
- Includes: XSS, IDOR, SQLi, SSRF, race condition reports (legit) + 1 AI-generated slop report
- Seed script at `artifacts/api-server/src/seed.ts`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/api-server run seed` — seed example vulnerability reports
- `pnpm --filter @workspace/vulnrap run dev` — run frontend dev server

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
