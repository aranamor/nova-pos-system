import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  FileText,
  Search,
  Receipt,
  Wallet,
  FileClock,
  CheckCircle2,
  ChevronRight,
  Inbox,
} from "lucide-react";
import { formatINR, formatDate } from "@/lib/format";
import { PurchaseFormDialog } from "@/components/PurchaseFormDialog";
import { PurchaseDetailsDialog } from "@/components/PurchaseDetailsDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Purchases() {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "Completed" | "Draft">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);

  const load = () =>
    api
      .purchases()
      .then(setRows)
      .catch((err) => toast.error(err?.message ?? "Failed to load purchases"));
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (status !== "all" && r.status !== status) return false;
        if (
          search &&
          !`${r.bill_number ?? ""} ${r.supplier_name ?? ""}`
            .toLowerCase()
            .includes(search.toLowerCase())
        )
          return false;
        return true;
      }),
    [rows, status, search],
  );

  const stats = useMemo(() => {
    const completed = rows.filter((r) => r.status === "Completed");
    const drafts = rows.filter((r) => r.status === "Draft");
    const totalSpend = completed.reduce((s, r) => s + (Number(r.grand_total) || 0), 0);
    return { count: rows.length, completed: completed.length, drafts: drafts.length, totalSpend };
  }, [rows]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Purchases"
        description="Inward supply from vendors. Drafts and completed bills, audit-ready."
        actions={
          <Button onClick={() => setFormOpen(true)} size="sm" className="h-9">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Purchase
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Receipt} label="Total Bills" value={String(stats.count)} variant="primary" />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={String(stats.completed)}
          variant="success"
        />
        <StatCard icon={FileClock} label="Drafts" value={String(stats.drafts)} variant="warning" />
        <StatCard icon={Wallet} label="Total Spend" value={formatINR(stats.totalSpend)} variant="info" />
      </div>

      <div className="surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bill number or supplier…"
              className="h-9 pl-8 text-[13px]"
            />
          </div>
          <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
            <TabsList className="h-9 bg-card-muted">
              <TabsTrigger value="all" className="h-7 text-[12px]">
                All
              </TabsTrigger>
              <TabsTrigger value="Completed" className="h-7 text-[12px]">
                Completed
              </TabsTrigger>
              <TabsTrigger value="Draft" className="h-7 text-[12px]">
                Drafts
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Supplier</th>
                <th>Date</th>
                <th className="text-center">Tax</th>
                <th className="text-right">Total</th>
                <th className="text-center">Status</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setViewing(r)}
                  className="cursor-pointer"
                >
                  <td className="font-mono text-[13px] font-semibold">{r.bill_number}</td>
                  <td>{r.supplier_name}</td>
                  <td className="text-muted-foreground">{formatDate(r.bill_date)}</td>
                  <td className="text-center">
                    <span className="rounded border border-border bg-card-muted px-1.5 py-0.5 font-mono text-[10px] uppercase">
                      {r.tax_type}
                    </span>
                  </td>
                  <td className="text-right font-mono font-semibold tabular-nums">
                    {formatINR(r.grand_total)}
                  </td>
                  <td className="text-center">
                    <span
                      className={cn(
                        "pill",
                        r.status === "Completed"
                          ? "bg-success-soft text-success"
                          : "bg-warning-soft text-warning",
                      )}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="mx-auto flex max-w-xs flex-col items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                        <Inbox className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-[13px] font-medium">No purchases yet</p>
                      <p className="text-[12px] text-muted-foreground">
                        Record a new purchase to add stock to your inventory.
                      </p>
                      <Button size="sm" className="mt-2 h-8" onClick={() => setFormOpen(true)}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        New Purchase
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PurchaseFormDialog open={formOpen} onOpenChange={setFormOpen} onSaved={load} />
      <PurchaseDetailsDialog
        open={!!viewing}
        onOpenChange={(v) => !v && setViewing(null)}
        purchase={viewing}
      />
    </div>
  );
}
