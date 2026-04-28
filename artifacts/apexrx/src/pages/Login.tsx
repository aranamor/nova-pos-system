import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, Eye, EyeOff, ArrowRight, Activity, Lock } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login, loggedIn, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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

  return (
    <div className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-[1fr_minmax(420px,520px)]">
      {/* Left brand pane */}
      <div className="relative hidden overflow-hidden border-r border-border bg-card-muted lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <span className="font-mono text-[13px] font-bold text-primary-foreground">Rx</span>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">ApexRx</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Pharmacy Console
            </div>
          </div>
        </div>

        <div className="max-w-md space-y-6">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            The pharmacy operating system, built for precision.
          </h2>
          <p className="text-[14px] text-muted-foreground">
            Inventory, billing, batch tracking, GST compliance and audit-ready reporting — in a single,
            keyboard-first console designed for high-volume retail and hospital pharmacies.
          </p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 pt-2 text-[12px]">
            <Feature icon={<ShieldCheck className="h-3.5 w-3.5" />} label="SOC-2 ready audit log" />
            <Feature icon={<Lock className="h-3.5 w-3.5" />} label="Role-based access control" />
            <Feature icon={<Activity className="h-3.5 w-3.5" />} label="Real-time stock & expiry" />
            <Feature icon={<ArrowRight className="h-3.5 w-3.5" />} label="GST invoicing built-in" />
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>© {new Date().getFullYear()} ApexRx Systems</span>
          <span className="font-mono">v1.0.0</span>
        </div>
      </div>

      {/* Right form pane */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="mb-2 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                <span className="font-mono text-[13px] font-bold text-primary-foreground">Rx</span>
              </div>
              <span className="text-sm font-semibold tracking-tight">ApexRx</span>
            </div>
          </div>

          <h1 className="text-[22px] font-semibold tracking-tight">Sign in to your console</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Enter your credentials to access ApexRx.
          </p>

          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-[12px] font-medium">
                Username or email
              </Label>
              <Input
                id="username"
                value={username}
                autoFocus
                onChange={(e) => setUsername(e.target.value)}
                placeholder="you@apexrx.io"
                autoComplete="username"
                maxLength={255}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[12px] font-medium">
                  Password
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-[12px] font-medium text-primary hover:underline"
                >
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
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={busy} className="h-10 w-full">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sign in
            </Button>

            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                <span className="bg-background px-2 text-muted-foreground">First-time setup</span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full"
              onClick={() => navigate("/signup")}
            >
              Create administrator account
            </Button>

            <p className="pt-3 text-center text-[11px] text-muted-foreground">
              Sessions expire after 12 hours. Failed attempts are rate-limited and audited.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <span className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card text-primary">
        {icon}
      </span>
      <span>{label}</span>
    </div>
  );
}
