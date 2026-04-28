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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  FileText,
  Loader2,
  Search,
  PackagePlus,
  ChevronDown,
  Check,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  _searching: boolean;
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
  _searching: false,
});

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
};

function calcSaleUnits(l: LineItem): number {
  const total = (Number(l.quantity) || 0) + (Number(l.freeQuantity) || 0);
  if (l.purchasingUom === "Primary")
    return total * (l.purchaseConvAtTime || 1) * (l.sellingConvAtTime || 1);
  return total * (l.sellingConvAtTime || 1);
}

// ---------- Inline "Quick create product" panel ----------
type QuickCreateState = {
  open: boolean;
  lineIndex: number | null;
  name: string;
  manufacturer: string;
  hsn: string;
  primaryUnit: string;
  secondaryUnit: string;
  saleUnit: string;
  purchaseConv: number;
  sellingConv: number;
  gstRate: number;
  saving: boolean;
};

const emptyQuickCreate = (name = ""): QuickCreateState => ({
  open: false,
  lineIndex: null,
  name,
  manufacturer: "",
  hsn: "",
  primaryUnit: "BOX",
  secondaryUnit: "STRIP",
  saleUnit: "TABLET",
  purchaseConv: 10,
  sellingConv: 10,
  gstRate: 12,
  saving: false,
});

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
  const [quickCreate, setQuickCreate] = useState<QuickCreateState>(emptyQuickCreate());
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
    setQuickCreate(emptyQuickCreate());
  }, [open]);

  const updateLine = (i: number, patch: Partial<LineItem>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const addLine = () => setLines((p) => [...p, emptyLine()]);
  const removeLine = (i: number) =>
    setLines((p) => (p.length === 1 ? [emptyLine()] : p.filter((_, idx) => idx !== i)));

  // Async product search per line
  const onSearchInput = (i: number, value: string) => {
    updateLine(i, { _search: value, _showDrop: true, _searching: value.length >= 2 });
    if (debounceRefs.current[i]) clearTimeout(debounceRefs.current[i]!);
    debounceRefs.current[i] = setTimeout(async () => {
      if (!value || value.length < 2) {
        updateLine(i, { _suggestions: [], _searching: false });
        return;
      }
      try {
        const results = await api.productSearch(value);
        updateLine(i, { _suggestions: results, _searching: false });
      } catch {
        updateLine(i, { _suggestions: [], _searching: false });
      }
    }, 200);
  };

  // Auto-fill from selected catalog product, then auto-add a fresh line if this was the last one
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
    toast.success(`Added "${p.name}" to line ${i + 1}`);
    // Auto-add a new blank line so the user can keep entering items
    setLines((prev) => {
      if (i === prev.length - 1) {
        return [...prev, emptyLine()];
      }
      return prev;
    });
  };

  // Open the quick-create panel pre-filled with what the user typed
  const openQuickCreate = (i: number, name: string) => {
    setQuickCreate({ ...emptyQuickCreate(name.trim()), open: true, lineIndex: i });
    updateLine(i, { _showDrop: false });
  };

  const submitQuickCreate = async () => {
    const qc = quickCreate;
    if (!qc.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (qc.lineIndex == null) return;
    setQuickCreate((s) => ({ ...s, saving: true }));
    try {
      const created = await api.createProduct({
        name: qc.name.trim(),
        manufacturer: qc.manufacturer || null,
        hsn: qc.hsn || null,
        primaryUnit: qc.primaryUnit,
        secondaryUnit: qc.secondaryUnit,
        saleUnit: qc.saleUnit,
        purchaseConvMultiplier: qc.purchaseConv,
        sellingConvMultiplier: qc.sellingConv,
        gstRate: qc.gstRate,
        saleRateExcl: 0,
        saleRateIncl: 0,
        mrp: 0,
        status: "Available",
      });
      // Build a "product-like" object to feed into pickProduct
      pickProduct(qc.lineIndex, {
        id: created.id,
        name: qc.name.trim(),
        hsn: qc.hsn,
        manufacturer: qc.manufacturer,
        primary_unit: qc.primaryUnit,
        secondary_unit: qc.secondaryUnit,
        sale_unit: qc.saleUnit,
        purchase_conv_multiplier: qc.purchaseConv,
        selling_conv_multiplier: qc.sellingConv,
        gst_rate: qc.gstRate,
        sale_rate_incl: 0,
        sale_rate_excl: 0,
        mrp: 0,
      });
      setQuickCreate(emptyQuickCreate());
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create product");
    } finally {
      setQuickCreate((s) => ({ ...s, saving: false }));
    }
  };

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

  const validLineCount = lines.filter(
    (l) => l.productId && l.batch.trim() && l.expiry && Number(l.quantity) > 0,
  ).length;

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
      <DialogContent className="max-h-[94vh] max-w-7xl overflow-y-auto p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <FileText className="h-4 w-4 text-primary" />
            New Purchase Bill
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            Record an inward purchase. Stock is added to the chosen batches once you mark this as Completed.
          </DialogDescription>
        </DialogHeader>

        {/* Header fields */}
        <div className="grid grid-cols-1 gap-4 border-b border-border bg-card-muted/40 px-6 py-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="field-label">Bill Number</Label>
            <Input
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
              className="h-9 font-mono text-[13px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="field-label">Date</Label>
            <Input
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="h-9 text-[13px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="field-label">Supplier</Label>
            <Input
              list="supplier-list"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Type or pick supplier"
              className="h-9 text-[13px]"
            />
            <datalist id="supplier-list">
              {suppliers.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label className="field-label">Tax Type</Label>
            <Select value={taxType} onValueChange={(v) => setTaxType(v as any)}>
              <SelectTrigger className="h-9 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CSGST">Local (CGST + SGST)</SelectItem>
                <SelectItem value="IGST">Interstate (IGST)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Line items */}
        <div className="space-y-3 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="section-title">Line Items</h3>
            <span className="text-[11px] text-muted-foreground">
              <span className="font-mono font-semibold text-foreground">{validLineCount}</span> valid /{" "}
              <span className="font-mono">{lines.length}</span> total
            </span>
          </div>

          {lines.map((l, i) => {
            const saleUnits = calcSaleUnits(l);
            const base = (Number(l.quantity) || 0) * (Number(l.purchaseRate) || 0);
            const afterDisc = base * (1 - (Number(l.discount) || 0) / 100);
            const taxPct =
              taxType === "IGST"
                ? Number(l.purchase_igst) || 0
                : (Number(l.purchase_cgst) || 0) + (Number(l.purchase_sgst) || 0);
            const amt = afterDisc * (1 + taxPct / 100);
            const isValid = l.productId && l.batch.trim() && l.expiry && Number(l.quantity) > 0;

            return (
              <div
                key={i}
                className={cn(
                  "rounded-md border bg-card transition-colors",
                  isValid ? "border-border" : "border-border-strong",
                )}
              >
                {/* Line header */}
                <div className="flex items-center justify-between border-b border-border bg-card-muted/50 px-3 py-1.5">
                  <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                    <span className="font-mono text-foreground">#{(i + 1).toString().padStart(2, "0")}</span>
                    {l.productId ? (
                      <span className="pill bg-success-soft text-success">linked</span>
                    ) : (
                      <span className="pill bg-warning-soft text-warning">draft</span>
                    )}
                    {l.productId && (
                      <span className="truncate text-foreground">{l.productName}</span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-destructive hover:bg-destructive-soft hover:text-destructive"
                    onClick={() => removeLine(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="grid gap-3 p-3 lg:grid-cols-12">
                  {/* Product search */}
                  <div className="relative lg:col-span-4">
                    <Label className="field-label">Product *</Label>
                    <div className="relative mt-1">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={l._search || l.productName}
                        onChange={(e) => onSearchInput(i, e.target.value)}
                        onFocus={() => updateLine(i, { _showDrop: true })}
                        onBlur={() =>
                          setTimeout(() => updateLine(i, { _showDrop: false }), 180)
                        }
                        placeholder="Search catalog or type a new product…"
                        className="h-9 pl-8 text-[13px]"
                      />
                      {l._searching && (
                        <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {l._showDrop && (l._search || "").length >= 2 && (
                      <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-popover shadow-popover">
                        {l._suggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              pickProduct(i, s);
                            }}
                            className="flex w-full items-start gap-2 border-b border-border/60 px-3 py-2 text-left transition-colors hover:bg-muted last:border-b-0"
                          >
                            <Check className="mt-0.5 h-3.5 w-3.5 text-primary" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[13px] font-medium">{s.name}</div>
                              <div className="font-mono text-[11px] text-muted-foreground">
                                {s.manufacturer ?? "—"} · HSN {s.hsn ?? "—"} · GST {s.gst_rate ?? 0}%
                              </div>
                            </div>
                          </button>
                        ))}
                        {/* Always-present "create new" option */}
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            openQuickCreate(i, l._search);
                          }}
                          className="flex w-full items-start gap-2 bg-primary-soft/40 px-3 py-2.5 text-left transition-colors hover:bg-primary-soft"
                        >
                          <PackagePlus className="mt-0.5 h-3.5 w-3.5 text-primary" />
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-medium text-primary">
                              Create new product{l._search ? `: "${l._search}"` : ""}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {l._suggestions.length === 0
                                ? "Nothing matched — add it to your catalog now."
                                : "Add a different product not in the list above."}
                            </div>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-2">
                    <Label className="field-label">Batch *</Label>
                    <Input
                      value={l.batch}
                      onChange={(e) => updateLine(i, { batch: e.target.value })}
                      className="mt-1 h-9 font-mono text-[13px]"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <Label className="field-label">Expiry (YYYY-MM) *</Label>
                    <Input
                      value={l.expiry}
                      onChange={(e) => updateLine(i, { expiry: e.target.value })}
                      placeholder="2027-09"
                      className="mt-1 h-9 font-mono text-[13px]"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <Label className="field-label">HSN</Label>
                    <Input
                      value={l.hsn}
                      onChange={(e) => updateLine(i, { hsn: e.target.value })}
                      className="mt-1 h-9 font-mono text-[13px]"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <Label className="field-label">Pack</Label>
                    <Input
                      value={l.packaging}
                      onChange={(e) => updateLine(i, { packaging: e.target.value })}
                      className="mt-1 h-9 text-[13px]"
                    />
                  </div>

                  {/* Row 2 */}
                  <div className="lg:col-span-3">
                    <Label className="field-label">Purchasing UoM</Label>
                    <Select
                      value={l.purchasingUom}
                      onValueChange={(v) => onChangeUoM(i, v as any)}
                    >
                      <SelectTrigger className="mt-1 h-9 text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Primary">Primary — {l.primaryUnit || "—"}</SelectItem>
                        {l.secondaryUnit && (
                          <SelectItem value="Secondary">Secondary — {l.secondaryUnit}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="lg:col-span-1">
                    <Label className="field-label">Qty</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={l.quantity}
                      onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                      className="mt-1 h-9 text-right font-mono text-[13px]"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <Label className="field-label">Free</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={l.freeQuantity}
                      onChange={(e) => updateLine(i, { freeQuantity: Number(e.target.value) })}
                      className="mt-1 h-9 text-right font-mono text-[13px]"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <Label className="field-label">P. Rate / {l.unitLabel || "unit"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={l.purchaseRate}
                      onChange={(e) => updateLine(i, { purchaseRate: Number(e.target.value) })}
                      className="mt-1 h-9 text-right font-mono text-[13px]"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <Label className="field-label">MRP</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={l.mrp}
                      onChange={(e) => updateLine(i, { mrp: Number(e.target.value) })}
                      className="mt-1 h-9 text-right font-mono text-[13px]"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <Label className="field-label">Sale Inc.</Label>
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
                      className="mt-1 h-9 text-right font-mono text-[13px]"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <Label className="field-label">Disc%</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={l.discount}
                      onChange={(e) => updateLine(i, { discount: Number(e.target.value) })}
                      className="mt-1 h-9 text-right font-mono text-[13px]"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <Label className="field-label">{taxType === "IGST" ? "IGST%" : "GST%"}</Label>
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
                      className="mt-1 h-9 text-right font-mono text-[13px]"
                    />
                  </div>
                </div>

                {/* Footer: conv hint + line total */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card-muted/40 px-3 py-2 text-[11px]">
                  <div className="font-mono text-muted-foreground">
                    1 {l.primaryUnit} = {l.purchaseConvAtTime} {l.secondaryUnit} · 1 {l.secondaryUnit} ={" "}
                    {l.sellingConvAtTime} {l.saleUnit}{" "}
                    <span className="ml-2 text-primary">
                      → adds {saleUnits.toFixed(2)} {l.saleUnit} to stock
                    </span>
                  </div>
                  <div className="font-mono text-[12px] font-semibold tabular-nums">
                    {formatINR(amt)}
                  </div>
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLine}
            className="h-8 border-dashed text-[13px]"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Line
          </Button>
        </div>

        {/* Totals */}
        <div className="border-t border-border bg-card-muted/40 px-6 py-4">
          <div className="ml-auto max-w-sm space-y-1.5 text-[13px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pre-Tax</span>
              <span className="font-mono tabular-nums">{formatINR(totals.preTax)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[12px] text-muted-foreground">Overall Discount %</Label>
              <Input
                type="number"
                value={overallDiscountPercent}
                onChange={(e) => setOverallDiscountPercent(Number(e.target.value) || 0)}
                className="h-7 w-20 text-right font-mono text-[12px]"
              />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxable</span>
              <span className="font-mono tabular-nums">{formatINR(totals.taxable)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST ({taxType})</span>
              <span className="font-mono tabular-nums">{formatINR(totals.gst)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-1.5 text-[15px] font-semibold">
              <span>Grand Total</span>
              <span className="font-mono tabular-nums text-primary">{formatINR(totals.grand)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-card px-6 py-3">
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="h-9 w-[200px] text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Draft">Save as Draft</SelectItem>
              <SelectItem value="Completed">Mark Completed (adds stock)</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9">
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="h-9">
            {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-2 h-3.5 w-3.5" />}
            Save Purchase
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Quick-Create product dialog (inline) */}
      <Dialog
        open={quickCreate.open}
        onOpenChange={(v) => setQuickCreate((s) => ({ ...s, open: v }))}
      >
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <PackagePlus className="h-4 w-4 text-primary" />
              Create New Product
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              Add this product to your catalog. Pricing is captured per-batch on the purchase line.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="field-label">Name *</Label>
                <Input
                  value={quickCreate.name}
                  onChange={(e) => setQuickCreate((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Paracetamol 500mg"
                  className="h-9 text-[13px]"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="field-label">Manufacturer</Label>
                <Input
                  value={quickCreate.manufacturer}
                  onChange={(e) => setQuickCreate((s) => ({ ...s, manufacturer: e.target.value }))}
                  placeholder="Cipla, Sun Pharma…"
                  className="h-9 text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="field-label">HSN Code</Label>
                <Input
                  value={quickCreate.hsn}
                  onChange={(e) => setQuickCreate((s) => ({ ...s, hsn: e.target.value }))}
                  placeholder="3004"
                  className="h-9 font-mono text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="field-label">GST Rate %</Label>
                <Input
                  type="number"
                  value={quickCreate.gstRate}
                  onChange={(e) => setQuickCreate((s) => ({ ...s, gstRate: Number(e.target.value) }))}
                  className="h-9 text-right font-mono text-[13px]"
                />
              </div>
            </div>

            <div className="rounded-md border border-border bg-card-muted/40 p-3">
              <p className="section-title mb-2">Units of Measure</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="field-label">Primary (Box)</Label>
                  <Input
                    value={quickCreate.primaryUnit}
                    onChange={(e) =>
                      setQuickCreate((s) => ({ ...s, primaryUnit: e.target.value.toUpperCase() }))
                    }
                    className="h-9 font-mono text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="field-label">Secondary (Strip)</Label>
                  <Input
                    value={quickCreate.secondaryUnit}
                    onChange={(e) =>
                      setQuickCreate((s) => ({ ...s, secondaryUnit: e.target.value.toUpperCase() }))
                    }
                    className="h-9 font-mono text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="field-label">Sale (Tablet)</Label>
                  <Input
                    value={quickCreate.saleUnit}
                    onChange={(e) =>
                      setQuickCreate((s) => ({ ...s, saleUnit: e.target.value.toUpperCase() }))
                    }
                    className="h-9 font-mono text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="field-label">1 {quickCreate.primaryUnit} = ? {quickCreate.secondaryUnit}</Label>
                  <Input
                    type="number"
                    value={quickCreate.purchaseConv}
                    onChange={(e) =>
                      setQuickCreate((s) => ({ ...s, purchaseConv: Number(e.target.value) }))
                    }
                    className="h-9 text-right font-mono text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="field-label">1 {quickCreate.secondaryUnit} = ? {quickCreate.saleUnit}</Label>
                  <Input
                    type="number"
                    value={quickCreate.sellingConv}
                    onChange={(e) =>
                      setQuickCreate((s) => ({ ...s, sellingConv: Number(e.target.value) }))
                    }
                    className="h-9 text-right font-mono text-[13px]"
                  />
                </div>
                <div className="flex items-end">
                  <p className="rounded-md bg-primary-soft px-2 py-1.5 text-[11px] text-primary">
                    1 {quickCreate.primaryUnit} ={" "}
                    <span className="font-mono font-semibold">
                      {quickCreate.purchaseConv * quickCreate.sellingConv}
                    </span>{" "}
                    {quickCreate.saleUnit}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-info/40 bg-info-soft px-3 py-2 text-[12px] text-foreground">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" />
              <span>
                Pricing (MRP, sale rate) will be captured per-batch on the purchase line below. You can
                fine-tune the catalog defaults later from the Inventory page.
              </span>
            </div>
          </div>

          <DialogFooter className="border-t border-border bg-card px-6 py-3">
            <Button
              variant="outline"
              onClick={() => setQuickCreate(emptyQuickCreate())}
              disabled={quickCreate.saving}
            >
              Cancel
            </Button>
            <Button onClick={submitQuickCreate} disabled={quickCreate.saving}>
              {quickCreate.saving ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-2 h-3.5 w-3.5" />
              )}
              Create & Add to Line
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
