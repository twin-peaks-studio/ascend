"use client";

import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import {
  BarChart3,
  Brain,
  Target,
  ArrowRight,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AscendLogo } from "@/components/ascend-logo";
import { AuthDialog } from "@/components/auth";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "signup">("signup");
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useIsomorphicLayoutEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme");
    if (stored === "dark") {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    } else if (stored === "light") {
      setIsDark(false);
      document.documentElement.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      setIsDark(prefersDark);
      if (prefersDark) {
        document.documentElement.classList.add("dark");
      }
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      return next;
    });
  }, []);

  const openSignUp = () => {
    setAuthTab("signup");
    setShowAuth(true);
  };

  const openLogin = () => {
    setAuthTab("login");
    setShowAuth(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <AscendLogo className="h-8 w-auto" />
              <span className="text-lg font-semibold tracking-tight">
                Ascend
              </span>
            </div>
            <div className="flex items-center gap-2">
              {mounted && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  aria-label="Toggle theme"
                >
                  {isDark ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button variant="ghost" onClick={openLogin}>
                Log in
              </Button>
              <Button onClick={openSignUp}>
                Sign up free
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-transparent to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/[0.04] rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Logo mark */}
          <div className="flex justify-center mb-8">
            <AscendLogo className="h-24 sm:h-32 w-auto" />
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            Rise above the noise
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Ascend learns how you work — understanding your patterns, predicting
            timelines, and helping your team deliver faster and more reliably.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={openSignUp}
              className="text-base px-8 h-12"
            >
              Get started — it&apos;s free
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-primary mb-2 tracking-wide uppercase">
              Built for momentum
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Work smarter, not harder
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <FeatureCard
              icon={<Target className="h-5 w-5" />}
              title="Smart project management"
              description="Organize work with Kanban boards, project grouping, and drag-and-drop task management that adapts to your workflow."
            />
            <FeatureCard
              icon={<Brain className="h-5 w-5" />}
              title="Pattern intelligence"
              description="Ascend learns how long certain types of tasks take you and your team, building an accurate model of your work patterns."
            />
            <FeatureCard
              icon={<BarChart3 className="h-5 w-5" />}
              title="Predictable delivery"
              description="With learned patterns, get realistic timelines and identify bottlenecks before they derail your projects."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 sm:py-28 border-t border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <p className="text-sm font-medium text-primary mb-2 tracking-wide uppercase">
              How it works
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-12">
              Intelligence that compounds
            </h2>

            <div className="space-y-10">
              <StepItem
                number="01"
                title="Track your work naturally"
                description="Create projects, add tasks, and move them through your workflow. Ascend stays out of your way — no complex setup, no rigid processes."
              />
              <StepItem
                number="02"
                title="Patterns emerge over time"
                description="As you work, Ascend quietly learns — which tasks take longer, where bottlenecks form, and how your team's velocity changes across project types."
              />
              <StepItem
                number="03"
                title="Predictability improves"
                description="Over time, you get increasingly accurate estimates, smarter prioritization suggestions, and a clear picture of what your team can realistically deliver."
              />
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-28 border-t border-border/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Ready to reach new heights?
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            Join Ascend and start building a smarter, more predictable way to
            get things done.
          </p>
          <Button
            size="lg"
            onClick={openSignUp}
            className="text-base px-8 h-12"
          >
            Get started — it&apos;s free
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AscendLogo className="h-6 w-auto" />
              <span className="text-sm font-medium">Ascend</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Ascend. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Auth dialog */}
      <AuthDialog
        open={showAuth}
        onOpenChange={setShowAuth}
        defaultTab={authTab}
      />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-xl border border-border/60 bg-card p-6 transition-all hover:border-border hover:shadow-sm">
      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function StepItem({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-5">
      <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary text-sm font-bold">
        {number}
      </div>
      <div className="pt-1">
        <h3 className="text-base font-semibold mb-1.5">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
