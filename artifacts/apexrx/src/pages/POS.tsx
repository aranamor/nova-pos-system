import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Trash2,
  Plus,
  Receipt,
  PauseCircle,
  Search,
  FileClock,
  Loader2,
  History,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatINR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface CartLine {
  product_id: number;
  batch_id: number;
  name: string;
  batch: string;
  hsn?: string;
  expiry?: string;
  mrp: number;
  rate: number;
  quantity: number;
  discount: number;
  cgst: number;
  sgst: number;
  available: number;
  is_h1?: boolean;
  is_narcotic?: boolean;
  is_prescription_required?: boolean;
}

export default function POS() {
  const [searchRows, setSearchRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [heldBills, setHeldBills] = useState<any[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [patient, setPatient] = useState({ name: "", mobile: "", doctor: "" });
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [recallOpen, setRecallOpen] = useState(false);
  const [recallLoading, setRecallLoading] = useState(false);
  const [editingBillId, setEditingBillId] = useState<number | null>(null);

  const loadCustomers = () => api.customers().then(setCustomers).catch(() => {});
  const loadHeld = () => api.heldBills().then(setHeldBills).catch(() => {});

  useEffect(() => {
    loadCustomers();
    loadHeld();
  }, []);

  // Debounced product+batch search
  useEffect(() => {
    if (!search || search.length < 2) {
      setSearchRows([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const rows = await api.inventoryFlat(search);
        setSearchRows(rows.slice(0, 12));
      } catch {
        setSearchRows([]);
      } finally {
        setSearchLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  const addToCart = (row: any) => {
    const batchId = Number(row.batch_id);
    if (!batchId) {
      toast.error("This product has no stock batch — record a purchase first.");
      return;
    }
    const available = Number(row.quantity ?? 0);
    if (available <= 0) {
      toast.error("Selected batch has no stock.");
      return;
    }
    const gst = Number(row.gst_rate ?? 0);
    setCart((c) => {
      const existing = c.find((x) => x.batch_id === batchId);
      if (existing) {
        return c.map((x) =>
          x.batch_id === batchId
            ? { ...x, quantity: Math.min(x.quantity + 1, available) }
            : x,
        );
      }
      return [
        ...c,
        {
          product_id: Number(row.product_id ?? row.id),
          batch_id: batchId,
          name: row.name,
          batch: row.batch_number ?? "",
          hsn: row.hsn,
          expiry: row.expiry,
          mrp: Number(row.mrp ?? 0),
          rate: Number(row.sale_rate_incl ?? row.mrp ?? 0),
          quantity: 1,
          discount: 0,
          cgst: gst / 2,
          sgst: gst / 2,
          available,
          is_h1: !!row.is_h1,
          is_narcotic: !!row.is_narcotic,
          is_prescription_required: !!row.is_prescription_required,
        },
      ];
    });
    setSearch("");
    setSearchRows([]);
  };

  const updateLine = (i: number, patch: Partial<CartLine>) =>
    setCart((c) => c.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setCart((c) => c.filter((_, idx) => idx !== i));

  const totals = useMemo(() => {
    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalDiscount = 0;
    cart.forEach((l) => {
      const lineGross = l.rate * l.quantity;
      const lineDisc = lineGross * (l.discount / 100);
      const taxable = (lineGross - lineDisc) / (1 + (l.cgst + l.sgst) / 100);
      subtotal += taxable;
      totalCgst += taxable * (l.cgst / 100);
      totalSgst += taxable * (l.sgst / 100);
      totalDiscount += lineDisc;
    });
    const beforeOverall = subtotal + totalCgst + totalSgst;
    const overallAmt = beforeOverall * (overallDiscount / 100);
    const grand = Math.round(beforeOverall - overallAmt);
    return { subtotal, totalCgst, totalSgst, totalDiscount, grand, overallAmt };
  }, [cart, overallDiscount]);

  const reset = () => {
    setCart([]);
    setPatient({ name: "", mobile: "", doctor: "" });
    setOverallDiscount(0);
    setEditingBillId(null);
  };

  const requiresRx = useMemo(
    () =>
      cart.some(
        (l) => l.is_h1 || l.is_narcotic || l.is_prescription_required,
      ),
    [cart],
  );

  const submit = async (status: "Completed" | "Held") => {
    if (!cart.length) return toast.error("Cart is empty");
    if (status === "Completed" && !patient.name) return toast.error("Patient name is required");
    if (status === "Completed" && requiresRx && !patient.doctor.trim()) {
      return toast.error("Prescription drug in cart — Doctor name required");
    }
    setBusy(true);
    try {
      const payload = {
        patient_name: patient.name || "Walk-in",
        patient_mobile: patient.mobile,
        doctor_name: patient.doctor,
        overall_discount_percent: overallDiscount,
        status,
        items: cart.map((l) => ({
          product_id: l.product_id,
          batch_id: l.batch_id,
          name: l.name,
          hsn: l.hsn,
          batch: l.batch,
          expiry: l.expiry,
          mrp: l.mrp,
          rate: l.rate,
          quantity: l.quantity,
          discount: l.discount,
          cgst: l.cgst,
          sgst: l.sgst,
        })),
      };
      if (editingBillId) {
        await api.updateBill(editingBillId, payload);
        toast.success(status === "Held" ? "Bill held" : "Bill completed");
      } else {
        const r = await api.createBill(payload);
        toast.success(
          status === "Held"
            ? "Bill held for later"
            : `Bill ${r.bill_number} created • ${formatINR(totals.grand)}`,
        );
      }
      reset();
      loadHeld();
      loadCustomers();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to submit bill");
    } finally {
      setBusy(false);
    }
  };

  const openRecall = async () => {
    setRecallOpen(true);
    setRecallLoading(true);
    try {
      const data = await api.heldBills();
      setHeldBills(data ?? []);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load held bills");
    } finally {
      setRecallLoading(false);
    }
  };

  const recall = async (held: any) => {
    setRecallLoading(true);
    try {
      const full = await api.bill(held.id);
      setEditingBillId(held.id);
      setPatient({
        name: full.patientName ?? full.patient_name ?? "",
        mobile: full.patientMobile ?? full.patient_mobile ?? "",
        doctor: full.doctorName ?? full.doctor_name ?? "",
      });
      setOverallDiscount(
        Number(full.overallDiscountPercent ?? full.overall_discount_percent ?? 0),
      );
      const items: CartLine[] = (full.items ?? []).map((it: any) => ({
        product_id: Number(it.product_id ?? it.productId ?? 0),
        batch_id: Number(it.batch_id ?? it.batchId ?? 0),
        name: it.product_name ?? it.productName ?? "",
        batch: it.batch ?? "",
        hsn: it.hsn,
        expiry: it.expiry,
        mrp: Number(it.mrp ?? 0),
        rate: Number(it.rate ?? 0),
        quantity: Number(it.quantity ?? 1),
        discount: Number(it.discount ?? 0),
        cgst: Number(it.cgst ?? 0),
        sgst: Number(it.sgst ?? 0),
        available: 999,
      }));
      setCart(items);
      setRecallOpen(false);
      toast.success(`Recalled ${held.bill_number ?? held.billNumber}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to recall");
    } finally {
      setRecallLoading(false);
    }
  };

  const removeHeld = async (held: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete held bill ${held.bill_number ?? held.billNumber}?`)) return;
    try {
      await api.deleteBill(held.id);
      toast.success("Held bill deleted");
      loadHeld();
    } catch (err: any) {
      toast.error(err?.message ?? "Delete failed");
    }
  };

  const matchCustomer = (mobile: string) => {
    const c = customers.find((x) => x.mobile === mobile);
    if (c) setPatient((p) => ({ ...p, name: c.name, doctor: c.doctor_name ?? p.doctor }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Point of Sale"
        description="Create bills, hold drafts, recall later."
        actions={
          <Button variant="outline" onClick={openRecall}>
            <FileClock className="mr-2 h-4 w-4" /> Held ({heldBills.length})
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <Card className="border-border/60 bg-card/80">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search product or batch (min 2 chars)…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 pl-10"
                />
                {searchLoading && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              {!!searchRows.length && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {searchRows.map((row) => (
                    <button
                      key={row.batch_id}
                      onClick={() => addToCart(row)}
                      className="group flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3 text-left transition-all hover:border-primary hover:shadow-glow"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {row.name}
                          {row.is_h1 && (
                            <Badge variant="destructive" className="ml-1.5 text-[9px]">H1</Badge>
                          )}
                          {row.is_narcotic && (
                            <Badge className="ml-1 bg-amber-600 text-white text-[9px] hover:bg-amber-700">
                              NAR
                            </Badge>
                          )}
                          {row.is_prescription_required && (
                            <Badge variant="secondary" className="ml-1 text-[9px]">Rx</Badge>
                          )}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {row.batch_number} · Stock: {Number(row.quantity).toFixed(2)}{" "}
                          {row.sale_unit} · Exp: {row.expiry}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-semibold">
                          {formatINR(row.sale_rate_incl)}
                        </p>
                        <Plus className="ml-auto h-4 w-4 text-primary opacity-0 transition group-hover:opacity-100" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {search.length >= 2 && !searchLoading && !searchRows.length && (
                <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                  No in-stock batches match.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle className="text-base">
                Cart ({cart.length})
                {editingBillId ? (
                  <Badge className="ml-2" variant="secondary">
                    Editing held bill
                  </Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2 text-left">Item</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2 text-right">Rate</th>
                      <th className="px-2 py-2 text-right">Disc%</th>
                      <th className="px-2 py-2 text-right">Total</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {cart.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                          Search and add products to begin.
                        </td>
                      </tr>
                    )}
                    {cart.map((l, i) => (
                      <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="px-4 py-2.5">
                          <div className="font-medium">
                            {l.name}
                            {l.is_h1 && (
                              <Badge variant="destructive" className="ml-1.5 text-[9px]">H1</Badge>
                            )}
                            {l.is_narcotic && (
                              <Badge className="ml-1 bg-amber-600 text-white text-[9px] hover:bg-amber-700">
                                NAR
                              </Badge>
                            )}
                            {l.is_prescription_required && (
                              <Badge variant="secondary" className="ml-1 text-[9px]">Rx</Badge>
                            )}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {l.batch} {l.expiry ? `· Exp ${l.expiry}` : ""} · Stock {l.available}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Input
                            type="number"
                            min={1}
                            max={l.available}
                            value={l.quantity}
                            onChange={(e) =>
                              updateLine(i, {
                                quantity: Math.max(
                                  1,
                                  Math.min(Number(e.target.value) || 1, l.available),
                                ),
                              })
                            }
                            className="ml-auto h-8 w-16 text-right"
                          />
                        </td>
                        <td className="px-2 py-2 text-right font-mono">{formatINR(l.rate)}</td>
                        <td className="px-2 py-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={l.discount}
                            onChange={(e) =>
                              updateLine(i, { discount: Number(e.target.value) || 0 })
                            }
                            className="ml-auto h-8 w-16 text-right"
                          />
                        </td>
                        <td className="px-2 py-2 text-right font-mono font-semibold">
                          {formatINR(l.rate * l.quantity * (1 - l.discount / 100))}
                        </td>
                        <td className="px-2 py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeLine(i)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle className="text-base">Patient</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-1.5">
                <Label>Name</Label>
                <Input
                  value={patient.name}
                  onChange={(e) => setPatient((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Aarav Sharma"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Mobile</Label>
                <Input
                  value={patient.mobile}
                  onChange={(e) => {
                    setPatient((p) => ({ ...p, mobile: e.target.value }));
                    if (e.target.value.length === 10) matchCustomer(e.target.value);
                  }}
                  placeholder="10-digit mobile"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>
                  Doctor
                  {requiresRx && (
                    <Badge variant="destructive" className="ml-2 text-[10px]">
                      Required (Rx in cart)
                    </Badge>
                  )}
                </Label>
                <Input
                  value={patient.doctor}
                  onChange={(e) => setPatient((p) => ({ ...p, doctor: e.target.value }))}
                  placeholder="Prescribing doctor"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {customers.length} saved customers · auto-fills on mobile match
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 font-mono text-sm">
              <Row label="Subtotal" value={formatINR(totals.subtotal)} />
              <Row label="Item discount" value={`- ${formatINR(totals.totalDiscount)}`} />
              <Row label="CGST" value={formatINR(totals.totalCgst)} />
              <Row label="SGST" value={formatINR(totals.totalSgst)} />
              <div className="flex items-center justify-between gap-2 py-1">
                <Label className="text-xs">Overall Discount %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={overallDiscount}
                  onChange={(e) => setOverallDiscount(Number(e.target.value) || 0)}
                  className="h-8 w-20 text-right"
                />
              </div>
              <div className="mt-2 flex items-center justify-between rounded-lg bg-gradient-primary p-3 text-primary-foreground shadow-glow">
                <span className="text-sm font-semibold">Grand Total</span>
                <span className="text-xl font-bold">{formatINR(totals.grand)}</span>
              </div>
              {requiresRx && (
                <div className="flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/5 p-2 text-[11px] text-warning">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  This bill contains H1 / Narcotic / Rx products — doctor name will be saved with the bill for compliance.
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" disabled={busy} onClick={() => submit("Held")}>
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PauseCircle className="mr-2 h-4 w-4" />
                  )}
                  Hold
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => submit("Completed")}
                  className="bg-gradient-primary text-primary-foreground hover:opacity-90"
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Receipt className="mr-2 h-4 w-4" />
                  )}
                  Bill
                </Button>
              </div>
              {editingBillId && (
                <Button variant="ghost" size="sm" className="w-full" onClick={reset}>
                  Discard recalled bill
                </Button>
              )}
              <div className="pt-1 text-center">
                <Badge variant="secondary" className="font-sans text-[10px]">
                  All taxes inclusive · Rounded to nearest ₹
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={recallOpen} onOpenChange={setRecallOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Held Bills
            </DialogTitle>
            <DialogDescription>Recall a held bill to continue editing or complete.</DialogDescription>
          </DialogHeader>
          {recallLoading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : heldBills.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No held bills.</div>
          ) : (
            <div className="space-y-2">
              {heldBills.map((h) => (
                <button
                  key={h.id}
                  onClick={() => recall(h)}
                  className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3 text-left transition-colors hover:border-primary hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {h.patient_name || h.patientName || "Walk-in"}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {h.bill_number ?? h.billNumber} · {h.item_count ?? 0} items
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">
                      {formatINR(h.grand_total ?? 0)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={(e) => removeHeld(h, e)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between">
    <span className="font-sans text-muted-foreground">{label}</span>
    <span>{value}</span>
  </div>
);
