# VulnRap.com

## Overview

VulnRap.com is a vulnerability report validation platform designed to assess the quality and originality of bug reports. It functions similarly to VirusTotal but for vulnerability reports, allowing anonymous users to upload reports for similarity checks against existing reports and to score them for potential AI-generated content. The platform employs a multi-axis scoring engine that combines linguistic fingerprinting, factual verification, and LLM semantic analysis, fused via Bayesian combination. A key feature is the auto-redaction of reports to remove PII, secrets, and identifying information before storage, ensuring user privacy. VulnRap aims to provide a robust tool for bug bounty hunters, PSIRT teams, and security researchers to efficiently triage and validate vulnerability disclosures.

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

## System Architecture

The project is structured as a pnpm workspace monorepo using TypeScript, with distinct `frontend` and `api-server` packages.

### Frontend (`artifacts/vulnrap/`)
- Built with React 19, Vite 7, Tailwind CSS 4, and React Router v7.
- Employs a Cyberpunk glassmorphism design system with glass cards, glow effects, gradient elements, and animated laser visuals.
- Features route-level code splitting for performance.
- Provides various user interfaces including:
    - Home/Submit page with drag-and-drop upload and privacy mode selection.
    - Analysis Results page displaying slop score, redaction summary, similarity matches, and section-level analysis.
    - Batch Upload and Compare Two Reports functionalities.
    - Session History and Export/Download options.
    - Public verification page (`/verify/:id`) for sharing analysis results.
    - API documentation for developers and use case explanations.
- Supports triple input methods: file upload (.txt, .md), direct text paste, or URL link (GitHub, Gist, etc.).
- Utilizes generated API hooks from `@workspace/api-client-react`.

### Backend (`artifacts/api-server/`)
- **API Framework**: Express 5.
- **Database**: PostgreSQL with Drizzle ORM.
- **Auto-Redaction Engine**: Deterministic regex-based redaction of PII/secrets, applied before analysis or storage.
- **Section Parser**: Parses reports into logical sections, hashes them with SHA-256, and classifies their value.
- **Similarity Engine**: Uses MinHash + Locality Sensitive Hashing (LSH), Simhash, and SHA-256 for near-duplicate and exact-match detection.
- **Multi-Axis Scoring Engine (v2.0)**:
    - **Linguistic AI Fingerprinting**: Analyzes AI-generated phrases, statistical text features, and known slop patterns.
    - **Quality vs Slop Separation**: Distinguishes between report quality signals and AI provenance signals.
    - **Factual Verification**: Flags severity inflation, placeholder URLs, fabricated debug output, and suspicious CVEs.
    - **LLM Semantic Analysis**: Evaluates reports across 5 dimensions (specificity, originality, voice, coherence, hallucination) using an OpenAI-compatible API.
    - **Score Fusion**: Combines scores from all axes using Bayesian weighting, with dynamic weight boosting for fabricated evidence and graceful degradation if the LLM is unavailable.
- **Input Sanitization**: Strips scripts, sanitizes attributes, neutralizes URIs, removes control characters, and guards against excessive input length and binary content.
- **Upload Pipeline**: Ensures reports are redacted, hashed, compared for similarity, and analyzed by the multi-axis engine, with only redacted text (or just hashes in `similarity_only` mode) stored.
- **Privacy Modes**: `full` (stores redacted text and hashes) and `similarity_only` (stores only hashes).
- **API Endpoints**: Comprehensive set of endpoints for submitting, checking, deleting, retrieving, and comparing reports, alongside statistics and health checks.

### Core Technologies
- **Monorepo**: pnpm workspaces
- **Frontend**: React, Vite, Tailwind CSS, Radix UI, shadcn/ui
- **Backend**: Node.js, Express, PostgreSQL, Drizzle ORM
- **Data Fetching**: TanStack React Query, Orval-generated hooks
- **Validation**: Zod, drizzle-zod
- **API Codegen**: Orval (from OpenAPI spec)
- **Security**: helmet.js, express-rate-limit, multer
- **Build**: esbuild (API server), Vite (frontend)

## External Dependencies

- **OpenAI-compatible API**: Used by the LLM Semantic Analysis axis for evaluating reports. Configurable via `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL` (defaults to `gpt-4o-mini`).
- **PostgreSQL**: The primary database for storing report data, hashes, and similarity results.