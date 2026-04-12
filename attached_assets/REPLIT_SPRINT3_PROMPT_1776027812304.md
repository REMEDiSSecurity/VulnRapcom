# VulnRap Sprint 3: Active Validation, Adversarial Resistance, PSIRT Triage Workflow

## Why This Sprint Matters

Sprints 1-2 built style-based detection (linguistic markers, template matching, sentence variance). This works against lazy slop but has a fundamental shelf life: if reporters can see the heuristics, they tell their LLM to avoid the triggers. Every stylistic detector is one prompt tweak away from bypass.

The long-term moat is **factual verification** — checking whether the claims in a report are actually true. To pass those checks, a reporter would have to find a real vulnerability, at which point the report isn't slop anymore. This sprint builds that layer.

---

## 1. ACTIVE CONTENT VALIDATION ENGINE

When a report references a public open-source project, VulnRap should attempt to verify the technical claims automatically. This is the single highest-value feature for PSIRT teams.

### 1A. Project Detection

Extract project references from the report and resolve them to a source repository:

```javascript
function detectProject(text) {
    const signals = [];

    // Direct GitHub/GitLab URLs
    const repoUrls = text.match(/(?:github|gitlab)\.com\/[\w\-]+\/[\w\-.]+/gi) || [];
    signals.push(...repoUrls.map(u => ({ type: 'repo_url', value: u })));

    // Package names with versions (npm, PyPI, Maven, etc.)
    const npmPkg = text.match(/(?:^|\s)([@\w\-]+\/?\w+)@(\d+\.\d+[\.\d]*)/gm) || [];
    const pypiPkg = text.match(/(?:pip install|pypi\.org\/project\/)([\w\-]+)/gi) || [];
    signals.push(...npmPkg.map(p => ({ type: 'npm_package', value: p.trim() })));
    signals.push(...pypiPkg.map(p => ({ type: 'pypi_package', value: p.trim() })));

    // Known project names (extensible lookup table)
    const KNOWN_PROJECTS = {
        'curl': 'github.com/curl/curl',
        'openssl': 'github.com/openssl/openssl',
        'nginx': 'github.com/nginx/nginx',
        'apache': null, // too ambiguous alone
        'linux kernel': 'github.com/torvalds/linux',
        'node': 'github.com/nodejs/node',
        'django': 'github.com/django/django',
        'flask': 'github.com/pallets/flask',
        'express': 'github.com/expressjs/express',
        'react': 'github.com/facebook/react',
        'wordpress': 'github.com/WordPress/WordPress',
        'libpng': 'github.com/pnggroup/libpng',
        'flatpak': 'github.com/flatpak/flatpak',
        'cockpit': 'github.com/cockpit-project/cockpit',
        // Add more as community contributes
    };

    const textLower = text.toLowerCase();
    for (const [name, repo] of Object.entries(KNOWN_PROJECTS)) {
        if (textLower.includes(name) && repo) {
            signals.push({ type: 'known_project', value: name, repo });
        }
    }

    return signals;
}
```

### 1B. Function/File Existence Verification

If we can identify the project repo, check whether referenced functions and files actually exist:

```javascript
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // optional, raises rate limit

async function verifyCodeReference(repoSlug, reference, type) {
    // repoSlug = "curl/curl", reference = "parse_multipart_header", type = "function"
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;

    if (type === 'function') {
        // GitHub code search
        const resp = await fetch(
            `https://api.github.com/search/code?q=${encodeURIComponent(reference)}+repo:${repoSlug}`,
            { headers }
        );
        if (!resp.ok) return { verified: null, reason: 'api_error' };
        const data = await resp.json();
        return {
            reference,
            type: 'function',
            verified: data.total_count > 0,
            matchCount: data.total_count,
            // If found, include file paths where it appears
            locations: (data.items || []).slice(0, 3).map(i => i.path),
            weight: data.total_count > 0 ? -8 : 20  // verified = human signal, missing = slop signal
        };
    }

    if (type === 'file') {
        // GitHub contents API — check if file exists
        const resp = await fetch(
            `https://api.github.com/repos/${repoSlug}/contents/${encodeURIComponent(reference)}`,
            { headers }
        );
        return {
            reference,
            type: 'file',
            verified: resp.ok,
            weight: resp.ok ? -6 : 18
        };
    }
}

async function verifyAllReferences(text, repoSlug) {
    if (!repoSlug) return [];

    // Extract function calls: word()
    const functions = [...new Set(
        (text.match(/\b([a-zA-Z_]\w{2,})\s*\(\)/g) || [])
            .map(f => f.replace('()', ''))
            .filter(f => !COMMON_STDLIB.includes(f))  // skip printf, malloc, etc.
    )];

    // Extract file paths: dir/file.ext
    const files = [...new Set(
        (text.match(/(?:^|\s)((?:[\w\-]+\/)+[\w\-]+\.\w{1,4})/gm) || [])
            .map(f => f.trim())
    )];

    const results = [];

    // Rate limit: max 5 checks per report to stay under GitHub API limits
    const toCheck = [
        ...functions.slice(0, 3).map(f => ({ ref: f, type: 'function' })),
        ...files.slice(0, 2).map(f => ({ ref: f, type: 'file' })),
    ];

    for (const { ref, type } of toCheck) {
        const result = await verifyCodeReference(repoSlug, ref, type);
        if (result) results.push(result);
        await sleep(200); // respect rate limits
    }

    return results;
}

// Common stdlib functions to skip (don't waste API calls on these)
const COMMON_STDLIB = [
    'printf', 'malloc', 'free', 'strlen', 'strcmp', 'memcpy', 'memset',
    'open', 'close', 'read', 'write', 'exit', 'abort', 'assert',
    'sizeof', 'typeof', 'return', 'include', 'import', 'require',
    'console', 'fetch', 'setTimeout', 'parseInt', 'JSON',
];
```

### 1C. CVE Cross-Referencing

Go beyond "does this CVE exist" — check if the report is just parroting the CVE description:

```javascript
async function deepCVECheck(text) {
    const cveIds = [...new Set(
        (text.match(/CVE-\d{4}-\d{4,}/g) || [])
    )];
    const results = [];

    for (const cveId of cveIds.slice(0, 3)) {
        const resp = await fetch(
            `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cveId}`
        );
        if (!resp.ok) continue;
        const data = await resp.json();

        if (data.totalResults === 0) {
            results.push({
                cve: cveId,
                exists: false,
                weight: 20,
                type: 'fabricated_cve',
                description: `${cveId} does not exist in NVD`
            });
            continue;
        }

        const cveData = data.vulnerabilities[0].cve;
        const nvdDescription = (cveData.descriptions || [])
            .find(d => d.lang === 'en')?.value || '';

        // PLAGIARISM CHECK: Is the report just rewording the NVD description?
        // Compute rough similarity using shared long phrases (5+ word sequences)
        const reportWords = text.toLowerCase().split(/\s+/);
        const nvdWords = nvdDescription.toLowerCase().split(/\s+/);
        let sharedPhrases = 0;

        for (let i = 0; i <= nvdWords.length - 5; i++) {
            const phrase = nvdWords.slice(i, i + 5).join(' ');
            if (text.toLowerCase().includes(phrase)) sharedPhrases++;
        }

        const similarityRatio = nvdWords.length > 5
            ? sharedPhrases / (nvdWords.length - 4)
            : 0;

        results.push({
            cve: cveId,
            exists: true,
            weight: similarityRatio > 0.3 ? 15 : -5,
            type: similarityRatio > 0.3 ? 'nvd_plagiarism' : 'verified_cve',
            similarity: Math.round(similarityRatio * 100),
            description: similarityRatio > 0.3
                ? `Report shares ${Math.round(similarityRatio * 100)}% of phrasing with NVD description — possible copy-paste`
                : `${cveId} verified in NVD — legitimate reference`
        });
    }
    return results;
}
```

### 1D. PoC Plausibility Check

When a report includes a "proof of concept," check if it's a generic template or references real endpoints:

```javascript
function checkPoCPlausibility(text) {
    const signals = [];

    // Extract curl/wget/python commands from the report
    const commands = text.match(/(?:curl|wget|python|java|nc)\s+[^\n]{10,}/g) || [];

    for (const cmd of commands) {
        // Check for placeholder domains
        const hasPlaceholder = /(?:target\.com|example\.com|vulnerable-server\.com|attacker\.com|evil\.com|victim\.com|your-domain\.com)/i.test(cmd);
        if (hasPlaceholder) {
            signals.push({
                type: 'placeholder_poc',
                weight: 12,
                description: 'PoC uses placeholder domain instead of actual target',
                matched: cmd.slice(0, 80)
            });
        }

        // Check for textbook payloads that are never customized
        const textbookPayloads = [
            /alert\(1\)/,
            /alert\(document\.cookie\)/,
            /<script>alert/,
            /1'?\s*OR\s*'?1'?\s*=\s*'?1/i,
            /admin'\s*--/,
            /\{\{7\*7\}\}/,  // SSTI test
            /etc\/passwd/,
            /169\.254\.169\.254/,  // SSRF to metadata — a real test, but check context
        ];

        const textbookHits = textbookPayloads.filter(p => p.test(cmd));
        if (textbookHits.length > 0 && hasPlaceholder) {
            // Textbook payload + placeholder domain = almost certainly template
            signals.push({
                type: 'textbook_poc',
                weight: 15,
                description: 'PoC combines generic payload with placeholder domain — likely template, not real test'
            });
        }
    }

    // Check for fabricated HTTP responses in the report
    const fakeResponse = /HTTP\/1\.[01]\s+200\s+OK[\s\S]{0,200}(?:token|session|admin|root|flag)/i;
    if (fakeResponse.test(text)) {
        // Check: is this a real captured response or a fabricated one?
        // Real responses have headers like Date, Server, Content-Length with realistic values
        const hasRealisticHeaders = /(?:Date:\s+\w{3},\s+\d{2}\s+\w{3}\s+\d{4}|Server:\s+\w+\/[\d.]+|Content-Length:\s+\d+)/i.test(text);
        if (!hasRealisticHeaders) {
            signals.push({
                type: 'fabricated_response',
                weight: 10,
                description: 'Includes HTTP response that lacks realistic server headers — possibly fabricated'
            });
        }
    }

    return signals;
}
```

---

## 2. VERIFICATION REPORT FOR PSIRT TRIAGERS

Instead of just a score, return a **verification checklist** that shows the triager exactly what was checked and what passed/failed. This is the feature that makes VulnRap indispensable.

### Response: New `verification` Object

```javascript
{
    // ... existing slopScore, qualityScore, breakdown, evidence ...

    "verification": {
        "projectDetected": "github.com/curl/curl",
        "checks": [
            {
                "check": "function_exists",
                "claim": "curl_parse_header_secure()",
                "result": "NOT_FOUND",
                "detail": "Function does not exist in curl/curl repository",
                "significance": "high",
                "icon": "❌"
            },
            {
                "check": "function_exists",
                "claim": "curl_easy_perform()",
                "result": "VERIFIED",
                "detail": "Found in lib/easy.c, lib/multi.c (3 matches)",
                "significance": "low",
                "icon": "✅"
            },
            {
                "check": "file_exists",
                "claim": "src/http/multipart.c",
                "result": "NOT_FOUND",
                "detail": "Path does not exist in repository",
                "significance": "high",
                "icon": "❌"
            },
            {
                "check": "cve_exists",
                "claim": "CVE-2026-31790",
                "result": "VERIFIED",
                "detail": "Exists in NVD, published 2026-04-07, severity Moderate",
                "significance": "medium",
                "icon": "✅"
            },
            {
                "check": "nvd_plagiarism",
                "claim": "CVE-2026-31790 description",
                "result": "WARNING",
                "detail": "Report shares 42% of phrasing with NVD description",
                "significance": "medium",
                "icon": "⚠️"
            },
            {
                "check": "poc_plausibility",
                "claim": "curl command in PoC section",
                "result": "WARNING",
                "detail": "PoC uses placeholder domain (target.com) with textbook payload",
                "significance": "medium",
                "icon": "⚠️"
            }
        ],
        "summary": {
            "verified": 2,
            "notFound": 2,
            "warnings": 2,
            "unchecked": 0
        },
        "triageNotes": [
            "2 referenced functions/files do not exist in the claimed project — strong slop indicator",
            "CVE is real but report language closely mirrors NVD description — possible copy-paste",
            "PoC uses placeholder domains — not tested against a real target"
        ]
    }
}
```

### UI: Verification Panel

Render this as a collapsible section below the score. Each check gets a row with ✅/❌/⚠️ status, the claim being checked, and the result. Triagers can scan this in 5 seconds and know whether to dig deeper or close the ticket.

---

## 3. ADVERSARIAL RESISTANCE: THE LAYERED DEFENSE MODEL

### Philosophy: Make Gaming Expensive

Every bypass costs the attacker something. Arrange defenses so that bypassing one layer requires doing more real work:

```
Layer 1: STYLE DETECTION (catches ~80% of slop today)
  Cost to bypass: modify LLM prompt (~5 minutes)
  Shelf life: 6-12 months

Layer 2: FACTUAL VERIFICATION (catches fabricated claims)
  Cost to bypass: reference real code, real CVEs, real paths
  Shelf life: years — requires actual research to bypass

Layer 3: CLAIM DEPTH ANALYSIS (catches shallow/parroted claims)
  Cost to bypass: produce original analysis, not just NVD rewording
  Shelf life: years — requires genuine understanding

Layer 4: BEHAVIORAL SIGNALS (catches patterns across submissions)
  Cost to bypass: change submission patterns, build history
  Shelf life: indefinite — game-theoretically stable

Layer 5: LLM SEMANTIC JUDGMENT (catches what rules can't)
  Cost to bypass: unpredictable — LLM detection evolves with LLMs
  Shelf life: tracks model capabilities over time
```

### Scoring Weight Evolution

As slop generators adapt, shift weight from style to verification:

```javascript
// Today (slop generators are still lazy):
const AXIS_WEIGHTS = {
    linguistic: 0.20,   // style detection
    factual: 0.15,      // claim verification
    template: 0.10,     // pattern matching
    verification: 0.20, // NEW: active code/CVE verification
    llm: 0.25,          // semantic judgment
    behavioral: 0.10,   // NEW: submission pattern analysis
};

// 12 months from now (slop generators have adapted to style checks):
// linguistic: 0.10, verification: 0.30, llm: 0.30, behavioral: 0.20
// The weights should be tuneable, not hardcoded — store in config.
```

### What Can NEVER Be Gamed

These signals are structurally resistant to gaming because bypassing them means doing legitimate work:

1. **Verified function/file references** — if the report claims `foo_bar_baz()` in `src/lib/parser.c` and both actually exist in the repo at the right locations, that's real research.

2. **Original analysis vs NVD parroting** — if the report's description is >30% identical to the NVD entry, it's a rewrite, not original research. Original findings describe what the researcher DID, not what the vuln IS.

3. **Temporal signals** — if a CVE is published at 14:00 UTC and VulnRap receives a "detailed analysis" at 14:07 UTC, that's 7 minutes for someone to "discover" and write up a finding. Flag it.

4. **Cross-submission fingerprinting** — the same template submitted to 15 different programs with only the project name swapped. Content hashing catches exact dupes; section hashing catches the template.

---

## 4. BEHAVIORAL SIGNALS (New Axis)

Track patterns across submissions, not just within a single report.

### 4A. Temporal Analysis

```javascript
function temporalSignals(text, submissionTime) {
    const signals = [];

    // Extract CVE IDs and check their publication dates
    const cveIds = text.match(/CVE-\d{4}-\d{4,}/g) || [];
    for (const cveId of cveIds) {
        // Look up publication time from NVD (cached from earlier check)
        const pubTime = cveCache[cveId]?.published;
        if (pubTime) {
            const hoursSincePub = (submissionTime - new Date(pubTime)) / 3600000;
            if (hoursSincePub < 2) {
                signals.push({
                    type: 'suspiciously_fast',
                    weight: 12,
                    description: `Report submitted ${Math.round(hoursSincePub * 60)} minutes after ${cveId} was published — insufficient time for original analysis`,
                    cve: cveId
                });
            } else if (hoursSincePub < 24) {
                signals.push({
                    type: 'fast_turnaround',
                    weight: 5,
                    description: `Report submitted within ${Math.round(hoursSincePub)} hours of ${cveId} publication`,
                    cve: cveId
                });
            }
        }
    }

    return signals;
}
```

### 4B. Cross-Report Similarity (Template Reuse Detection)

You already have `sectionHashes`. Extend this to detect template reuse across different submissions:

```javascript
async function crossReportSimilarity(contentHash, sectionHashes, text) {
    const signals = [];

    // Check section hashes against ALL stored reports (not just this content hash)
    for (const [section, hash] of Object.entries(sectionHashes)) {
        if (section === '__full_document') continue;
        const matches = await db.findBySectionHash(hash);
        // Exclude matches against the same full document
        const otherMatches = matches.filter(m => m.contentHash !== contentHash);
        if (otherMatches.length >= 2) {
            signals.push({
                type: 'template_reuse',
                weight: 18,
                description: `The "${section}" section matches ${otherMatches.length} other reports — likely template`,
                matchCount: otherMatches.length
            });
        }
    }

    // Check for "mad-libs" pattern: same structure with swapped project/vuln names
    // Hash the report with all proper nouns, URLs, and CVE IDs replaced with placeholders
    const normalized = text
        .replace(/CVE-\d{4}-\d+/g, 'CVE-XXXX-XXXXX')
        .replace(/https?:\/\/\S+/g, 'URL_PLACEHOLDER')
        .replace(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g, 'PROPER_NOUN')  // proper nouns
        .replace(/\d+\.\d+\.\d+/g, 'X.Y.Z');  // version numbers
    const templateHash = sha256(normalized.trim().replace(/\s+/g, ' ').toLowerCase());

    const templateMatches = await db.findByTemplateHash(templateHash);
    if (templateMatches.length >= 1) {
        signals.push({
            type: 'mad_libs_template',
            weight: 25,
            description: `Report structure matches ${templateMatches.length} other reports with different project names swapped in — strong slop indicator`
        });
    }

    return signals;
}
```

**Important:** Store `templateHash` (the normalized/anonymized hash) alongside `contentHash` for every report. This is the fingerprint of the TEMPLATE, not the content.

---

## 5. PSIRT TRIAGE WORKFLOW INTEGRATION

### 5A. Triage Action Recommendations

Based on the combined score and verification results, give the triager a clear recommended action:

```javascript
function triageRecommendation(slopScore, verification, confidence) {
    if (slopScore >= 75 && confidence >= 0.7) {
        return {
            action: "AUTO_CLOSE",
            reason: "High-confidence slop detection with multiple corroborating signals",
            note: "Review evidence panel before closing. If reporter disputes, re-evaluate manually."
        };
    }
    if (slopScore >= 55) {
        return {
            action: "MANUAL_REVIEW",
            reason: "Mixed signals — some slop indicators but not conclusive",
            note: "Check the verification panel. If code references are verified, treat as potentially legitimate."
        };
    }
    if (verification?.summary?.notFound >= 2) {
        return {
            action: "CHALLENGE_REPORTER",
            reason: "Multiple claimed code references do not exist in the project",
            note: "Ask reporter to provide exact commit hash, branch, and version where the issue was found."
        };
    }
    if (slopScore <= 25 && verification?.summary?.verified >= 2) {
        return {
            action: "PRIORITIZE",
            reason: "Low slop score with verified code references — likely legitimate finding",
            note: "Proceed with standard vulnerability triage."
        };
    }
    return {
        action: "STANDARD_TRIAGE",
        reason: "No strong signals either way",
        note: "Evaluate on technical merit."
    };
}
```

### 5B. "Challenge Questions" for Suspicious Reports

When a report is flagged as questionable, generate specific questions the triager can send back to the reporter. A real researcher can answer these easily; a slop generator cannot:

```javascript
function generateChallengeQuestions(text, verification) {
    const questions = [];

    // If functions weren't found
    const missingFunctions = (verification?.checks || [])
        .filter(c => c.check === 'function_exists' && c.result === 'NOT_FOUND');
    if (missingFunctions.length > 0) {
        const names = missingFunctions.map(c => c.claim).join(', ');
        questions.push(
            `We could not locate ${names} in the project repository. ` +
            `Can you provide the exact file path, branch, and commit hash where this function exists?`
        );
    }

    // If CVE was parroted
    const parroted = (verification?.checks || [])
        .filter(c => c.type === 'nvd_plagiarism');
    if (parroted.length > 0) {
        questions.push(
            `Your description closely matches the NVD advisory text. ` +
            `Can you describe the specific steps YOU took to discover and verify this issue?`
        );
    }

    // If PoC uses placeholders
    const placeholderPoC = (verification?.checks || [])
        .filter(c => c.check === 'poc_plausibility' && c.result === 'WARNING');
    if (placeholderPoC.length > 0) {
        questions.push(
            `Your proof of concept references placeholder domains. ` +
            `Can you provide output from running the PoC against the actual affected software?`
        );
    }

    // If severity seems inflated
    if (text.match(/cvss.*9\.[0-9]|severity.*critical/i) &&
        !(verification?.checks || []).some(c => c.result === 'VERIFIED' && c.significance === 'high')) {
        questions.push(
            `You've rated this as Critical severity. ` +
            `Can you provide evidence of impact beyond the initial vulnerability class ` +
            `(e.g., confirmed RCE, demonstrated auth bypass, data exfiltration)?`
        );
    }

    // Generic fallback
    if (questions.length === 0) {
        questions.push(
            `Can you describe your testing environment (OS, software version, configuration) ` +
            `and share the exact commands and output from your testing?`
        );
    }

    return questions;
}
```

### 5C. Exportable Triage Report

Add an endpoint that returns a formatted triage summary a PSIRT analyst can paste into their ticketing system:

```
GET /api/reports/{contentHash}/triage-report
Accept: text/markdown

Response:
## VulnRap Triage Summary
**Slop Score:** 72/100 (Likely Slop) | **Confidence:** 0.82
**Quality Score:** 45/100

### Verification Results
| Check | Claim | Result |
|-------|-------|--------|
| Function exists | curl_parse_header_secure() | ❌ NOT FOUND |
| File exists | src/http/multipart.c | ❌ NOT FOUND |
| CVE exists | CVE-2026-31790 | ✅ Verified |
| NVD similarity | - | ⚠️ 42% phrase match |

### Key Evidence
- Template match: "dear_security_team" pattern
- Placeholder URLs: target.com, attacker.com
- Severity inflation: Claims Critical without RCE evidence
- 0 contractions (AI formality pattern)

### Recommended Action: CHALLENGE_REPORTER
Suggested questions to send back:
1. We could not locate curl_parse_header_secure() in the curl repository...
2. Your proof of concept references placeholder domains...

### Human Indicators (none detected)

---
Generated by VulnRap | {timestamp} | Hash: {contentHash}
```

---

## 6. HANDLING EVOLVING REPORTS (Data Integrity)

### The Problem

When a reporter gets challenged and submits a "revised" report (fixing the issues VulnRap flagged), we need to:
- Track it as a revision, not a new report
- Score the revision independently
- Show the triager the diff between versions
- NOT let the revision pollute stats as a separate report

### Revision Tracking

```javascript
// On submission, check for high similarity to existing reports
async function detectRevision(contentHash, text) {
    // Exact match → same report, return cached
    const exact = await db.getByHash(contentHash);
    if (exact) return { type: 'exact_duplicate', original: exact };

    // High similarity (>70%) to a recent report → likely revision
    // Use templateHash or compute cosine similarity on word vectors
    const recent = await db.getRecentReports(48); // last 48 hours
    for (const prev of recent) {
        const similarity = computeTextSimilarity(text, prev.originalText);
        if (similarity > 0.70) {
            return {
                type: 'revision',
                originalHash: prev.contentHash,
                similarity: Math.round(similarity * 100),
                originalScore: prev.slopScore
            };
        }
    }

    return { type: 'new' };
}
```

### Response for Revisions

```javascript
{
    // Normal scoring fields...
    "revision": {
        "isRevision": true,
        "originalHash": "abc123...",
        "originalScore": 72,
        "currentScore": 45,
        "changeDirection": "improved",  // score dropped = reporter addressed issues
        "changesDetected": [
            "Placeholder URLs replaced with specific targets",
            "Added specific version numbers",
            "Removed AI pleasantries (Dear Security Team, Best Regards)"
        ],
        "triageNote": "This is a revision of a previously flagged report. Score improved from 72→45. Reporter may have addressed the flagged issues — or may have adapted to avoid detection. Verify the NEW claims independently."
    }
}
```

---

## 7. IMPLEMENTATION PRIORITY

| # | Task | Impact | Effort | Why |
|---|------|--------|--------|-----|
| 1 | Project detection + function/file verification (1A-1B) | CRITICAL | Medium | The un-gameable layer. Real moat. |
| 2 | CVE deep check with plagiarism detection (1C) | HIGH | Small | Catches NVD copy-paste slop |
| 3 | Verification panel in API response (Section 2) | HIGH | Small | Makes VulnRap useful for triagers |
| 4 | PoC plausibility checker (1D) | HIGH | Small | Catches template PoCs |
| 5 | Challenge question generator (5B) | HIGH | Small | Actionable output for PSIRT teams |
| 6 | Temporal signals (4A) | MED | Small | Catches speed-submitted parrots |
| 7 | Cross-report template detection (4B) | MED | Medium | Catches mass-submitted campaigns |
| 8 | Triage recommendations + export (5A, 5C) | MED | Medium | Workflow integration |
| 9 | Revision tracking (Section 6) | MED | Medium | Data integrity for evolving reports |
| 10 | Behavioral axis weight in fusion (Section 3) | LOW | Tiny | Wire new signals into scoring |

---

## 8. UPDATED SCORING AXIS WEIGHTS

With the new verification and behavioral axes, update the Noisy-OR fusion from Sprint 2:

```javascript
// Each axis produces a 0-100 score. Convert to 0-1 probability for Noisy-OR.
// Only axes with score > threshold contribute (avoids noise from weak signals).

const AXIS_CONFIG = {
    linguistic:    { threshold: 10, enabled: true },
    factual:       { threshold: 10, enabled: true },
    template:      { threshold: 0,  enabled: true },
    verification:  { threshold: 10, enabled: true },  // NEW: from Section 1
    llm:           { threshold: 20, enabled: true },
    behavioral:    { threshold: 10, enabled: true },   // NEW: from Section 4
};

// The verification axis score is computed from:
// - Function/file existence checks (weight by verified vs not-found ratio)
// - CVE plagiarism detection
// - PoC plausibility
// Combine them into a single 0-100 score.

function computeVerificationScore(verificationResults) {
    if (!verificationResults || verificationResults.length === 0) return 0;

    let score = 0;
    for (const r of verificationResults) {
        score += r.weight;  // positive = slop signal, negative = human signal
    }
    // Clamp to 0-100
    return Math.max(0, Math.min(100, 50 + score));
    // 50 = neutral (no signal). >50 = slop indicators. <50 = verified/legit indicators.
}
```

---

## Target Metrics After Sprint 3

These are the targets with the full pipeline (style + verification + LLM + behavioral):

| Metric | After Sprint 2 | Sprint 3 Target |
|--------|---------------|-----------------|
| AUC-ROC | 0.78 | > 0.95 |
| Accuracy | 87.5% | > 95% |
| Score range | 34-43 | 5-95 |
| Adversarial resistance | Low (style-based) | High (verification-based) |
| PSIRT utility | Score only | Score + verification + triage actions |
| Slop generator adaptation time | Days | Months-to-never (for verification layer) |
