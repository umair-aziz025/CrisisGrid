import { Eye, EyeOff, Loader2, LogIn, Radio, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { api, setAuthToken } from "@/lib/api";

type Step = "credentials" | "totp";

const SignIn = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("credentials");
  const [form, setForm] = useState({ email: "", password: "" });
  const [totpCode, setTotpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email.trim()) {
      e.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      e.email = "Enter a valid email address (e.g. you@example.com)";
    }
    if (!form.password) {
      e.password = "Password is required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const result = await api.login({ email: form.email.trim(), password: form.password });

      if (result.requiresTwoFactor) {
        setTwoFactorToken(result.twoFactorToken);
        setTotpCode("");
        setBackupCode("");
        setUseBackupCode(false);
        setStep("totp");
        return;
      }

      finishLogin(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTotpSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setIsSubmitting(true);
    try {
      let result;
      if (useBackupCode) {
        const normalized = backupCode.trim().toUpperCase();
        if (!normalized) { setErrors({ totp: "Enter a backup code" }); setIsSubmitting(false); return; }
        result = await api.verify2FALogin({ twoFactorToken, backupCode: normalized });
      } else {
        const code = totpCode.replace(/\s/g, "");
        if (code.length !== 6 || !/^\d{6}$/.test(code)) {
          setErrors({ totp: "Enter a valid 6-digit code" }); setIsSubmitting(false); return;
        }
        result = await api.verify2FALogin({ twoFactorToken, code });
      }
      finishLogin(result);
    } catch (error) {
      setErrors({ totp: error instanceof Error ? error.message : "Invalid code" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const finishLogin = (result: any) => {
    setAuthToken(result.token);
    localStorage.setItem("crisisgrid_user", JSON.stringify(result.user));
    toast.success("Welcome back!");
    if (result.user.role === "ADMIN" || result.user.role === "SUPERADMIN" || result.user.role === "STAFF") {
      navigate("/admin");
    } else {
      navigate("/dashboard");
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.15),transparent_50%),radial-gradient(circle_at_70%_80%,hsl(var(--crisis-rescue)/0.10),transparent_40%)]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold tracking-wide">
            <Radio className="h-6 w-6 text-primary" />
            CrisisGrid
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to access the coordination platform</p>
        </div>

        <div className="rounded-2xl border border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.85] p-6 backdrop-blur sm:p-8">
          {step === "credentials" ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center gap-3 border-b border-border/40 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <LogIn className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Welcome Back</h2>
                  <p className="text-xs text-muted-foreground">Enter your credentials to continue</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="you@example.com"
                  className={cn("h-11", errors.email && "border-destructive")}
                  data-testid="input-login-email"
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary" data-testid="link-forgot-password">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    placeholder="Enter your password"
                    className={cn("h-11 pr-10", errors.password && "border-destructive")}
                    data-testid="input-login-password"
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

              <Button type="submit" className="h-12 w-full text-base" disabled={isSubmitting} data-testid="button-login">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing In...</> : "Sign In"}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/signup" className="font-medium text-primary hover:underline" data-testid="link-signup">
                  Create Account
                </Link>
              </div>

              <div className="border-t border-border/40 pt-4">
                <Link to="/admin/login" className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground" data-testid="link-admin-login">
                  Organization / Admin Portal
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleTotpSubmit} className="space-y-5">
              <div className="flex items-center gap-3 border-b border-border/40 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Two-Factor Authentication</h2>
                  <p className="text-xs text-muted-foreground">
                    {useBackupCode ? "Enter one of your saved backup codes" : "Open your authenticator app and enter the 6-digit code"}
                  </p>
                </div>
              </div>

              {useBackupCode ? (
                <div className="space-y-1.5">
                  <Label htmlFor="backup-code">Backup Code</Label>
                  <Input
                    id="backup-code"
                    value={backupCode}
                    onChange={(e) => { setBackupCode(e.target.value.toUpperCase()); setErrors({}); }}
                    placeholder="XXXX-XXXX"
                    autoComplete="off"
                    className={cn("h-14 text-center text-xl font-mono tracking-widest", errors.totp && "border-destructive")}
                    autoFocus
                  />
                  {errors.totp ? (
                    <p className="text-xs text-destructive">{errors.totp}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center">Each backup code can only be used once.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="totp-code">Authentication Code</Label>
                  <Input
                    id="totp-code"
                    value={totpCode}
                    onChange={(e) => { setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setErrors({}); }}
                    placeholder="000000"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className={cn("h-14 text-center text-2xl tracking-widest font-mono", errors.totp && "border-destructive")}
                    autoFocus
                  />
                  {errors.totp ? (
                    <p className="text-xs text-destructive">{errors.totp}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center">Code refreshes every 30 seconds</p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="h-12 w-full text-base"
                disabled={isSubmitting || (!useBackupCode && totpCode.length !== 6) || (useBackupCode && !backupCode.trim())}
              >
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : "Verify & Sign In"}
              </Button>

              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setUseBackupCode((p) => !p); setErrors({}); setTotpCode(""); setBackupCode(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {useBackupCode ? "← Use authenticator app instead" : "Use a backup code instead"}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("credentials"); setErrors({}); setTotpCode(""); setBackupCode(""); setUseBackupCode(false); }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ← Back to sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignIn;
