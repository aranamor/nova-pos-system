import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  purchase: any | null;
};

export function PurchaseDetailsDialog({ open, onOpenChange, purchase }: Props) {
  const [full, setFull] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !purchase?.id) {
      setFull(null);
      return;
    }
    setLoading(true);
    api
      .purchase(purchase.id)
      .then(setFull)
      .catch((err) => toast.error(err?.message ?? "Failed to load purchase"))
      .finally(() => setLoading(false));
  }, [open, purchase?.id]);

  if (!purchase) return null;

  const data = full ?? purchase;
  const items: any[] = data.items ?? [];
  const taxType = data.tax_type ?? data.taxType;
  const isIgst = taxType === "IGST";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="font-mono">{data.bill_number ?? data.billNumber}</span>
            {data.status === "Completed" ? (
              <Badge className="bg-success text-success-foreground hover:bg-success">Completed</Badge>
            ) : (
              <Badge variant="outline">Draft</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {data.supplier_name ?? data.supplierName} ·{" "}
            {formatDate(data.bill_date ?? data.billDate)} · {taxType}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-left">Batch</th>
                    <th className="px-3 py-2 text-center">Expiry</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Free</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">{isIgst ? "IGST%" : "GST%"}</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-t border-border/60">
                      <td className="px-3 py-2">{it.productName ?? it.product_name}</td>
                      <td className="px-3 py-2 font-mono text-xs">{it.batch}</td>
                      <td className="px-3 py-2 text-center font-mono text-xs">{it.expiry}</td>
                      <td className="px-3 py-2 text-right font-mono">{it.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono">{it.freeQuantity ?? it.free_quantity ?? 0}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatINR(it.purchaseRate ?? it.purchase_rate)}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {isIgst
                          ? Number(it.purchaseIgst ?? it.purchase_igst ?? 0)
                          : Number(it.purchaseCgst ?? it.purchase_cgst ?? 0) +
                            Number(it.purchaseSgst ?? it.purchase_sgst ?? 0)}
                        %
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{formatINR(it.amount)}</td>
                    </tr>
                  ))}
                  {!items.length && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        No line items.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pre-Tax</span>
                <span className="font-mono">{formatINR(data.total_pre_tax ?? data.totalPreTax ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-mono">
                  {formatINR(data.overall_discount_amount ?? data.overallDiscountAmount ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxable</span>
                <span className="font-mono">{formatINR(data.taxable_amount ?? data.taxableAmount ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST ({taxType})</span>
                <span className="font-mono">{formatINR(data.total_gst_amount ?? data.totalGstAmount ?? 0)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-border/60 pt-1 text-base font-semibold">
                <span>Grand Total</span>
                <span className="font-mono">{formatINR(data.grand_total ?? data.grandTotal)}</span>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
