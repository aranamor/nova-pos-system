import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Pill, Loader2, ShieldCheck } from "lucide-react";
import { PasswordStrength, passwordScore } from "@/components/PasswordStrength";
import { toast } from "sonner";

export default function Signup() {
  const { loggedIn, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (loggedIn) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error("Passwords do not match");
    const { score } = passwordScore(password);
    if (score < 5) return toast.error("Password does not meet the strength policy");
    setBusy(true);
    try {
      const r = await api.signup({
        username: username.trim(),
        email: email.trim(),
        fullName: fullName.trim() || undefined,
        password,
      });
      toast.success(r.message ?? "Account created");
      navigate("/login", { replace: true });
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setClosed(true);
      }
      toast.error(err?.message ?? "Signup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-background to-primary/5" />
      <Card className="relative z-10 w-full max-w-md border-border/60 bg-card/90 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
            <Pill className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl tracking-tight">Create administrator</CardTitle>
            <CardDescription className="flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              First-time setup for Nova POS
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {closed ? (
            <div className="space-y-3 text-sm">
              <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">
                Self-signup is closed. The first administrator has already been created — new users
                must be invited from the Admin → Users console by an existing administrator.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">Back to sign-in</Link>
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} maxLength={64} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={255} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={128} autoComplete="new-password" required />
                <PasswordStrength password={password} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} maxLength={128} autoComplete="new-password" required />
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create administrator
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
