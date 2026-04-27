import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Phone, Stethoscope, Search, Edit2, Trash2, History } from "lucide-react";
import { toast } from "sonner";
import { CustomerFormDialog } from "@/components/CustomerFormDialog";
import { CustomerHistoryDialog } from "@/components/CustomerHistoryDialog";

export default function Customers() {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [historyOf, setHistoryOf] = useState<any | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = () =>
    api
      .customers()
      .then(setRows)
      .catch((err) => toast.error(err?.message ?? "Failed to load customers"));
  useEffect(() => {
    load();
  }, []);

  const filtered = rows.filter((c) =>
    !search ? true : `${c.name} ${c.mobile}`.toLowerCase().includes(search.toLowerCase()),
  );

  const remove = async (c: any) => {
    if (!confirm(`Delete customer ${c.name}?`)) return;
    try {
      await api.deleteCustomer(c.id);
      toast.success("Customer deleted");
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Patients with mobile and prescribing doctor."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Customer
          </Button>
        }
      />

      <Card className="border-border/60 bg-card/80">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or mobile…"
              className="h-10 pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c) => (
          <Card
            key={c.id}
            className="border-border/60 bg-card/80 transition-all hover:shadow-elev-lg hover:-translate-y-0.5"
          >
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-accent text-lg font-bold text-primary-foreground shadow-glow">
                  {(c.name || "?").charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {c.mobile}
                  </p>
                  {c.doctor_name && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Stethoscope className="h-3 w-3" />
                      {c.doctor_name}
                    </p>
                  )}
                </div>
                <div className="font-mono text-xs text-muted-foreground">#{c.id}</div>
              </div>
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setHistoryOf(c);
                    setHistoryOpen(true);
                  }}
                >
                  <History className="mr-1.5 h-3.5 w-3.5" /> History
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setEditing(c);
                    setFormOpen(true);
                  }}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => remove(c)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card className="border-border/60 bg-card/80 md:col-span-2 xl:col-span-3">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No customers yet — add your first patient.
            </CardContent>
          </Card>
        )}
      </div>

      <CustomerFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} onSaved={load} />
      <CustomerHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        customer={historyOf}
      />
    </div>
  );
}
