# VulnRap Sprint 4: AI Triage Assistant — Reproduction Guidance, Gap Analysis, Reporter Feedback

## Why This Sprint Matters

VulnRap currently answers one question: "Is this slop?" That's necessary but not sufficient. PSIRT teams are drowning in AI-generated beg-bounty noise, and the real danger isn't just wasting time on slop — it's **accidentally dismissing a real vulnerability because it's buried in garbage, or because a legitimate but poorly written report looks suspicious.**

This sprint adds an AI-generated **triage report** to every submission that helps both sides:
- **Triagers** get reproduction steps, environment requirements, gap analysis, and a clear next-action — so they can verify real bugs faster and close fake ones with confidence.
- **Reporters** get specific, constructive feedback on what's missing and how to improve — which raises report quality across the ecosystem over time.
- **Both sides benefit** from the "what could be missed" analysis that flags edge cases, untested configurations, and incomplete scope — so real issues don't fall through the cracks.

---

## 1. THE LLM TRIAGE REPORT

Use the same LLM call that powers slop detection (Sprint 2, Axis 4) but with an expanded prompt that generates both the slop assessment AND the triage guidance in one shot. This avoids a second LLM call.

### Combined LLM Prompt

```javascript
const TRIAGE_ANALYSIS_PROMPT = `You are a senior PSIRT triage analyst. You receive vulnerability reports and must produce two things:
(A) An assessment of whether this report was AI-generated slop or legitimate human research.
(B) A practical triage guide for the security team handling this report.

Be direct. Be specific to THIS report. Do not give generic advice.

REPORT:
---
{report_text}
---

Return ONLY valid JSON matching this exact structure:

{
  "slopAssessment": {
    "specificity": <0-100>,
    "originality": <0-100>,
    "voice": <0-100>,
    "coherence": <0-100>,
    "hallucination": <0-100>,
    "overall": <0-100>,
    "reasoning": "<2-3 sentences on the strongest slop/legit signals>",
    "redFlags": ["<specific quotes or patterns>"]
  },

  "triageGuide": {
    "reproductionSteps": [
      "<Step 1: specific action to set up test environment>",
      "<Step 2: specific action to trigger the described issue>",
      "<Step N: what to observe to confirm the vulnerability>"
    ],
    "environmentRequirements": {
      "os": "<specific OS/version if determinable, or 'Not specified — ask reporter'>",
      "software": "<affected software and version from the report>",
      "configuration": "<any special config needed, or 'Default configuration' or 'Not specified'>",
      "prerequisites": "<auth level, network position, etc.>",
      "hardwareNotes": "<bare metal vs VM vs container if relevant, or null>"
    },
    "expectedBehavior": "<what should happen if the vuln is real — specific observable outcome>",
    "testingTips": [
      "<practical tip specific to this vuln type — e.g., 'enable ASan when compiling to catch the overflow'>",
      "<another tip>"
    ]
  },

  "gapAnalysis": {
    "missingFromReport": [
      {
        "gap": "<what's missing>",
        "severity": "critical|important|minor",
        "why": "<why this matters for triage>"
      }
    ],
    "untestedScenarios": [
      "<scenario the reporter didn't address — e.g., 'Does this affect the Windows build?'>",
      "<e.g., 'Is this exploitable without authentication?'>",
      "<e.g., 'Does this require a non-default configuration?'>"
    ],
    "scopeQuestions": [
      "<question about affected scope — e.g., 'Is this limited to v2.4.3 or does it affect the entire 2.x branch?'>",
      "<e.g., 'Does the fix in the latest release also address this variant?'>"
    ]
  },

  "reporterFeedback": {
    "strengths": ["<what the report did well>"],
    "improvements": [
      {
        "area": "<specific section or aspect>",
        "current": "<what the report currently says or lacks>",
        "suggested": "<specific improvement>"
      }
    ],
    "clarityScore": <0-100>,
    "actionability": "<one-sentence summary: can a triager act on this report as-is?>"
  }
}`;
```

### Integration Into the Scoring Pipeline

```javascript
async function llmAnalyze(reportText, llmClient) {
    const prompt = TRIAGE_ANALYSIS_PROMPT.replace('{report_text}', reportText.slice(0, 6000));
    // Increased to 6000 chars and higher max_tokens for the expanded response

    const response = await llmClient.chat({
        model: "anthropic/claude-3-haiku",  // or gpt-4o-mini
        temperature: 0.15,
        max_tokens: 1500,  // increased from 500
        messages: [{ role: "user", content: prompt }]
    });

    try {
        const parsed = JSON.parse(response.content);

        // Extract slop scores for fusion (same as before)
        const sa = parsed.slopAssessment;
        const llmSlopScore = Math.round(
            sa.specificity * 0.15 + sa.originality * 0.25 +
            sa.voice * 0.20 + sa.coherence * 0.15 +
            sa.hallucination * 0.25
        );

        return {
            llmSlopScore,
            llmEnhanced: true,
            slopAssessment: sa,
            triageGuide: parsed.triageGuide,
            gapAnalysis: parsed.gapAnalysis,
            reporterFeedback: parsed.reporterFeedback,
        };
    } catch (e) {
        console.error("[LLM] Parse failed:", e.message);
        return { llmSlopScore: null, llmEnhanced: false };
    }
}
```

### Cost Note

Haiku at 1500 output tokens ≈ $0.005/report. At 100 reports/day = $0.50/day. Still negligible. The triage guide alone saves a triager 15-30 minutes per report — the ROI is massive.

---

## 2. REPRODUCTION STEPS GENERATOR

The LLM produces initial reproduction steps, but we can enhance them with structured logic for common vulnerability classes. This serves as a fallback when LLM is unavailable AND as enrichment when it is.

### Heuristic Reproduction Templates

```javascript
const REPRO_TEMPLATES = {
    xss: {
        detect: /(?:cross.?site\s*scripting|xss|script\s*injection)/i,
        steps: (report) => [
            `Set up the application at the version mentioned (${extractVersion(report) || 'version not specified — ask reporter'})`,
            `Navigate to the endpoint identified: ${extractEndpoint(report) || 'endpoint not specified'}`,
            `Enter the payload from the report in the specified input field`,
            `Check browser DevTools console for script execution`,
            `Test with CSP headers enabled and disabled to determine if existing mitigations catch it`,
            `Test in multiple browsers (Chrome, Firefox) — XSS behavior can vary`
        ],
        envNotes: [
            "Test with browser XSS auditor both enabled and disabled",
            "Check if the application has CSP headers that would block the payload",
            "Verify whether the XSS is stored, reflected, or DOM-based — each has different reproduction requirements"
        ]
    },

    sqli: {
        detect: /(?:sql\s*injection|sqli|blind.*sql|union.*select)/i,
        steps: (report) => [
            `Set up a local instance with a database backend matching production (${extractDBType(report) || 'DB type not specified'})`,
            `Identify the vulnerable endpoint: ${extractEndpoint(report) || 'not specified'}`,
            `Send the payload from the report — capture the full HTTP request/response`,
            `Check application logs and DB query logs for injected SQL`,
            `If blind SQLi: measure response time difference between true/false conditions`,
            `Test with WAF/input validation enabled to check if existing defenses catch it`
        ],
        envNotes: [
            "Different database engines (MySQL, PostgreSQL, MSSQL) have different injection syntax",
            "Test with parameterized queries to confirm the fix works",
            "Check if the ORM/query builder is being bypassed via raw queries"
        ]
    },

    ssrf: {
        detect: /(?:server.?side\s*request|ssrf|internal.*fetch|metadata.*service)/i,
        steps: (report) => [
            `Set up the application in a cloud environment matching production (AWS/GCP/Azure)`,
            `Identify the endpoint that makes outbound requests: ${extractEndpoint(report) || 'not specified'}`,
            `Test with a request to a controlled external server (e.g., Burp Collaborator) to confirm outbound requests`,
            `Test internal access: attempt to reach 169.254.169.254 (AWS metadata), 169.254.169.254/computeMetadata (GCP), or internal service endpoints`,
            `Check if IMDSv2 is enforced (requires token header) — this is a common mitigation`,
            `Test with both IP addresses and DNS rebinding to check for IP-based blocklists`
        ],
        envNotes: [
            "SSRF impact varies dramatically by cloud provider and metadata service version",
            "IMDSv2 on AWS mitigates most metadata theft but doesn't prevent internal network scanning",
            "Test from the same network segment as production — SSRF to localhost behaves differently in containers vs VMs"
        ]
    },

    deserialization: {
        detect: /(?:deserializ|objectinputstream|pickle|yaml\.load|unserialize|marshal)/i,
        steps: (report) => [
            `Identify the deserialization endpoint: ${extractEndpoint(report) || 'not specified'}`,
            `Check the classpath/dependencies for known gadget chains (ysoserial for Java, phpggc for PHP)`,
            `Generate a benign test payload (e.g., DNS callback) — do NOT use the RCE payload in production`,
            `Send the payload and monitor for the callback to confirm deserialization occurs`,
            `Check if there are ObjectInputFilters, allowlists, or type checking in place`,
            `Test with the specific library versions mentioned — gadget availability is version-dependent`
        ],
        envNotes: [
            "Java deserialization exploits are highly dependent on which libraries are in the classpath",
            "The same gadget chain may work in dev but fail in production due to different dependency versions",
            "Some WAFs detect serialized Java objects by magic bytes (0xACED) — test with and without WAF"
        ]
    },

    buffer_overflow: {
        detect: /(?:buffer\s*overflow|heap.*overflow|stack.*overflow|out.?of.?bounds|memcpy|strcpy)/i,
        steps: (report) => [
            `Compile the affected software from source at the specified version with AddressSanitizer: CFLAGS="-fsanitize=address" ./configure && make`,
            `Run the PoC input against the ASan-instrumented binary`,
            `Check ASan output for the exact crash location, access type (read/write), and size`,
            `Compare the crash location with what the report claims — do they match?`,
            `Test with Valgrind as a second opinion: valgrind --tool=memcheck ./binary < poc_input`,
            `Check if the overflow is reachable from an external input or requires local access`
        ],
        envNotes: [
            "Buffer overflows behave differently on 32-bit vs 64-bit systems (address space, alignment)",
            "ASLR, stack canaries, and NX/DEP affect exploitability but not the bug's existence",
            "Compile with and without optimizations — some overflows only manifest at specific optimization levels",
            "If the report claims RCE from a heap overflow, that requires heap grooming which is highly environment-specific"
        ]
    },

    path_traversal: {
        detect: /(?:path\s*traversal|directory\s*traversal|\.\.\/|\.\.\\|local\s*file\s*inclusion|lfi)/i,
        steps: (report) => [
            `Identify the endpoint: ${extractEndpoint(report) || 'not specified'}`,
            `Test with the exact traversal sequence from the report`,
            `Also test URL-encoded variants: %2e%2e%2f, %252e%252e%252f (double encoding), ..%c0%af (overlong UTF-8)`,
            `Check if the traversal works with absolute paths (e.g., /etc/passwd) or only relative`,
            `Test what files are readable — can you access files outside the web root?`,
            `Check if there's a chroot, container boundary, or AppArmor/SELinux policy limiting access`
        ],
        envNotes: [
            "Path traversal behaves differently on Windows (backslash) vs Linux (forward slash)",
            "Containerized deployments may limit the blast radius even if traversal succeeds",
            "Check if the application runs as root or a limited user — this determines what files are readable"
        ]
    },

    auth_bypass: {
        detect: /(?:auth(?:entication|orization)?\s*bypass|privilege\s*escalation|idor|broken\s*access|missing\s*auth)/i,
        steps: (report) => [
            `Set up at least two user accounts with different privilege levels`,
            `Reproduce the exact request sequence from the report using the lower-privileged account`,
            `Verify that the response contains data or actions that should require higher privileges`,
            `Test with no authentication at all (remove auth headers entirely)`,
            `Check if the bypass works through the UI or only via direct API calls`,
            `Test if rate limiting or account lockout affects reproducibility`
        ],
        envNotes: [
            "Auth bypasses often depend on specific role configurations — test with the default role setup",
            "Some bypasses only work with certain authentication backends (LDAP vs local, OAuth vs session)",
            "Check if the application has multiple auth enforcement points — the bypass may be in one but not others"
        ]
    },

    race_condition: {
        detect: /(?:race\s*condition|toctou|time.?of.?check|concurrent|double.?spend|atomicity)/i,
        steps: (report) => [
            `Set up the application with a database backend (race conditions often disappear with SQLite)`,
            `Use a concurrency testing tool (e.g., Turbo Intruder in Burp, or GNU parallel with curl)`,
            `Send N concurrent requests (start with 10, increase to 50) to the identified endpoint`,
            `Check the database/state for inconsistencies after each batch`,
            `Run the test multiple times — race conditions are probabilistic, not deterministic`,
            `Measure the timing window: what's the minimum request gap needed to trigger the race?`
        ],
        envNotes: [
            "Race conditions are highly sensitive to server hardware and load — a busy production server may have a wider race window than a local dev instance",
            "Database transaction isolation level matters: READ COMMITTED vs SERIALIZABLE can make the difference",
            "Containerized deployments with connection pooling may behave differently than bare-metal",
            "Some race conditions only trigger under specific load patterns — test with realistic concurrent user counts"
        ]
    },
};

function extractVersion(text) {
    const match = text.match(/(?:version|v)\s*([\d]+\.[\d]+(?:\.[\d]+)?)/i);
    return match ? match[1] : null;
}

function extractEndpoint(text) {
    const match = text.match(/(?:endpoint|url|path|route).*?(\/[\w\-\/\{\}]+)/i)
        || text.match(/((?:GET|POST|PUT|DELETE|PATCH)\s+\/[\w\-\/\{\}]+)/i)
        || text.match(/(\/api\/[\w\-\/\{\}]+)/i);
    return match ? match[1] : null;
}

function extractDBType(text) {
    const dbs = ['mysql', 'postgresql', 'postgres', 'mssql', 'sql server', 'oracle', 'sqlite', 'mongodb', 'mariadb'];
    const textLower = text.toLowerCase();
    return dbs.find(db => textLower.includes(db)) || null;
}

function generateHeuristicRepro(text) {
    for (const [vulnType, template] of Object.entries(REPRO_TEMPLATES)) {
        if (template.detect.test(text)) {
            return {
                vulnType,
                steps: template.steps(text),
                envNotes: template.envNotes,
            };
        }
    }
    return null;
}
```

### Merging LLM + Heuristic Reproduction

```javascript
function buildTriageGuide(llmResult, heuristicRepro, report) {
    // If LLM produced a triage guide, use it as primary (more specific)
    // Layer heuristic environment notes on top (more comprehensive per vuln class)
    const guide = {};

    if (llmResult?.triageGuide) {
        guide.reproductionSteps = llmResult.triageGuide.reproductionSteps;
        guide.environment = llmResult.triageGuide.environmentRequirements;
        guide.expectedBehavior = llmResult.triageGuide.expectedBehavior;
        guide.testingTips = llmResult.triageGuide.testingTips || [];
    } else if (heuristicRepro) {
        guide.reproductionSteps = heuristicRepro.steps;
        guide.environment = { note: "Environment details not specified in report — generated from vulnerability class" };
        guide.expectedBehavior = null;
        guide.testingTips = [];
    } else {
        guide.reproductionSteps = ["Insufficient detail in report to generate reproduction steps"];
        guide.environment = {};
        guide.expectedBehavior = null;
        guide.testingTips = [];
    }

    // Always append heuristic env notes for the detected vuln class (more comprehensive)
    if (heuristicRepro?.envNotes) {
        guide.environmentConsiderations = heuristicRepro.envNotes;
    }

    // Add "what could be missed" section — always present
    guide.dontMiss = generateDontMiss(report, llmResult);

    return guide;
}
```

---

## 3. "DON'T MISS" ANALYSIS

This is the feature that prevents triagers from throwing out a real bug. Even if the slop score is high, these checks flag scenarios where a legitimate issue could be hiding behind a bad report.

```javascript
function generateDontMiss(reportText, llmResult) {
    const warnings = [];

    // Check if the vulnerability CLASS is real even if the report is sloppy
    const vulnClasses = {
        xss: /(?:cross.?site|xss)/i,
        sqli: /(?:sql\s*inject)/i,
        rce: /(?:remote\s*code\s*exec|rce|command\s*inject)/i,
        ssrf: /(?:ssrf|server.?side\s*request)/i,
        idor: /(?:idor|insecure\s*direct)/i,
        lfi: /(?:local\s*file|path\s*traversal|directory\s*traversal)/i,
    };

    for (const [cls, pattern] of Object.entries(vulnClasses)) {
        if (pattern.test(reportText)) {
            warnings.push({
                type: 'vuln_class_is_real',
                message: `Even if this report is AI-generated, ${cls.toUpperCase()} vulnerabilities in this type of application are common. Consider a quick manual check of the referenced endpoint before closing.`
            });
            break;  // one warning is enough
        }
    }

    // Check if a real CVE is referenced — even slop reports sometimes reference real issues
    const cves = reportText.match(/CVE-\d{4}-\d{4,}/g) || [];
    if (cves.length > 0) {
        warnings.push({
            type: 'real_cve_referenced',
            message: `This report references ${cves.join(', ')}. Even if the report itself is AI-generated, verify whether your deployment is affected by the referenced CVE(s) independently.`
        });
    }

    // Check if a real project/component is named
    const hasSpecificComponent = /(?:in\s+(?:the\s+)?)([\w\-]+\.(?:js|py|c|go|java|rb|rs|php))/i.test(reportText);
    if (hasSpecificComponent) {
        warnings.push({
            type: 'specific_component_named',
            message: `A specific source file is named. Even poorly written reports sometimes identify real attack surface. A 30-second grep of the codebase for the referenced file may be worthwhile.`
        });
    }

    // If the report mentions a dependency, check if YOUR project uses it
    warnings.push({
        type: 'dependency_check_reminder',
        message: `If this report references third-party dependencies, check whether those specific dependencies (and versions) are actually in your project's dependency tree before dismissing.`
    });

    // If the slopScore is in the ambiguous zone
    if (llmResult?.llmSlopScore >= 30 && llmResult?.llmSlopScore <= 60) {
        warnings.push({
            type: 'ambiguous_score',
            message: `This report scored in the ambiguous range. It may be a real finding submitted by someone using AI to help write the report (increasingly common), rather than pure AI slop. Consider evaluating the technical claims on their merits.`
        });
    }

    return warnings;
}
```

**This is critical.** The "ambiguous score" warning acknowledges a reality that's emerging right now: legitimate researchers are using AI to help write and format their reports. A report that "sounds like AI" might contain a genuine vulnerability discovered by a human who used ChatGPT to help articulate it. VulnRap needs to account for this — the style signals matter less; the factual verification matters more.

---

## 4. GAP ANALYSIS ENGINE

Systematically identify what the report DOESN'T address. This generates both the "improvements for the reporter" and the "things the triager should check independently."

```javascript
function analyzeReportGaps(text) {
    const gaps = [];

    // VERSION SPECIFICITY
    const hasVersion = /(?:version|v)\s*\d+\.\d+/i.test(text);
    const hasVersionRange = /(?:versions?\s*(?:before|prior|through|up to|<=?|>=?))\s*\d+\.\d+/i.test(text);
    if (!hasVersion) {
        gaps.push({
            gap: "No software version specified",
            severity: "critical",
            forTriager: "Cannot determine if your deployment is affected without a version. Check if the described behavior exists in your current version.",
            forReporter: "Always include the exact version you tested against. If you believe multiple versions are affected, specify the range you verified."
        });
    } else if (!hasVersionRange) {
        gaps.push({
            gap: "Single version tested, no range specified",
            severity: "important",
            forTriager: "Reporter only tested one version. Check if the issue also exists in adjacent versions, especially if you're on a different release.",
            forReporter: "Testing a single version is a start, but indicating whether older/newer versions are also affected helps triage significantly."
        });
    }

    // ENVIRONMENT DETAILS
    const hasOS = /(?:ubuntu|debian|centos|rhel|windows|macos|alpine|linux)/i.test(text);
    const hasRuntime = /(?:docker|container|kubernetes|k8s|bare.?metal|vm|virtual|ec2|lambda)/i.test(text);
    if (!hasOS && !hasRuntime) {
        gaps.push({
            gap: "No environment/OS details",
            severity: "important",
            forTriager: "No indication of the test environment. Some vulnerabilities are OS-specific or behave differently in containers vs bare metal.",
            forReporter: "Include your OS, runtime environment (Docker, VM, bare metal), and any relevant system configuration."
        });
    }

    // AUTHENTICATION CONTEXT
    const hasAuthContext = /(?:unauth|no\s*auth|without\s*(?:auth|login|cred)|anonym|pre.?auth|auth(?:enticated|orized)?\s*(?:user|attacker|request))/i.test(text);
    if (!hasAuthContext) {
        gaps.push({
            gap: "Authentication requirements unclear",
            severity: "important",
            forTriager: "The report doesn't clearly state whether exploitation requires authentication. Test both authenticated and unauthenticated.",
            forReporter: "State explicitly whether the attack requires authentication, and if so, what privilege level (viewer, editor, admin)."
        });
    }

    // IMPACT DEMONSTRATION
    const claimsSevere = /(?:critical|rce|remote\s*code|arbitrary\s*code|privilege\s*escalation)/i.test(text);
    const demonstratesImpact = /(?:uid=|whoami|id\s*command|reverse\s*shell|calc\.exe|/etc/shadow|admin.*password|token.*exfiltrat)/i.test(text);
    if (claimsSevere && !demonstratesImpact) {
        gaps.push({
            gap: "Claims severe impact without demonstrating it",
            severity: "critical",
            forTriager: "Report claims high severity but doesn't show impact beyond the initial bug class. The actual exploitability may be lower than claimed. Evaluate the real-world impact independently.",
            forReporter: "You claim critical severity but your PoC only demonstrates the vulnerability trigger, not the impact. Show the actual consequence: exfiltrated data, code execution output, privilege escalation proof."
        });
    }

    // PROOF OF CONCEPT QUALITY
    const hasPoC = /(?:proof\s*of\s*concept|poc|steps\s*to\s*reproduce|reproduction)/i.test(text);
    const hasActualCode = /(?:```|curl\s+-|python\s+-c|import\s+\w|POST\s+\/|GET\s+\/)/i.test(text);
    if (hasPoC && !hasActualCode) {
        gaps.push({
            gap: "Claims PoC but no executable code provided",
            severity: "important",
            forTriager: "The report mentions a PoC but doesn't include runnable code. Ask for a complete, self-contained reproduction script.",
            forReporter: "Include actual commands or code that can be copy-pasted and run. Narrative descriptions of steps are not reproducible."
        });
    }
    if (!hasPoC) {
        gaps.push({
            gap: "No proof of concept",
            severity: "critical",
            forTriager: "No PoC provided. Cannot verify the claim without independent reproduction from scratch.",
            forReporter: "A vulnerability report without a PoC cannot be efficiently triaged. Include the exact steps, commands, or script to reproduce the issue."
        });
    }

    // NETWORK POSITION
    const isNetworkVuln = /(?:remote|network|http|api|endpoint|server)/i.test(text);
    const hasNetworkPosition = /(?:internet.?facing|internal|localhost|local\s*network|same\s*network|adjacent)/i.test(text);
    if (isNetworkVuln && !hasNetworkPosition) {
        gaps.push({
            gap: "Network position not specified",
            severity: "minor",
            forTriager: "Unclear whether this is exploitable from the internet, local network only, or localhost only. This significantly affects severity.",
            forReporter: "Specify the required network position: internet-facing, local network, or localhost only."
        });
    }

    // DEFAULT vs CUSTOM CONFIGURATION
    const hasConfigNote = /(?:default\s*config|custom\s*config|non.?default|configuration\s*required|must\s*be\s*enabled|when\s*.*\s*is\s*enabled)/i.test(text);
    if (!hasConfigNote) {
        gaps.push({
            gap: "No mention of whether default or custom configuration is needed",
            severity: "minor",
            forTriager: "Unknown whether this requires a non-default configuration. Test with default settings first, then check if the report assumes custom config.",
            forReporter: "State whether the vulnerability exists in the default configuration or requires specific settings to be enabled."
        });
    }

    return gaps;
}
```

---

## 5. REPORTER FEEDBACK GENERATOR

Combine the LLM's feedback with the gap analysis into structured, constructive feedback that can be sent back to the reporter.

```javascript
function generateReporterFeedback(llmFeedback, gaps, slopScore, verification) {
    const feedback = {
        overall: null,
        strengths: [],
        improvements: [],
        missingElements: [],
        slopWarnings: [],
    };

    // OVERALL ASSESSMENT
    if (slopScore >= 70) {
        feedback.overall = "This report has strong indicators of AI generation. If this is a legitimate finding, resubmitting with the improvements below will help it get the attention it deserves.";
    } else if (slopScore >= 40) {
        feedback.overall = "This report has some quality concerns that may slow down triage. Addressing the items below would help the security team evaluate your finding more efficiently.";
    } else {
        feedback.overall = "This report appears well-structured. The suggestions below are minor improvements that could help with faster triage.";
    }

    // STRENGTHS — always find something positive
    if (llmFeedback?.strengths) {
        feedback.strengths = llmFeedback.strengths;
    }
    const hasCode = /```[\s\S]+```/.test('placeholder'); // check in actual report
    if (verification?.checks?.some(c => c.result === 'VERIFIED')) {
        feedback.strengths.push("References verified code elements that exist in the actual project");
    }

    // IMPROVEMENTS from gap analysis
    for (const gap of gaps) {
        feedback.improvements.push({
            priority: gap.severity,
            issue: gap.gap,
            suggestion: gap.forReporter,
        });
    }

    // IMPROVEMENTS from LLM
    if (llmFeedback?.improvements) {
        for (const imp of llmFeedback.improvements) {
            feedback.improvements.push({
                priority: "important",
                issue: imp.area,
                suggestion: imp.suggested,
            });
        }
    }

    // SLOP-SPECIFIC WARNINGS
    // These help legitimate researchers who used AI assistance to clean up their reports
    if (slopScore >= 50) {
        feedback.slopWarnings = [
            "Your report contains phrases commonly associated with AI-generated content. If you used AI to help draft this report, consider editing it to include more of your own observations and specific testing details.",
            "Generic security advice (e.g., 'implement input validation as recommended by OWASP') can be replaced with specific recommendations tied to the actual code you reviewed.",
            "Removing formulaic openers ('I hope this finds you well', 'Dear Security Team') and closers ('Best regards, Security Researcher') will help your report be taken more seriously."
        ];
    }

    // Deduplicate and sort by priority
    feedback.improvements.sort((a, b) => {
        const order = { critical: 0, important: 1, minor: 2 };
        return (order[a.priority] || 2) - (order[b.priority] || 2);
    });

    return feedback;
}
```

---

## 6. FULL API RESPONSE — TRIAGE REPORT SECTION

Add the new `triageReport` object to the API response:

```javascript
{
    // ... existing: slopScore, qualityScore, confidence, breakdown, evidence, verification ...

    "triageReport": {
        // Reproduction guidance
        "reproduction": {
            "steps": [
                "1. Set up Cockpit >= v326 on a Linux host with OpenSSH < 9.6",
                "2. Send: curl -X POST https://target:9090/cockpit+=-oProxyCommand=touch%20/tmp/pwned/login -H 'Authorization: Basic dGVzdDp0ZXN0'",
                "3. Check if /tmp/pwned was created on the Cockpit host",
                "4. If created, RCE is confirmed without valid credentials"
            ],
            "environment": {
                "os": "Linux (any distribution with Cockpit packages)",
                "software": "Cockpit >= 326, < 360",
                "configuration": "Remote login feature enabled (default)",
                "prerequisites": "Network access to Cockpit web service (port 9090)",
                "hardwareNotes": null
            },
            "expectedBehavior": "The injected command executes on the Cockpit host before SSH authentication completes",
            "testingTips": [
                "Test with both OpenSSH >= 9.6 and < 9.6 — the hostname validation in newer versions blocks one of the two attack vectors",
                "Check Cockpit logs for the SSH invocation to see the unsanitized arguments"
            ],
            "environmentConsiderations": [
                "This only affects the beiboot/OpenSSH code path (Cockpit >= 326/327), not the older cockpit-ssh/libssh path",
                "Systems that upgraded Cockpit without updating OpenSSH are most at risk",
                "Test in a VM or container — the PoC executes commands on the host"
            ]
        },

        // Gap analysis
        "gapAnalysis": {
            "missingFromReport": [
                {
                    "gap": "No mention of SELinux/AppArmor impact",
                    "severity": "important",
                    "forTriager": "Mandatory access controls may limit exploitability even if the injection succeeds. Test with and without SELinux enforcing.",
                    "forReporter": "Indicating whether SELinux/AppArmor blocks the exploit would strengthen the severity assessment."
                }
            ],
            "untestedScenarios": [
                "Does this affect Cockpit when configured with certificate-based SSH authentication instead of password?",
                "Is the vulnerability exploitable through a reverse proxy (e.g., Cockpit behind nginx)?",
                "What happens on systems where the Cockpit user doesn't have a shell (nologin)?"
            ],
            "scopeQuestions": [
                "Is the beiboot code path used for ALL remote connections or only specific configurations?",
                "Does the fix in v360 also address custom SSH wrapper scripts?"
            ]
        },

        // Don't-miss warnings
        "dontMiss": [
            {
                "type": "vuln_class_is_real",
                "message": "SSH argument injection is a well-documented vulnerability class. Even if report quality is low, verify that user-supplied hostnames are sanitized before being passed to ssh."
            },
            {
                "type": "real_cve_referenced",
                "message": "CVE-2026-4631 is a real, published CVE. Verify independently whether your Cockpit version is in the affected range."
            }
        ],

        // Reporter feedback
        "reporterFeedback": {
            "overall": "This report appears well-structured. The suggestions below are minor improvements that could help with faster triage.",
            "strengths": [
                "Detailed technical root cause analysis with specific code paths",
                "Two distinct attack vectors clearly explained",
                "References specific source files (cockpitauth.c, beiboot.py)"
            ],
            "improvements": [
                {
                    "priority": "minor",
                    "issue": "No mention of mandatory access control impact",
                    "suggestion": "Test and report whether SELinux or AppArmor in enforcing mode blocks the exploitation."
                },
                {
                    "priority": "minor",
                    "issue": "Network position not explicitly stated",
                    "suggestion": "Explicitly state that the attacker needs network access to port 9090 (the Cockpit web service)."
                }
            ],
            "slopWarnings": []
        },

        // Recommended action for triager
        "triageAction": {
            "action": "PRIORITIZE",
            "reason": "Low slop score with verified code references and a real CVE",
            "note": "Proceed with standard vulnerability triage. Verify affected version range in your deployment."
        },

        // Challenge questions (only populated for suspicious reports)
        "challengeQuestions": []
    }
}
```

---

## 7. UI RENDERING

### Triage Report Panel

Render as a collapsible section with tabs:

```
┌─── Triage Report ─────────────────────────────────────────┐
│                                                            │
│  [Reproduce] [Gaps] [Don't Miss] [Reporter Feedback]       │
│                                                            │
│  ── How to Reproduce ──────────────────────────────────── │
│  Environment: Cockpit >= 326 on Linux, OpenSSH < 9.6      │
│  1. Set up Cockpit >= v326 on a Linux host...              │
│  2. Send: curl -X POST https://target:9090/cockpit+...     │
│  3. Check if /tmp/pwned was created...                     │
│  4. If created, RCE confirmed without valid credentials    │
│                                                            │
│  ⚠️ Testing Tips:                                          │
│  • Test with both OpenSSH >= 9.6 and < 9.6                │
│  • Test in a VM — PoC executes commands on the host        │
│                                                            │
│  ── Recommended Action ──────────────────────────────────  │
│  ✅ PRIORITIZE — Low slop score, verified code references  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### "Copy for Ticket" Button

Add a button that copies a formatted markdown triage summary (from Sprint 3's export endpoint) including the reproduction steps, gap analysis, and recommended action. One click → paste into Jira/ServiceNow/GitHub Issues.

---

## 8. FEEDBACK-TO-REPORTER DELIVERY

### Option A: Display in UI

Show the reporter feedback alongside the slop score when someone checks their own report before submitting:

```
┌─── Report Quality Feedback ───────────────────────────────┐
│                                                            │
│  ✅ Strengths:                                             │
│  • Detailed root cause with specific code paths            │
│  • Two attack vectors clearly explained                    │
│                                                            │
│  📝 Suggested Improvements:                                │
│  🔴 No proof of concept code provided                     │
│     → Include the exact curl command or script to repro    │
│  🟡 Authentication requirements unclear                    │
│     → State explicitly: "No authentication required"       │
│  🟡 Single version tested                                  │
│     → Indicate if older/newer versions are also affected   │
│                                                            │
│  💡 This report would score higher on clarity if you       │
│     replace generic OWASP references with specific         │
│     observations from YOUR testing.                        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Option B: API-Only for PSIRT Integration

PSIRT teams can pull the reporter feedback from the API and include it in their "needs more info" response template. This standardizes the feedback across the team.

### Option C: Shareable Feedback Link

Generate a unique URL (e.g., `vulnrap.com/feedback/{hash}`) that shows ONLY the reporter feedback (not the slop score or triage details). The PSIRT team can include this link when responding to a reporter: "Please review the improvement suggestions at this link and resubmit."

---

## 9. IMPLEMENTATION PRIORITY

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 1 | Expand LLM prompt to include triage guide + gap analysis (Section 1) | HIGH | Small — it's a prompt change |
| 2 | Heuristic reproduction templates (Section 2) | HIGH | Medium — 8 vuln classes |
| 3 | Gap analysis engine (Section 4) | HIGH | Small — rule-based checks |
| 4 | "Don't miss" warnings (Section 3) | CRITICAL | Small — prevents real bugs being dismissed |
| 5 | Reporter feedback generator (Section 5) | MED | Small — combines LLM + gaps |
| 6 | Add triageReport to API response (Section 6) | HIGH | Small — wire it up |
| 7 | UI triage report panel with tabs (Section 7) | MED | Medium — frontend work |
| 8 | "Copy for Ticket" export button | MED | Small |
| 9 | Shareable feedback link (Section 8, Option C) | LOW | Medium |

Do 1-6 first. The LLM prompt expansion (step 1) and gap analysis (step 3) are the highest ROI — small effort, massive value for triagers.

---

## KEY PRINCIPLE

**VulnRap's job is not just to detect slop. It's to make sure real vulnerabilities never get lost in the noise.**

Every feature in this sprint serves that goal: reproduction steps help triagers verify real bugs faster, gap analysis catches what the reporter missed, "don't miss" warnings prevent premature dismissal, and reporter feedback raises the quality of ALL reports over time. The slop score is the filter; the triage report is the value.
