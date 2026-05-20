import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Building2, Loader2, Mail, MessageSquare, Phone, Send, User } from "lucide-react";
import AppFooter from "@/components/AppFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { api } from "@/lib/api";

const Contact = () => {
  const [form, setForm] = useState({
    orgName: "",
    contactName: "",
    email: "",
    phone: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.orgName.trim()) newErrors.orgName = "Organization name is required";
    if (!form.contactName.trim()) newErrors.contactName = "Contact name is required";
    if (!form.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!form.message.trim()) newErrors.message = "Message is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await api.submitContact({
        orgName: form.orgName.trim(),
        contactName: form.contactName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        message: form.message.trim(),
      });
      setSubmitted(true);
      toast.success("Your message has been sent successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  if (submitted) {
    return (
      <div className="relative min-h-screen bg-background text-foreground">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,hsl(var(--primary)/0.22),transparent_45%),radial-gradient(circle_at_85%_15%,hsl(var(--crisis-rescue)/0.17),transparent_30%)]" />
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4">
          <Card className="w-full max-w-md border-border/60 bg-[hsl(var(--surface-glass))/0.85] backdrop-blur">
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--status-claimed))]/20">
                <Send className="h-7 w-7 text-[hsl(var(--status-claimed))]" />
              </div>
              <CardTitle className="text-xl" data-testid="text-success-title">Message Sent</CardTitle>
              <CardDescription>
                Thank you for reaching out. Our team will review your submission and get back to you shortly.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <Button asChild variant="outline" data-testid="link-back-home">
                <Link to="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Home
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,hsl(var(--primary)/0.22),transparent_45%),radial-gradient(circle_at_85%_15%,hsl(var(--crisis-rescue)/0.17),transparent_30%)]" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="mb-6 flex w-full max-w-lg items-center">
          <Button asChild variant="ghost" size="sm" data-testid="link-back">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>

        <Card className="w-full max-w-lg border-border/60 bg-[hsl(var(--surface-glass))/0.85] backdrop-blur">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl" data-testid="text-contact-title">Contact Us</CardTitle>
                <CardDescription>
                  Interested in partnering with CrisisGrid? Send us a message.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName" className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Organization Name
                </Label>
                <Input
                  id="orgName"
                  value={form.orgName}
                  onChange={(e) => updateField("orgName", e.target.value)}
                  placeholder="Your organization"
                  className={errors.orgName ? "border-destructive" : "border-border/70 bg-background/40"}
                  data-testid="input-org-name"
                />
                {errors.orgName && (
                  <p className="text-xs text-destructive" data-testid="error-org-name">{errors.orgName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactName" className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Contact Name
                </Label>
                <Input
                  id="contactName"
                  value={form.contactName}
                  onChange={(e) => updateField("contactName", e.target.value)}
                  placeholder="Your full name"
                  className={errors.contactName ? "border-destructive" : "border-border/70 bg-background/40"}
                  data-testid="input-contact-name"
                />
                {errors.contactName && (
                  <p className="text-xs text-destructive" data-testid="error-contact-name">{errors.contactName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="you@organization.com"
                  className={errors.email ? "border-destructive" : "border-border/70 bg-background/40"}
                  data-testid="input-email"
                />
                {errors.email && (
                  <p className="text-xs text-destructive" data-testid="error-email">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  Phone Number
                  <span className="text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="border-border/70 bg-background/40"
                  data-testid="input-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message" className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  Message
                </Label>
                <Textarea
                  id="message"
                  value={form.message}
                  onChange={(e) => updateField("message", e.target.value)}
                  placeholder="Tell us about your organization and how you'd like to work with CrisisGrid..."
                  rows={5}
                  className={errors.message ? "border-destructive resize-none" : "border-border/70 bg-background/40 resize-none"}
                  data-testid="input-message"
                />
                {errors.message && (
                  <p className="text-xs text-destructive" data-testid="error-message">{errors.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
                data-testid="button-submit-contact"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Message
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <AppFooter />
    </div>
  );
};

export default Contact;
