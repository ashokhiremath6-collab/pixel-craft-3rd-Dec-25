import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function isRecent(
  date: string | Date | null | undefined,
  days = 7
): boolean {
  if (!date) return false;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return d > cutoff;
}

interface RecentBadgeProps {
  date: string | Date | null | undefined;
  days?: number;
  className?: string;
}

export function RecentBadge({ date, days = 7, className }: RecentBadgeProps) {
  if (!isRecent(date, days)) return null;

  const hoursAgo = date
    ? (Date.now() - new Date(date).getTime()) / 36e5
    : Infinity;

  const label =
    hoursAgo < 1
      ? "Just now"
      : hoursAgo < 24
      ? "Today"
      : Math.floor(hoursAgo / 24) === 1
      ? "Yesterday"
      : "New";

  return (
    <Badge
      className={cn(
        "text-[10px] px-1.5 py-0 h-4 font-semibold uppercase tracking-wide",
        "bg-amber-500 text-white border-amber-600 no-default-active-elevate shrink-0",
        className
      )}
    >
      {label}
    </Badge>
  );
}
