import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Pill, Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login, loggedIn, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (loggedIn) {
    const from = (location.state as any)?.from?.pathname ?? "/";
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Please enter both username and password");
      return;
    }
    setBusy(true);
    try {
      const u = await login(username.trim(), password);
      toast.success(`Welcome back, ${u.fullName ?? u.username}`);
      const from = (location.state as any)?.from?.pathname ?? "/";
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 423) {
        toast.error("Account temporarily locked. Try again in a few minutes.");
      } else if (err instanceof ApiError && err.status === 429) {
        toast.error("Too many attempts. Please wait and try again.");
      } else {
        toast.error(err?.message ?? "Login failed");
      }
    } finally {
      setBusy(false);
    }
  };

  // Detect "no users yet" by attempting a benign signup probe.
  const tryBootstrap = async () => {
    setBootstrapping(true);
    try {
      // attempt to navigate to /signup; if signup is closed (users exist) we
      // simply show a "must be invited" notice on that page.
      navigate("/signup");
    } finally {
      setBootstrapping(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-background to-primary/5" />
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />

      <Card className="relative z-10 w-full max-w-md border-border/60 bg-card/90 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
            <Pill className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl tracking-tight">Nova POS</CardTitle>
            <CardDescription className="flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Secure pharmacy console · Sign in to continue
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username or email</Label>
              <Input
                id="username"
                value={username}
                autoFocus
                onChange={(e) => setUsername(e.target.value)}
                placeholder="you@nova.pos"
                autoComplete="username"
                maxLength={255}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  maxLength={128}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sign in
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-widest">
                <span className="bg-card px-2 text-muted-foreground">Setup</span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={bootstrapping}
              onClick={tryBootstrap}
            >
              First-time setup · Create admin
            </Button>
            <p className="pt-2 text-center text-[11px] text-muted-foreground">
              Sessions expire after 12 hours · Failed attempts are rate-limited and audited.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
