"use client";

/**
 * PasswordGate
 *
 * Tester-facing password entry form for accessing a feedback form.
 * Shown on first visit; bypassed on return if session cookie is still valid.
 * Shows lockout messaging when rate-limited.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff } from "lucide-react";

interface PasswordGateProps {
  slug: string;
  formTitle: string;
  onAuthenticated: () => void;
}

export function PasswordGate({ slug, formTitle, onAuthenticated }: PasswordGateProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim() || loading) return;

    setLoading(true);
    setError(null);
    setRetryAfter(null);

    try {
      const res = await fetch(`/api/forms/${slug}/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (data.success) {
        onAuthenticated();
        return;
      }

      if (res.status === 429) {
        setRetryAfter(data.error?.retryAfter ?? 60);
        setError("Too many attempts. Please wait before trying again.");
      } else if (data.error?.type === "invalid_password") {
        setError("Incorrect password. Please check with the team and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Branding */}
        <div className="text-center space-y-1">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-3">
              <Lock className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{formTitle}</h1>
          <p className="text-sm text-muted-foreground">
            Enter the password to access this feedback form.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter form password"
                autoComplete="current-password"
                disabled={loading || retryAfter !== null}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
              {retryAfter !== null && (
                <span className="block mt-0.5 text-muted-foreground">
                  Try again in {Math.ceil(retryAfter / 60)} minute
                  {retryAfter > 60 ? "s" : ""}.
                </span>
              )}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !password.trim() || retryAfter !== null}
          >
            {loading ? "Verifying…" : "Access Form"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Powered by{" "}
          <span className="font-medium text-foreground">Ascend</span>
        </p>
      </div>
    </div>
  );
}
