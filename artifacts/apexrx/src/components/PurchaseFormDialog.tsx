import { useEffect, useMemo, useRef, useState } from "react";
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
import { Plus, Trash2, FileText, Loader2, Search } from "lucide-react";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";

type LineItem = {
  productId: number | null;
  productName: string;
  hsn: string;
  batch: string;
  packaging: string;
  primaryUnit: string;
  secondaryUnit: string;
  saleUnit: string;
  purchaseConvAtTime: number;
  sellingConvAtTime: number;
  purchasingUom: "Primary" | "Secondary";
  unitLabel: string;

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

  // Search state
  _search: string;
  _suggestions: any[];
  _showDrop: boolean;
};

const emptyLine = (): LineItem => ({
  productId: null,
  productName: "",
  hsn: "",
  batch: "",
  packaging: "",
  primaryUnit: "BOX",
  secondaryUnit: "STRIP",
  saleUnit: "TABLET",
  purchaseConvAtTime: 1,
  sellingConvAtTime: 1,
  purchasingUom: "Primary",
  unitLabel: "BOX",
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
  _search: "",
  _suggestions: [],
  _showDrop: false,
});

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
};

function calcSaleUnits(l: LineItem): number {
  const total = (Number(l.quantity) || 0) + (Number(l.freeQuantity) || 0);
  if (l.purchasingUom === "Primary") return total * (l.purchaseConvAtTime || 1) * (l.sellingConvAtTime || 1);
  return total * (l.sellingConvAtTime || 1);
}

export function PurchaseFormDialog({ open, onOpenChange, onSaved }: Props) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierName, setSupplierName] = useState<string>("");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [taxType, setTaxType] = useState<"CSGST" | "IGST">("CSGST");
  const [overallDiscountPercent, setOverallDiscountPercent] = useState(0);
  const [status, setStatus] = useState<"Draft" | "Completed">("Completed");
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const debounceRefs = useRef<Record<number, ReturnType<typeof setTimeout> | null>>({});

  useEffect(() => {
    if (!open) return;
    api.suppliers().then(setSuppliers).catch(() => {});
    setBillNumber(`PUR-${Date.now().toString().slice(-6)}`);
    setBillDate(new Date().toISOString().slice(0, 10));
    setLines([emptyLine()]);
    setSupplierName("");
    setStatus("Completed");
    setTaxType("CSGST");
    setOverallDiscountPercent(0);
  }, [open]);

  const updateLine = (i: number, patch: Partial<LineItem>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const addLine = () => setLines((p) => [...p, emptyLine()]);
  const removeLine = (i: number) =>
    setLines((p) => (p.length === 1 ? [emptyLine()] : p.filter((_, idx) => idx !== i)));

  // Async product search per line
  const onSearchInput = (i: number, value: string) => {
    updateLine(i, { _search: value, _showDrop: true });
    if (debounceRefs.current[i]) clearTimeout(debounceRefs.current[i]!);
    debounceRefs.current[i] = setTimeout(async () => {
      if (!value || value.length < 2) {
        updateLine(i, { _suggestions: [] });
        return;
      }
      try {
        const results = await api.productSearch(value);
        updateLine(i, { _suggestions: results });
      } catch {
        updateLine(i, { _suggestions: [] });
      }
    }, 200);
  };

  // Auto-fill from selected catalog product
  const pickProduct = (i: number, p: any) => {
    const gst = Number(p.gst_rate ?? p.gstRate ?? 0);
    const half = gst / 2;
    updateLine(i, {
      productId: p.id,
      productName: p.name,
      hsn: p.hsn ?? "",
      packaging: p.packing_size ?? p.packingSize ?? "",
      primaryUnit: p.primary_unit ?? p.primaryUnit ?? "BOX",
      secondaryUnit: p.secondary_unit ?? p.secondaryUnit ?? "STRIP",
      saleUnit: p.sale_unit ?? p.saleUnit ?? "TABLET",
      purchaseConvAtTime: Number(p.purchase_conv_multiplier ?? p.purchaseConvMultiplier ?? 1),
      sellingConvAtTime: Number(p.selling_conv_multiplier ?? p.sellingConvMultiplier ?? 1),
      purchasingUom: "Primary",
      unitLabel: p.primary_unit ?? p.primaryUnit ?? "BOX",
      saleRateIncl: Number(p.sale_rate_incl ?? p.saleRateIncl ?? 0),
      saleRate: Number(p.sale_rate_excl ?? p.saleRateExcl ?? 0),
      mrp: Number(p.mrp ?? 0),
      purchase_cgst: half,
      purchase_sgst: half,
      purchase_igst: gst,
      sale_cgst: half,
      sale_sgst: half,
      _search: p.name,
      _suggestions: [],
      _showDrop: false,
    });
  };

  // When user changes UoM, switch the unit label
  const onChangeUoM = (i: number, uom: "Primary" | "Secondary") => {
    const l = lines[i];
    updateLine(i, {
      purchasingUom: uom,
      unitLabel: uom === "Primary" ? l.primaryUnit : l.secondaryUnit,
    });
  };

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
      const pct =
        taxType === "IGST"
          ? Number(l.purchase_igst) || 0
          : (Number(l.purchase_cgst) || 0) + (Number(l.purchase_sgst) || 0);
      gst += finalDisc * (pct / 100);
    }
    const grand = Math.round(taxable + gst);
    return { preTax, overallAmt, taxable, gst, grand };
  }, [lines, taxType, overallDiscountPercent]);

  const save = async () => {
    if (!supplierName) {
      toast.error("Select or enter a supplier");
      return;
    }
    const valid = lines.filter(
      (l) => l.productId && l.batch.trim() && l.expiry && Number(l.quantity) > 0,
    );
    if (valid.length === 0) {
      toast.error("Add at least one valid line (product, batch, expiry, qty)");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        supplierName,
        billNumber,
        billDate,
        taxType,
        overallDiscountPercent,
        status,
        items: valid.map((l) => ({
          productId: l.productId,
          productName: l.productName,
          hsn: l.hsn,
          batch: l.batch,
          packaging: l.packaging,
          purchasingUom: l.purchasingUom,
          unitLabel: l.unitLabel,
          purchaseConvAtTime: l.purchaseConvAtTime,
          sellingConvAtTime: l.sellingConvAtTime,
          quantity: l.quantity,
          freeQuantity: l.freeQuantity,
          mrp: l.mrp,
          purchaseRate: l.purchaseRate,
          saleRate: l.saleRate,
          saleRateIncl: l.saleRateIncl,
          discount: l.discount,
          expiry: l.expiry,
          purchase_cgst: l.purchase_cgst,
          purchase_sgst: l.purchase_sgst,
          purchase_igst: l.purchase_igst,
          sale_cgst: l.sale_cgst,
          sale_sgst: l.sale_sgst,
        })),
      };
      await api.createPurchase(payload);
      toast.success(`Purchase ${billNumber} saved as ${status} • ${formatINR(totals.grand)}`);
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
      <DialogContent className="max-h-[92vh] max-w-7xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> New Purchase
          </DialogTitle>
          <DialogDescription>
            Record an inward purchase. Stock will be added to the chosen batches once you mark this Completed.
          </DialogDescription>
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
              {suppliers.map((s) => <option key={s.id} value={s.name} />)}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Tax Type</Label>
            <Select value={taxType} onValueChange={(v) => setTaxType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CSGST">Local (CGST + SGST)</SelectItem>
                <SelectItem value="IGST">Interstate (IGST)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          {lines.map((l, i) => {
            const saleUnits = calcSaleUnits(l);
            const base = (Number(l.quantity) || 0) * (Number(l.purchaseRate) || 0);
            const afterDisc = base * (1 - (Number(l.discount) || 0) / 100);
            const taxPct =
              taxType === "IGST"
                ? Number(l.purchase_igst) || 0
                : (Number(l.purchase_cgst) || 0) + (Number(l.purchase_sgst) || 0);
            const amt = afterDisc * (1 + taxPct / 100);

            return (
              <div key={i} className="rounded-lg border border-border/60 bg-muted/10 p-3">
                <div className="grid gap-3 lg:grid-cols-12">
                  {/* Product search */}
                  <div className="relative lg:col-span-4">
                    <Label className="text-xs">Product *</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={l._search || l.productName}
                        onChange={(e) => onSearchInput(i, e.target.value)}
                        onFocus={() => updateLine(i, { _showDrop: true })}
                        onBlur={() =>
                          setTimeout(() => updateLine(i, { _showDrop: false }), 200)
                        }
                        placeholder="Search catalog…"
                        className="h-9 pl-7"
                      />
                    </div>
                    {l._showDrop && l._suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-border/80 bg-popover shadow-lg">
                        {l._suggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => pickProduct(i, s)}
                            className="flex w-full flex-col items-start gap-0.5 border-b border-border/40 px-3 py-2 text-left hover:bg-muted"
                          >
                            <span className="text-sm font-medium">{s.name}</span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {s.manufacturer ?? "—"} · HSN {s.hsn ?? "—"} · GST {s.gst_rate}%
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-1.5 lg:col-span-2">
                    <Label className="text-xs">Batch *</Label>
                    <Input
                      value={l.batch}
                      onChange={(e) => updateLine(i, { batch: e.target.value })}
                      className="h-9 font-mono"
                    />
                  </div>
                  <div className="grid gap-1.5 lg:col-span-2">
                    <Label className="text-xs">Expiry (YYYY-MM) *</Label>
                    <Input
                      value={l.expiry}
                      onChange={(e) => updateLine(i, { expiry: e.target.value })}
                      placeholder="2027-09"
                      className="h-9 font-mono"
                    />
                  </div>
                  <div className="grid gap-1.5 lg:col-span-2">
                    <Label className="text-xs">HSN</Label>
                    <Input
                      value={l.hsn}
                      onChange={(e) => updateLine(i, { hsn: e.target.value })}
                      className="h-9 font-mono"
                    />
                  </div>
                  <div className="grid gap-1.5 lg:col-span-2">
                    <Label className="text-xs">Pack</Label>
                    <Input
                      value={l.packaging}
                      onChange={(e) => updateLine(i, { packaging: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  {/* UoM */}
                  <div className="grid gap-1.5 lg:col-span-3">
                    <Label className="text-xs">Purchasing UoM</Label>
                    <Select
                      value={l.purchasingUom}
                      onValueChange={(v) => onChangeUoM(i, v as any)}
                    >
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Primary">Primary — {l.primaryUnit || "—"}</SelectItem>
                        {l.secondaryUnit && (
                          <SelectItem value="Secondary">Secondary — {l.secondaryUnit}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5 lg:col-span-1">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={l.quantity}
                      onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                      className="h-9 text-right font-mono"
                    />
                  </div>
                  <div className="grid gap-1.5 lg:col-span-1">
                    <Label className="text-xs">Free</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={l.freeQuantity}
                      onChange={(e) => updateLine(i, { freeQuantity: Number(e.target.value) })}
                      className="h-9 text-right font-mono"
                    />
                  </div>
                  <div className="grid gap-1.5 lg:col-span-2">
                    <Label className="text-xs">P. Rate / {l.unitLabel || "unit"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={l.purchaseRate}
                      onChange={(e) => updateLine(i, { purchaseRate: Number(e.target.value) })}
                      className="h-9 text-right font-mono"
                    />
                  </div>
                  <div className="grid gap-1.5 lg:col-span-1">
                    <Label className="text-xs">MRP</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={l.mrp}
                      onChange={(e) => updateLine(i, { mrp: Number(e.target.value) })}
                      className="h-9 text-right font-mono"
                    />
                  </div>
                  <div className="grid gap-1.5 lg:col-span-2">
                    <Label className="text-xs">Sale Inc.</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={l.saleRateIncl}
                      onChange={(e) =>
                        updateLine(i, {
                          saleRateIncl: Number(e.target.value),
                          saleRate:
                            Number(e.target.value) /
                            (1 + (Number(l.sale_cgst) + Number(l.sale_sgst)) / 100),
                        })
                      }
                      className="h-9 text-right font-mono"
                    />
                  </div>
                  <div className="grid gap-1.5 lg:col-span-1">
                    <Label className="text-xs">Disc%</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={l.discount}
                      onChange={(e) => updateLine(i, { discount: Number(e.target.value) })}
                      className="h-9 text-right font-mono"
                    />
                  </div>
                  <div className="grid gap-1.5 lg:col-span-1">
                    <Label className="text-xs">{taxType === "IGST" ? "IGST%" : "GST%"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={
                        taxType === "IGST" ? l.purchase_igst : l.purchase_cgst + l.purchase_sgst
                      }
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (taxType === "IGST") updateLine(i, { purchase_igst: v });
                        else
                          updateLine(i, {
                            purchase_cgst: v / 2,
                            purchase_sgst: v / 2,
                            sale_cgst: v / 2,
                            sale_sgst: v / 2,
                          });
                      }}
                      className="h-9 text-right font-mono"
                    />
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-2 text-xs text-muted-foreground">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono">
                    <span>
                      Conv: 1 {l.primaryUnit} = {l.purchaseConvAtTime} {l.secondaryUnit} ·{" "}
                      1 {l.secondaryUnit} = {l.sellingConvAtTime} {l.saleUnit}
                    </span>
                    <span className="font-semibold text-primary">
                      → Adds {saleUnits.toFixed(2)} {l.saleUnit} to stock
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono">Line: {formatINR(amt)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeLine(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
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
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Draft">Save as Draft</SelectItem>
              <SelectItem value="Completed">Mark Completed (adds stock)</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
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
