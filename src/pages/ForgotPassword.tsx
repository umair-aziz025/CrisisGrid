import { ArrowLeft, Loader2, Mail, Radio } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.forgotPassword(email.trim());
      setSent(true);
      if (result.resetToken) {
        setResetToken(result.resetToken);
      }
      toast.success("Password reset instructions sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.15),transparent_50%)]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold tracking-wide">
            <Radio className="h-6 w-6 text-primary" />
            CrisisGrid
          </Link>
        </div>

        <div className="rounded-2xl border border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.85] p-6 backdrop-blur sm:p-8">
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center gap-3 border-b border-border/40 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Forgot Password</h2>
                  <p className="text-xs text-muted-foreground">We'll help you reset your password</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  placeholder="you@example.com"
                  className={cn("h-11", error && "border-destructive")}
                  data-testid="input-forgot-email"
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>

              <Button type="submit" className="h-12 w-full" disabled={isSubmitting} data-testid="button-reset-request">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>

              <Link
                to="/signin"
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Sign In
              </Link>
            </form>
          ) : (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--status-claimed))]/15">
                <Mail className="h-6 w-6 text-[hsl(var(--status-claimed))]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Check Your Email</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  If an account exists for <span className="font-medium text-foreground">{email}</span>, password
                  reset instructions have been sent.
                </p>
              </div>

              {resetToken && (
                <div className="rounded-lg border border-border/60 bg-background/30 p-4 text-left">
                  <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Development Mode - Reset Link:
                  </p>
                  <Link
                    to={`/reset-password?token=${resetToken}`}
                    className="text-sm text-primary hover:underline break-all"
                    data-testid="link-reset-password"
                  >
                    Click here to reset password
                  </Link>
                </div>
              )}

              <Link
                to="/signin"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
