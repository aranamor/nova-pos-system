import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: string;
  delta?: number; // percentage
  variant?: "primary" | "success" | "warning" | "danger" | "info";
}

const variantBg: Record<NonNullable<StatCardProps["variant"]>, string> = {
  primary: "bg-gradient-primary",
  success: "bg-gradient-success",
  warning: "bg-gradient-warning",
  danger: "bg-gradient-danger",
  info: "bg-gradient-accent",
};

export function StatCard({ label, value, icon: Icon, hint, delta, variant = "primary" }: StatCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="stat-card">
      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          {typeof delta === "number" && (
            <div className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
              positive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
              {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(delta).toFixed(1)}%
            </div>
          )}
        </div>
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl shadow-glow", variantBg[variant])}>
          <Icon className="h-5 w-5 text-primary-foreground" />
        </div>
      </div>
    </div>
  );
}
