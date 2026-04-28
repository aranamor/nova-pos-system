import { useEffect, useState } from "react";
import { api, type AuthUser, type AuditEntry, type Role } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

const roleColor: Record<Role, string> = {
  admin: "bg-primary/15 text-primary border-primary/30",
  manager: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  cashier: "bg-muted text-foreground border-border/60",
};

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [u, a] = await Promise.all([api.users(), api.auditLog(150)]);
      setUsers(u);
      setAudit(a);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const updateRole = async (id: number, role: Role) => {
    try {
      await api.updateUser(id, { role });
      toast.success("Role updated");
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Update failed");
    }
  };
  const toggleStatus = async (u: AuthUser) => {
    try {
      await api.updateUser(u.id, { status: u.status === "active" ? "disabled" : "active" });
      toast.success(u.status === "active" ? "User disabled" : "User enabled");
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Update failed");
    }
  };
  const resetPassword = async (u: AuthUser) => {
    if (!confirm(`Reset ${u.username}'s password? They'll need to change it on next sign-in.`)) return;
    try {
      const r = await api.adminResetPassword(u.id);
      toast.success("Temporary password generated");
      window.prompt(`Temporary password for ${u.username} (copy now — shown only once):`, r.tempPassword);
    } catch (err: any) {
      toast.error(err?.message ?? "Reset failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Access"
        description="Manage operator accounts, roles, and review the security audit log."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Operators</CardTitle>
          <CardDescription>Roles: admin (full), manager (operations + reports), cashier (POS only).</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">{u.fullName ?? u.username}</div>
                      <div className="text-xs text-muted-foreground">@{u.username}</div>
                    </TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={(v) => updateRole(u.id, v as Role)} disabled={u.id === me?.id}>
                        <SelectTrigger className={`h-8 w-32 border ${roleColor[u.role]}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">admin</SelectItem>
                          <SelectItem value="manager">manager</SelectItem>
                          <SelectItem value="cashier">cashier</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.status === "active" ? "secondary" : "destructive"}>{u.status}</Badge>
                      {u.mustChangePassword ? <Badge variant="outline" className="ml-2 text-[10px]">must reset</Badge> : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}
                      {u.lastLoginAt && (u as any).lastLoginIp ? ` · ${(u as any).lastLoginIp}` : ""}
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button variant="ghost" size="sm" onClick={() => resetPassword(u)} title="Reset password">
                        <KeyRound className="mr-1 h-3.5 w-3.5" /> Reset
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStatus(u)}
                        disabled={u.id === me?.id}
                        className={u.status === "active" ? "text-destructive" : "text-emerald-600"}
                      >
                        {u.status === "active" ? "Disable" : "Enable"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                      No users yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-amber-500" /> Security audit log</CardTitle>
          <CardDescription>Most recent {audit.length} authentication and access events.</CardDescription>
        </CardHeader>
        <CardContent className="max-h-[480px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>User</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap text-xs">{new Date(a.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={a.success ? "secondary" : "destructive"} className="font-mono text-[10px]">
                      {a.event}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{a.username ?? `#${a.userId ?? "—"}`}</TableCell>
                  <TableCell className="font-mono text-xs">{a.ipAddress ?? "—"}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground" title={a.detail ?? ""}>
                    {a.detail ?? ""}
                  </TableCell>
                </TableRow>
              ))}
              {audit.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No events yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
