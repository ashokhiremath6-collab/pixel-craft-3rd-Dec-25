import { useState } from "react";
import { Sparkles, AlertTriangle, Lightbulb, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";

interface AIReviewItem {
  severity: "concern" | "suggestion" | "note";
  category: string;
  message: string;
}

interface AIReviewResult {
  summary: string;
  items: AIReviewItem[];
}

export type AIReviewType =
  | "moodboard"
  | "render"
  | "floor-plan"
  | "concept"
  | "elevation"
  | "working";

interface AIReviewButtonProps {
  filePath: string;
  fileName: string;
  reviewType: AIReviewType;
  className?: string;
}

const SEVERITY_CONFIG = {
  concern: {
    Icon: AlertTriangle,
    label: "Concern",
    iconColor: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50",
    badgeColor: "border-amber-400 text-amber-600 dark:text-amber-400",
  },
  suggestion: {
    Icon: Lightbulb,
    label: "Suggestion",
    iconColor: "text-blue-500 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50",
    badgeColor: "border-blue-400 text-blue-600 dark:text-blue-400",
  },
  note: {
    Icon: Info,
    label: "Note",
    iconColor: "text-muted-foreground",
    bg: "bg-muted/40 border-border",
    badgeColor: "border-border text-muted-foreground",
  },
} as const;

const REVIEW_TYPE_LABELS: Record<AIReviewType, string> = {
  moodboard: "Moodboard Review",
  render: "Render Review",
  "floor-plan": "Floor Plan Review",
  concept: "Concept Drawing Review",
  elevation: "Elevation Review",
  working: "Working Drawing Review",
};

export function AIReviewButton({
  filePath,
  fileName,
  reviewType,
  className,
}: AIReviewButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setOpen(true);
    if (result) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("POST", "/api/ai-review", {
        filePath,
        fileName,
        reviewType,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Review failed");
      setResult(data as AIReviewResult);
    } catch (e: any) {
      setError(e.message ?? "Could not get AI review. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const title = REVIEW_TYPE_LABELS[reviewType];

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={`h-8 w-8 ${className ?? ""}`}
        onClick={(e) => {
          e.stopPropagation();
          handleOpen();
        }}
        title="AI Review"
      >
        <Sparkles className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[82vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-blue-500 shrink-0" />
              {title}
            </DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Analysing with AI…</p>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-4 pt-1">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {result.summary}
              </p>
              <div className="space-y-2.5">
                {result.items.map((item, i) => {
                  const cfg =
                    SEVERITY_CONFIG[item.severity] ?? SEVERITY_CONFIG.note;
                  const { Icon } = cfg;
                  return (
                    <div
                      key={i}
                      className={`rounded-md border px-3 py-2.5 ${cfg.bg}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <Icon
                          className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.iconColor}`}
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-foreground">
                              {item.category}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-xs h-5 ${cfg.badgeColor}`}
                            >
                              {cfg.label}
                            </Badge>
                          </div>
                          <p className="text-sm leading-relaxed text-foreground/80">
                            {item.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
