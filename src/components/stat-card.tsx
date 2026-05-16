import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TrendingDown, TrendingUp } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
  delta,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  delta?: { value: number; suffix?: string };
}) {
  const toneCls = {
    default: "bg-primary-soft text-primary ring-primary/15",
    success: "bg-success-soft text-success ring-success/20",
    warning: "bg-warning-soft text-warning ring-warning/20",
    danger: "bg-danger-soft text-destructive ring-destructive/20",
    info: "bg-info-soft text-info ring-info/20",
  }[tone];

  const positive = (delta?.value ?? 0) >= 0;

  return (
    <Card className="group relative flex items-start justify-between gap-4 overflow-hidden p-5 shadow-xs transition-shadow duration-200 hover:shadow-md">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </div>
        <div className="text-[28px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
          {value}
        </div>
        {(hint || delta) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {delta && (
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium ${
                  positive ? "bg-success-soft text-success" : "bg-danger-soft text-destructive"
                }`}
              >
                {positive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(delta.value)}
                {delta.suffix ?? "%"}
              </span>
            )}
            {hint && <span className="truncate">{hint}</span>}
          </div>
        )}
      </div>
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${toneCls}`}
      >
        <Icon className="h-5 w-5" />
      </div>
    </Card>
  );
}
