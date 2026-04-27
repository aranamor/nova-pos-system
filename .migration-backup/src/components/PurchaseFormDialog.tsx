import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

type LineItem = {
  product_id?: number | string;
  name: string;
  batch: string;
  expiry: string;
  quantity: number;
  purchase_rate: number;
  cgst: number;
  sgst: number;
  igst: number;
};

const emptyLine = (): LineItem => ({
  name: "", batch: "", expiry: "", quantity: 1, purchase_rate: 0, cgst: 6, sgst: 6, igst: 0,
});

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
};

export function PurchaseFormDialog({ open, onOpenChange, onSaved }: Props) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [invoice, setInvoice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [taxType, setTaxType] = useState<"Local" | "Interstate">("Local");
  const [status, setStatus] = useState<"Draft" | "Completed">("Draft");
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.suppliers().then(setSuppliers);
    api.products().then(setProducts);
    setInvoice(`PUR-${Date.now().toString().slice(-6)}`);
    setLines([emptyLine()]);
    setSupplierId("");
    setStatus("Draft");
    setTaxType("Local");
  }, [open]);

  const totals = useMemo(() => {
    let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
    lines.forEach(l => {
      const base = (Number(l.quantity) || 0) * (Number(l.purchase_rate) || 0);
      subtotal += base;
      if (taxType === "Local") {
        cgst += (base * (Number(l.cgst) || 0)) / 100;
        sgst += (base * (Number(l.sgst) || 0)) / 100;
      } else {
        igst += (base * (Number(l.igst) || 0)) / 100;
      }
    });
    const grand = subtotal + cgst + sgst + igst;
    return { subtotal, cgst, sgst, igst, grand };
  }, [lines, taxType]);

  const updateLine = (i: number, patch: Partial<LineItem>) =>
    setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const pickProduct = (i: number, productId: string) => {
    const p = products.find(x => String(x.id) === productId);
    if (!p) return;
    updateLine(i, {
      product_id: p.id, name: p.name, batch: p.batch, expiry: p.expiry,
      purchase_rate: p.purchase_rate, cgst: p.cgst, sgst: p.sgst, igst: p.cgst + p.sgst,
    });
  };

  const save = async () => {
    if (!supplierId) { toast({ title: "Select a supplier", variant: "destructive" }); return; }
    if (!lines.length || !lines.some(l => l.name && l.quantity > 0)) {
      toast({ title: "Add at least one line item", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const supplier = suppliers.find(s => String(s.id) === supplierId);
      const items = lines
        .filter(l => l.name && l.quantity > 0)
        .map(l => ({
          ...l,
          amount: (l.quantity * l.purchase_rate) * (1 + (taxType === "Local" ? (l.cgst + l.sgst) : l.igst) / 100),
        }));
      await api.createPurchase({
        invoice_number: invoice,
        supplier_id: supplier?.id,
        supplier_name: supplier?.name,
        purchase_date: date,
        status, tax_type: taxType,
        subtotal: totals.subtotal, cgst: totals.cgst, sgst: totals.sgst, igst: totals.igst,
        grand_total: totals.grand,
        items,
      });
      toast({ title: "Purchase saved", description: `${invoice} • ${formatINR(totals.grand)}` });
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> New Purchase</DialogTitle>
          <DialogDescription>Record inward supply from a vendor with batch and tax details.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Invoice #</Label>
            <Input value={invoice} onChange={e => setInvoice(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>
                {suppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tax Type</Label>
            <Select value={taxType} onValueChange={v => setTaxType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Local">Local (CGST + SGST)</SelectItem>
                <SelectItem value="Interstate">Interstate (IGST)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left">Product</th>
                <th className="px-2 py-2 text-left">Batch</th>
                <th className="px-2 py-2 text-left">Expiry</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2 text-right">Rate</th>
                <th className="px-2 py-2 text-right">{taxType === "Local" ? "GST%" : "IGST%"}</th>
                <th className="px-2 py-2 text-right">Amount</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const base = (l.quantity || 0) * (l.purchase_rate || 0);
                const taxPct = taxType === "Local" ? (l.cgst + l.sgst) : l.igst;
                const amt = base * (1 + taxPct / 100);
                return (
                  <tr key={i} className="border-t border-border/60">
                    <td className="px-2 py-1.5 min-w-[200px]">
                      <Select value={l.product_id ? String(l.product_id) : ""} onValueChange={v => pickProduct(i, v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder={l.name || "Pick product"} /></SelectTrigger>
                        <SelectContent>
                          {products.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1.5"><Input value={l.batch} onChange={e => updateLine(i, { batch: e.target.value })} className="h-9 font-mono" /></td>
                    <td className="px-2 py-1.5"><Input value={l.expiry} onChange={e => updateLine(i, { expiry: e.target.value })} placeholder="YYYY-MM" className="h-9 w-24 font-mono" /></td>
                    <td className="px-2 py-1.5"><Input type="number" value={l.quantity} onChange={e => updateLine(i, { quantity: Number(e.target.value) })} className="h-9 w-20 text-right font-mono" /></td>
                    <td className="px-2 py-1.5"><Input type="number" value={l.purchase_rate} onChange={e => updateLine(i, { purchase_rate: Number(e.target.value) })} className="h-9 w-24 text-right font-mono" /></td>
                    <td className="px-2 py-1.5">
                      <Input type="number" value={taxType === "Local" ? l.cgst + l.sgst : l.igst}
                        onChange={e => {
                          const v = Number(e.target.value);
                          if (taxType === "Local") updateLine(i, { cgst: v / 2, sgst: v / 2 });
                          else updateLine(i, { igst: v });
                        }}
                        className="h-9 w-16 text-right font-mono" />
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">{formatINR(amt)}</td>
                    <td className="px-2 py-1.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}>
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
          <Button variant="outline" size="sm" onClick={() => setLines(p => [...p, emptyLine()])}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Line
          </Button>
          <div className="space-y-1 text-sm md:min-w-[260px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatINR(totals.subtotal)}</span></div>
            {taxType === "Local" ? (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span className="font-mono">{formatINR(totals.cgst)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span className="font-mono">{formatINR(totals.sgst)}</span></div>
              </>
            ) : (
              <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span className="font-mono">{formatINR(totals.igst)}</span></div>
            )}
            <div className="mt-1 flex justify-between border-t border-border/60 pt-1 text-base font-semibold">
              <span>Grand Total</span><span className="font-mono">{formatINR(totals.grand)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Select value={status} onValueChange={v => setStatus(v as any)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Draft">Save as Draft</SelectItem>
              <SelectItem value="Completed">Mark Completed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
            {saving ? "Saving…" : "Save Purchase"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
