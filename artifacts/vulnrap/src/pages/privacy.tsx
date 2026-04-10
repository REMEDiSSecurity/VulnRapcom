import { Shield, Lock, FileText, Database, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function Privacy() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-bold uppercase tracking-tight flex items-center gap-2">
          <Shield className="w-8 h-8 text-primary" />
          Privacy & Security
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          We take the security of vulnerability reports seriously. Understand exactly what data we process, how we store it, and your options for keeping zero-days confidential.
        </p>
      </div>

      <div className="space-y-6">
        <Card className="bg-card/40 backdrop-blur border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wide text-sm text-muted-foreground flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Submission Modes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-primary mb-2">Similarity Only Mode (Recommended for Zero-Days)</h3>
              <p className="text-sm leading-relaxed mb-4">
                In "Similarity Only" mode, the platform extracts structural features and generates a cryptographic hash (SHA-256) of your report content. The original file and all plaintext content are <strong>immediately discarded from memory</strong> after analysis. We only store the mathematical representation required to match future reports against yours.
              </p>
              <ul className="text-sm space-y-2 list-disc pl-5 text-muted-foreground marker:text-primary">
                <li>Content is never written to disk</li>
                <li>Cannot be reverse-engineered back to original text</li>
                <li>Matches will flag future duplicates without revealing your exploit</li>
              </ul>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="text-lg font-bold text-secondary mb-2">Full Storage Mode</h3>
              <p className="text-sm leading-relaxed mb-4">
                In "Full Storage" mode, we encrypt and securely store the contents of your report. This helps improve the community dataset, allowing our AI to better detect subtle variations of previously reported bugs.
              </p>
              <ul className="text-sm space-y-2 list-disc pl-5 text-muted-foreground marker:text-secondary">
                <li>Data encrypted at rest using AES-256</li>
                <li>Used to train the sloppiness detection models</li>
                <li>Improves semantic matching for the broader community</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card/40 backdrop-blur border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-wide text-sm text-muted-foreground flex items-center gap-2">
                <Server className="w-4 h-4" />
                Infrastructure
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3 text-muted-foreground">
              <p>VulnRap does not share data with any bug bounty platforms (HackerOne, Bugcrowd, YesWeHack) or vendors.</p>
              <p>Our analysis nodes run in ephemeral, isolated containers. All network traffic is forced through TLS 1.3.</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-wide text-sm text-muted-foreground flex items-center gap-2">
                <FileText className="w-4 h-4" />
                No Attribution
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3 text-muted-foreground">
              <p>We do not track user accounts, IP addresses, or browser fingerprints. Submissions are entirely anonymous.</p>
              <p>If your report contains PII or target coordinates, please redact them prior to upload, regardless of submission mode.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
