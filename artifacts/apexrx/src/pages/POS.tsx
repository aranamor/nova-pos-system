import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
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
  ShoppingBag,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
    () => cart.some((l) => l.is_h1 || l.is_narcotic || l.is_prescription_required),
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
      setOverallDiscount(Number(full.overallDiscountPercent ?? full.overall_discount_percent ?? 0));
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
    <div className="space-y-5">
      <PageHeader
        title="Point of Sale"
        description="Create bills, hold drafts, recall later. Optimised for keyboard-first checkout."
        actions={
          <Button variant="outline" size="sm" className="h-9" onClick={openRecall}>
            <FileClock className="mr-1.5 h-3.5 w-3.5" />
            Held{" "}
            <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
              {heldBills.length}
            </span>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          {/* Search */}
          <div className="surface p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search product, batch, or scan barcode (min 2 chars)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-10 text-[13px]"
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
                    className="group flex items-center justify-between rounded-md border border-border bg-card p-2.5 text-left transition-colors hover:border-primary hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                        {row.name}
                        {row.is_h1 && (
                          <span className="pill bg-destructive-soft text-destructive">H1</span>
                        )}
                        {row.is_narcotic && (
                          <span className="pill bg-warning-soft text-warning">NAR</span>
                        )}
                        {row.is_prescription_required && (
                          <span className="pill bg-info-soft text-info">Rx</span>
                        )}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {row.batch_number} · {Number(row.quantity).toFixed(2)} {row.sale_unit} ·{" "}
                        Exp {row.expiry}
                      </p>
                    </div>
                    <div className="ml-3 text-right">
                      <p className="font-mono text-[13px] font-semibold tabular-nums">
                        {formatINR(row.sale_rate_incl)}
                      </p>
                      <Plus className="ml-auto h-4 w-4 text-primary opacity-0 transition group-hover:opacity-100" />
                    </div>
                  </button>
                ))}
              </div>
            )}
            {search.length >= 2 && !searchLoading && !searchRows.length && (
              <div className="mt-3 rounded-md border border-dashed border-border p-4 text-center text-[12px] text-muted-foreground">
                No in-stock batches match. Record a purchase to add stock.
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-card-muted/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13px] font-semibold">Cart</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                  {cart.length}
                </span>
                {editingBillId ? (
                  <span className="pill bg-info-soft text-info">editing held bill</span>
                ) : null}
              </div>
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[12px] text-muted-foreground hover:text-destructive"
                  onClick={() => setCart([])}
                >
                  Clear
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Disc%</th>
                    <th className="text-right">Total</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <p className="text-[13px] text-muted-foreground">
                          Search and add products to begin.
                        </p>
                      </td>
                    </tr>
                  )}
                  {cart.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <div className="flex items-center gap-1.5 text-[13px] font-medium">
                          {l.name}
                          {l.is_h1 && (
                            <span className="pill bg-destructive-soft text-destructive">H1</span>
                          )}
                          {l.is_narcotic && (
                            <span className="pill bg-warning-soft text-warning">NAR</span>
                          )}
                          {l.is_prescription_required && (
                            <span className="pill bg-info-soft text-info">Rx</span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {l.batch} {l.expiry ? `· Exp ${l.expiry}` : ""} · stock {l.available}
                        </div>
                      </td>
                      <td className="text-right">
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
                          className="ml-auto h-8 w-16 text-right font-mono text-[13px]"
                        />
                      </td>
                      <td className="text-right font-mono tabular-nums">{formatINR(l.rate)}</td>
                      <td className="text-right">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={l.discount}
                          onChange={(e) =>
                            updateLine(i, { discount: Number(e.target.value) || 0 })
                          }
                          className="ml-auto h-8 w-16 text-right font-mono text-[13px]"
                        />
                      </td>
                      <td className="text-right font-mono font-semibold tabular-nums">
                        {formatINR(l.rate * l.quantity * (1 - l.discount / 100))}
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeLine(i)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column: Patient + Summary */}
        <div className="space-y-4">
          <div className="surface p-3">
            <h3 className="section-title mb-3">Patient</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="field-label">Name</Label>
                <Input
                  value={patient.name}
                  onChange={(e) => setPatient((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Aarav Sharma"
                  className="h-9 text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="field-label">Mobile</Label>
                <Input
                  value={patient.mobile}
                  onChange={(e) => {
                    setPatient((p) => ({ ...p, mobile: e.target.value }));
                    if (e.target.value.length === 10) matchCustomer(e.target.value);
                  }}
                  placeholder="10-digit mobile"
                  className="h-9 font-mono text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="field-label">Doctor</Label>
                  {requiresRx && (
                    <span className="pill bg-destructive-soft text-destructive">required</span>
                  )}
                </div>
                <Input
                  value={patient.doctor}
                  onChange={(e) => setPatient((p) => ({ ...p, doctor: e.target.value }))}
                  placeholder="Prescribing doctor"
                  className="h-9 text-[13px]"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {customers.length} saved customers · auto-fills on mobile match
              </p>
            </div>
          </div>

          <div className="surface p-3">
            <h3 className="section-title mb-3">Summary</h3>
            <div className="space-y-1.5 font-mono text-[13px]">
              <Row label="Subtotal" value={formatINR(totals.subtotal)} />
              <Row label="Item discount" value={`- ${formatINR(totals.totalDiscount)}`} />
              <Row label="CGST" value={formatINR(totals.totalCgst)} />
              <Row label="SGST" value={formatINR(totals.totalSgst)} />
              <div className="flex items-center justify-between gap-2 py-1">
                <Label className="text-[12px] text-muted-foreground">Overall Discount %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={overallDiscount}
                  onChange={(e) => setOverallDiscount(Number(e.target.value) || 0)}
                  className="h-7 w-20 text-right font-mono text-[12px]"
                />
              </div>
              <div
                className={cn(
                  "mt-2 flex items-center justify-between rounded-md border border-primary/30 bg-primary-soft px-3 py-2.5",
                )}
              >
                <span className="font-sans text-[12px] font-semibold uppercase tracking-wider text-primary">
                  Grand Total
                </span>
                <span className="text-lg font-bold tabular-nums text-primary">
                  {formatINR(totals.grand)}
                </span>
              </div>
              {requiresRx && (
                <div className="mt-2 flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning-soft p-2 text-[11px] text-foreground">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                  <span>
                    Contains H1 / Narcotic / Rx — doctor name will be saved with the bill for
                    compliance.
                  </span>
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => submit("Held")}
                  className="h-9"
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <PauseCircle className="mr-2 h-3.5 w-3.5" />
                  )}
                  Hold
                </Button>
                <Button disabled={busy} onClick={() => submit("Completed")} className="h-9">
                  {busy ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Receipt className="mr-2 h-3.5 w-3.5" />
                  )}
                  Bill
                </Button>
              </div>
              {editingBillId && (
                <Button variant="ghost" size="sm" className="mt-2 w-full h-8" onClick={reset}>
                  Discard recalled bill
                </Button>
              )}
              <p className="mt-2 text-center font-sans text-[10px] uppercase tracking-wider text-muted-foreground">
                All taxes inclusive · Rounded to nearest ₹
              </p>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={recallOpen} onOpenChange={setRecallOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-primary" />
              Held Bills
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              Recall a held bill to continue editing or complete.
            </DialogDescription>
          </DialogHeader>
          {recallLoading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : heldBills.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-muted-foreground">
              No held bills.
            </div>
          ) : (
            <div className="space-y-2">
              {heldBills.map((h) => (
                <button
                  key={h.id}
                  onClick={() => recall(h)}
                  className="flex w-full items-center justify-between rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">
                      {h.patient_name || h.patientName || "Walk-in"}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {h.bill_number ?? h.billNumber} · {h.item_count ?? 0} items
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] font-semibold tabular-nums">
                      {formatINR(h.grand_total ?? 0)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
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
    <span className="font-sans text-[12px] text-muted-foreground">{label}</span>
    <span className="tabular-nums">{value}</span>
  </div>
);
