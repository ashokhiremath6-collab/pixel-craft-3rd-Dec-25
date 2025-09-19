import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "Quoted" | "Selected" | "Rejected";
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const variants = {
    Quoted: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800",
    Selected: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
    Rejected: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
  };

  return (
    <Badge 
      className={cn(variants[status], className)}
      data-testid={`badge-status-${status.toLowerCase()}`}
    >
      {status}
    </Badge>
  );
}