import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Pill, Loader2 } from "lucide-react";
import { PasswordStrength, passwordScore } from "@/components/PasswordStrength";
import { toast } from "sonner";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error("Passwords do not match");
    if (passwordScore(password).score < 5) return toast.error("Password does not meet the strength policy");
    setBusy(true);
    try {
      await api.resetPassword(token.trim(), password);
      toast.success("Password updated. Please sign in.");
      navigate("/login", { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-background to-primary/5" />
      <Card className="relative z-10 w-full max-w-md border-border/60 bg-card/90 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-md">
            <Pill className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl tracking-tight">Set a new password</CardTitle>
            <CardDescription>Reset link expires after 30 minutes.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="token">Reset token</Label>
              <Input id="token" value={token} onChange={(e) => setToken(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={128} />
              <PasswordStrength password={password} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required maxLength={128} />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-primary text-primary-foreground shadow-md">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update password
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              <Link to="/login" className="text-primary hover:underline">Back to sign-in</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
