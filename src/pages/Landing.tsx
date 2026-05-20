import { Link } from "react-router-dom";
import {
  Radio,
  Zap,
  MapPin,
  Navigation,
  Shield,
  Users,
  Clock,
  ArrowRight,
  ChevronRight,
  Activity,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: Zap,
    title: "Real-time Coordination",
    description:
      "Instantly broadcast crisis requests to nearby volunteers. Live updates ensure no call for help goes unanswered.",
    accent: "hsl(var(--crisis-rescue))",
  },
  {
    icon: Navigation,
    title: "AI-Powered Routing",
    description:
      "Smart algorithms match volunteers to the nearest crisis, optimizing response times and saving critical minutes.",
    accent: "hsl(var(--crisis-medical))",
  },
  {
    icon: MapPin,
    title: "GPS Tracking",
    description:
      "Precise geolocation pins every crisis on the map. Volunteers navigate directly to those in need with live tracking.",
    accent: "hsl(var(--crisis-food-water))",
  },
];

const steps = [
  {
    step: "01",
    title: "Report a Crisis",
    description:
      "Tap the map to drop a pin at your location. Select the crisis type and describe your situation.",
  },
  {
    step: "02",
    title: "Volunteers Respond",
    description:
      "Nearby verified volunteers receive your alert instantly and claim the task to begin responding.",
  },
  {
    step: "03",
    title: "Help Arrives",
    description:
      "Track your volunteer's approach in real-time. Once resolved, the crisis is marked complete.",
  },
];

const stats = [
  { value: "2,400+", label: "Crises Resolved" },
  { value: "850+", label: "Active Volunteers" },
  { value: "< 4 min", label: "Avg Response Time" },
  { value: "98%", label: "Resolution Rate" },
];

const Landing = () => {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,hsl(var(--primary)/0.15),transparent_45%),radial-gradient(circle_at_85%_15%,hsl(var(--crisis-rescue)/0.12),transparent_30%),radial-gradient(circle_at_50%_80%,hsl(var(--crisis-medical)/0.08),transparent_40%)]" />

      <header className="relative z-20 flex h-16 items-center justify-between border-b border-border/60 bg-[hsl(var(--surface-glass))/0.9] px-4 backdrop-blur md:px-6">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-[hsl(var(--crisis-rescue))]" />
          <span className="text-lg font-semibold tracking-wide" data-testid="text-brand">
            CrisisGrid
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link to="/signin" data-testid="link-signin-header">
              Sign In
            </Link>
          </Button>
          <Button asChild>
            <Link to="/signup" data-testid="link-signup-header">
              Get Started
            </Link>
          </Button>
        </div>
      </header>

      <section className="relative z-10 flex flex-col items-center px-4 pt-16 pb-20 text-center md:pt-24 md:pb-28">
        <Badge
          variant="outline"
          className="mb-6 border-[hsl(var(--crisis-rescue))]/40 text-[hsl(var(--crisis-rescue))]"
        >
          <Activity className="mr-1.5 h-3 w-3" />
          Live Emergency Platform
        </Badge>

        <h1
          className="max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl"
          data-testid="text-hero-title"
        >
          When Every Second Counts,{" "}
          <span className="text-[hsl(var(--crisis-rescue))]">CrisisGrid Connects</span>
        </h1>

        <p
          className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl"
          data-testid="text-hero-subtitle"
        >
          A real-time emergency coordination platform that connects people in crisis with
          nearby volunteers — powered by AI routing, live maps, and GPS tracking.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" asChild>
            <Link to="/signup" data-testid="link-signup-hero">
              Start Volunteering
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link to="/signin" data-testid="link-signin-hero">
              Sign In
            </Link>
          </Button>
        </div>
      </section>

      <section className="relative z-10 px-4 pb-20 md:pb-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-semibold md:text-3xl" data-testid="text-features-title">
              Built for Crisis Response
            </h2>
            <p className="mt-3 text-muted-foreground">
              Everything responders need — in one unified platform.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.title}
                  className="border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.6] backdrop-blur"
                  data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <CardContent className="p-6">
                    <div
                      className="mb-4 flex h-10 w-10 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${feature.accent}20` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: feature.accent }} />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-4 pb-20 md:pb-28">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-semibold md:text-3xl" data-testid="text-howitworks-title">
              How It Works
            </h2>
            <p className="mt-3 text-muted-foreground">
              Three simple steps from crisis to resolution.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((item) => (
              <div key={item.step} className="text-center" data-testid={`step-${item.step}`}>
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-[hsl(var(--crisis-rescue))]/15 text-lg font-bold text-[hsl(var(--crisis-rescue))]">
                  {item.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-4 pb-20 md:pb-28">
        <div className="mx-auto max-w-4xl">
          <Card
            className="border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.6] backdrop-blur"
            data-testid="card-stats"
          >
            <CardContent className="p-8">
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-semibold md:text-3xl" data-testid="text-stats-title">
                  Trusted by Communities Worldwide
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Real impact, measurable results.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                {stats.map((stat) => (
                  <div key={stat.label} className="text-center" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>
                    <p className="text-2xl font-bold text-[hsl(var(--crisis-rescue))] md:text-3xl">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground md:text-sm">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="relative z-10 px-4 pb-20 md:pb-28">
        <div className="mx-auto max-w-2xl text-center">
          <Globe className="mx-auto mb-4 h-8 w-8 text-[hsl(var(--crisis-rescue))]" />
          <h2 className="text-2xl font-semibold md:text-3xl" data-testid="text-cta-title">
            Ready to Make a Difference?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Join CrisisGrid today and help build a safer, more connected world — one
            response at a time.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link to="/signup" data-testid="link-signup-cta">
                Create Your Account
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/contact" data-testid="link-contact-cta">
                Contact Us
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/60 bg-[hsl(var(--surface-glass))/0.6] backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-8 text-center md:flex-row md:justify-between md:text-left">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-[hsl(var(--crisis-rescue))]" />
            <span className="text-sm font-semibold" data-testid="text-footer-brand">CrisisGrid</span>
            <span className="text-xs text-muted-foreground">
              Real-time emergency coordination
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/contact" className="transition-colors hover:text-foreground" data-testid="link-contact-footer">
              Contact
            </Link>
            <Link to="/signin" className="transition-colors hover:text-foreground" data-testid="link-signin-footer">
              Sign In
            </Link>
            <Link to="/signup" className="transition-colors hover:text-foreground" data-testid="link-signup-footer">
              Sign Up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
