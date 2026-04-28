import { FormEvent, useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Package } from "lucide-react";
import { api } from "@/lib/api";
import { CATEGORIES, UNITS, GST_RATES } from "@/lib/constants";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: any | null;
  onSaved: () => void;
};

const blank = () => ({
  name: "",
  manufacturer: "",
  hsn: "",
  content: "",
  packing_size: "",
  category: "GENERAL",
  primary_unit: "BOX",
  secondary_unit: "STRIP",
  purchase_conv_multiplier: 10,
  sale_unit: "TABLET",
  selling_conv_multiplier: 10,
  gst_rate: 12,
  mrp: 0,
  sale_rate_excl: 0,
  sale_rate_incl: 0,
  is_h1: false,
  is_narcotic: false,
  is_prescription_required: false,
});

function adopt(initial: any | null | undefined) {
  if (!initial) return blank();
  return {
    ...blank(),
    ...initial,
    name: initial.name ?? "",
    manufacturer: initial.manufacturer ?? "",
    hsn: initial.hsn ?? "",
    content: initial.content ?? "",
    packing_size: initial.packing_size ?? initial.packingSize ?? "",
    category: initial.category ?? "GENERAL",
    primary_unit: initial.primary_unit ?? initial.primaryUnit ?? "BOX",
    secondary_unit: initial.secondary_unit ?? initial.secondaryUnit ?? "STRIP",
    purchase_conv_multiplier: Number(initial.purchase_conv_multiplier ?? initial.purchaseConvMultiplier ?? 10),
    sale_unit: initial.sale_unit ?? initial.saleUnit ?? "TABLET",
    selling_conv_multiplier: Number(initial.selling_conv_multiplier ?? initial.sellingConvMultiplier ?? 10),
    gst_rate: Number(initial.gst_rate ?? initial.gstRate ?? 12),
    mrp: Number(initial.mrp ?? 0),
    sale_rate_excl: Number(initial.sale_rate_excl ?? initial.saleRateExcl ?? 0),
    sale_rate_incl: Number(initial.sale_rate_incl ?? initial.saleRateIncl ?? 0),
    is_h1: !!(initial.is_h1 ?? initial.isH1),
    is_narcotic: !!(initial.is_narcotic ?? initial.isNarcotic),
    is_prescription_required: !!(initial.is_prescription_required ?? initial.isPrescriptionRequired),
  };
}

export function ProductFormDialog({ open, onOpenChange, initial, onSaved }: Props) {
  const [form, setForm] = useState<any>(blank());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(adopt(initial));
  }, [open, initial]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  // Auto-calc excl <-> incl when GST rate or one of the prices changes.
  const recalcInclFromExcl = (excl: number, gst: number) => +(excl * (1 + gst / 100)).toFixed(2);
  const recalcExclFromIncl = (incl: number, gst: number) => +(incl / (1 + gst / 100)).toFixed(2);

  const onChangeExcl = (v: number) => {
    const incl = recalcInclFromExcl(v, Number(form.gst_rate));
    setForm((p: any) => ({ ...p, sale_rate_excl: v, sale_rate_incl: incl }));
  };
  const onChangeIncl = (v: number) => {
    const excl = recalcExclFromIncl(v, Number(form.gst_rate));
    setForm((p: any) => ({ ...p, sale_rate_incl: v, sale_rate_excl: excl }));
  };
  const onChangeGst = (v: string) => {
    const gst = Number(v);
    const excl = Number(form.sale_rate_excl);
    setForm((p: any) => ({
      ...p,
      gst_rate: gst,
      sale_rate_incl: recalcInclFromExcl(excl, gst),
    }));
  };

  const totalSaleUnitsPerPrimary = useMemo(
    () => Number(form.purchase_conv_multiplier || 0) * Number(form.selling_conv_multiplier || 0),
    [form.purchase_conv_multiplier, form.selling_conv_multiplier],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) {
      toast.error("Product name is required");
      return;
    }
    setBusy(true);
    try {
      if (initial?.id) {
        await api.updateProduct(initial.id, form);
        toast.success("Product updated");
      } else {
        await api.createProduct(form);
        toast.success("Product added to catalog");
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            {initial?.id ? "Edit Product" : "Add Product to Catalog"}
          </DialogTitle>
          <DialogDescription>
            Add a product to your catalog. Stock comes from a Purchase entry — products start with 0 stock.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={submit}>
          {/* Basic Info */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Basic Information
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2 grid gap-1.5">
                <Label>Product Name *</Label>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Pantoprazole 40mg" />
              </div>
              <div className="grid gap-1.5">
                <Label>Manufacturer</Label>
                <Input value={form.manufacturer ?? ""} onChange={(e) => set("manufacturer", e.target.value)} placeholder="e.g. Sun Pharma" />
              </div>
              <div className="grid gap-1.5">
                <Label>HSN Code</Label>
                <Input value={form.hsn ?? ""} onChange={(e) => set("hsn", e.target.value)} className="font-mono" placeholder="3004" />
              </div>
              <div className="grid gap-1.5">
                <Label>Packing Size</Label>
                <Input value={form.packing_size ?? ""} onChange={(e) => set("packing_size", e.target.value)} placeholder="10 x 10" />
              </div>
              <div className="grid gap-1.5">
                <Label>Category</Label>
                <Select value={form.category ?? ""} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 grid gap-1.5">
                <Label>Composition / Content</Label>
                <Textarea
                  value={form.content ?? ""}
                  onChange={(e) => set("content", e.target.value)}
                  rows={2}
                  placeholder="e.g. Pantoprazole 40mg + Domperidone 30mg"
                />
              </div>
            </div>
          </section>

          {/* Compliance */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Compliance Flags
            </h3>
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!form.is_h1} onCheckedChange={(v) => set("is_h1", !!v)} />
                H1 Drug
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!form.is_narcotic} onCheckedChange={(v) => set("is_narcotic", !!v)} />
                Narcotic
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={!!form.is_prescription_required}
                  onCheckedChange={(v) => set("is_prescription_required", !!v)}
                />
                Rx (Prescription)
              </label>
            </div>
          </section>

          {/* Units */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Unit Conversion Engine
            </h3>
            <div className="grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 md:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Primary Purchase Unit</Label>
                <Select value={form.primary_unit} onValueChange={(v) => set("primary_unit", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Purchase Conv. Multiplier</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.purchase_conv_multiplier}
                  onChange={(e) => set("purchase_conv_multiplier", Number(e.target.value))}
                />
                <span className="text-[11px] text-muted-foreground">
                  1 {form.primary_unit} = {form.purchase_conv_multiplier} {form.secondary_unit}
                </span>
              </div>
              <div className="grid gap-1.5">
                <Label>Secondary Purchase Unit</Label>
                <Select value={form.secondary_unit ?? ""} onValueChange={(v) => set("secondary_unit", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label>Sale Unit</Label>
                <Select value={form.sale_unit} onValueChange={(v) => set("sale_unit", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Selling Conv. Multiplier</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.selling_conv_multiplier}
                  onChange={(e) => set("selling_conv_multiplier", Number(e.target.value))}
                />
                <span className="text-[11px] text-muted-foreground">
                  1 {form.secondary_unit} = {form.selling_conv_multiplier} {form.sale_unit}
                </span>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Total Sale Units / Primary</Label>
                <div className="flex h-9 items-center rounded-md border border-border/60 bg-background/50 px-3 font-mono text-sm font-semibold text-primary">
                  {totalSaleUnitsPerPrimary} {form.sale_unit}
                </div>
              </div>
            </div>
          </section>

          {/* Tax & Pricing */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tax & Pricing (per {form.sale_unit})
            </h3>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="grid gap-1.5">
                <Label>GST Rate</Label>
                <Select value={String(form.gst_rate)} onValueChange={onChangeGst}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GST_RATES.map((r) => (
                      <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>MRP</Label>
                <Input type="number" step="0.01" value={form.mrp} onChange={(e) => set("mrp", Number(e.target.value))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Sale Rate (Excl.)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.sale_rate_excl}
                  onChange={(e) => onChangeExcl(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Sale Rate (Incl.)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.sale_rate_incl}
                  onChange={(e) => onChangeIncl(Number(e.target.value))}
                />
              </div>
            </div>
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className=""
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {initial?.id ? "Update Product" : "Add to Catalog"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
