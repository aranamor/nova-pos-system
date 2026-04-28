import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";

const REPORT_TYPES = [
  { value: "sales", label: "Sales Report", supportsCompliance: true },
  { value: "profitability", label: "Profitability", supportsCompliance: false },
  { value: "movement", label: "Product Movement", supportsCompliance: false },
  { value: "purchases", label: "Purchases", supportsCompliance: true },
  { value: "supplier_purchases", label: "Supplier-wise Purchases", supportsCompliance: false },
  { value: "sale_gst", label: "Sale GST", supportsCompliance: false },
  { value: "purchase_gst", label: "Purchase GST", supportsCompliance: false },
  { value: "hsn_sale", label: "HSN-wise Sale", supportsCompliance: false },
  { value: "inventory", label: "Current Inventory", supportsCompliance: true },
  { value: "expiry", label: "Expiry Details", supportsCompliance: false },
  { value: "compliance_sales", label: "Compliance Sales (H1/Narcotic/Rx)", supportsCompliance: true },
  { value: "compliance_purchases", label: "Compliance Purchases (H1/Narcotic/Rx)", supportsCompliance: true },
];

const COMPLIANCE_OPTIONS = [
  { value: "none", label: "All (no filter)" },
  { value: "h1", label: "H1 Only" },
  { value: "narcotic", label: "Narcotic Only" },
  { value: "rx", label: "Rx Only" },
];

export default function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [type, setType] = useState("sales");
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [compliance, setCompliance] = useState("none");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const currentMeta = REPORT_TYPES.find((r) => r.value === type);
  const supportsCompliance = !!currentMeta?.supportsCompliance;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, []);

  const run = async () => {
    setLoading(true);
    try {
      const data = await api.report(type, from, to, supportsCompliance ? compliance : undefined);
      setRows(data || []);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load report");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!rows.length) return toast.error("Nothing to export");
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${type}${supportsCompliance && compliance !== "none" ? `_${compliance}` : ""}_${from}_${to}.csv`;
    a.click();
    toast.success("Report downloaded");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Generate date-filtered insights across sales, GST, inventory and compliance categories."
      />

      <Card className="border-border/60 bg-card/80">
        <CardContent className="grid gap-3 p-5 md:grid-cols-6">
          <div className="grid gap-1.5 md:col-span-2">
            <Label>Report Type</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v);
                if (!REPORT_TYPES.find((r) => r.value === v)?.supportsCompliance) {
                  setCompliance("none");
                }
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className={supportsCompliance ? "" : "opacity-40"}>Compliance Filter</Label>
            <Select
              value={compliance}
              onValueChange={setCompliance}
              disabled={!supportsCompliance}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMPLIANCE_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button
              onClick={run}
              disabled={loading}
              className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Generate
            </Button>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    {Object.keys(rows[0]).map((h) => (
                      <th key={h} className="px-4 py-3 text-left">
                        {h.replace(/_/g, " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-border/60 hover:bg-muted/20">
                      {Object.values(r).map((v: any, j) => (
                        <td key={j} className="px-4 py-2.5 font-mono text-xs">
                          {String(v ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No data — pick filters and Generate.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
