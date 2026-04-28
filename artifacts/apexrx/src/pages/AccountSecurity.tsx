import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type SessionInfo } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Smartphone, X } from "lucide-react";
import { PasswordStrength, passwordScore } from "@/components/PasswordStrength";
import { toast } from "sonner";

export default function AccountSecurity() {
  const { user, refresh } = useAuth();
  const [params] = useSearchParams();
  const forced = params.get("force") === "1";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      setSessions(await api.sessions());
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load sessions");
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => { loadSessions(); }, []);

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) return toast.error("New passwords do not match");
    if (passwordScore(newPassword).score < 5) return toast.error("New password does not meet the strength policy");
    if (newPassword === currentPassword) return toast.error("New password must differ");
    setBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      toast.success("Password updated");
      setCurrentPassword(""); setNewPassword(""); setConfirm("");
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to change password");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      await api.revokeSession(id);
      toast.success("Session signed out");
      loadSessions();
    } catch (err: any) {
      toast.error(err?.message ?? "Revoke failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account & Security"
        description="Manage your password and active sessions."
      />

      {forced || user?.mustChangePassword ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
          You must change your password before continuing.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Change password</CardTitle>
            <CardDescription>Min 10 chars, with uppercase, lowercase, number and symbol.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onChangePassword}>
              <div className="space-y-1.5">
                <Label htmlFor="cp">Current password</Label>
                <Input id="cp" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required maxLength={128} autoComplete="current-password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np">New password</Label>
                <Input id="np" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required maxLength={128} autoComplete="new-password" />
                <PasswordStrength password={newPassword} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cf">Confirm new password</Label>
                <Input id="cf" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required maxLength={128} autoComplete="new-password" />
              </div>
              <Button type="submit" disabled={busy} className="bg-primary text-primary-foreground shadow-md">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update password
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> Active sessions</CardTitle>
            <CardDescription>Sign out of any device you don't recognize.</CardDescription>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-sm text-muted-foreground">No sessions found.</div>
            ) : (
              <ul className="divide-y divide-border/60">
                {sessions.map((s) => {
                  const ua = (s.userAgent ?? "").slice(0, 90);
                  const stale = s.revokedAt || new Date(s.expiresAt) < new Date();
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{s.ipAddress ?? "Unknown IP"}</span>
                          {s.current ? <Badge variant="secondary" className="text-[10px]">This device</Badge> : null}
                          {s.revokedAt ? <Badge variant="destructive" className="text-[10px]">Revoked</Badge> : null}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{ua || "—"}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          Last seen {new Date(s.lastSeenAt).toLocaleString()} · Expires {new Date(s.expiresAt).toLocaleString()}
                        </div>
                      </div>
                      {!s.current && !stale ? (
                        <Button variant="ghost" size="sm" onClick={() => revoke(s.id)} className="text-destructive">
                          <X className="mr-1 h-4 w-4" /> Sign out
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
