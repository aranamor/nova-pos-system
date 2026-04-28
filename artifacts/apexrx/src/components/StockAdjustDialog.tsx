import { FormEvent, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MinusCircle } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const REASONS = ["Damaged", "Expired", "Pilferage", "Sample", "Manual Adjustment", "Other"] as const;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: any | null;
  onAdjusted: () => void;
};

export function StockAdjustDialog({ open, onOpenChange, product, onAdjusted }: Props) {
  const [batches, setBatches] = useState<any[]>([]);
  const [batchId, setBatchId] = useState<string>("");
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState<string>("Damaged");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !product?.id) return;
    setQty(0);
    setReason("Damaged");
    setNotes("");
    setBatchId("");
    api
      .productBatches(product.id)
      .then((rows) => {
        const filtered = rows.filter((r: any) => Number(r.quantity) > 0);
        setBatches(filtered);
        if (filtered.length === 1) setBatchId(String(filtered[0].id));
      })
      .catch(() => setBatches([]));
  }, [open, product]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!batchId) {
      toast.error("Pick a batch to adjust");
      return;
    }
    if (!qty || qty <= 0) {
      toast.error("Enter a positive quantity to remove");
      return;
    }
    setBusy(true);
    try {
      await api.stockAdjust({
        productId: product?.id,
        batchId: Number(batchId),
        quantity: qty,
        reason,
        notes,
      });
      toast.success("Stock adjusted");
      onAdjusted();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Adjustment failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MinusCircle className="h-4 w-4 text-warning" /> Adjust Stock
          </DialogTitle>
          <DialogDescription>
            {product?.name ?? "Remove damaged or expired stock from a specific batch."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid gap-1.5">
            <Label>Batch</Label>
            {batches.length === 0 ? (
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                No in-stock batches available for this product.
              </div>
            ) : (
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger><SelectValue placeholder="Choose a batch" /></SelectTrigger>
                <SelectContent>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.batchNumber ?? b.batch_number} · Stock {Number(b.quantity)} · Exp {b.expiry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label>Quantity to Remove (in sale units)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || batches.length === 0}
              className=""
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Adjust Stock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
