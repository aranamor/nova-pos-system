import { useEffect, useMemo, useState } from "react";
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
import { Plus, Trash2, FileText, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";

type LineItem = {
  productName: string;
  hsn: string;
  batch: string;
  packaging: string;
  quantity: number;
  freeQuantity: number;
  mrp: number;
  purchaseRate: number;
  saleRate: number;
  saleRateIncl: number;
  discount: number;
  expiry: string;
  purchase_cgst: number;
  purchase_sgst: number;
  purchase_igst: number;
  sale_cgst: number;
  sale_sgst: number;
};

const emptyLine = (): LineItem => ({
  productName: "",
  hsn: "",
  batch: "",
  packaging: "",
  quantity: 1,
  freeQuantity: 0,
  mrp: 0,
  purchaseRate: 0,
  saleRate: 0,
  saleRateIncl: 0,
  discount: 0,
  expiry: "",
  purchase_cgst: 6,
  purchase_sgst: 6,
  purchase_igst: 0,
  sale_cgst: 6,
  sale_sgst: 6,
});

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
};

export function PurchaseFormDialog({ open, onOpenChange, onSaved }: Props) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierName, setSupplierName] = useState<string>("");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [taxType, setTaxType] = useState<"CSGST" | "IGST">("CSGST");
  const [overallDiscountPercent, setOverallDiscountPercent] = useState(0);
  const [status, setStatus] = useState<"Draft" | "Completed">("Draft");
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.suppliers().then(setSuppliers).catch(() => {});
    setBillNumber(`PUR-${Date.now().toString().slice(-6)}`);
    setBillDate(new Date().toISOString().slice(0, 10));
    setLines([emptyLine()]);
    setSupplierName("");
    setStatus("Draft");
    setTaxType("CSGST");
    setOverallDiscountPercent(0);
  }, [open]);

  const totals = useMemo(() => {
    let preTax = 0;
    let gst = 0;
    for (const l of lines) {
      const base = (Number(l.quantity) || 0) * (Number(l.purchaseRate) || 0);
      const itemDisc = base * ((Number(l.discount) || 0) / 100);
      const afterItemDisc = base - itemDisc;
      preTax += afterItemDisc;
    }
    const overallAmt = preTax * ((Number(overallDiscountPercent) || 0) / 100);
    const taxable = preTax - overallAmt;
    for (const l of lines) {
      const base = (Number(l.quantity) || 0) * (Number(l.purchaseRate) || 0);
      const itemDisc = base * ((Number(l.discount) || 0) / 100);
      const afterItemDisc = base - itemDisc;
      const finalDisc = afterItemDisc * (1 - (Number(overallDiscountPercent) || 0) / 100);
      const pct = taxType === "IGST" ? Number(l.purchase_igst) || 0 : (Number(l.purchase_cgst) || 0) + (Number(l.purchase_sgst) || 0);
      gst += finalDisc * (pct / 100);
    }
    const grand = Math.round(taxable + gst);
    return { preTax, overallAmt, taxable, gst, grand };
  }, [lines, taxType, overallDiscountPercent]);

  const updateLine = (i: number, patch: Partial<LineItem>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const addLine = () => setLines((p) => [...p, emptyLine()]);
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!supplierName) {
      toast.error("Select or enter a supplier");
      return;
    }
    const valid = lines.filter((l) => l.productName && Number(l.quantity) > 0);
    if (valid.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    setSaving(true);
    try {
      await api.createPurchase({
        supplierName,
        billNumber,
        billDate,
        taxType,
        overallDiscountPercent,
        status,
        items: valid,
      });
      toast.success(`Purchase saved: ${billNumber} • ${formatINR(totals.grand)}`);
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save purchase");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> New Purchase
          </DialogTitle>
          <DialogDescription>Record inward supply with batch, expiry and GST.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Bill #</Label>
            <Input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Supplier</Label>
            <Input
              list="supplier-list"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Type or pick supplier"
            />
            <datalist id="supplier-list">
              {suppliers.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Tax Type</Label>
            <Select value={taxType} onValueChange={(v) => setTaxType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CSGST">Local (CGST + SGST)</SelectItem>
                <SelectItem value="IGST">Interstate (IGST)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left">Product</th>
                <th className="px-2 py-2 text-left">HSN</th>
                <th className="px-2 py-2 text-left">Batch</th>
                <th className="px-2 py-2 text-left">Pack</th>
                <th className="px-2 py-2 text-left">Expiry</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2 text-right">Free</th>
                <th className="px-2 py-2 text-right">P.Rate</th>
                <th className="px-2 py-2 text-right">MRP</th>
                <th className="px-2 py-2 text-right">Sale Inc.</th>
                <th className="px-2 py-2 text-right">Disc%</th>
                <th className="px-2 py-2 text-right">{taxType === "IGST" ? "IGST%" : "GST%"}</th>
                <th className="px-2 py-2 text-right">Amount</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const base = (Number(l.quantity) || 0) * (Number(l.purchaseRate) || 0);
                const afterDisc = base * (1 - (Number(l.discount) || 0) / 100);
                const taxPct =
                  taxType === "IGST"
                    ? Number(l.purchase_igst) || 0
                    : (Number(l.purchase_cgst) || 0) + (Number(l.purchase_sgst) || 0);
                const amt = afterDisc * (1 + taxPct / 100);
                return (
                  <tr key={i} className="border-t border-border/60">
                    <td className="px-2 py-1.5 min-w-[180px]">
                      <Input
                        value={l.productName}
                        onChange={(e) => updateLine(i, { productName: e.target.value })}
                        className="h-9"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={l.hsn}
                        onChange={(e) => updateLine(i, { hsn: e.target.value })}
                        className="h-9 w-20 font-mono"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={l.batch}
                        onChange={(e) => updateLine(i, { batch: e.target.value })}
                        className="h-9 w-24 font-mono"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={l.packaging}
                        onChange={(e) => updateLine(i, { packaging: e.target.value })}
                        className="h-9 w-16"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={l.expiry}
                        onChange={(e) => updateLine(i, { expiry: e.target.value })}
                        placeholder="YYYY-MM"
                        className="h-9 w-24 font-mono"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        value={l.quantity}
                        onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                        className="h-9 w-16 text-right font-mono"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        value={l.freeQuantity}
                        onChange={(e) => updateLine(i, { freeQuantity: Number(e.target.value) })}
                        className="h-9 w-16 text-right font-mono"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        value={l.purchaseRate}
                        onChange={(e) => updateLine(i, { purchaseRate: Number(e.target.value) })}
                        className="h-9 w-20 text-right font-mono"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        value={l.mrp}
                        onChange={(e) => updateLine(i, { mrp: Number(e.target.value) })}
                        className="h-9 w-20 text-right font-mono"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        value={l.saleRateIncl}
                        onChange={(e) => updateLine(i, { saleRateIncl: Number(e.target.value), saleRate: Number(e.target.value) / (1 + (Number(l.sale_cgst) + Number(l.sale_sgst)) / 100) })}
                        className="h-9 w-20 text-right font-mono"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        value={l.discount}
                        onChange={(e) => updateLine(i, { discount: Number(e.target.value) })}
                        className="h-9 w-14 text-right font-mono"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        value={taxType === "IGST" ? l.purchase_igst : l.purchase_cgst + l.purchase_sgst}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (taxType === "IGST") updateLine(i, { purchase_igst: v });
                          else updateLine(i, { purchase_cgst: v / 2, purchase_sgst: v / 2, sale_cgst: v / 2, sale_sgst: v / 2 });
                        }}
                        className="h-9 w-14 text-right font-mono"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs">{formatINR(amt)}</td>
                    <td className="px-2 py-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeLine(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Line
          </Button>
          <div className="space-y-1 text-sm md:min-w-[280px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pre-Tax</span>
              <span className="font-mono">{formatINR(totals.preTax)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground">Overall Discount %</Label>
              <Input
                type="number"
                value={overallDiscountPercent}
                onChange={(e) => setOverallDiscountPercent(Number(e.target.value) || 0)}
                className="h-8 w-20 text-right font-mono"
              />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxable</span>
              <span className="font-mono">{formatINR(totals.taxable)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST ({taxType})</span>
              <span className="font-mono">{formatINR(totals.gst)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-border/60 pt-1 text-base font-semibold">
              <span>Grand Total</span>
              <span className="font-mono">{formatINR(totals.grand)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Draft">Save as Draft</SelectItem>
              <SelectItem value="Completed">Mark Completed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Purchase
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
