import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: string;
  delta?: number;
  variant?: "primary" | "success" | "warning" | "danger" | "info" | "neutral";
}

const accentMap: Record<NonNullable<StatCardProps["variant"]>, string> = {
  primary: "text-primary bg-primary-soft",
  success: "text-success bg-success-soft",
  warning: "text-warning bg-warning-soft",
  danger: "text-destructive bg-destructive-soft",
  info: "text-info bg-info-soft",
  neutral: "text-muted-foreground bg-muted",
};

export function StatCard({ label, value, icon: Icon, hint, delta, variant = "neutral" }: StatCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="surface group p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="field-label">{label}</p>
          <p className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-foreground">
            {value}
          </p>
        </div>
        {Icon && (
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", accentMap[variant])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      {(hint || typeof delta === "number") && (
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          {typeof delta === "number" && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                positive ? "text-success" : "text-destructive",
              )}
            >
              {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </div>
  );
}
