import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Pill, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ message: string; devToken?: string } | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.forgotPassword(email.trim());
      setDone({ message: r.message, devToken: r.devToken });
    } catch (err: any) {
      toast.error(err?.message ?? "Request failed");
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
            <CardTitle className="text-2xl tracking-tight">Reset your password</CardTitle>
            <CardDescription>We'll email you a single-use, time-limited link.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="space-y-3 text-sm">
              <p className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3">{done.message}</p>
              {done.devToken ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
                  <div className="font-semibold text-amber-600 dark:text-amber-400">Dev mode</div>
                  Use this token at{" "}
                  <Link className="text-primary underline" to={`/reset-password?token=${done.devToken}`}>
                    /reset-password
                  </Link>
                  <pre className="mt-2 overflow-auto rounded bg-muted p-2 font-mono">{done.devToken}</pre>
                </div>
              ) : null}
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">Back to sign-in</Link>
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} autoFocus required onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send reset link
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Remembered it? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
