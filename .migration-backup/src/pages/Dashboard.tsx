import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { IndianRupee, Receipt, Package, AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { formatINR, formatDateTime } from "@/lib/format";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => { api.dashboardStats().then(setStats); }, []);
  if (!stats) return <div className="h-64 animate-pulse rounded-2xl bg-muted/40" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Welcome back 👋"
        description="Here's a snapshot of your pharmacy today."
        actions={<Button asChild className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"><Link to="/pos">+ New Bill</Link></Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Today's Sales" value={formatINR(stats.todaySales)} icon={IndianRupee} variant="primary" delta={12.4} />
        <StatCard label="Bills Today" value={stats.todayBillCount} icon={Receipt} variant="info" delta={4.2} />
        <StatCard label="Total Products" value={stats.totalProducts} icon={Package} variant="success" hint="Across all batches" />
        <StatCard label="Low Stock" value={stats.lowStock} icon={AlertTriangle} variant="warning" hint="Need reorder" />
        <StatCard label="Expiring Soon" value={stats.expiringSoon} icon={Clock} variant="danger" hint="Within 90 days" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60 bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Sales Trend</CardTitle>
              <CardDescription>Last 14 days</CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono">{formatINR(stats.monthSales)} this month</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <AreaChart data={stats.salesTrend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => v.slice(5)} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: any) => formatINR(v)}
                  />
                  <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Recent Bills</CardTitle>
            <CardDescription>Latest 5 transactions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.recentBills.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{b.patient_name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{b.bill_number} · {formatDateTime(b.bill_date).split(",")[1]}</p>
                </div>
                <div className="text-right font-mono text-sm font-semibold">{formatINR(b.grand_total)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
