import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, FileText, Search, Receipt, Wallet, FileClock, CheckCircle2, Trash2 } from "lucide-react";
import { formatINR, formatDate } from "@/lib/format";
import { PurchaseFormDialog } from "@/components/PurchaseFormDialog";
import { PurchaseDetailsDialog } from "@/components/PurchaseDetailsDialog";
import { toast } from "@/hooks/use-toast";

export default function Purchases() {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "Completed" | "Draft">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);

  const load = () => api.purchases().then(setRows);
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter(r => {
    if (status !== "all" && r.status !== status) return false;
    if (search && !`${r.invoice_number} ${r.supplier_name}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [rows, status, search]);

  const stats = useMemo(() => {
    const completed = rows.filter(r => r.status === "Completed");
    const drafts = rows.filter(r => r.status === "Draft");
    const totalSpend = completed.reduce((s, r) => s + (Number(r.grand_total) || 0), 0);
    const draftValue = drafts.reduce((s, r) => s + (Number(r.grand_total) || 0), 0);
    return { count: rows.length, completed: completed.length, drafts: drafts.length, totalSpend, draftValue };
  }, [rows]);

  const remove = async (r: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete purchase ${r.invoice_number}?`)) return;
    // Optimistic — backend wiring via api when available
    setRows(prev => prev.filter(x => x.id !== r.id));
    toast({ title: "Purchase deleted", description: r.invoice_number });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Purchases" description="Inward supply from vendors, drafts and completed purchases."
        actions={
          <Button onClick={() => setFormOpen(true)} className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
            <Plus className="mr-2 h-4 w-4" /> New Purchase
          </Button>
        } />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Receipt} label="Total Purchases" value={String(stats.count)} />
        <StatCard icon={CheckCircle2} label="Completed" value={String(stats.completed)} />
        <StatCard icon={FileClock} label="Drafts" value={String(stats.drafts)} />
        <StatCard icon={Wallet} label="Total Spend" value={formatINR(stats.totalSpend)} />
      </div>

      <Card className="border-border/60 bg-card/80">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice or supplier…" className="h-10 pl-10" />
            </div>
            <Tabs value={status} onValueChange={v => setStatus(v as any)}>
              <TabsList className="bg-muted/40">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="Completed">Completed</TabsTrigger>
                <TabsTrigger value="Draft">Drafts</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Invoice</th>
                  <th className="px-3 py-3 text-left">Supplier</th>
                  <th className="px-3 py-3 text-left">Date</th>
                  <th className="px-3 py-3 text-center">Tax</th>
                  <th className="px-3 py-3 text-right">Items</th>
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} onClick={() => setViewing(r)} className="cursor-pointer border-t border-border/60 hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono font-semibold">{r.invoice_number}</td>
                    <td className="px-3 py-3">{r.supplier_name}</td>
                    <td className="px-3 py-3 text-muted-foreground">{formatDate(r.purchase_date)}</td>
                    <td className="px-3 py-3 text-center"><Badge variant="secondary">{r.tax_type}</Badge></td>
                    <td className="px-3 py-3 text-right font-mono">{r.items?.length ?? 0}</td>
                    <td className="px-3 py-3 text-right font-mono font-semibold">{formatINR(r.grand_total)}</td>
                    <td className="px-3 py-3 text-center">
                      {r.status === "Completed"
                        ? <Badge className="bg-success text-success-foreground hover:bg-success">Completed</Badge>
                        : <Badge variant="outline">Draft</Badge>}
                    </td>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setViewing(r)}>
                          <FileText className="mr-1.5 h-3.5 w-3.5" />View
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={e => remove(r, e)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={8} className="py-10 text-center text-muted-foreground">No purchases match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <PurchaseFormDialog open={formOpen} onOpenChange={setFormOpen} onSaved={load} />
      <PurchaseDetailsDialog open={!!viewing} onOpenChange={v => !v && setViewing(null)} purchase={viewing} />
    </div>
  );
}
