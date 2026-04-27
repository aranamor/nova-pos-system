import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, AlertTriangle, Edit2, Trash2, ChevronRight } from "lucide-react";
import { formatINR } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BatchDetailsDialog, type BatchRow } from "@/components/BatchDetailsDialog";

// TODO: replace with api.productBatches(id) when backend exposes /products/:id/batches.
// For now we synthesize plausible batch splits from the single-batch product record.
function synthesizeBatches(p: any): BatchRow[] {
  const shiftMonth = (ym: string, delta: number) => {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return d.toISOString().slice(0, 7);
  };
  const q = Math.max(1, p.quantity);
  const a = Math.max(1, Math.floor(q * 0.55));
  const b = Math.max(1, Math.floor(q * 0.3));
  const c = Math.max(0, q - a - b);
  return [
    { batch: p.batch, quantity: a, mrp: p.mrp, sale_rate_inclusive: p.sale_rate_inclusive, expiry: p.expiry, purchase_rate: p.purchase_rate },
    { batch: `${p.batch}-B`, quantity: b, mrp: p.mrp, sale_rate_inclusive: p.sale_rate_inclusive, expiry: shiftMonth(p.expiry, -2), purchase_rate: p.purchase_rate },
    ...(c > 0 ? [{ batch: `${p.batch}-C`, quantity: c, mrp: p.mrp, sale_rate_inclusive: p.sale_rate_inclusive, expiry: shiftMonth(p.expiry, -5), purchase_rate: p.purchase_rate }] : []),
  ];
}

export default function Inventory() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "exp1" | "exp2" | "exp3" | "expired">("all");
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => { api.products().then(setProducts); }, []);

  const monthsAhead = (n: number) => {
    const d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 7);
  };
  const todayMonth = new Date().toISOString().slice(0, 7);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (search && !`${p.name} ${p.batch} ${p.hsn}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === "low" && p.quantity > 10) return false;
      if (filter === "expired" && p.expiry > todayMonth) return false;
      if (filter === "exp1" && (p.expiry < todayMonth || p.expiry > monthsAhead(1))) return false;
      if (filter === "exp2" && (p.expiry < todayMonth || p.expiry > monthsAhead(2))) return false;
      if (filter === "exp3" && (p.expiry < todayMonth || p.expiry > monthsAhead(3))) return false;
      return true;
    });
  }, [products, search, filter]);

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Track stock, batches and expiry across your store."
        actions={<Button className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"><Plus className="mr-2 h-4 w-4" /> Add Product</Button>} />

      <Card className="border-border/60 bg-card/80">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, batch, HSN…" className="h-10 pl-10" />
            </div>
            <Tabs value={filter} onValueChange={v => setFilter(v as any)}>
              <TabsList className="bg-muted/40">
                <TabsTrigger value="all"><Filter className="mr-1.5 h-3.5 w-3.5" />All</TabsTrigger>
                <TabsTrigger value="low">Low</TabsTrigger>
                <TabsTrigger value="exp1">≤1m</TabsTrigger>
                <TabsTrigger value="exp2">≤2m</TabsTrigger>
                <TabsTrigger value="exp3">≤3m</TabsTrigger>
                <TabsTrigger value="expired">Expired</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-3 py-3 text-left">Batch</th>
                  <th className="px-3 py-3 text-right">Stock</th>
                  <th className="px-3 py-3 text-right">MRP</th>
                  <th className="px-3 py-3 text-right">Sale (Inc.)</th>
                  <th className="px-3 py-3 text-center">Expiry</th>
                  <th className="px-3 py-3 text-center">GST</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const low = p.quantity <= 10;
                  const expired = p.expiry < todayMonth;
                  const soon = !expired && p.expiry <= monthsAhead(3);
                  return (
                    <tr key={p.id} onClick={() => setSelected(p)} className="cursor-pointer border-t border-border/60 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-medium">
                          {p.name}
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">HSN {p.hsn} · {p.packaging}</div>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{p.batch}</td>
                      <td className="px-3 py-3 text-right">
                        <span className={low ? "font-semibold text-warning" : ""}>{p.quantity}</span>
                        {low && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-warning" />}
                      </td>
                      <td className="px-3 py-3 text-right font-mono">{formatINR(p.mrp)}</td>
                      <td className="px-3 py-3 text-right font-mono font-semibold">{formatINR(p.sale_rate_inclusive)}</td>
                      <td className="px-3 py-3 text-center">
                        {expired ? <Badge variant="destructive">{p.expiry}</Badge>
                          : soon ? <Badge className="bg-warning text-warning-foreground hover:bg-warning">{p.expiry}</Badge>
                          : <Badge variant="secondary" className="font-mono">{p.expiry}</Badge>}
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-xs">{p.cgst}+{p.sgst}%</td>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8"><Edit2 className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && <tr><td colSpan={8} className="py-10 text-center text-muted-foreground">No products match your filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
