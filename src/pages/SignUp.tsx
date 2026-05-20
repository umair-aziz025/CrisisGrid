import { Eye, EyeOff, Loader2, Radio, UserPlus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { api, setAuthToken } from "@/lib/api";

const SignUp = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    address: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};

    // Full name: letters and spaces only, no numbers or symbols
    if (!form.fullName.trim()) {
      e.fullName = "Full name is required";
    } else if (!/^[a-zA-Z\s]+$/.test(form.fullName.trim())) {
      e.fullName = "Name must contain letters only — no numbers or symbols";
    } else if (form.fullName.trim().length < 2) {
      e.fullName = "Name must be at least 2 characters";
    }

    // Email
    if (!form.email.trim()) {
      e.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      e.email = "Enter a valid email address (e.g. you@example.com)";
    }

    // Address: required, must contain both letters and numbers
    if (!form.address.trim()) {
      e.address = "Address is required";
    } else {
      const hasLetter = /[a-zA-Z]/.test(form.address);
      const hasNumber = /[0-9]/.test(form.address);
      if (!hasNumber) {
        e.address = "Address must include a street number (e.g. 123 Main St)";
      } else if (!hasLetter) {
        e.address = "Address must include both letters and numbers";
      }
    }

    // Password
    if (!form.password) {
      e.password = "Password is required";
    } else if (form.password.length < 6) {
      e.password = "Password must be at least 6 characters";
    }

    // Confirm password
    if (form.password && form.password !== form.confirmPassword) {
      e.confirmPassword = "Passwords do not match";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const result = await api.register({
        email: form.email.trim(),
        password: form.password,
        name: form.fullName.trim(),
        role: "civilian",
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
      });

      setAuthToken(result.token);
      localStorage.setItem("crisisgrid_user", JSON.stringify(result.user));
      toast.success(`Account created! Your ID: ${result.user.publicId}`);
      navigate("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed");
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.15),transparent_50%),radial-gradient(circle_at_70%_80%,hsl(var(--crisis-rescue)/0.10),transparent_40%)]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold tracking-wide">
            <Radio className="h-6 w-6 text-primary" />
            CrisisGrid
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">Create your account to get started</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.85] p-6 backdrop-blur sm:p-8"
        >
          <div className="flex items-center gap-3 border-b border-border/40 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Create Account</h2>
              <p className="text-xs text-muted-foreground">Join the emergency response network</p>
            </div>
          </div>

          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full Name *</Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(e) => updateField("fullName", e.target.value)}
              placeholder="Jane Doe"
              className={cn("h-11", errors.fullName && "border-destructive")}
              data-testid="input-register-name"
            />
            {errors.fullName ? (
              <p className="text-xs text-destructive">{errors.fullName}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Letters only — no numbers or symbols</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="you@example.com"
              className={cn("h-11", errors.email && "border-destructive")}
              data-testid="input-register-email"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          {/* Phone + Address */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+1 234 567 8900"
                className="h-11"
                data-testid="input-register-phone"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="123 Main St, City"
                className={cn("h-11", errors.address && "border-destructive")}
                data-testid="input-register-address"
              />
              {errors.address ? (
                <p className="text-xs text-destructive">{errors.address}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Must include a street number</p>
              )}
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password">Password *</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                placeholder="Min 6 characters"
                className={cn("h-11 pr-10", errors.password && "border-destructive")}
                data-testid="input-register-password"
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

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm Password *</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={(e) => updateField("confirmPassword", e.target.value)}
              placeholder="Re-enter password"
              className={cn("h-11", errors.confirmPassword && "border-destructive")}
              data-testid="input-register-confirm-password"
            />
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
          </div>

          <Button type="submit" className="h-12 w-full text-base" disabled={isSubmitting} data-testid="button-register">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/signin" className="font-medium text-primary hover:underline" data-testid="link-signin">
              Sign In
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignUp;
