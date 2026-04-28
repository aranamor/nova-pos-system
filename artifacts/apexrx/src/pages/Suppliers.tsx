import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Mail, Phone, MapPin, User, Search, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SupplierFormDialog } from "@/components/SupplierFormDialog";

export default function Suppliers() {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = () =>
    api
      .suppliers()
      .then(setRows)
      .catch((err) => toast.error(err?.message ?? "Failed to load suppliers"));
  useEffect(() => {
    load();
  }, []);

  const filtered = rows.filter((s) =>
    !search ? true : `${s.name} ${s.contact_person ?? ""} ${s.phone ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  const remove = async (s: any) => {
    if (!confirm(`Delete supplier ${s.name}?`)) return;
    try {
      await api.deleteSupplier(s.id);
      toast.success("Supplier deleted");
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Wholesale vendors and distributor partners."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className=""
          >
            <Plus className="mr-2 h-4 w-4" /> Add Supplier
          </Button>
        }
      />

      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search suppliers…"
              className="h-10 pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((s) => (
          <Card key={s.id} className="border-border bg-card transition-all hover:shadow-elev-lg">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{s.name}</h3>
                  {s.contact_person && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      {s.contact_person}
                    </p>
                  )}
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md">
                  {(s.name || "?").charAt(0)}
                </div>
              </div>
              <div className="space-y-1.5 text-sm">
                {s.phone && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {s.phone}
                  </p>
                )}
                {s.email && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {s.email}
                  </p>
                )}
                {s.address && (
                  <p className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-2">{s.address}</span>
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-1 border-t border-border/40 pt-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setEditing(s);
                    setFormOpen(true);
                  }}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => remove(s)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card className="border-border bg-card md:col-span-2 xl:col-span-3">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No suppliers yet — add your first vendor.
            </CardContent>
          </Card>
        )}
      </div>

      <SupplierFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} onSaved={load} />
    </div>
  );
}
