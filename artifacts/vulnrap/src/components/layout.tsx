import { Link, useLocation } from "wouter";
import { Terminal, Activity, Shield, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-mono selection:bg-primary selection:text-primary-foreground">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
            <Terminal className="w-6 h-6" />
            <span className="font-bold text-xl tracking-tight uppercase">VulnRap</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/" className={cn("text-sm font-medium transition-colors hover:text-primary", location === "/" ? "text-primary" : "text-muted-foreground")}>
              Analyze
            </Link>
            <Link href="/stats" className={cn("text-sm font-medium transition-colors hover:text-primary flex items-center gap-1", location === "/stats" ? "text-primary" : "text-muted-foreground")}>
              <Activity className="w-4 h-4" /> Stats
            </Link>
            <Link href="/privacy" className={cn("text-sm font-medium transition-colors hover:text-primary flex items-center gap-1", location === "/privacy" ? "text-primary" : "text-muted-foreground")}>
              <Shield className="w-4 h-4" /> Privacy
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-border py-8 mt-auto">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            <span>VulnRap Platform // Anonymous Validation</span>
          </div>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <a href="#" className="hover:text-primary transition-colors">API Docs</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
