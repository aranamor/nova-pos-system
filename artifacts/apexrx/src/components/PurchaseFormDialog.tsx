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
  Check,
  AlertCircle,
  Gift,
  Edit2,
  RotateCcw,
  Inbox,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---- Types ----------------------------------------------------------------
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
};

type FormItem = LineItem & {
  _search: string;
  _suggestions: any[];
  _showDrop: boolean;
  _searching: boolean;
};

const blankLine = (): LineItem => ({
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
});

const blankForm = (): FormItem => ({
  ...blankLine(),
  _search: "",
  _suggestions: [],
  _showDrop: false,
  _searching: false,
});

// ---- Quick create ---------------------------------------------------------
type QuickCreateState = {
  open: boolean;
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

const blankQuickCreate = (name = ""): QuickCreateState => ({
  open: false,
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

// ---- Math helpers ---------------------------------------------------------
function lineTaxPct(l: LineItem, taxType: "CSGST" | "IGST") {
  return taxType === "IGST"
    ? Number(l.purchase_igst) || 0
    : (Number(l.purchase_cgst) || 0) + (Number(l.purchase_sgst) || 0);
}
function lineMath(l: LineItem, taxType: "CSGST" | "IGST") {
  const gross = (Number(l.quantity) || 0) * (Number(l.purchaseRate) || 0);
  const discAmt = gross * ((Number(l.discount) || 0) / 100);
  const taxable = gross - discAmt;
  const gstPct = lineTaxPct(l, taxType);
  const gstAmt = taxable * (gstPct / 100);
  const total = taxable + gstAmt;
  return { gross, discAmt, taxable, gstPct, gstAmt, total };
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
};

export function PurchaseFormDialog({ open, onOpenChange, onSaved }: Props) {
  // ---- Bill header ----
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierName, setSupplierName] = useState<string>("");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [taxType, setTaxType] = useState<"CSGST" | "IGST">("CSGST");
  const [overallDiscountPercent, setOverallDiscountPercent] = useState(0);
  const [status, setStatus] = useState<"Draft" | "Completed">("Completed");

  // ---- Item entry form + committed grid ----
  const [form, setForm] = useState<FormItem>(blankForm());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [lines, setLines] = useState<LineItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [quickCreate, setQuickCreate] = useState<QuickCreateState>(blankQuickCreate());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productInputRef = useRef<HTMLInputElement | null>(null);

  // ---- Reset on open ----
  useEffect(() => {
    if (!open) return;
    api.suppliers().then(setSuppliers).catch(() => {});
    setBillNumber(`PUR-${Date.now().toString().slice(-6)}`);
    setBillDate(new Date().toISOString().slice(0, 10));
    setLines([]);
    setForm(blankForm());
    setEditingIndex(null);
    setSupplierName("");
    setStatus("Completed");
    setTaxType("CSGST");
    setOverallDiscountPercent(0);
    setQuickCreate(blankQuickCreate());
  }, [open]);

  const updateForm = (patch: Partial<FormItem>) => setForm((f) => ({ ...f, ...patch }));

  // ---- Product search ----
  const onSearchInput = (value: string) => {
    updateForm({
      _search: value,
      productName: value,
      _showDrop: true,
      _searching: value.length >= 2,
    });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!value || value.length < 2) {
        updateForm({ _suggestions: [], _searching: false });
        return;
      }
      try {
        const results = await api.productSearch(value);
        updateForm({ _suggestions: results, _searching: false });
      } catch {
        updateForm({ _suggestions: [], _searching: false });
      }
    }, 200);
  };

  const pickProduct = (p: any) => {
    const gst = Number(p.gst_rate ?? p.gstRate ?? 0);
    const half = gst / 2;
    updateForm({
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

  const openQuickCreate = (name: string) => {
    setQuickCreate({ ...blankQuickCreate(name.trim()), open: true });
    updateForm({ _showDrop: false });
  };

  const submitQuickCreate = async () => {
    const qc = quickCreate;
    if (!qc.name.trim()) {
      toast.error("Product name is required");
      return;
    }
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
      pickProduct({
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
      setQuickCreate(blankQuickCreate());
      toast.success(`"${qc.name}" added to catalog`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create product");
    } finally {
      setQuickCreate((s) => ({ ...s, saving: false }));
    }
  };

  const onChangeUoM = (uom: "Primary" | "Secondary") => {
    updateForm({
      purchasingUom: uom,
      unitLabel: uom === "Primary" ? form.primaryUnit : form.secondaryUnit,
    });
  };

  // ---- Validate form ----
  const formErrors = useMemo(() => {
    const errs: string[] = [];
    if (!form.productId) errs.push("Pick a product");
    if (!form.batch.trim()) errs.push("Batch is required");
    if (!form.expiry.trim()) errs.push("Expiry is required");
    if (Number(form.quantity) <= 0 && Number(form.freeQuantity) <= 0)
      errs.push("Enter Quantity or Free Qty");
    return errs;
  }, [form]);

  // ---- Add / Update line ----
  const commit = (asFree = false) => {
    if (formErrors.length) {
      toast.error(formErrors[0]);
      return;
    }
    const base: LineItem = { ...form };
    if (asFree) {
      // "Add Free Item" — move whatever quantity was entered into freeQuantity, zero out quantity & rate
      const moved = Number(form.quantity) > 0 ? Number(form.quantity) : Number(form.freeQuantity);
      base.freeQuantity = moved;
      base.quantity = 0;
      base.purchaseRate = 0;
      base.discount = 0;
    }
    if (editingIndex != null) {
      setLines((prev) => prev.map((l, idx) => (idx === editingIndex ? base : l)));
      toast.success(`Updated ${base.productName}`);
    } else {
      setLines((prev) => [...prev, base]);
      toast.success(`${asFree ? "Free " : ""}${base.productName} added`);
    }
    // reset form for next entry
    setForm(blankForm());
    setEditingIndex(null);
    setTimeout(() => productInputRef.current?.focus(), 50);
  };

  const editLine = (i: number) => {
    const l = lines[i];
    setForm({
      ...l,
      _search: l.productName,
      _suggestions: [],
      _showDrop: false,
      _searching: false,
    });
    setEditingIndex(i);
    setTimeout(() => productInputRef.current?.focus(), 50);
  };

  const cancelEdit = () => {
    setForm(blankForm());
    setEditingIndex(null);
  };

  const removeLine = (i: number) => {
    if (!confirm(`Remove "${lines[i].productName}" from this bill?`)) return;
    setLines((prev) => prev.filter((_, idx) => idx !== i));
    if (editingIndex === i) cancelEdit();
  };

  // ---- Totals ----
  const totals = useMemo(() => {
    let preTax = 0;
    for (const l of lines) {
      const m = lineMath(l, taxType);
      preTax += m.taxable;
    }
    const overallAmt = preTax * ((Number(overallDiscountPercent) || 0) / 100);
    const taxable = preTax - overallAmt;
    let gst = 0;
    for (const l of lines) {
      const m = lineMath(l, taxType);
      const finalTaxable = m.taxable * (1 - (Number(overallDiscountPercent) || 0) / 100);
      gst += finalTaxable * (m.gstPct / 100);
    }
    const grand = Math.round(taxable + gst);
    return { preTax, overallAmt, taxable, gst, grand };
  }, [lines, taxType, overallDiscountPercent]);

  const save = async () => {
    if (!supplierName) {
      toast.error("Select or enter a supplier");
      return;
    }
    if (!lines.length) {
      toast.error("Add at least one item to the bill");
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
        items: lines.map((l) => ({
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
      <DialogContent className="max-h-[96vh] max-w-[95vw] overflow-y-auto p-0 xl:max-w-[1400px]">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <FileText className="h-4 w-4 text-primary" />
            New Purchase Bill
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            Record an inward purchase. Stock is added to the chosen batches once you mark this as Completed.
          </DialogDescription>
        </DialogHeader>

        {/* ============= SECTION 1 — BILL DETAILS ============= */}
        <section className="border-b border-border px-6 py-4">
          <h3 className="section-title mb-3">1 · Bill Details</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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
        </section>

        {/* ============= SECTION 2 — ITEM ENTRY FORM ============= */}
        <section className="border-b border-border bg-card-muted/40 px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="section-title">
              2 · {editingIndex != null ? `Edit Item #${editingIndex + 1}` : "Add Item"}
            </h3>
            {editingIndex != null && (
              <span className="pill bg-info-soft text-info">editing</span>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-12">
            {/* Product search (with quick-create) */}
            <div className="relative md:col-span-4">
              <Label className="field-label">Product Name *</Label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={productInputRef}
                  value={form._search || form.productName}
                  onChange={(e) => onSearchInput(e.target.value)}
                  onFocus={() => updateForm({ _showDrop: true })}
                  onBlur={() => setTimeout(() => updateForm({ _showDrop: false }), 180)}
                  placeholder="Search catalog or type a new product…"
                  className="h-9 pl-8 text-[13px]"
                />
                {form._searching && (
                  <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              {form._showDrop && (form._search || "").length >= 2 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-popover shadow-popover">
                  {form._suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickProduct(s);
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
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      openQuickCreate(form._search);
                    }}
                    className="flex w-full items-start gap-2 bg-primary-soft/40 px-3 py-2.5 text-left transition-colors hover:bg-primary-soft"
                  >
                    <PackagePlus className="mt-0.5 h-3.5 w-3.5 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-primary">
                        Create new product{form._search ? `: "${form._search}"` : ""}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {form._suggestions.length === 0
                          ? "Nothing matched — add it to your catalog now."
                          : "Add a different product not in the list above."}
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <Label className="field-label">Pack</Label>
              <Input
                value={form.packaging}
                onChange={(e) => updateForm({ packaging: e.target.value })}
                placeholder="10x10"
                className="mt-1 h-9 text-[13px]"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="field-label">HSN</Label>
              <Input
                value={form.hsn}
                onChange={(e) => updateForm({ hsn: e.target.value })}
                className="mt-1 h-9 font-mono text-[13px]"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="field-label">Batch No *</Label>
              <Input
                value={form.batch}
                onChange={(e) => updateForm({ batch: e.target.value })}
                className="mt-1 h-9 font-mono text-[13px]"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="field-label">Expiry (YYYY-MM) *</Label>
              <Input
                value={form.expiry}
                onChange={(e) => updateForm({ expiry: e.target.value })}
                placeholder="2027-09"
                className="mt-1 h-9 font-mono text-[13px]"
              />
            </div>

            {/* Row 2 */}
            <div className="md:col-span-3">
              <Label className="field-label">Purchasing UoM</Label>
              <Select
                value={form.purchasingUom}
                onValueChange={(v) => onChangeUoM(v as any)}
              >
                <SelectTrigger className="mt-1 h-9 text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Primary">Primary — {form.primaryUnit || "—"}</SelectItem>
                  {form.secondaryUnit && (
                    <SelectItem value="Secondary">Secondary — {form.secondaryUnit}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1">
              <Label className="field-label">Qty</Label>
              <Input
                type="number"
                step="0.01"
                value={form.quantity}
                onChange={(e) => updateForm({ quantity: Number(e.target.value) })}
                className="mt-1 h-9 text-right font-mono text-[13px]"
              />
            </div>
            <div className="md:col-span-1">
              <Label className="field-label">Free</Label>
              <Input
                type="number"
                step="0.01"
                value={form.freeQuantity}
                onChange={(e) => updateForm({ freeQuantity: Number(e.target.value) })}
                className="mt-1 h-9 text-right font-mono text-[13px]"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="field-label">P. Rate / {form.unitLabel || "unit"}</Label>
              <Input
                type="number"
                step="0.01"
                value={form.purchaseRate}
                onChange={(e) => updateForm({ purchaseRate: Number(e.target.value) })}
                className="mt-1 h-9 text-right font-mono text-[13px]"
              />
            </div>
            <div className="md:col-span-1">
              <Label className="field-label">MRP</Label>
              <Input
                type="number"
                step="0.01"
                value={form.mrp}
                onChange={(e) => updateForm({ mrp: Number(e.target.value) })}
                className="mt-1 h-9 text-right font-mono text-[13px]"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="field-label">Sale Inc.</Label>
              <Input
                type="number"
                step="0.01"
                value={form.saleRateIncl}
                onChange={(e) =>
                  updateForm({
                    saleRateIncl: Number(e.target.value),
                    saleRate:
                      Number(e.target.value) /
                      (1 + (Number(form.sale_cgst) + Number(form.sale_sgst)) / 100),
                  })
                }
                className="mt-1 h-9 text-right font-mono text-[13px]"
              />
            </div>
            <div className="md:col-span-1">
              <Label className="field-label">Disc%</Label>
              <Input
                type="number"
                step="0.01"
                value={form.discount}
                onChange={(e) => updateForm({ discount: Number(e.target.value) })}
                className="mt-1 h-9 text-right font-mono text-[13px]"
              />
            </div>
            <div className="md:col-span-1">
              <Label className="field-label">{taxType === "IGST" ? "IGST%" : "GST%"}</Label>
              <Input
                type="number"
                step="0.01"
                value={
                  taxType === "IGST"
                    ? form.purchase_igst
                    : form.purchase_cgst + form.purchase_sgst
                }
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (taxType === "IGST") updateForm({ purchase_igst: v });
                  else
                    updateForm({
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

          {/* Action buttons */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="font-mono text-[11px] text-muted-foreground">
              {form.productId ? (
                <>
                  1 {form.primaryUnit} = {form.purchaseConvAtTime} {form.secondaryUnit} · 1{" "}
                  {form.secondaryUnit} = {form.sellingConvAtTime} {form.saleUnit}
                </>
              ) : (
                <span className="text-muted-foreground/70">Pick or create a product to begin</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {editingIndex != null ? (
                <>
                  <Button variant="ghost" size="sm" className="h-9" onClick={cancelEdit}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Cancel Edit
                  </Button>
                  <Button size="sm" className="h-9" onClick={() => commit(false)}>
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Update Item
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => commit(true)}
                    title="Adds the entered quantity as Free Qty (no charge)"
                  >
                    <Gift className="mr-1.5 h-3.5 w-3.5" />
                    Add Free Item
                  </Button>
                  <Button size="sm" className="h-9" onClick={() => commit(false)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add Item
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ============= SECTION 3 — ITEMS GRID ============= */}
        <section className="border-b border-border px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="section-title">
              3 · Items in Bill{" "}
              <span className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-normal">
                {lines.length}
              </span>
            </h3>
            {lines.length > 0 && (
              <span className="font-mono text-[11px] text-muted-foreground">
                Click a row's pencil to edit · trash to remove
              </span>
            )}
          </div>

          <div className="surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table min-w-[1400px]">
                <thead>
                  <tr>
                    <th className="w-10 text-center">#</th>
                    <th className="min-w-[180px]">Product Name</th>
                    <th>Pack Size</th>
                    <th className="text-right">Quantity</th>
                    <th>Batch No</th>
                    <th>Expiry</th>
                    <th className="text-right">Free Qty</th>
                    <th className="text-right">P. Rate</th>
                    <th className="text-right">Sale Rate</th>
                    <th className="text-right">GST%</th>
                    <th className="text-right">Disc%</th>
                    <th className="text-right">Disc Amt</th>
                    <th className="text-right">Taxable</th>
                    <th className="text-right">GST Amt</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">MRP</th>
                    <th className="w-20 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={17} className="py-12 text-center">
                        <div className="mx-auto flex max-w-xs flex-col items-center gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                            <Inbox className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <p className="text-[13px] font-medium">No items yet</p>
                          <p className="text-[12px] text-muted-foreground">
                            Fill the form above and click <span className="font-semibold">Add Item</span> to populate this grid.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {lines.map((l, i) => {
                    const m = lineMath(l, taxType);
                    const isFree = Number(l.quantity) === 0 && Number(l.freeQuantity) > 0;
                    return (
                      <tr
                        key={i}
                        className={cn(
                          editingIndex === i && "bg-info-soft/40",
                          isFree && "bg-success-soft/30",
                        )}
                      >
                        <td className="text-center font-mono text-muted-foreground">
                          {(i + 1).toString().padStart(2, "0")}
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5 text-[13px] font-medium">
                            {l.productName}
                            {isFree && (
                              <span className="pill bg-success-soft text-success">FREE</span>
                            )}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            HSN {l.hsn || "—"}
                          </div>
                        </td>
                        <td className="text-[12px]">{l.packaging || "—"}</td>
                        <td className="text-right font-mono tabular-nums">
                          {Number(l.quantity).toFixed(2)}{" "}
                          <span className="text-[10px] text-muted-foreground">{l.unitLabel}</span>
                        </td>
                        <td className="font-mono text-[12px]">{l.batch}</td>
                        <td className="font-mono text-[12px]">{l.expiry}</td>
                        <td className="text-right font-mono tabular-nums">
                          {Number(l.freeQuantity).toFixed(2)}{" "}
                          <span className="text-[10px] text-muted-foreground">{l.unitLabel}</span>
                        </td>
                        <td className="text-right font-mono tabular-nums">
                          {formatINR(l.purchaseRate)}
                        </td>
                        <td className="text-right font-mono tabular-nums">
                          {formatINR(l.saleRateIncl)}
                        </td>
                        <td className="text-right font-mono tabular-nums">
                          {m.gstPct.toFixed(2)}%
                        </td>
                        <td className="text-right font-mono tabular-nums">
                          {Number(l.discount).toFixed(2)}%
                        </td>
                        <td className="text-right font-mono tabular-nums text-muted-foreground">
                          {formatINR(m.discAmt)}
                        </td>
                        <td className="text-right font-mono tabular-nums">
                          {formatINR(m.taxable)}
                        </td>
                        <td className="text-right font-mono tabular-nums text-muted-foreground">
                          {formatINR(m.gstAmt)}
                        </td>
                        <td className="text-right font-mono font-semibold tabular-nums">
                          {formatINR(m.total)}
                        </td>
                        <td className="text-right font-mono tabular-nums">{formatINR(l.mrp)}</td>
                        <td className="text-center">
                          <div className="flex justify-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => editLine(i)}
                              title="Edit"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive-soft hover:text-destructive"
                              onClick={() => removeLine(i)}
                              title="Remove"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ============= SECTION 4 — TOTALS ============= */}
        <section className="bg-card-muted/40 px-6 py-4">
          <div className="ml-auto max-w-sm space-y-1.5 text-[13px]">
            <h3 className="section-title mb-2">4 · Bill Totals</h3>
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
        </section>

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
            {saving ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="mr-2 h-3.5 w-3.5" />
            )}
            Save Purchase
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Quick-Create product dialog */}
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
                  onChange={(e) =>
                    setQuickCreate((s) => ({ ...s, manufacturer: e.target.value }))
                  }
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
                  onChange={(e) =>
                    setQuickCreate((s) => ({ ...s, gstRate: Number(e.target.value) }))
                  }
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
                      setQuickCreate((s) => ({
                        ...s,
                        primaryUnit: e.target.value.toUpperCase(),
                      }))
                    }
                    className="h-9 font-mono text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="field-label">Secondary (Strip)</Label>
                  <Input
                    value={quickCreate.secondaryUnit}
                    onChange={(e) =>
                      setQuickCreate((s) => ({
                        ...s,
                        secondaryUnit: e.target.value.toUpperCase(),
                      }))
                    }
                    className="h-9 font-mono text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="field-label">Sale (Tablet)</Label>
                  <Input
                    value={quickCreate.saleUnit}
                    onChange={(e) =>
                      setQuickCreate((s) => ({
                        ...s,
                        saleUnit: e.target.value.toUpperCase(),
                      }))
                    }
                    className="h-9 font-mono text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="field-label">
                    1 {quickCreate.primaryUnit} = ? {quickCreate.secondaryUnit}
                  </Label>
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
                  <Label className="field-label">
                    1 {quickCreate.secondaryUnit} = ? {quickCreate.saleUnit}
                  </Label>
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
                Pricing (MRP, sale rate) will be captured per-batch on the purchase line below. You
                can fine-tune the catalog defaults later from the Inventory page.
              </span>
            </div>
          </div>

          <DialogFooter className="border-t border-border bg-card px-6 py-3">
            <Button
              variant="outline"
              onClick={() => setQuickCreate(blankQuickCreate())}
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
              Create & Use
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
