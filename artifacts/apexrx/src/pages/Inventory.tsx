import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Filter, AlertTriangle, Edit2, Trash2, MinusCircle, ChevronRight,
} from "lucide-react";
import { formatINR } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BatchDetailsDialog } from "@/components/BatchDetailsDialog";
import { ProductFormDialog } from "@/components/ProductFormDialog";
import { StockAdjustDialog } from "@/components/StockAdjustDialog";
import { toast } from "sonner";

export default function Inventory() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "exp1" | "exp2" | "exp3" | "expired">("all");
  const [selected, setSelected] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [adjusting, setAdjusting] = useState<any | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const load = () =>
    api
      .products()
      .then(setProducts)
      .catch((err) => toast.error(err?.message ?? "Failed to load products"));
  useEffect(() => {
    load();
  }, []);

  const monthsAhead = (n: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + n);
    return d.toISOString().slice(0, 7);
  };
  const todayMonth = new Date().toISOString().slice(0, 7);

  // Group by name to render one row per product, with expand-to-batches.
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const p of products) {
      const arr = map.get(p.name) ?? [];
      arr.push(p);
      map.set(p.name, arr);
    }
    return Array.from(map.values()).map((batches) => {
      const totalQty = batches.reduce((s, b) => s + Number(b.quantity || 0), 0);
      const earliestExpiry = [...batches].sort((a, b) => String(a.expiry).localeCompare(String(b.expiry)))[0]?.expiry;
      return { ...batches[0], _batches: batches, _totalQty: totalQty, _earliestExpiry: earliestExpiry };
    });
  }, [products]);

  const filtered = useMemo(() => {
    return grouped.filter((p) => {
      if (search && !`${p.name} ${p.batch} ${p.hsn}`.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (filter === "low" && p._totalQty > 10) return false;
      if (filter === "expired" && p._earliestExpiry > todayMonth) return false;
      if (filter === "exp1" && (p._earliestExpiry < todayMonth || p._earliestExpiry > monthsAhead(1)))
        return false;
      if (filter === "exp2" && (p._earliestExpiry < todayMonth || p._earliestExpiry > monthsAhead(2)))
        return false;
      if (filter === "exp3" && (p._earliestExpiry < todayMonth || p._earliestExpiry > monthsAhead(3)))
        return false;
      return true;
    });
  }, [grouped, search, filter]);

  const remove = async (p: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete ${p.name} (batch ${p.batch})?`)) return;
    try {
      await api.deleteProduct(p.id);
      toast.success("Product deleted");
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Delete failed");
    }
  };

  const onEdit = (p: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(p);
    setFormOpen(true);
  };

  const onAdjust = (p: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setAdjusting(p);
    setAdjustOpen(true);
  };

  const onAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Track stock, batches and expiry across your store."
        actions={
          <Button
            onClick={onAdd}
            className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </Button>
        }
      />

      <Card className="border-border/60 bg-card/80">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, batch, HSN…"
                className="h-10 pl-10"
              />
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
              <TabsList className="bg-muted/40">
                <TabsTrigger value="all">
                  <Filter className="mr-1.5 h-3.5 w-3.5" />
                  All
                </TabsTrigger>
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
                  <th className="px-3 py-3 text-left">Batches</th>
                  <th className="px-3 py-3 text-right">Total Stock</th>
                  <th className="px-3 py-3 text-right">MRP</th>
                  <th className="px-3 py-3 text-right">Sale (Inc.)</th>
                  <th className="px-3 py-3 text-center">Earliest Expiry</th>
                  <th className="px-3 py-3 text-center">GST</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const low = p._totalQty <= 10;
                  const expired = p._earliestExpiry && p._earliestExpiry < todayMonth;
                  const soon = !expired && p._earliestExpiry && p._earliestExpiry <= monthsAhead(3);
                  return (
                    <tr
                      key={p.name}
                      onClick={() => setSelected(p)}
                      className="cursor-pointer border-t border-border/60 hover:bg-muted/20"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-medium">
                          {p.name}
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          HSN {p.hsn} · {p.packaging ?? ""}
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{p._batches.length}</td>
                      <td className="px-3 py-3 text-right">
                        <span className={low ? "font-semibold text-warning" : ""}>{p._totalQty}</span>
                        {low && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-warning" />}
                      </td>
                      <td className="px-3 py-3 text-right font-mono">{formatINR(p.mrp)}</td>
                      <td className="px-3 py-3 text-right font-mono font-semibold">
                        {formatINR(p.sale_rate_inclusive)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {expired ? (
                          <Badge variant="destructive">{p._earliestExpiry}</Badge>
                        ) : soon ? (
                          <Badge className="bg-warning text-warning-foreground hover:bg-warning">
                            {p._earliestExpiry}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="font-mono">
                            {p._earliestExpiry}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-xs">
                        {p.cgst}+{p.sgst}%
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Edit"
                            onClick={(e) => onEdit(p, e)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-warning"
                            title="Adjust stock"
                            onClick={(e) => onAdjust(p, e)}
                          >
                            <MinusCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            title="Delete"
                            onClick={(e) => remove(p, e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-muted-foreground">
                      No products match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <BatchDetailsDialog
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        product={selected}
        batches={selected?._batches ?? []}
      />

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSaved={load}
      />

      <StockAdjustDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        product={adjusting}
        onAdjusted={load}
      />
    </div>
  );
}
