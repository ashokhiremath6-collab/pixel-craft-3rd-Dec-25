import { AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface PlanLimitBannerProps {
  current: number;
  limit: number;
  resourceLabel: string;
  className?: string;
}

const UNLIMITED = 999_999;

export function PlanLimitBanner({ current, limit, resourceLabel, className = "" }: PlanLimitBannerProps) {
  const [, navigate] = useLocation();

  if (limit >= UNLIMITED) return null;
  const pct = current / limit;
  if (pct < 0.8) return null;

  const atLimit = current >= limit;

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm ${
        atLimit
          ? "bg-destructive/10 text-destructive border border-destructive/20"
          : "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40"
      } ${className}`}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          {atLimit
            ? `${resourceLabel} limit reached (${current} / ${limit}). Upgrade your plan to add more.`
            : `${resourceLabel} limit approaching (${current} / ${limit}). Consider upgrading your plan.`}
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={() => navigate("/settings")}
      >
        <Zap className="h-3 w-3 mr-1" />
        Upgrade
      </Button>
    </div>
  );
}
