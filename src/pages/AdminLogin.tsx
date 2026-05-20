import { Eye, EyeOff, Loader2, Radio, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { api, setAuthToken } from "@/lib/api";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email.trim()) e.email = "Email is required";
    if (!form.password) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const result = await api.login({
        email: form.email.trim(),
        password: form.password,
      });

      if (result.user.role !== "ADMIN") {
        toast.error("Access denied. Admin credentials required.");
        return;
      }

      setAuthToken(result.token);
      localStorage.setItem("crisisgrid_user", JSON.stringify(result.user));
      toast.success("Welcome to Command Center");
      navigate("/admin");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,hsl(var(--destructive)/0.08),transparent_50%),radial-gradient(circle_at_20%_80%,hsl(var(--primary)/0.10),transparent_40%)]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold tracking-wide">
            <Radio className="h-6 w-6 text-primary" />
            CrisisGrid
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">Organization & NGO Administration Portal</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-destructive/20 bg-[hsl(var(--surface-glass))/0.85] p-6 backdrop-blur sm:p-8"
        >
          <div className="flex items-center gap-3 border-b border-border/40 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
              <ShieldCheck className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Admin Access</h2>
              <p className="text-xs text-muted-foreground">Authorized personnel only</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-email">Admin Email</Label>
            <Input
              id="admin-email"
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="admin@organization.org"
              className={cn("h-11", errors.email && "border-destructive")}
              data-testid="input-admin-email"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-password">Password</Label>
            <div className="relative">
              <Input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                placeholder="Enter admin password"
                className={cn("h-11 pr-10", errors.password && "border-destructive")}
                data-testid="input-admin-password"
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

          <Button type="submit" className="h-12 w-full bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isSubmitting} data-testid="button-admin-login">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              "Access Command Center"
            )}
          </Button>

          <div className="border-t border-border/40 pt-4 text-center">
            <Link to="/signin" className="text-xs text-muted-foreground hover:text-foreground">
              Regular User Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
