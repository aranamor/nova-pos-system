import { FormEvent, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Package } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: any | null;
  onSaved: () => void;
};

const blank = () => ({
  name: "",
  hsn: "",
  batch: "",
  packaging: "",
  quantity: 0,
  mrp: 0,
  purchase_rate: 0,
  sale_rate: 0,
  sale_rate_inclusive: 0,
  expiry: "",
  cgst: 6,
  sgst: 6,
});

export function ProductFormDialog({ open, onOpenChange, initial, onSaved }: Props) {
  const [form, setForm] = useState<any>(blank());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initial ? { ...blank(), ...initial } : blank());
  }, [open, initial]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim() || !form.batch?.trim() || !form.expiry) {
      toast.error("Name, batch and expiry are required");
      return;
    }
    setBusy(true);
    try {
      if (initial?.id) {
        await api.updateProduct(initial.id, form);
        toast.success("Product updated");
      } else {
        await api.createProduct(form);
        toast.success("Product added");
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            {initial?.id ? "Edit Product" : "Add Product"}
          </DialogTitle>
          <DialogDescription>Maintain HSN, batch, expiry, GST and rates.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
          <div className="md:col-span-2 grid gap-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Paracetamol 500mg" />
          </div>
          <div className="grid gap-1.5">
            <Label>HSN</Label>
            <Input value={form.hsn} onChange={(e) => set("hsn", e.target.value)} className="font-mono" />
          </div>
          <div className="grid gap-1.5">
            <Label>Packaging</Label>
            <Input value={form.packaging ?? ""} onChange={(e) => set("packaging", e.target.value)} placeholder="10x10" />
          </div>
          <div className="grid gap-1.5">
            <Label>Batch</Label>
            <Input value={form.batch} onChange={(e) => set("batch", e.target.value)} className="font-mono" />
          </div>
          <div className="grid gap-1.5">
            <Label>Expiry (YYYY-MM)</Label>
            <Input value={form.expiry} onChange={(e) => set("expiry", e.target.value)} placeholder="2027-09" className="font-mono" />
          </div>
          <div className="grid gap-1.5">
            <Label>Quantity</Label>
            <Input type="number" step="0.01" value={form.quantity} onChange={(e) => set("quantity", Number(e.target.value))} />
          </div>
          <div className="grid gap-1.5">
            <Label>MRP</Label>
            <Input type="number" step="0.01" value={form.mrp} onChange={(e) => set("mrp", Number(e.target.value))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Purchase Rate</Label>
            <Input type="number" step="0.01" value={form.purchase_rate} onChange={(e) => set("purchase_rate", Number(e.target.value))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Sale Rate (Pre-tax)</Label>
            <Input type="number" step="0.01" value={form.sale_rate} onChange={(e) => set("sale_rate", Number(e.target.value))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Sale Rate (Inclusive)</Label>
            <Input type="number" step="0.01" value={form.sale_rate_inclusive} onChange={(e) => set("sale_rate_inclusive", Number(e.target.value))} />
          </div>
          <div className="grid gap-1.5">
            <Label>CGST %</Label>
            <Input type="number" step="0.01" value={form.cgst} onChange={(e) => set("cgst", Number(e.target.value))} />
          </div>
          <div className="grid gap-1.5">
            <Label>SGST %</Label>
            <Input type="number" step="0.01" value={form.sgst} onChange={(e) => set("sgst", Number(e.target.value))} />
          </div>

          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {initial?.id ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
