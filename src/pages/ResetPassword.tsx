import { Eye, EyeOff, KeyRound, Loader2, Radio } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.password) e.password = "Password is required";
    else if (form.password.length < 6) e.password = "Password must be at least 6 characters";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match";
    if (!token) e.token = "Invalid or missing reset token";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await api.resetPassword(token, form.password);
      setDone(true);
      toast.success("Password reset successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reset failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Invalid Reset Link</h2>
          <p className="mt-2 text-sm text-muted-foreground">This password reset link is invalid or has expired.</p>
          <Link to="/forgot-password" className="mt-4 inline-block text-sm text-primary hover:underline">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

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
          {!done ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center gap-3 border-b border-border/40 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <KeyRound className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Set New Password</h2>
                  <p className="text-xs text-muted-foreground">Choose a strong password for your account</p>
                </div>
              </div>

              {errors.token && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {errors.token}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, password: e.target.value }));
                      if (errors.password) setErrors((p) => ({ ...p, password: "" }));
                    }}
                    placeholder="Min 6 characters"
                    className={cn("h-11 pr-10", errors.password && "border-destructive")}
                    data-testid="input-new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, confirmPassword: e.target.value }));
                    if (errors.confirmPassword) setErrors((p) => ({ ...p, confirmPassword: "" }));
                  }}
                  placeholder="Re-enter password"
                  className={cn("h-11", errors.confirmPassword && "border-destructive")}
                  data-testid="input-confirm-new-password"
                />
                {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
              </div>

              <Button type="submit" className="h-12 w-full" disabled={isSubmitting} data-testid="button-reset-password">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--status-claimed))]/15">
                <KeyRound className="h-6 w-6 text-[hsl(var(--status-claimed))]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Password Updated</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your password has been successfully reset. You can now sign in with your new password.
                </p>
              </div>
              <Button onClick={() => navigate("/signin")} className="h-11 w-full" data-testid="button-goto-signin">
                Go to Sign In
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
