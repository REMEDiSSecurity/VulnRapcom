# VulnRap.com

## Overview

VulnRap.com is a vulnerability report validation platform designed to assess the quality and originality of bug reports. It functions similarly to VirusTotal but for vulnerability reports, allowing anonymous users to upload reports to check for similarity with existing reports and score them for potential AI-generated content. The platform employs a two-layer scoring engine combining deterministic heuristics and LLM semantic analysis. A core feature is the auto-redaction of reports before storage to remove sensitive information like PII, secrets, and identifying data. The project aims to provide a robust tool for bug bounty hunters, PSIRT teams, and VDPs to streamline vulnerability report processing and enhance validation.

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

The project is structured as a pnpm workspace monorepo utilizing Node.js 24 and TypeScript 5.9.

**Frontend (`artifacts/vulnrap/`)**:
- Built with React 19, Vite 7, Tailwind CSS 4, and React Router v7.
- UI/UX features a cyberpunk glassmorphism design system including glass cards, glow effects, gradient borders, and animated laser visuals.
- Implements route-level code splitting for optimized loading.
- Supports triple input methods: file upload (.txt, .md, 20MB max), direct text paste, and URL links (GitHub, Gist, GitLab, Pastebin).
- Key pages include Home/submit, Results, Batch Upload, Compare, History, Verification, Stats, Developers (API docs), Use Cases, Blog, Security, Terms, and Privacy.

**Backend (`artifacts/api-server/`)**:
- Uses Express 5 as the API framework.
- Employs PostgreSQL with Drizzle ORM for data persistence.
- Key modules include:
    - **Auto-Redaction Engine**: Deterministic regex-based redaction of sensitive data (emails, IPs, API keys, etc.) before storage or analysis.
    - **Section Parser**: Divides reports into logical sections, hashes them, and classifies their value for granular duplicate detection.
    - **Similarity Engine**: Uses MinHash, Locality Sensitive Hashing (LSH), and Simhash for near-duplicate and structural similarity detection.
    - **Multi-Axis Scoring Engine (v2.0)**: A four-axis system fused via Bayesian combination:
        1.  **Linguistic AI Fingerprinting**: Detects AI-generated phrases, statistical text features, and template usage.
        2.  **Quality vs Slop Separation**: Distinguishes between report quality (e.g., missing repro steps) and AI provenance signals.
        3.  **Factual Verification**: Identifies fabricated evidence like inflated CVSS scores, placeholder URLs, or fake debug output.
        4.  **LLM Semantic Analysis**: Evaluates reports across 5 dimensions (specificity, originality, voice, coherence, hallucination) using an OpenAI-compatible API.
    - **Input Sanitization**: Strips harmful content like script tags, event handlers, and control characters from user inputs.
- Supports two privacy modes: `full` (stores redacted text and hashes) and `similarity_only` (stores only hashes).

**API Endpoints**:
- `POST /api/reports`: Submits a report for analysis.
- `DELETE /api/reports/:id`: Deletes a report using a one-time token.
- `POST /api/reports/check`: Performs read-only analysis without storage.
- `GET /api/reports/:id`: Retrieves analysis results.
- `GET /api/reports/:id/verify`: Provides lightweight verification data.
- `GET /api/reports/:id/compare/:matchId`: Compares two reports side-by-side.
- `GET /api/stats`, `/api/stats/recent`, `/api/stats/distribution`: Provides platform statistics.
- `POST /api/feedback`: Submits user feedback.
- `GET /api/docs`: Serves Swagger UI documentation.

## External Dependencies

- **Node.js**: Runtime environment.
- **pnpm**: Monorepo package manager.
- **TypeScript**: Programming language.
- **Express**: Backend web application framework.
- **React**: Frontend library.
- **Vite**: Frontend build tool.
- **Tailwind CSS**: Utility-first CSS framework.
- **React Router**: Declarative routing for React.
- **Radix UI + shadcn/ui**: UI component libraries.
- **TanStack React Query**: Data fetching and caching.
- **Orval**: API client code generation from OpenAPI specifications.
- **PostgreSQL**: Relational database.
- **Drizzle ORM**: TypeScript ORM for SQL databases.
- **Zod**: Schema declaration and validation library.
- **esbuild**: Build tool for API server.
- **helmet.js**: Express middleware for security headers.
- **express-rate-limit**: Rate limiting middleware for Express.
- **multer**: Middleware for handling `multipart/form-data`.
- **compression**: Compression middleware for Express.
- **swagger-ui-express**: Serves Swagger UI for API documentation.
- **OpenAI-compatible API**: Used by the LLM Semantic Analysis engine for AI-powered report evaluation.