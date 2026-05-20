import { Link } from "react-router-dom";
import { Radio, Shield, Zap } from "lucide-react";

export default function AppFooter() {
  return (
    <footer className="w-full shrink-0 border-t border-border/60 bg-background/90 backdrop-blur-md">
      <div className="flex flex-col items-center gap-3 px-4 py-4 sm:flex-row sm:justify-between sm:text-left">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Radio className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold">CrisisGrid</span>
            <span className="text-[10px] text-muted-foreground">Real-time emergency coordination</span>
          </div>
          <div className="ml-2 flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5">
            <Zap className="h-2.5 w-2.5 text-emerald-400" />
            <span className="text-[10px] font-semibold text-emerald-400">CIRO</span>
          </div>
        </div>

        {/* Links */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-foreground">Home</Link>
          <Link to="/contact" className="transition-colors hover:text-foreground">Contact</Link>
          <Link to="/signin" className="transition-colors hover:text-foreground">Sign In</Link>
          <Link to="/signup" className="transition-colors hover:text-foreground">Sign Up</Link>
        </div>

        {/* Badge */}
        <div className="hidden items-center gap-1.5 text-[10px] text-muted-foreground sm:flex">
          <Shield className="h-3 w-3" />
          <span>Powered by Google Antigravity</span>
        </div>
      </div>
    </footer>
  );
}
