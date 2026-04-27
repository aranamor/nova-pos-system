import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { formatINR, formatDate } from "@/lib/format";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  purchase: any | null;
};

export function PurchaseDetailsDialog({ open, onOpenChange, purchase }: Props) {
  if (!purchase) return null;
  const items: any[] = purchase.items || [];
  const isLocal = purchase.tax_type === "Local";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="font-mono">{purchase.invoice_number}</span>
            {purchase.status === "Completed"
              ? <Badge className="bg-success text-success-foreground hover:bg-success">Completed</Badge>
              : <Badge variant="outline">Draft</Badge>}
          </DialogTitle>
          <DialogDescription>
            {purchase.supplier_name} · {formatDate(purchase.purchase_date)} · {purchase.tax_type}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-left">Batch</th>
                <th className="px-3 py-2 text-center">Expiry</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">{isLocal ? "GST%" : "IGST%"}</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t border-border/60">
                  <td className="px-3 py-2">{it.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{it.batch}</td>
                  <td className="px-3 py-2 text-center font-mono text-xs">{it.expiry}</td>
                  <td className="px-3 py-2 text-right font-mono">{it.quantity}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatINR(it.purchase_rate)}</td>
                  <td className="px-3 py-2 text-right font-mono">{isLocal ? (it.cgst + it.sgst) : it.igst}%</td>
                  <td className="px-3 py-2 text-right font-mono">{formatINR(it.amount)}</td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No line items.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatINR(purchase.subtotal || 0)}</span></div>
          {isLocal ? (
            <>
              <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span className="font-mono">{formatINR(purchase.cgst || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span className="font-mono">{formatINR(purchase.sgst || 0)}</span></div>
            </>
          ) : (
            <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span className="font-mono">{formatINR(purchase.igst || 0)}</span></div>
          )}
          <div className="mt-1 flex justify-between border-t border-border/60 pt-1 text-base font-semibold">
            <span>Grand Total</span><span className="font-mono">{formatINR(purchase.grand_total)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
