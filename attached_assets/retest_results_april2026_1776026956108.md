# VulnRap Retest Results — Fresh Data (April 12, 2026)

## Test Setup

16 completely new reports (no overlap with original 29-report test), tested against the updated VulnRap scoring engine after implementing the development prompt changes.

- 8 legitimate reports: sourced from oss-security mailing list, April 1-11 2026 (OpenSSL, Cockpit RCE, Flatpak sandbox escape, libcap TOCTOU, X41 LiteLLM, libpng UAF, CPython base64, Airflow authz bypass)
- 8 slop reports: freshly crafted at varying sophistication levels (generic XSS, template SQLi, SSRF cloud, Java deser, dependency dump, polished buffer overflow, path traversal, sophisticated race condition)

## Raw Scores

| Report | Type | SlopScore | QualityScore | Confidence | Linguistic | Factual | Template | Evidence |
|--------|------|-----------|-------------|------------|------------|---------|----------|----------|
| L01-openssl | LEGIT | 35 | 64 | 0.30 | 3 | 0 | 0 | 1 |
| L02-cockpit | LEGIT | 35 | 54 | 0.30 | 0 | 0 | 0 | 0 |
| L03-flatpak | LEGIT | 35 | 59 | 0.30 | 0 | 0 | 0 | 0 |
| L04-libcap | LEGIT | 35 | 72 | 0.30 | 0 | 0 | 0 | 0 |
| L05-litellm | LEGIT | 34 | 79 | 0.37 | 0 | 15 | 0 | 1 |
| L06-libpng | LEGIT | 35 | 67 | 0.30 | 0 | 0 | 0 | 0 |
| L07-cpython | LEGIT | 35 | 62 | 0.30 | 0 | 0 | 0 | 0 |
| L08-airflow | LEGIT | 35 | 62 | 0.30 | 0 | 0 | 0 | 0 |
| S01-xss | SLOP | 41 | 69 | 0.44 | 47 | 0 | 100 | 2 |
| S02-sqli | SLOP | 37 | 77 | 0.44 | 22 | 17 | 0 | 3 |
| S03-ssrf | SLOP | 34 | 77 | 0.37 | 0 | 15 | 0 | 1 |
| S04-deser | SLOP | 41 | 77 | 0.65 | 29 | 41 | 100 | 6 |
| S05-deps | SLOP | 38 | 64 | 0.37 | 29 | 0 | 0 | 2 |
| S06-bof | SLOP | 40 | 85 | 0.51 | 0 | 54 | 0 | 4 |
| S07-pathtrv | SLOP | 43 | 77 | 0.51 | 47 | 15 | 100 | 3 |
| S08-race | SLOP | 34 | 67 | 0.37 | 0 | 15 | 0 | 1 |

**LLM axis = null on ALL reports (still broken/disabled)**

## Headline Metrics

| Metric | Previous (29 reports) | Current (16 reports) | Target |
|--------|----------------------|---------------------|--------|
| Cohen's d | 0.06 (negligible) | **1.63 (large)** | >1.0 |
| AUC-ROC | ~0.52 (random) | **0.781 (fair)** | >0.85 |
| Best accuracy | 58.6% | **87.5%** | >85% |
| Score gap | 0.5 pts | **3.6 pts** | >25 pts |
| LLM scoring | Broken | **Still broken** | Active |

## What Improved

1. **Quality score is now properly separated** — legit reports get quality scores (54-79) that do NOT inflate slopScore. This was the single biggest fix for false positives.

2. **The new heuristic axes are working** — The linguistic, factual, and template axes all show meaningful discrimination:
   - Linguistic: mean 21.8 slop vs 0.4 legit (gap = 21.4)
   - Factual: mean 19.6 slop vs 1.9 legit (gap = 17.8)
   - Template: mean 37.5 slop vs 0.0 legit (gap = 37.5)

3. **Cohen's d went from 0.06 to 1.63** — this is a jump from "statistically indistinguishable" to "large effect size." The system can now meaningfully tell the two groups apart.

4. **Accuracy at optimal threshold: 87.5%** (up from 58.6%), correctly classifying 14 of 16 reports at threshold 36.

## What Still Needs Work

### Problem 1: LLM scoring is still broken (CRITICAL)
`llmSlopScore` is null on every single response. `llmEnhanced` never appears as true. This is the #1 remaining blocker. The LLM axis was assigned 35% weight in the fusion model — without it, the system is running on less than two-thirds of its intended capability.

### Problem 2: Score range is severely compressed
All scores fall in a 9-point band (34-43). The fusion formula's confidence-based damping toward the midpoint (50) is over-compressing the output. When confidence is 0.30-0.37, the formula `final = raw * conf + 50 * (1-conf)` pulls everything toward ~35-42 regardless of the raw signal strength.

**Suggested fix:** Either raise the confidence floor (e.g., from 0.3 to 0.5 when any heuristic axis fires), or reduce the midpoint pull (use 35 instead of 50 as the uncertainty anchor, since base rates suggest most reports aren't slop).

### Problem 3: Two slop types evade detection
- **S03-ssrf**: The "professional-sounding SSRF" scored 34 (same as legit). It avoided most AI phrases, used `target.com` (which should trigger placeholder URL detection but didn't bump the score enough), and had no template match.
- **S08-race**: The "sophisticated race condition" scored 34. It's well-written slop with no AI catchphrases, uses `example.com` in a curl command (detected as 1 factual signal), but the linguistic and template axes found nothing.

These represent the hard cases that require either LLM analysis or perplexity/entropy scoring to catch.

### Problem 4: Default score is 35
When no evidence is found, slopScore defaults to ~35 ("Questionable" tier). This is appropriate as an uncertainty marker, but it means the system has no way to actively score something LOW (e.g., "this is clearly NOT slop, score 10"). Reports with strong human signals (contractions, typos, terse style, verified CVEs) should pull the score DOWN below 35.

## Recommendations for Next Sprint

1. **Fix LLM scoring** — Still priority #1. Debug why llmSlopScore is always null. Check: Is the LLM API key configured? Is the call actually being made? Is there an error being swallowed?

2. **Reduce confidence damping** — The midpoint pull is too aggressive. When heuristic axes fire with strong signals (linguistic=47, template=100), confidence should be higher than 0.44.

3. **Add negative evidence** — Verified CVEs, real function names confirmed via GitHub, contractions, and terse style should generate negative-weight evidence that pulls slopScore BELOW the 35 default.

4. **Tune placeholder URL detection weight** — `target.com` and `example.com` appear in slop PoCs but the factual weight (15) barely moves the needle through the damping layer.

5. **Add sentence variance and bigram entropy** — These statistical features from the development prompt haven't been implemented yet. They would help catch S03 and S08 style sophisticated slop.
