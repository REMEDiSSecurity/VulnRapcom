import type { EvidenceItem } from "./score-fusion";
import type { VerificationResult } from "./active-verification";
import type { LLMSlopResult } from "./llm-slop";

export interface ReproStep {
  order: number;
  instruction: string;
  note?: string;
}

export interface ReproGuidance {
  vulnClass: string;
  confidence: number;
  steps: ReproStep[];
  environment: string[];
  tools: string[];
}

export interface GapItem {
  category: string;
  severity: "critical" | "important" | "minor";
  description: string;
  suggestion: string;
}

export interface DontMissItem {
  area: string;
  warning: string;
  reason: string;
}

export interface ReporterFeedbackItem {
  tone: "positive" | "neutral" | "concern";
  message: string;
}

export interface TriageAssistantResult {
  reproGuidance: ReproGuidance | null;
  gaps: GapItem[];
  dontMiss: DontMissItem[];
  reporterFeedback: ReporterFeedbackItem[];
  llmTriageGuidance: LLMTriageGuidance | null;
}

export interface LLMTriageGuidance {
  reproSteps: string[];
  missingInfo: string[];
  dontMiss: string[];
  reporterFeedback: string;
}

type VulnClass = "xss" | "sqli" | "ssrf" | "deserialization" | "buffer_overflow" | "path_traversal" | "auth_bypass" | "race_condition" | "unknown";

const VULN_CLASS_PATTERNS: Array<{ vulnClass: VulnClass; patterns: RegExp[]; label: string }> = [
  {
    vulnClass: "xss",
    label: "Cross-Site Scripting (XSS)",
    patterns: [
      /\bcross[- ]?site\s*scripting\b/i,
      /\bXSS\b/,
      /\b(?:reflected|stored|dom[- ]?based)\s*xss\b/i,
      /<script[^>]*>.*?<\/script>/i,
      /\bdocument\.cookie\b/i,
      /\balert\s*\(/i,
      /\bonmouseover\b/i,
      /\bonerror\b/i,
    ],
  },
  {
    vulnClass: "sqli",
    label: "SQL Injection",
    patterns: [
      /\bsql\s*injection\b/i,
      /\bSQLi\b/,
      /\bunion\s+select\b/i,
      /\bor\s+1\s*=\s*1\b/i,
      /\b(?:blind|error[- ]?based|time[- ]?based)\s*(?:sql|injection)\b/i,
      /\b(?:sleep|waitfor|benchmark)\s*\(/i,
    ],
  },
  {
    vulnClass: "ssrf",
    label: "Server-Side Request Forgery (SSRF)",
    patterns: [
      /\bserver[- ]?side\s*request\s*forgery\b/i,
      /\bSSRF\b/,
      /\b169\.254\.169\.254\b/,
      /\bmetadata\s*(?:service|endpoint)\b/i,
      /\binternal\s*(?:service|network|host)\b/i,
      /\bcloud\s*metadata\b/i,
    ],
  },
  {
    vulnClass: "deserialization",
    label: "Insecure Deserialization",
    patterns: [
      /\bdeserialization\b/i,
      /\binsecure\s*deserialization\b/i,
      /\b(?:pickle|yaml\.load|unserialize|readObject|ObjectInputStream)\b/i,
      /\b(?:ysoserial|gadget\s*chain)\b/i,
      /\bremote\s*code\s*execution\s*via\s*(?:de)?serial/i,
    ],
  },
  {
    vulnClass: "buffer_overflow",
    label: "Buffer Overflow",
    patterns: [
      /\bbuffer\s*overflow\b/i,
      /\bheap\s*overflow\b/i,
      /\bstack\s*(?:overflow|smash)\b/i,
      /\bout[- ]?of[- ]?bounds\b/i,
      /\buse[- ]?after[- ]?free\b/i,
      /\bASan\b/,
      /\bAddressSanitizer\b/i,
      /\bSegmentation\s*fault\b/i,
    ],
  },
  {
    vulnClass: "path_traversal",
    label: "Path Traversal",
    patterns: [
      /\bpath\s*traversal\b/i,
      /\bdirectory\s*traversal\b/i,
      /\bLFI\b/,
      /\blocal\s*file\s*inclusion\b/i,
      /\.\.\//,
      /\.\.\\+/,
      /\/etc\/(?:passwd|shadow)\b/,
    ],
  },
  {
    vulnClass: "auth_bypass",
    label: "Authentication / Authorization Bypass",
    patterns: [
      /\bauth(?:entication|orization)?\s*bypass\b/i,
      /\bprivilege\s*escalation\b/i,
      /\bIDOR\b/,
      /\binsecure\s*direct\s*object\b/i,
      /\bbroken\s*(?:access|auth)\b/i,
      /\bJWT\s*(?:bypass|forgery|manipulation)\b/i,
      /\bforce[- ]?browse\b/i,
    ],
  },
  {
    vulnClass: "race_condition",
    label: "Race Condition",
    patterns: [
      /\brace\s*condition\b/i,
      /\bTOCTOU\b/i,
      /\btime[- ]?of[- ]?check\b/i,
      /\bdouble[- ]?spend\b/i,
      /\bconcurren(?:cy|t)\s*(?:bug|vuln|issue)\b/i,
    ],
  },
];

const REPRO_TEMPLATES: Record<Exclude<VulnClass, "unknown">, { steps: ReproStep[]; environment: string[]; tools: string[] }> = {
  xss: {
    steps: [
      { order: 1, instruction: "Identify the injection point (URL parameter, form field, header, stored input)", note: "Check if the report specifies the exact parameter name" },
      { order: 2, instruction: "Set up a local instance of the target application at the reported version" },
      { order: 3, instruction: "Inject the exact payload from the report into the identified parameter" },
      { order: 4, instruction: "Check if the payload is reflected/stored without encoding in the DOM" },
      { order: 5, instruction: "Verify the payload executes in a modern browser (check CSP headers)" },
      { order: 6, instruction: "Test with different browser contexts (same-origin, cross-origin iframe)" },
      { order: 7, instruction: "Confirm the impact: cookie theft, session hijack, or DOM manipulation" },
    ],
    environment: ["Target app at reported version", "Modern browser with DevTools", "Proxy tool for request inspection"],
    tools: ["Burp Suite / OWASP ZAP", "Browser DevTools (Console + Network)", "curl for header inspection"],
  },
  sqli: {
    steps: [
      { order: 1, instruction: "Identify the injection point and the database backend (MySQL, PostgreSQL, MSSQL, SQLite)" },
      { order: 2, instruction: "Set up a local instance with a test database populated with sample data" },
      { order: 3, instruction: "Reproduce the exact query from the report (check parameterization)" },
      { order: 4, instruction: "Test with the reported payload — verify if output changes or errors appear" },
      { order: 5, instruction: "If blind injection: use time-based or boolean-based confirmation" },
      { order: 6, instruction: "Verify data exfiltration or privilege escalation is actually achievable" },
      { order: 7, instruction: "Check if ORM/prepared statements are in use at the reported code path" },
    ],
    environment: ["Target app at reported version", "Database with sample data", "SQL client for direct DB verification"],
    tools: ["sqlmap (for automated confirmation)", "Burp Suite / OWASP ZAP", "Database CLI client"],
  },
  ssrf: {
    steps: [
      { order: 1, instruction: "Identify the endpoint that accepts user-controlled URLs or hostnames" },
      { order: 2, instruction: "Set up a canary server (Burp Collaborator, interactsh, or local listener)" },
      { order: 3, instruction: "Submit a request pointing to the canary server — verify the callback" },
      { order: 4, instruction: "Test internal network access (127.0.0.1, 169.254.169.254, internal hostnames)" },
      { order: 5, instruction: "Check for protocol smuggling (file://, gopher://, dict://)" },
      { order: 6, instruction: "Verify if response data is returned to the attacker or blind SSRF only" },
      { order: 7, instruction: "Assess real impact: cloud metadata access, internal service interaction, port scanning" },
    ],
    environment: ["Target app at reported version", "Canary/callback server", "Access to internal network simulation"],
    tools: ["Burp Collaborator / interactsh", "curl", "ncat/netcat for listener"],
  },
  deserialization: {
    steps: [
      { order: 1, instruction: "Identify the deserialization entry point and the serialization format (Java, PHP, Python pickle, .NET)" },
      { order: 2, instruction: "Confirm the library and version used for deserialization" },
      { order: 3, instruction: "Generate a test gadget chain for the reported library/version" },
      { order: 4, instruction: "Send the serialized payload to the entry point" },
      { order: 5, instruction: "Verify execution via a canary (DNS callback, file write, sleep delay)" },
      { order: 6, instruction: "Assess if the gadget chain is actually available in the target classpath/environment" },
    ],
    environment: ["Target app at reported version", "Matching runtime (JDK version, PHP version, Python version)", "Canary server"],
    tools: ["ysoserial / phpggc / similar", "Burp Suite", "Decompiler (for classpath verification)"],
  },
  buffer_overflow: {
    steps: [
      { order: 1, instruction: "Identify the vulnerable function, input vector, and target architecture" },
      { order: 2, instruction: "Build the target from source at the reported version with debug symbols" },
      { order: 3, instruction: "Enable memory safety tools (ASan, Valgrind, or similar)" },
      { order: 4, instruction: "Reproduce the crash with the reported input/payload" },
      { order: 5, instruction: "Analyze the crash for exploitability (controllable EIP/RIP, heap metadata corruption)" },
      { order: 6, instruction: "Check if modern mitigations (ASLR, stack canaries, NX) affect exploitability" },
    ],
    environment: ["Target built from source with debug symbols", "Matching OS and architecture", "Debugger setup"],
    tools: ["GDB / LLDB", "AddressSanitizer (ASan)", "Valgrind", "pwntools / ROPgadget"],
  },
  path_traversal: {
    steps: [
      { order: 1, instruction: "Identify the file access endpoint and the user-controlled path parameter" },
      { order: 2, instruction: "Set up the target with known files at predictable paths" },
      { order: 3, instruction: "Test the reported traversal payload (../../../etc/passwd or equivalent)" },
      { order: 4, instruction: "Verify file contents are returned or an error leaks path information" },
      { order: 5, instruction: "Test for write/delete capabilities if claimed" },
      { order: 6, instruction: "Check if path canonicalization, chroot, or sandboxing limits the impact" },
    ],
    environment: ["Target app at reported version", "Known file layout for verification"],
    tools: ["curl / Burp Suite", "File system monitoring (inotifywait)", "strace (for syscall verification)"],
  },
  auth_bypass: {
    steps: [
      { order: 1, instruction: "Identify the auth mechanism (session cookie, JWT, OAuth, API key)" },
      { order: 2, instruction: "Set up two test accounts with different privilege levels" },
      { order: 3, instruction: "Reproduce the reported bypass: token manipulation, parameter tampering, or direct access" },
      { order: 4, instruction: "Verify that the lower-privilege user can access higher-privilege resources" },
      { order: 5, instruction: "Check if the bypass works across different authentication flows" },
      { order: 6, instruction: "Verify the scope of access gained (read-only vs. full CRUD)" },
    ],
    environment: ["Target app at reported version", "Multiple test accounts with different roles", "Token inspection setup"],
    tools: ["Burp Suite (Autorize extension)", "jwt.io / jwt_tool", "curl for direct API testing"],
  },
  race_condition: {
    steps: [
      { order: 1, instruction: "Identify the vulnerable operation and the race window" },
      { order: 2, instruction: "Set up the target with a measurable side effect (balance, counter, state change)" },
      { order: 3, instruction: "Send concurrent requests using the reported technique (parallel HTTP, threads)" },
      { order: 4, instruction: "Verify the state inconsistency (double-spend, duplicate action, privilege gain)" },
      { order: 5, instruction: "Measure the race window reliability (success rate over N attempts)" },
      { order: 6, instruction: "Check if the application uses locking, transactions, or idempotency keys" },
    ],
    environment: ["Target app at reported version", "Load testing setup", "Database with observable state"],
    tools: ["Burp Suite (Turbo Intruder)", "curl + GNU parallel", "Custom race condition script"],
  },
};

export function detectVulnClass(text: string): { vulnClass: VulnClass; label: string; confidence: number } {
  let bestClass: VulnClass = "unknown";
  let bestLabel = "Unknown Vulnerability Class";
  let bestScore = 0;

  for (const entry of VULN_CLASS_PATTERNS) {
    let matchCount = 0;
    for (const pattern of entry.patterns) {
      if (pattern.test(text)) matchCount++;
    }
    const score = matchCount / entry.patterns.length;
    if (score > bestScore) {
      bestScore = score;
      bestClass = entry.vulnClass;
      bestLabel = entry.label;
    }
  }

  const confidence = bestScore >= 0.4 ? 0.9 : bestScore >= 0.2 ? 0.6 : bestScore > 0 ? 0.3 : 0;

  return { vulnClass: bestClass, label: bestLabel, confidence };
}

export function generateReproGuidance(text: string): ReproGuidance | null {
  const { vulnClass, label, confidence } = detectVulnClass(text);

  if (vulnClass === "unknown" || confidence < 0.3) return null;

  const template = REPRO_TEMPLATES[vulnClass];
  return {
    vulnClass: label,
    confidence,
    steps: template.steps,
    environment: template.environment,
    tools: template.tools,
  };
}

export function analyzeGaps(
  text: string,
  evidence: EvidenceItem[],
  verification: VerificationResult | null,
  slopScore: number,
): GapItem[] {
  const gaps: GapItem[] = [];
  const lower = text.toLowerCase();

  const hasVersionInfo = /\b\d+\.\d+\.\d+\b/.test(text);
  if (!hasVersionInfo) {
    gaps.push({
      category: "missing_version",
      severity: "critical",
      description: "No software version numbers found in the report",
      suggestion: "Ask the reporter for exact affected versions, including minor/patch level and build identifiers",
    });
  }

  const hasCodeBlock = /```[\s\S]*?```/.test(text) || /^\s{4,}\S/m.test(text);
  const hasPocIndicator = /\b(?:proof[- ]?of[- ]?concept|poc|exploit|payload|reproduce)\b/i.test(text);
  if (!hasCodeBlock && !hasPocIndicator) {
    gaps.push({
      category: "missing_poc",
      severity: "critical",
      description: "No proof-of-concept code or reproduction payload found",
      suggestion: "Request a working PoC with exact HTTP requests/responses, code snippets, or command-line steps",
    });
  }

  const hasImpact = /\b(?:impact|consequence|severity|risk|damage|data\s*(?:loss|leak|exposure))\b/i.test(text);
  if (!hasImpact) {
    gaps.push({
      category: "missing_impact",
      severity: "important",
      description: "No clear impact statement or severity justification",
      suggestion: "Ask the reporter to describe the concrete security impact: what data is exposed, what actions an attacker can perform",
    });
  }

  const hasEnvironment = /\b(?:environment|setup|configuration|test(?:ing)?\s*(?:env|setup)|browser|os|platform)\b/i.test(text);
  if (!hasEnvironment) {
    gaps.push({
      category: "missing_environment",
      severity: "important",
      description: "No testing environment details provided",
      suggestion: "Request OS, browser version, server configuration, and any special setup needed to reproduce",
    });
  }

  const hasSteps = /\b(?:step\s*\d|steps?\s*to\s*reproduce|reproduction\s*steps|how\s*to\s*reproduce)\b/i.test(text);
  if (!hasSteps && !hasCodeBlock) {
    gaps.push({
      category: "missing_repro_steps",
      severity: "critical",
      description: "No explicit reproduction steps found",
      suggestion: "Request numbered step-by-step instructions starting from a clean state",
    });
  }

  const hasFix = /\b(?:fix|patch|remediat|mitigat|recommendation|workaround)\b/i.test(text);
  if (!hasFix) {
    gaps.push({
      category: "missing_remediation",
      severity: "minor",
      description: "No remediation recommendation or fix suggestion provided",
      suggestion: "Optional but useful: ask if the reporter has a suggested fix or has tested any mitigations",
    });
  }

  const hasHttpDetail = /\b(?:HTTP\/|GET |POST |PUT |DELETE |PATCH |request|response|header|cookie|status\s*code)\b/i.test(text);
  const isWebVuln = /\b(?:XSS|SSRF|SQL|CSRF|injection|redirect|traversal)\b/i.test(text);
  if (isWebVuln && !hasHttpDetail) {
    gaps.push({
      category: "missing_http_detail",
      severity: "important",
      description: "Web vulnerability reported without HTTP request/response details",
      suggestion: "Request the full HTTP request (method, URL, headers, body) and the server response showing the vulnerability",
    });
  }

  const placeholderEvidence = evidence.filter(e => e.type === "placeholder_url" || e.type === "generic_path");
  if (placeholderEvidence.length > 0) {
    gaps.push({
      category: "placeholder_artifacts",
      severity: "critical",
      description: `${placeholderEvidence.length} placeholder URL(s) or generic path(s) detected in the report`,
      suggestion: "These are strong indicators of AI-generated content. Request real URLs, paths, and endpoints from the reporter's actual testing",
    });
  }

  if (verification) {
    const notFoundCount = verification.summary.notFound;
    if (notFoundCount >= 2) {
      gaps.push({
        category: "unverifiable_references",
        severity: "critical",
        description: `${notFoundCount} referenced items could not be verified against live sources`,
        suggestion: "The reporter references files, functions, or CVEs that don't exist. Challenge them to provide correct references",
      });
    }
  }

  const hasCvss = /\bCVSS\b/i.test(text);
  const hasCwe = /\bCWE-\d+\b/i.test(text);
  if (lower.includes("critical") || lower.includes("high severity")) {
    if (!hasCvss) {
      gaps.push({
        category: "missing_cvss",
        severity: "minor",
        description: "High severity claimed but no CVSS vector or score provided",
        suggestion: "Request a CVSS 3.1 vector string to validate the severity claim",
      });
    }
  }

  return gaps.sort((a, b) => {
    const order = { critical: 0, important: 1, minor: 2 };
    return order[a.severity] - order[b.severity];
  });
}

export function analyzeDontMiss(
  text: string,
  evidence: EvidenceItem[],
  verification: VerificationResult | null,
  slopScore: number,
): DontMissItem[] {
  const items: DontMissItem[] = [];
  const lower = text.toLowerCase();

  const chainPattern = /\b(?:chain(?:ed|ing)?|combin(?:ed|ing)|together\s*with|escalat|pivot|lateral)\b/i;
  if (chainPattern.test(text)) {
    items.push({
      area: "Attack Chain",
      warning: "Report describes chained vulnerabilities — evaluate each link independently",
      reason: "AI-generated reports often describe idealized multi-step attacks where individual steps may not work. Verify each stage separately before accepting the full chain.",
    });
  }

  const rcePattern = /\b(?:remote\s*code\s*execution|RCE|arbitrary\s*code|command\s*(?:injection|execution))\b/i;
  if (rcePattern.test(text)) {
    items.push({
      area: "RCE Claim",
      warning: "Remote code execution claimed — verify the execution context and privilege level",
      reason: "RCE is the highest-impact claim. Confirm the payload actually executes (not just injected), check the process privilege level, and test if sandboxing/containers limit the blast radius.",
    });
  }

  const multiCve = text.match(/CVE-\d{4}-\d{4,}/gi);
  if (multiCve && multiCve.length >= 3) {
    items.push({
      area: "Multiple CVEs",
      warning: `Report references ${multiCve.length} CVEs — verify each is relevant to the actual finding`,
      reason: "Mass-generated reports often list multiple CVEs to appear thorough. Check if each CVE actually applies to the reported version and component.",
    });
  }

  if (verification) {
    const verifiedItems = verification.checks.filter(c => c.result === "verified");
    const notFoundItems = verification.checks.filter(c => c.result === "not_found");
    if (verifiedItems.length > 0 && notFoundItems.length > 0) {
      items.push({
        area: "Mixed Verification",
        warning: "Some references verified but others failed — the report may mix real research with fabricated details",
        reason: "Sophisticated AI-generated reports copy-paste real file paths and CVEs, then add fabricated details. The verified items don't guarantee the vulnerability is real.",
      });
    }
  }

  if (slopScore >= 40 && slopScore <= 60) {
    items.push({
      area: "Ambiguous Score",
      warning: "Slop score is in the ambiguous zone — don't rely on automated scoring alone",
      reason: "Scores between 40-60 mean the automated analysis is uncertain. Human review of the technical details is essential. Look for unique observations that only hands-on testing would produce.",
    });
  }

  const scopeCreep = /\b(?:additionally|furthermore|moreover|also\s*(?:found|discovered|noticed)|another\s*(?:vuln|issue|finding))\b/i;
  if (scopeCreep.test(text) && (text.match(scopeCreep) || []).length >= 2) {
    items.push({
      area: "Scope Creep",
      warning: "Report covers multiple findings — evaluate if each finding meets the bar independently",
      reason: "Some reporters bundle weak findings together to inflate perceived severity. Each finding should be triaged on its own merit.",
    });
  }

  const hasNightTimestamp = /\b(?:0[0-4]:[0-5]\d(?::\d{2})?\s*(?:UTC|GMT))\b/i.test(text);
  const fabricatedEvidence = evidence.filter(e =>
    e.type === "fake_asan" || e.type === "fake_registers" || e.type === "repeating_stack"
  );
  if (fabricatedEvidence.length > 0) {
    items.push({
      area: "Fabricated Debug Output",
      warning: "Debug output (ASan, stack traces, register dumps) appears fabricated",
      reason: "AI-generated reports sometimes include plausible-looking but fake debug output. Compare against what the actual tool/sanitizer would produce for this class of bug.",
    });
  }

  return items;
}

export function generateReporterFeedback(
  text: string,
  slopScore: number,
  confidence: number,
  gaps: GapItem[],
  verification: VerificationResult | null,
): ReporterFeedbackItem[] {
  const feedback: ReporterFeedbackItem[] = [];

  if (slopScore <= 20 && confidence >= 0.7) {
    feedback.push({
      tone: "positive",
      message: "This report shows strong indicators of genuine research. The writing style, technical detail level, and verified references are consistent with hands-on security testing.",
    });
  } else if (slopScore >= 70) {
    feedback.push({
      tone: "concern",
      message: "This report has significant AI-generation indicators. If requesting revisions, ask the reporter to provide environment-specific details, exact reproduction steps from their own testing, and raw tool output rather than summarized findings.",
    });
  }

  const criticalGaps = gaps.filter(g => g.severity === "critical");
  if (criticalGaps.length > 0) {
    const gapNames = criticalGaps.map(g => g.category.replace(/_/g, " ")).join(", ");
    feedback.push({
      tone: "neutral",
      message: `Key information gaps detected: ${gapNames}. Consider sending a structured follow-up requesting these specific items before investing time in reproduction.`,
    });
  }

  if (verification) {
    const verifiedCount = verification.summary.verified;
    const notFoundCount = verification.summary.notFound;
    if (verifiedCount >= 2 && notFoundCount === 0) {
      feedback.push({
        tone: "positive",
        message: `${verifiedCount} technical references were independently verified. The reporter appears to have tested against real code/infrastructure.`,
      });
    } else if (notFoundCount >= 2 && verifiedCount === 0) {
      feedback.push({
        tone: "concern",
        message: `${notFoundCount} referenced items could not be found in live sources. Consider asking the reporter to double-check their references before proceeding.`,
      });
    }
  }

  const hasPoliteOpening = /\b(?:dear\s*(?:team|sir|madam)|to\s*whom\s*it\s*may\s*concern|i\s*hope\s*this\s*(?:email|message)\s*finds\s*you)\b/i.test(text);
  if (hasPoliteOpening) {
    feedback.push({
      tone: "neutral",
      message: "Report uses formal/template-style opening language common in mass-submitted reports. This alone isn't conclusive but combined with other signals may indicate automated submission.",
    });
  }

  if (feedback.length === 0) {
    feedback.push({
      tone: "neutral",
      message: "No strong positive or negative indicators about reporter behavior. Proceed with standard triage workflow.",
    });
  }

  return feedback;
}

export function generateTriageAssistant(
  text: string,
  slopScore: number,
  confidence: number,
  evidence: EvidenceItem[],
  verification: VerificationResult | null,
  llmTriageGuidance: LLMTriageGuidance | null,
): TriageAssistantResult {
  const reproGuidance = generateReproGuidance(text);
  const gaps = analyzeGaps(text, evidence, verification, slopScore);
  const dontMiss = analyzeDontMiss(text, evidence, verification, slopScore);
  const reporterFeedback = generateReporterFeedback(text, slopScore, confidence, gaps, verification);

  return {
    reproGuidance,
    gaps,
    dontMiss,
    reporterFeedback,
    llmTriageGuidance,
  };
}
