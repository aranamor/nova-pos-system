import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  AlertTriangle,
  Edit2,
  Trash2,
  MinusCircle,
  ChevronRight,
  PackageX,
  PackageCheck,
  Package,
} from "lucide-react";
import { formatINR } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BatchDetailsDialog } from "@/components/BatchDetailsDialog";
import { ProductFormDialog } from "@/components/ProductFormDialog";
import { StockAdjustDialog } from "@/components/StockAdjustDialog";
import { toast } from "sonner";

type StockStatus = "Available" | "NotAvailable" | "All";

export default function Inventory() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<StockStatus>("Available");
  const [selected, setSelected] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [adjusting, setAdjusting] = useState<any | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await api.products(tab, search);
      setProducts(rows);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search]);

  const counts = useMemo(() => {
    const total = products.length;
    return { total };
  }, [products]);

  const remove = async (p: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete ${p.name}? Existing batches & stock will also be removed.`)) return;
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
        description="Catalog of products. Stock comes from purchase entries — products start with 0 stock."
        actions={
          <Button
            onClick={onAdd}
            className=""
          >
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </Button>
        }
      />

      <Card className="border-border bg-card">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, manufacturer, HSN, content…"
                className="h-10 pl-10"
              />
            </div>
            <Tabs value={tab} onValueChange={(v) => setTab(v as StockStatus)}>
              <TabsList className="bg-muted/40">
                <TabsTrigger value="Available">
                  <PackageCheck className="mr-1.5 h-3.5 w-3.5" />
                  Available
                </TabsTrigger>
                <TabsTrigger value="NotAvailable">
                  <PackageX className="mr-1.5 h-3.5 w-3.5" />
                  Out of Stock
                </TabsTrigger>
                <TabsTrigger value="All">
                  <Package className="mr-1.5 h-3.5 w-3.5" />
                  All
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{loading ? "Loading…" : `${counts.total} products`}</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-3 py-3 text-left">Manufacturer / Pack</th>
                  <th className="px-3 py-3 text-left">Compliance</th>
                  <th className="px-3 py-3 text-right">Total Stock</th>
                  <th className="px-3 py-3 text-right">MRP</th>
                  <th className="px-3 py-3 text-right">Sale (Inc.)</th>
                  <th className="px-3 py-3 text-center">GST</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const totalQty = Number(p.total_quantity ?? 0);
                  const low = totalQty > 0 && totalQty <= 10;
                  const out = totalQty <= 0;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelected(p)}
                      className="cursor-pointer border-t border-border/60 hover:bg-muted/20"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-medium">
                          {p.name}
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          HSN {p.hsn ?? "—"} · {p.category ?? "—"}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <div>{p.manufacturer ?? "—"}</div>
                        <div className="font-mono text-muted-foreground">
                          {p.packing_size ?? "—"}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {p.is_h1 && (
                            <Badge variant="destructive" className="text-[10px]">H1</Badge>
                          )}
                          {p.is_narcotic && (
                            <Badge className="bg-amber-600 text-white text-[10px] hover:bg-amber-700">
                              NAR
                            </Badge>
                          )}
                          {p.is_prescription_required && (
                            <Badge variant="secondary" className="text-[10px]">Rx</Badge>
                          )}
                          {!p.is_h1 && !p.is_narcotic && !p.is_prescription_required && (
                            <span className="text-xs text-muted-foreground">OTC</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span
                          className={
                            out
                              ? "font-semibold text-muted-foreground"
                              : low
                                ? "font-semibold text-warning"
                                : "font-semibold"
                          }
                        >
                          {totalQty.toFixed(2)}
                        </span>
                        {low && !out && (
                          <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-warning" />
                        )}
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {p.sale_unit}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono">{formatINR(p.mrp)}</td>
                      <td className="px-3 py-3 text-right font-mono font-semibold">
                        {formatINR(p.sale_rate_incl)}
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-xs">
                        {p.gst_rate}%
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
                            disabled={out}
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
                {!loading && !products.length && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-muted-foreground">
                      {tab === "Available"
                        ? "No products with stock — record a Purchase to add stock."
                        : tab === "NotAvailable"
                          ? "Every catalog product has stock."
                          : "No products in catalog yet."}
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
