import { Shield, Lock, FileText, Database, Server, Eye, Fingerprint, Users, Globe, Trash2, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";
import logoSrc from "@/assets/logo.png";

export default function Privacy() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-bold uppercase tracking-tight flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          Privacy Policy & Data Practices
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl leading-relaxed">
          VulnRap is built on the principle that security researchers should be able to validate their work without exposing their findings. Here is exactly what we do with your data, why we do it, and how it helps the ecosystem.
        </p>
      </div>

      <Card className="bg-card/40 backdrop-blur border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <img src={logoSrc} alt="" className="w-6 h-6 rounded-sm" />
            Why VulnRap Exists
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            Bug bounty programs are drowning in low-quality, duplicate, and AI-generated reports. Triage teams waste hours filtering noise while legitimate researchers wait longer for their reports to be reviewed. VulnRap exists to help both sides:
          </p>
          <ul className="space-y-2 list-disc pl-5">
            <li><strong className="text-foreground">For researchers:</strong> Check if your report has been submitted before, get an honest assessment of quality, and improve your report before submission.</li>
            <li><strong className="text-foreground">For the ecosystem:</strong> Every report analyzed improves our fingerprint corpus. When a researcher discovers their report matches an existing one, that saves everyone time -- theirs, the triage team's, and the program's.</li>
            <li><strong className="text-foreground">For trust:</strong> Platforms can point researchers here as a pre-submission check, reducing duplicate submissions and AI slop before they clog the pipeline.</li>
          </ul>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <h2 className="text-xl font-bold uppercase tracking-tight flex items-center gap-2">
          <Lock className="w-5 h-5 text-primary" />
          Data Collection & Storage
        </h2>

        <Card className="bg-card/40 backdrop-blur border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wide text-sm text-muted-foreground flex items-center gap-2">
              <Fingerprint className="w-4 h-4" />
              Similarity Only Mode (Default)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">
              In this mode, we extract structural features from your report and generate mathematical fingerprints. The original file and all plaintext content are <strong>immediately discarded from memory</strong> after analysis completes. We never write your content to disk.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-bold">What we store:</h4>
              <ul className="text-sm space-y-1.5 text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-primary mt-1 flex-shrink-0">--</span> SHA-256 content hash (for exact-match deduplication)</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1 flex-shrink-0">--</span> MinHash signature (128 hash values for fuzzy matching)</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1 flex-shrink-0">--</span> Simhash fingerprint (single 64-bit structural hash)</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1 flex-shrink-0">--</span> AI sloppiness score and tier classification</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1 flex-shrink-0">--</span> File name and size (metadata only)</li>
              </ul>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-bold">What we do NOT store:</h4>
              <ul className="text-sm space-y-1.5 text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-destructive mt-1 flex-shrink-0">x</span> Original report text or file content</li>
                <li className="flex items-start gap-2"><span className="text-destructive mt-1 flex-shrink-0">x</span> IP addresses, browser fingerprints, or cookies</li>
                <li className="flex items-start gap-2"><span className="text-destructive mt-1 flex-shrink-0">x</span> User accounts or any personal identifiers</li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground italic">
              The stored hashes cannot be reverse-engineered to recover your original report content. They are one-way mathematical transformations.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wide text-sm text-muted-foreground flex items-center gap-2">
              <Database className="w-4 h-4" />
              Full Storage Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">
              In this mode, we store everything from Similarity Only mode <strong>plus</strong> the full text content of your report. This is a voluntary opt-in that helps improve the quality of the community corpus.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-bold">How stored content helps the ecosystem:</h4>
              <ul className="text-sm space-y-1.5 text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-primary mt-1 flex-shrink-0">--</span> Enables semantic (meaning-based) matching beyond just structural fingerprints</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1 flex-shrink-0">--</span> Improves sloppiness scoring calibration with real-world examples</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1 flex-shrink-0">--</span> Builds a richer corpus so future researchers get better duplicate detection</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1 flex-shrink-0">--</span> Helps identify common patterns in AI-generated reports</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground">
              We recommend this mode for reports covering already-disclosed vulnerabilities, public CVEs, or general research where confidentiality is not a concern.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-bold uppercase tracking-tight flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary" />
          Anonymity & Tracking
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card/40 backdrop-blur border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-wide text-sm text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                No User Accounts
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3 text-muted-foreground leading-relaxed">
              <p>VulnRap does not require registration, login, or any form of identification. There are no user accounts, no email collection, and no OAuth flows.</p>
              <p>Every submission is treated as an independent, anonymous event. We cannot correlate multiple submissions to the same person.</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-wide text-sm text-muted-foreground flex items-center gap-2">
                <Globe className="w-4 h-4" />
                No Analytics or Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3 text-muted-foreground leading-relaxed">
              <p>We do not use Google Analytics, Mixpanel, Hotjar, or any third-party analytics, tracking pixels, or advertising scripts.</p>
              <p>No cookies are set. No browser fingerprinting is performed. Server logs are ephemeral and do not record client IP addresses.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-bold uppercase tracking-tight flex items-center gap-2">
          <Server className="w-5 h-5 text-primary" />
          Security & Infrastructure
        </h2>

        <Card className="bg-card/40 backdrop-blur border-border">
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" />
                  Transport Security
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  All connections are encrypted via TLS. File uploads are transmitted over HTTPS and processed in memory. Rate limiting prevents abuse.
                </p>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Platform Independence
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  VulnRap is not affiliated with any bug bounty platform (HackerOne, Bugcrowd, Intigriti, YesWeHack). We do not share data with vendors, programs, or third parties.
                </p>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  File Handling
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Uploaded files are validated server-side (extension, size, content type). Files are processed in memory and never temporarily written to disk. Maximum file size is 20MB.
                </p>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-primary" />
                  Data Lifecycle
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  In Similarity Only mode, content exists only in process memory during analysis (typically under 2 seconds). Hashes are stored indefinitely to maintain corpus accuracy.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/40 backdrop-blur border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" />
            Your Rights & Responsibilities
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <div className="space-y-3">
            <h3 className="font-bold text-foreground">Researcher Responsibility</h3>
            <p>
              If your report contains personally identifiable information (PII), target credentials, API keys, or other sensitive data beyond the vulnerability description itself, redact these before uploading regardless of which privacy mode you select.
            </p>
          </div>
          <Separator />
          <div className="space-y-3">
            <h3 className="font-bold text-foreground">Report Results</h3>
            <p>
              Analysis results are accessible via a shareable link containing the report's numeric ID. Anyone with this link can view the analysis results (sloppiness score, similarity matches, feedback). No original content is exposed through these links in Similarity Only mode.
            </p>
          </div>
          <Separator />
          <div className="space-y-3">
            <h3 className="font-bold text-foreground">Open Source & Transparency</h3>
            <p>
              VulnRap's similarity engine uses deterministic, seeded algorithms (SHA-256 for hashing, MinHash with 128 permutations for fuzzy matching, Simhash for structural similarity). The scoring is fully heuristic-based with no opaque ML models. What you see is what runs.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="text-center py-4 text-xs text-muted-foreground space-y-2">
        <p>Questions about our data practices? This policy was written to be comprehensive, not to hide anything.</p>
        <p>
          <Link to="/" className="text-primary hover:underline">Back to Report Validation</Link>
        </p>
      </div>
    </div>
  );
}
