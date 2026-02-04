"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth, getPasswordRequirements } from "@/hooks/use-auth";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preventClose?: boolean;
  defaultTab?: "login" | "signup";
}

export function AuthDialog({
  open,
  onOpenChange,
  onSuccess,
  preventClose = false,
  defaultTab = "login",
}: AuthDialogProps) {
  const { signIn, signUp, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<"login" | "signup">(defaultTab);

  // Sync active tab when defaultTab changes externally
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  // Sign up form
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const resetForms = () => {
    setLoginEmail("");
    setLoginPassword("");
    setLoginError(null);
    setSignupName("");
    setSignupEmail("");
    setSignupPassword("");
    setSignupError(null);
    setSignupSuccess(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!loginEmail || !loginPassword) {
      setLoginError("Please fill in all fields");
      return;
    }

    const { error } = await signIn({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) {
      // Make error messages more user-friendly
      if (error.message.includes("Invalid login credentials")) {
        setLoginError("Invalid email or password. Please try again.");
      } else {
        setLoginError(error.message);
      }
      return;
    }

    resetForms();
    onOpenChange(false);
    onSuccess?.();
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);
    setSignupSuccess(false);

    if (!signupName || !signupEmail || !signupPassword) {
      setSignupError("Please fill in all fields");
      return;
    }

    const { error } = await signUp({
      email: signupEmail,
      password: signupPassword,
      name: signupName,
    });

    if (error) {
      // Make error messages more user-friendly
      if (error.message.includes("already registered")) {
        setSignupError("This email is already registered. Please log in instead.");
      } else {
        setSignupError(error.message);
      }
      return;
    }

    // Check if email confirmation is required
    setSignupSuccess(true);

    // If auto-confirmed, close dialog and trigger success
    setTimeout(() => {
      resetForms();
      onOpenChange(false);
      onSuccess?.();
    }, 1500);
  };

  const passwordRequirements = getPasswordRequirements();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      // Prevent closing if preventClose is true
      if (preventClose && !isOpen) {
        return;
      }
      if (!isOpen) {
        resetForms();
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={!preventClose}
        onInteractOutside={(e) => {
          if (preventClose) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (preventClose) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Welcome</DialogTitle>
          <DialogDescription>
            Log in to your account or create a new one.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as "login" | "signup");
            setLoginError(null);
            setSignupError(null);
            setSignupSuccess(false);
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login" className="data-[state=active]:ring-2 data-[state=active]:ring-ring data-[state=active]:ring-offset-1">Log in</TabsTrigger>
            <TabsTrigger value="signup" className="data-[state=active]:ring-2 data-[state=active]:ring-ring data-[state=active]:ring-offset-1">Create account</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4 pt-4">
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {loginError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{loginError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    "Log in"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4 pt-4">
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              {signupError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{signupError}</AlertDescription>
                </Alert>
              )}

              {signupSuccess && (
                <Alert className="border-green-500 bg-green-50 text-green-700">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription>
                    Account created successfully! Logging you in...
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="signup-name">Name</Label>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="Your name"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  autoComplete="name"
                  disabled={loading || signupSuccess}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading || signupSuccess}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading || signupSuccess}
                />
                <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                  {passwordRequirements.map((req, index) => (
                    <li key={index} className="flex items-center gap-1">
                      <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading || signupSuccess}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : signupSuccess ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Success!
                    </>
                  ) : (
                    "Create account"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
