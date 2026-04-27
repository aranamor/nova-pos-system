import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Receipt, PauseCircle, Search } from "lucide-react";
import { formatINR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface CartLine {
  product_id: number; name: string; batch: string; mrp: number;
  rate: number; qty: number; discount: number; cgst: number; sgst: number;
}

export default function POS() {
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [patient, setPatient] = useState({ name: "", mobile: "", doctor: "" });
  const [overallDiscount, setOverallDiscount] = useState(0);

  useEffect(() => {
    api.products().then(setProducts);
    api.customers().then(setCustomers);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return [] as any[];
    const s = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(s) || p.batch.toLowerCase().includes(s)).slice(0, 6);
  }, [search, products]);

  const addToCart = (p: any) => {
    setCart(c => {
      const existing = c.find(x => x.product_id === p.id);
      if (existing) return c.map(x => x.product_id === p.id ? { ...x, qty: x.qty + 1 } : x);
      return [...c, {
        product_id: p.id, name: p.name, batch: p.batch, mrp: p.mrp,
        rate: p.sale_rate_inclusive, qty: 1, discount: 0, cgst: p.cgst, sgst: p.sgst,
      }];
    });
    setSearch("");
  };

  const updateLine = (i: number, patch: Partial<CartLine>) =>
    setCart(c => c.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const removeLine = (i: number) => setCart(c => c.filter((_, idx) => idx !== i));

  const totals = useMemo(() => {
    let subtotal = 0, totalCgst = 0, totalSgst = 0, totalDiscount = 0;
    cart.forEach(l => {
      const lineGross = l.rate * l.qty;
      const lineDisc = lineGross * (l.discount / 100);
      const taxable = (lineGross - lineDisc) / (1 + (l.cgst + l.sgst) / 100);
      subtotal += taxable;
      totalCgst += taxable * (l.cgst / 100);
      totalSgst += taxable * (l.sgst / 100);
      totalDiscount += lineDisc;
    });
    const afterOverall = (subtotal + totalCgst + totalSgst) * (1 - overallDiscount / 100);
    const grand = Math.round(afterOverall);
    return { subtotal, totalCgst, totalSgst, totalDiscount, grand };
  }, [cart, overallDiscount]);

  const submit = async (status: "Completed" | "Hold") => {
    if (!cart.length) return toast.error("Cart is empty");
    if (status === "Completed" && !patient.name) return toast.error("Patient name required");
    await api.createBill({ patient, items: cart, status, overall_discount_percent: overallDiscount, totals });
    toast.success(status === "Hold" ? "Bill held for later" : "Bill created");
    setCart([]); setPatient({ name: "", mobile: "", doctor: "" }); setOverallDiscount(0);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Point of Sale" description="Create bills, hold drafts, recall later." />

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        {/* Left: Search + Cart */}
        <div className="space-y-4">
          <Card className="border-border/60 bg-card/80">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search product by name or batch…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-11 pl-10"
                />
              </div>
              {!!filtered.length && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {filtered.map(p => (
                    <button key={p.id} onClick={() => addToCart(p)}
                      className="group flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3 text-left transition-all hover:border-primary hover:shadow-glow">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{p.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{p.batch} · Stock: {p.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-semibold">{formatINR(p.sale_rate_inclusive)}</p>
                        <Plus className="ml-auto h-4 w-4 text-primary opacity-0 transition group-hover:opacity-100" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader><CardTitle className="text-base">Cart ({cart.length})</CardTitle></CardHeader>
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
                      <tr><td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">Search and add products to begin.</td></tr>
                    )}
                    {cart.map((l, i) => (
                      <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{l.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{l.batch}</div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Input type="number" min={1} value={l.qty} onChange={e => updateLine(i, { qty: Number(e.target.value) || 1 })} className="ml-auto h-8 w-16 text-right" />
                        </td>
                        <td className="px-2 py-2 text-right font-mono">{formatINR(l.rate)}</td>
                        <td className="px-2 py-2 text-right">
                          <Input type="number" min={0} max={100} value={l.discount} onChange={e => updateLine(i, { discount: Number(e.target.value) || 0 })} className="ml-auto h-8 w-16 text-right" />
                        </td>
                        <td className="px-2 py-2 text-right font-mono font-semibold">{formatINR(l.rate * l.qty * (1 - l.discount / 100))}</td>
                        <td className="px-2 py-2"><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeLine(i)}><Trash2 className="h-4 w-4" /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: customer + summary */}
        <div className="space-y-4">
          <Card className="border-border/60 bg-card/80">
            <CardHeader><CardTitle className="text-base">Patient</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-1.5"><Label>Name</Label><Input value={patient.name} onChange={e => setPatient(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Aarav Sharma" /></div>
              <div className="grid gap-1.5"><Label>Mobile</Label><Input value={patient.mobile} onChange={e => setPatient(p => ({ ...p, mobile: e.target.value }))} placeholder="10-digit mobile" /></div>
              <div className="grid gap-1.5"><Label>Doctor</Label><Input value={patient.doctor} onChange={e => setPatient(p => ({ ...p, doctor: e.target.value }))} placeholder="Prescribing doctor" /></div>
              <div className="text-xs text-muted-foreground">{customers.length} saved customers</div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 font-mono text-sm">
              <Row label="Subtotal" value={formatINR(totals.subtotal)} />
              <Row label="Item discount" value={`- ${formatINR(totals.totalDiscount)}`} />
              <Row label="CGST" value={formatINR(totals.totalCgst)} />
              <Row label="SGST" value={formatINR(totals.totalSgst)} />
              <div className="flex items-center justify-between gap-2 py-1">
                <Label className="text-xs">Overall Discount %</Label>
                <Input type="number" min={0} max={100} value={overallDiscount} onChange={e => setOverallDiscount(Number(e.target.value) || 0)} className="h-8 w-20 text-right" />
              </div>
              <div className="mt-2 flex items-center justify-between rounded-lg bg-gradient-primary p-3 text-primary-foreground shadow-glow">
                <span className="text-sm font-semibold">Grand Total</span>
                <span className="text-xl font-bold">{formatINR(totals.grand)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" onClick={() => submit("Hold")}><PauseCircle className="mr-2 h-4 w-4" /> Hold</Button>
                <Button onClick={() => submit("Completed")} className="bg-gradient-primary text-primary-foreground hover:opacity-90"><Receipt className="mr-2 h-4 w-4" /> Bill</Button>
              </div>
              <div className="pt-1 text-center"><Badge variant="secondary" className="font-sans text-[10px]">All taxes inclusive · Rounded to nearest ₹</Badge></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between">
    <span className="font-sans text-muted-foreground">{label}</span>
    <span>{value}</span>
  </div>
);
