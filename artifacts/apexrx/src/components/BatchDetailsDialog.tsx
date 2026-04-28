import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package, CalendarClock, Loader2 } from "lucide-react";
import { formatINR } from "@/lib/format";
import { api } from "@/lib/api";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: any | null;
};

const monthsAhead = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 7);
};

export function BatchDetailsDialog({ open, onOpenChange, product }: Props) {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "expiring" | "expired">("all");
  const todayMonth = new Date().toISOString().slice(0, 7);
  const m3 = monthsAhead(3);

  useEffect(() => {
    if (!open || !product?.id) return;
    setLoading(true);
    api
      .productBatches(product.id)
      .then((rows) => setBatches(rows))
      .catch(() => setBatches([]))
      .finally(() => setLoading(false));
  }, [open, product]);

  const numQty = (b: any) => Number(b.quantity ?? 0);

  const filtered = useMemo(() => {
    return batches.filter((b) => {
      const expired = String(b.expiry) < todayMonth;
      const expiring = !expired && String(b.expiry) <= m3;
      if (filter === "expired") return expired;
      if (filter === "expiring") return expiring;
      return true;
    });
  }, [batches, filter, todayMonth, m3]);

  const totalQty = batches.reduce((s, b) => s + numQty(b), 0);
  const expiredQty = batches
    .filter((b) => String(b.expiry) < todayMonth)
    .reduce((s, b) => s + numQty(b), 0);
  const expiringQty = batches
    .filter((b) => String(b.expiry) >= todayMonth && String(b.expiry) <= m3)
    .reduce((s, b) => s + numQty(b), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            {product?.name ?? "Product"}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {product?.manufacturer ? `${product.manufacturer} · ` : ""}HSN {product?.hsn ?? "—"} ·{" "}
            {product?.packing_size ?? product?.packingSize ?? "—"} · GST {product?.gst_rate ?? product?.gstRate}%
          </DialogDescription>
          {(product?.is_h1 || product?.is_narcotic || product?.is_prescription_required) && (
            <div className="flex gap-1 pt-1">
              {product?.is_h1 && <Badge variant="destructive" className="text-[10px]">H1</Badge>}
              {product?.is_narcotic && (
                <Badge className="bg-amber-600 text-white text-[10px] hover:bg-amber-700">NARCOTIC</Badge>
              )}
              {product?.is_prescription_required && (
                <Badge variant="secondary" className="text-[10px]">Rx</Badge>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground">Total Stock</div>
            <div className="font-mono text-xl font-semibold">{totalQty.toFixed(2)}</div>
          </div>
          <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5 text-warning" /> Expiring ≤3m
            </div>
            <div className="font-mono text-xl font-semibold text-warning">{expiringQty.toFixed(2)}</div>
          </div>
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Expired
            </div>
            <div className="font-mono text-xl font-semibold text-destructive">{expiredQty.toFixed(2)}</div>
          </div>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList className="bg-muted/40">
            <TabsTrigger value="all">All Batches</TabsTrigger>
            <TabsTrigger value="expiring">Expiring (≤3m)</TabsTrigger>
            <TabsTrigger value="expired">Expired</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="overflow-x-auto rounded-lg border border-border/60">
          {loading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Batch</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">MRP</th>
                  <th className="px-3 py-2 text-right">P. Rate</th>
                  <th className="px-3 py-2 text-center">Expiry</th>
                  <th className="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, i) => {
                  const expired = String(b.expiry) < todayMonth;
                  const soon = !expired && String(b.expiry) <= m3;
                  return (
                    <tr
                      key={`${b.batchNumber ?? b.batch_number}-${i}`}
                      className="border-t border-border/60 hover:bg-muted/20"
                    >
                      <td className="px-3 py-2 font-mono text-xs">
                        {b.batchNumber ?? b.batch_number}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{numQty(b).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatINR(b.mrp)}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatINR(b.purchaseRate ?? b.purchase_rate)}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-xs">{b.expiry}</td>
                      <td className="px-3 py-2 text-center">
                        {expired ? (
                          <Badge variant="destructive">Expired</Badge>
                        ) : soon ? (
                          <Badge className="bg-warning text-warning-foreground hover:bg-warning">
                            Expiring
                          </Badge>
                        ) : (
                          <Badge variant="secondary">OK</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No batches match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
