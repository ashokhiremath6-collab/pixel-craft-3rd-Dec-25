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

export function RecentBadge({ date, days = 30, className }: RecentBadgeProps) {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;

  const hoursAgo = (Date.now() - d.getTime()) / 36e5;
  const daysAgo = hoursAgo / 24;

  if (daysAgo > days) return null;

  const isNew = daysAgo < 7;

  const label = isNew
    ? hoursAgo < 1
      ? "Just now"
      : hoursAgo < 24
      ? "Today"
      : Math.floor(hoursAgo / 24) === 1
      ? "Yesterday"
      : "New"
    : daysAgo < 14
    ? "1 week ago"
    : daysAgo < 21
    ? "2 weeks ago"
    : "3 weeks ago";

  return (
    <Badge
      className={cn(
        "text-[10px] px-1.5 py-0 h-4 font-semibold uppercase tracking-wide no-default-active-elevate shrink-0",
        isNew
          ? "bg-blue-500 text-white border-blue-600"
          : "bg-emerald-500 text-white border-emerald-600",
        className
      )}
    >
      {label}
    </Badge>
  );
}
