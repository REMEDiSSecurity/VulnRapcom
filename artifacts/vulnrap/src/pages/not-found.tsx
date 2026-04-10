import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4">
        <AlertTriangle className="w-16 h-16 text-destructive mx-auto" />
        <h1 className="text-4xl font-bold uppercase tracking-tight">404</h1>
        <p className="text-muted-foreground">The requested page could not be found.</p>
        <Button variant="outline" asChild>
          <Link to="/">Return to Home</Link>
        </Button>
      </div>
    </div>
  );
}
