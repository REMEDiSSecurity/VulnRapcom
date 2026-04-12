# VulnRap Sprint 2: Scoring Overhaul, Live Tuning, Data Integrity

## What This Prompt Covers

Sprint 1 separated quality from slop, added linguistic/factual/template axes, and implemented Bayesian fusion. Retest results (16 fresh reports): Cohen's d improved from 0.06→1.63, accuracy from 58.6%→87.5%, AUC from 0.52→0.78. But score range is compressed to 9 points (34-43), LLM scoring is still null, and users can't tune sensitivity. This sprint fixes all of that.

---

## 1. REPLACE THE FUSION FORMULA (Critical — scores are compressed)

### The Problem

Current formula: `final = raw * confidence + 50 * (1 - confidence)`

When confidence=0.30 (most reports), this maps EVERYTHING to 35-43 regardless of raw signal strength. The midpoint anchor of 50 is wrong — base rate of slop is not 50%. A template detector screaming 100 and linguistic at 47 still only produces slopScore=41.

### The Fix: Additive Evidence Model from a Low Prior

Replace the midpoint-anchor formula with an additive model that starts low and climbs with evidence:

```python
def compute_slop_score(linguistic, factual, template, llm_score,
                       evidence_list, human_indicators):
    """
    Start from a low prior (15). Evidence pushes UP.
    Human indicators push DOWN (but floor at 5).
    Multiple independent signals compound via 1 - product(1 - p_i).
    """
    BASE_PRIOR = 15  # Assumption: most reports are legit

    # Convert each axis to a probability-like signal (0.0 to 1.0)
    signals = []
    if linguistic > 10:
        signals.append(min(1.0, linguistic / 100))
    if factual > 10:
        signals.append(min(1.0, factual / 100))
    if template > 0:
        signals.append(min(1.0, template / 100))
    if llm_score is not None and llm_score > 20:
        signals.append(min(1.0, llm_score / 100))

    if signals:
        # Noisy-OR combination: P(slop) = 1 - product(1 - p_i)
        # This means: if ANY signal is strong, score goes up.
        # If MULTIPLE signals fire, they compound (not average out).
        combined_p = 1.0
        for s in signals:
            combined_p *= (1.0 - s)
        combined_p = 1.0 - combined_p  # P(slop | all signals)
        raw_score = BASE_PRIOR + combined_p * 80  # Maps to 15-95 range
    else:
        raw_score = BASE_PRIOR

    # NEGATIVE EVIDENCE: human indicators pull score DOWN
    # (see Section 3 below for what generates these)
    human_pull = sum(h["weight"] for h in human_indicators)
    raw_score = max(5, raw_score - human_pull)

    # Confidence = how many axes contributed + evidence density
    axis_count = len(signals)
    evidence_count = len(evidence_list) + len(human_indicators)
    confidence = min(1.0, 0.2 + axis_count * 0.15 + evidence_count * 0.05)
    if llm_score is not None:
        confidence = min(1.0, confidence + 0.15)

    return {
        "slopScore": round(raw_score),
        "confidence": round(confidence, 2)
    }
```

### Why This Works

- **Low prior (15)**: clean reports with no evidence score 15, not 35. This creates room to go DOWN for strong human signals and UP for slop signals.
- **Noisy-OR**: if linguistic=47/100 alone → score ~53. If linguistic=47 AND template=100 → score ~82. Signals compound instead of averaging.
- **No midpoint anchor**: confidence no longer pulls toward 50. It's just a metadata field indicating certainty.
- **Score range**: 5-95 instead of 34-43. PSIRT teams can set a meaningful threshold.

### Tier Recalibration

Update the tier thresholds to match the new score distribution:

```javascript
function getSlopTier(score) {
    if (score <= 20) return "Clean";        // Strong human signals, no slop indicators
    if (score <= 35) return "Likely Human";  // Some minor flags but probably real
    if (score <= 55) return "Questionable";  // Mixed signals, review manually
    if (score <= 75) return "Likely Slop";   // Multiple AI indicators firing
    return "Slop";                           // Near-certain AI generated
}
```

---

## 2. FIX LLM SCORING (Still the #1 priority)

`llmSlopScore` was null on ALL 16 retest reports. `llmEnhanced` is always false. This has been broken since initial testing (46+ reports, zero LLM results).

### Debugging Checklist

1. Add logging at every step of the LLM call path:
```javascript
console.log("[LLM] Starting analysis...");
console.log("[LLM] API key present:", !!process.env.LLM_API_KEY);
console.log("[LLM] Model:", LLM_MODEL);
try {
    const result = await llmAnalyze(reportText);
    console.log("[LLM] Success:", JSON.stringify(result).slice(0, 200));
} catch (err) {
    console.error("[LLM] FAILED:", err.message, err.stack);
}
```

2. Check: Is the LLM call behind a feature flag or environment variable that's set to `false`?
3. Check: Is there a try/catch that swallows errors and silently returns `{llmSlopScore: null}`?
4. Check: Is the API key env var actually set in Replit Secrets?
5. Check: Is the function async but not being awaited?
6. Check: Is there a timeout that's too short for the LLM response?

### If the LLM Provider Isn't Set Up Yet

Use OpenRouter as a unified gateway — one API key, many models:

```javascript
async function llmAnalyze(reportText) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://vulnrap.com",
        },
        body: JSON.stringify({
            model: "anthropic/claude-3-haiku",  // ~$0.003 per report
            temperature: 0.1,
            max_tokens: 500,
            messages: [{
                role: "user",
                content: LLM_ANALYSIS_PROMPT.replace("{report_text}", reportText.slice(0, 4000))
            }]
        })
    });
    // ... parse structured JSON response
}
```

Cost: ~$0.003/report with Haiku. At 100 reports/day = $0.30/day. Negligible.

### Cost Guard

Only call LLM when heuristic score is in the ambiguous zone (25-60) OR when confidence < 0.5. This cuts LLM calls by ~40% while preserving accuracy on the hard cases. Cache results by content hash (you already compute `sectionHashes`).

---

## 3. ADD NEGATIVE EVIDENCE (Human Indicators)

The system currently can only push scores UP. Legit reports all default to 35 (now 15 with the new prior). But reports with strong human signals should score 5-12 to create maximum separation.

```javascript
function detectHumanIndicators(text) {
    const indicators = [];

    // Contractions present = human signal
    const contractions = ["don't","doesn't","can't","won't","isn't","aren't",
                         "wasn't","couldn't","it's","that's","there's","I'm",
                         "I've","we're","we've","they're","you're"];
    const found = contractions.filter(c => text.toLowerCase().includes(c));
    if (found.length >= 2) {
        indicators.push({type: "contractions_present", weight: 5,
            description: `Uses ${found.length} contractions — natural human writing`});
    }

    // Terse/fragmented style (short sentences, no fluff)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 3);
    const avgLen = sentences.reduce((a,s) => a + s.split(/\s+/).length, 0) / sentences.length;
    if (avgLen < 15 && sentences.length > 3) {
        indicators.push({type: "terse_style", weight: 4,
            description: "Terse, direct writing style typical of experienced researchers"});
    }

    // Named real researcher/org (not "Security Researcher")
    const namedAuthor = /(?:reported by|credit|discovered by|found by)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/i;
    if (namedAuthor.test(text)) {
        indicators.push({type: "named_researcher", weight: 3,
            description: "Credits a named individual — AI slop uses generic attributions"});
    }

    // Real commit/PR references
    const commitRef = /(?:github\.com\/[\w\-]+\/[\w\-]+\/(?:commit|pull|issues)\/[a-f0-9]+|[\w\-]+@[a-f0-9]{7,})/i;
    if (commitRef.test(text)) {
        indicators.push({type: "real_commit_ref", weight: 6,
            description: "References specific commit/PR — indicates real code research"});
    }

    // Version-specific fix references
    const versionFix = /(?:fixed in|patched in|upgrade to)\s+(?:v(?:ersion)?\s*)?[\d]+\.[\d]+\.[\d]+/i;
    if (versionFix.test(text)) {
        indicators.push({type: "specific_fix_version", weight: 3,
            description: "References specific patched version"});
    }

    // Typos/informal language (AI doesn't make these)
    const informalMarkers = /(?:gonna|wanna|btw|fwiw|iirc|afaik|LGTM|nit:|tbh|IMO|FWIW)/i;
    if (informalMarkers.test(text)) {
        indicators.push({type: "informal_language", weight: 4,
            description: "Uses informal language/abbreviations typical of real devs"});
    }

    // Mailing list / advisory format indicators
    const advisoryFormat = /(?:Security Advisory|CVE-\d{4}-\d+.*(?:Severity|Affected|Patched))/s;
    if (advisoryFormat.test(text) && !text.toLowerCase().includes("dear security team")) {
        indicators.push({type: "advisory_format", weight: 3,
            description: "Follows standard advisory format without AI pleasantries"});
    }

    return indicators;
}
```

Feed these into `compute_slop_score()` as the `human_indicators` parameter. They reduce the score, widening the gap between real and fake.

---

## 4. LIVE TUNING WITHOUT DATA POLLUTION

### The Problem

Users want to adjust sensitivity (e.g., "I care more about false negatives than false positives"). But if they recheck the same report with different settings, it:
- Counts the same report multiple times in stats
- Inflates `totalReports`
- Makes `avgSlopScore` meaningless
- Stores duplicate entries

### Architecture: Canonical Score + User Overlay

```
┌─────────────────────────────────────────────────────────────┐
│  Report submitted via /api/reports/check                     │
│                                                              │
│  1. Compute content hash (SHA-256 of normalized text)        │
│  2. Check: has this hash been scored before?                 │
│     YES → return cached canonical score + apply user overlay │
│     NO  → run full scoring pipeline, store result            │
│  3. Apply user sensitivity profile (post-processing)         │
│  4. Return both: canonical score + adjusted score            │
└─────────────────────────────────────────────────────────────┘
```

### API Changes

Add an optional `sensitivity` parameter to `/api/reports/check`:

```javascript
// POST /api/reports/check
// Body: FormData with rawText + optional JSON sensitivity profile
//
// sensitivity = {
//   preset: "strict" | "balanced" | "lenient",
//   // OR custom weights:
//   weights: {
//     linguistic: 1.0,  // multiplier (0.5 = half weight, 2.0 = double)
//     factual: 1.5,
//     template: 1.0,
//     llm: 1.0,
//     humanIndicators: 1.0,
//   },
//   threshold: 50,  // user's personal "flag above this" threshold
// }

const PRESETS = {
    strict:   { linguistic: 1.5, factual: 1.5, template: 1.2, llm: 1.2, humanIndicators: 0.7 },
    balanced: { linguistic: 1.0, factual: 1.0, template: 1.0, llm: 1.0, humanIndicators: 1.0 },
    lenient:  { linguistic: 0.7, factual: 0.7, template: 0.8, llm: 1.0, humanIndicators: 1.5 },
};
```

### Response Format Update

```javascript
{
    // Canonical (stored, deduped, never changes per content hash):
    "slopScore": 62,
    "qualityScore": 45,
    "confidence": 0.78,
    "breakdown": { "linguistic": 47, "factual": 41, "template": 100, "llm": 65, "quality": 45 },
    "evidence": [...],
    "humanIndicators": [...],

    // User-adjusted (computed on the fly, never stored):
    "adjustedScore": 71,         // after applying user's sensitivity weights
    "adjustedTier": "Likely Slop",
    "sensitivityProfile": "strict",

    // Dedup metadata:
    "contentHash": "a1b2c3...",
    "previouslySeen": true,      // true if this exact text was checked before
    "firstSeenAt": "2026-04-12T...",
    "checkCount": 3,             // how many times this hash has been checked
}
```

### Dedup Logic

```javascript
async function checkReport(rawText, sensitivity) {
    const normalizedText = rawText.trim().replace(/\s+/g, ' ').toLowerCase();
    const contentHash = sha256(normalizedText);

    // Check cache
    let canonical = await db.getByHash(contentHash);
    let previouslySeen = !!canonical;

    if (!canonical) {
        // First time seeing this report — run full pipeline
        canonical = await runFullScoringPipeline(rawText);
        canonical.contentHash = contentHash;
        canonical.firstSeenAt = new Date().toISOString();
        canonical.checkCount = 1;
        await db.store(canonical);

        // Only count in stats for NEW reports
        await updateStats(canonical);
    } else {
        // Seen before — increment check count but do NOT re-run pipeline
        // do NOT update stats (no pollution)
        canonical.checkCount += 1;
        await db.updateCheckCount(contentHash);
    }

    // Apply sensitivity overlay (never stored)
    const adjusted = applySensitivity(canonical, sensitivity);

    return {
        ...canonical,
        adjustedScore: adjusted.score,
        adjustedTier: adjusted.tier,
        sensitivityProfile: sensitivity?.preset || "balanced",
        previouslySeen: previouslySeen,
    };
}
```

### UI: Sensitivity Slider

Add to the web interface — a slider or preset buttons ABOVE the results panel:

```
[Lenient] ----●---- [Balanced] ----○---- [Strict]

When user changes: re-render the score display using the cached canonical
breakdown. NO new API call needed — the math is:
adjustedScore = recompute(canonical.breakdown, userWeights)
```

This means tuning is instant (client-side), free (no API call), and clean (no data pollution).

---

## 5. ADD STATISTICAL TEXT FEATURES (Missing from Sprint 1)

These were in the Sprint 1 prompt but not implemented. They catch sophisticated slop that avoids keywords.

### Sentence Length Coefficient of Variation

```javascript
function sentenceLengthCV(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 3);
    if (sentences.length < 5) return { score: 0, cv: null };
    const lengths = sentences.map(s => s.trim().split(/\s+/).length);
    const mean = lengths.reduce((a,b) => a+b, 0) / lengths.length;
    const std = Math.sqrt(lengths.reduce((a,l) => a + (l-mean)**2, 0) / lengths.length);
    const cv = mean > 0 ? std / mean : 0;
    // Human: CV > 0.6 (bursty). AI: CV 0.3-0.5 (uniform).
    let score;
    if (cv < 0.3) score = 70;
    else if (cv < 0.5) score = 45;
    else if (cv < 0.7) score = 15;
    else score = 5;
    return { score, cv: Math.round(cv * 100) / 100 };
}
```

### Bigram Entropy

```javascript
function bigramEntropy(text) {
    const words = text.toLowerCase().split(/\s+/);
    if (words.length < 20) return { score: 0, entropy: null };
    const bigrams = {};
    for (let i = 0; i < words.length - 1; i++) {
        const bg = words[i] + " " + words[i+1];
        bigrams[bg] = (bigrams[bg] || 0) + 1;
    }
    const total = words.length - 1;
    let entropy = 0;
    for (const count of Object.values(bigrams)) {
        const p = count / total;
        entropy -= p * Math.log2(p);
    }
    const maxEntropy = Math.log2(total);
    const normalized = maxEntropy > 0 ? entropy / maxEntropy : 0;
    // AI: 0.85-0.92. Human: 0.93-0.99.
    let score;
    if (normalized < 0.88) score = 60;
    else if (normalized < 0.92) score = 35;
    else if (normalized < 0.95) score = 15;
    else score = 5;
    return { score, entropy: Math.round(normalized * 1000) / 1000 };
}
```

### Where to Plug In

Add both to the linguistic axis. The linguistic score becomes:

```javascript
function computeLinguisticScore(text) {
    const lexical = scoreLexical(text);          // existing
    const passiveVoice = passiveVoiceRatio(text); // existing
    const contractionAbsence = contractionAbsenceScore(text); // existing
    const sentenceCV = sentenceLengthCV(text);    // NEW
    const entropy = bigramEntropy(text);          // NEW

    // Weighted combination
    const raw = (
        lexical.score * 0.30 +
        passiveVoice.score * 0.15 +
        contractionAbsence.score * 0.15 +
        sentenceCV.score * 0.20 +    // NEW — catches uniform AI sentence structure
        entropy.score * 0.20          // NEW — catches predictable AI word patterns
    );
    return { score: Math.round(raw), details: { lexical, passiveVoice, contractionAbsence, sentenceCV, entropy } };
}
```

---

## 6. COMMUNITY FEEDBACK LOOP

Let users label reports after checking. This builds a labeled dataset over time for calibrating weights.

### API Endpoint

```
POST /api/reports/{contentHash}/feedback
Body: { "label": "slop" | "legit" | "unsure", "source": "anonymous" }
```

### Storage

```javascript
// In the report record, add:
{
    communityLabels: {
        slop: 3,     // 3 users said slop
        legit: 0,
        unsure: 1
    },
    // Use for weight calibration (offline batch job):
    // Compare predicted slopScore vs community consensus
}
```

### UI

After showing results, add two buttons below the score:

```
Was this report actually AI slop?
[👍 Yes, slop] [👎 No, legit] [🤷 Unsure]
```

Rate-limit to 1 vote per content hash per session. No account required.

---

## 7. SIMILARITY MATCHING IMPROVEMENTS

The system already has `sectionHashes` and `similarityMatches`. Enhance this to build a known-slop corpus:

```javascript
// When a report gets community-labeled as "slop" with high consensus (3+ votes),
// add its content hash and key phrases to a "known slop" lookup table.
//
// On new submissions, check:
// 1. Exact hash match → "This exact report was previously flagged as slop"
// 2. Section hash overlap → "Sections of this report match known slop"
// 3. Cosine similarity > 0.85 against known-slop corpus → "Similar to known slop"
//
// Each match type adds evidence with appropriate weight:
//   exact_hash_match: weight 40 (near-conclusive)
//   section_overlap:  weight 20
//   high_similarity:  weight 15
```

---

## 8. BATCH MODE FOR PSIRT TEAMS

PSIRT teams receive dozens of reports and want to triage them all at once.

```
POST /api/reports/batch
Content-Type: application/json
Body: {
    "reports": [
        {"id": "user-ref-1", "text": "..."},
        {"id": "user-ref-2", "text": "..."}
    ],
    "sensitivity": "strict",     // optional, applied to all
    "maxConcurrent": 5           // limit parallel LLM calls
}

Response: {
    "results": [
        {"id": "user-ref-1", "slopScore": 72, "tier": "Likely Slop", ...},
        {"id": "user-ref-2", "slopScore": 12, "tier": "Clean", ...}
    ],
    "summary": {
        "total": 2,
        "byTier": {"Clean": 1, "Likely Slop": 1},
        "avgSlopScore": 42,
        "flagged": 1   // reports above user's threshold
    }
}
```

Limit: 20 reports per batch request. Rate limit: 5 batch requests per hour per IP.

---

## 9. UPDATED API RESPONSE FORMAT

Combine all changes into the final response shape:

```javascript
{
    // Core scores
    "slopScore": 62,                    // canonical, additive model
    "slopTier": "Likely Slop",
    "qualityScore": 45,
    "confidence": 0.78,

    // Axis breakdown (all 0-100)
    "breakdown": {
        "linguistic": 47,               // lexical + passive + contractions + CV + entropy
        "factual": 41,                  // placeholder URLs + severity inflation + fake debug
        "template": 100,                // known slop template match
        "llm": 65,                      // LLM 5-dimension analysis (no longer null!)
        "quality": 45                   // report completeness (separate axis)
    },

    // Evidence (positive = slop indicators)
    "evidence": [
        {"type": "ai_phrase", "matched": "I hope this finds you well", "weight": 8},
        {"type": "template_match", "matched": "dear_security_team", "weight": 12},
        {"type": "low_sentence_cv", "cv": 0.31, "weight": 8},
        {"type": "severity_inflation", "matched": "CVSS 9.8 without RCE evidence", "weight": 15}
    ],

    // Human indicators (negative = reduces slop score)
    "humanIndicators": [
        {"type": "contractions_present", "count": 4, "weight": -5},
        {"type": "real_commit_ref", "matched": "github.com/...", "weight": -6}
    ],

    // User sensitivity overlay
    "adjustedScore": 71,
    "adjustedTier": "Likely Slop",
    "sensitivityProfile": "strict",

    // Dedup / data integrity
    "contentHash": "a1b2c3d4...",
    "previouslySeen": false,
    "firstSeenAt": "2026-04-12T14:30:00Z",
    "checkCount": 1,

    // Similarity
    "similarityMatches": [],
    "knownSlopMatch": false,

    // Quality feedback (unchanged)
    "feedback": ["Missing specific version...", "..."],

    // LLM details (when available)
    "llmAnalysis": {
        "specificity": 25,
        "originality": 30,
        "voice": 70,
        "coherence": 45,
        "hallucination": 60,
        "reasoning": "Report uses textbook CWE language without original analysis...",
        "redFlags": ["Generic PoC with placeholder URLs", "No specific version tested"]
    }
}
```

---

## 10. IMPLEMENTATION PRIORITY

| # | Task | Impact | Effort | Depends On |
|---|------|--------|--------|------------|
| 1 | Replace fusion formula (Section 1) | HIGH — fixes score compression | Small | Nothing |
| 2 | Fix LLM scoring (Section 2) | HIGH — biggest accuracy jump | Small-Med | Debug only |
| 3 | Add negative evidence (Section 3) | HIGH — widens score gap | Small | Section 1 |
| 4 | Add sentence CV + bigram entropy (Section 5) | MED — catches sophisticated slop | Small | Nothing |
| 5 | Content-hash dedup for tuning (Section 4) | MED — data integrity | Medium | Nothing |
| 6 | Sensitivity presets API + UI (Section 4) | MED — user experience | Medium | Section 5 |
| 7 | Tier recalibration (Section 1) | LOW — cosmetic | Tiny | Section 1 |
| 8 | Community feedback endpoint (Section 6) | MED — builds training data | Small | Section 5 |
| 9 | Known-slop corpus matching (Section 7) | MED — catches repeat offenders | Medium | Section 8 |
| 10 | Batch mode (Section 8) | LOW — power user feature | Medium | Sections 1-3 |

Do steps 1-4 first. They're all small changes that together should push AUC past 0.90.

---

## Target Metrics After This Sprint

| Metric | Sprint 1 Result | Sprint 2 Target |
|--------|----------------|-----------------|
| Cohen's d | 1.63 | > 2.5 |
| AUC-ROC | 0.781 | > 0.92 |
| Best accuracy | 87.5% | > 93% |
| Score range | 34-43 (9 pts) | 8-85+ (70+ pts) |
| Score gap (mean slop − mean legit) | 3.6 pts | > 35 pts |
| LLM scoring active | No | Yes |
| FPR at 80% sensitivity | ~25% | < 8% |

---

## Companion Files

- `retest_results_april2026.md` — Full 16-report retest data with per-axis breakdown
- `vulnrap_sample_reports_and_sources.md` — 50+ labeled reports for testing
- `vulnrap_accuracy_analysis.md` — Original 29-report blind test analysis
