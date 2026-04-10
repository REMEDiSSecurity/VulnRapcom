import { Link, useLocation } from "react-router-dom";
import { Activity, Shield, Search, Code, BookOpen, Target, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import logoSrc from "@/assets/logo.png";
import { LaserEffects } from "@/components/laser-effects";
import { CursorBugs } from "@/components/cursor-bugs";

function feedbackMailto(page: string) {
  const subject = encodeURIComponent("VulnRap Feedback");
  const body = encodeURIComponent(
    `Hi VulnRap team,\n\nI wanted to share some feedback:\n\n[Your feedback here]\n\n---\nPage: ${page}`
  );
  return `mailto:remedisllc@gmail.com?subject=${subject}&body=${body}`;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="laser-content-layer min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary selection:text-primary-foreground">
      <div className="cyber-grid" aria-hidden="true" />
      <LaserEffects />
      <CursorBugs />
      <header className="nav-glass sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img src={logoSrc} alt="VulnRap" className="w-8 h-8 rounded-sm transition-transform group-hover:scale-110" />
            <span className="font-bold text-xl tracking-tight uppercase text-primary glow-text-sm transition-all group-hover:glow-text">VulnRap</span>
          </Link>
          <nav className="flex items-center gap-1">
            {[
              { to: "/", label: "Submit", icon: null, match: pathname === "/" },
              { to: "/check", label: "Check", icon: <Search className="w-3.5 h-3.5" />, match: pathname === "/check" },
              { to: "/stats", label: "Stats", icon: <Activity className="w-3.5 h-3.5" />, match: pathname === "/stats" },
              { to: "/use-cases", label: "Use Cases", icon: <Target className="w-3.5 h-3.5" />, match: pathname === "/use-cases" },
              { to: "/developers", label: "API", icon: <Code className="w-3.5 h-3.5" />, match: pathname === "/developers" },
              { to: "/blog", label: "Blog", icon: <BookOpen className="w-3.5 h-3.5" />, match: pathname === "/blog" },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "text-sm font-medium transition-all px-3 py-1.5 rounded-md flex items-center gap-1.5",
                  item.match
                    ? "text-primary bg-primary/10 glow-text-sm"
                    : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="footer-gradient py-10 mt-auto">
        <div className="container mx-auto px-4 flex flex-col items-center gap-4 text-xs text-muted-foreground">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-2.5">
              <img src={logoSrc} alt="" className="w-5 h-5 rounded-sm opacity-50" />
              <span className="text-muted-foreground/70">VulnRap // Free & Anonymous Vulnerability Report Validation — made by and for frustrated PSIRTlings</span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 justify-center md:justify-end">
              <Link to="/use-cases" className="hover:text-primary transition-colors">Use Cases</Link>
              <Link to="/developers" className="hover:text-primary transition-colors">API Docs</Link>
              <Link to="/blog" className="hover:text-primary transition-colors">Blog</Link>
              <Link to="/security" className="hover:text-primary transition-colors">Security</Link>
              <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-primary transition-colors">Terms</Link>
              <Link to="/stats" className="hover:text-primary transition-colors">Stats</Link>
            </div>
          </div>
          <div className="w-16 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          <a
            href={`mailto:remedisllc@gmail.com?subject=${encodeURIComponent("VulnRap Feedback")}&body=${encodeURIComponent("Hi VulnRap team,\n\nI wanted to share some feedback:\n\n[Your feedback here]\n\n---\nSent from " + window.location.href)}`}
            className="inline-flex items-center gap-1.5 text-muted-foreground/50 hover:text-primary transition-colors group"
          >
            <MessageSquare className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
            <span>Send us feedback</span>
          </a>
          <div className="w-16 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          <span className="text-[10px] text-muted-foreground/30">Funded and developed by the creators of <a href="https://complitt.com" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground/50 transition-colors">COMPLiTT.com</a> and <a href="https://remedissecurity.com" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground/50 transition-colors">REMEDiSSecurity.com</a></span>
        </div>
      </footer>
    </div>
  );
}
