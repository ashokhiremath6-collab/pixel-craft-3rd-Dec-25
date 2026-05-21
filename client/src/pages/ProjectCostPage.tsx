import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CheckCircle2, Circle } from "lucide-react";
import type { VendorCategory, Project } from "@shared/schema";
import { formatCurrencyCompact } from "@/lib/currencyUtils";

interface QuotationData {
  id: string;
  vendorName: string;
  category: string;
  quotationName: string;
  quotationType: "item" | "option";
  quotationValue: string | null | undefined;
  dateOfQuotation: string | null | undefined;
  status: "Quoted" | "Selected" | "Rejected";
  notes?: string;
  isNegotiated?: boolean;
  unitRateSubtype?: string | null;
}

interface QuotationsResponse {
  projects: Project[];
  quotations: Record<string, QuotationData[]>;
}

// Only vendor quotes where BOQ × unit rates produced the total — exclude raw unit-rate quotes
const isVendorQuote = (q: QuotationData) =>
  q.unitRateSubtype === null || q.unitRateSubtype === undefined;

export default function ProjectCostPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const { data: categoriesData = [], isLoading: catLoading } = useQuery<VendorCategory[]>({
    queryKey: ["/api/vendor-categories/tree"],
  });

  const { data: quotationsData, isLoading: quotLoading } = useQuery<QuotationsResponse>({
    queryKey: ["/api/quotations"],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const isLoading = catLoading || quotLoading;
  const projects = quotationsData?.projects ?? [];
  const quotations = quotationsData?.quotations ?? {};

  const rootCategories = [...categoriesData]
    .filter((c) => !c.parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const allCategories = categoriesData;

  const getTotal = (projectId: string): number => {
    const quotes = quotations[projectId] ?? [];
    return quotes
      .filter((q) => isVendorQuote(q) && q.status !== "Rejected")
      .reduce((sum, q) => sum + parseFloat(q.quotationValue || "0"), 0);
  };

  const getQuotedCategoryCount = (projectId: string): number => {
    const quotes = quotations[projectId] ?? [];
    const quotedNames = new Set(
      quotes
        .filter((q) => isVendorQuote(q) && q.status !== "Rejected")
        .map((q) => q.category)
    );
    return rootCategories.filter((cat) => {
      if (quotedNames.has(cat.name)) return true;
      const children = allCategories.filter((c) => c.parentId === cat.id);
      return children.some((child) => quotedNames.has(child.name));
    }).length;
  };

  const getBestQuoteForCategory = (
    projectId: string,
    catName: string
  ): QuotationData | null => {
    const quotes = quotations[projectId] ?? [];
    const matching = quotes.filter(
      (q) => isVendorQuote(q) && q.category === catName && q.status !== "Rejected"
    );
    if (matching.length === 0) return null;
    return matching.find((q) => q.status === "Selected") ?? matching[0];
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  if (isLoading) {
    return (
      <div className="p-6 text-center py-12 text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  if (selectedProjectId && selectedProject) {
    const total = getTotal(selectedProjectId);
    const quotedCount = getQuotedCategoryCount(selectedProjectId);

    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedProjectId(null)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-base font-semibold leading-tight">
              {selectedProject.projectName}
            </h1>
            <p className="text-xs text-muted-foreground">
              {selectedProject.clientName}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground mb-1">Total quoted</p>
              <p className="text-base font-semibold">
                {total > 0 ? formatCurrencyCompact(total) : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground mb-1">Categories covered</p>
              <p className="text-base font-semibold">
                {quotedCount}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / {rootCategories.length}
                </span>
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm">All Categories</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {rootCategories.map((cat) => {
                const quote = getBestQuoteForCategory(selectedProjectId, cat.name);
                const childCategories = allCategories.filter(
                  (c) => c.parentId === cat.id
                );
                const childQuote =
                  childCategories
                    .map((child) =>
                      getBestQuoteForCategory(selectedProjectId, child.name)
                    )
                    .find(Boolean) ?? null;
                const displayQuote = quote ?? childQuote;
                const hasQuote = !!displayQuote;

                return (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between px-4 py-2.5 gap-4"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {hasQuote ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                      )}
                      <span className="text-sm truncate">{cat.name}</span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {displayQuote ? (
                        <>
                          <span className="text-sm text-muted-foreground max-w-[150px] truncate text-right">
                            {displayQuote.vendorName}
                          </span>
                          <span className="text-sm font-medium tabular-nums w-20 text-right">
                            {displayQuote.quotationValue
                              ? formatCurrencyCompact(displayQuote.quotationValue)
                              : "—"}
                          </span>
                          <Badge
                            variant={
                              displayQuote.status === "Selected"
                                ? "default"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {displayQuote.status}
                          </Badge>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">
                          No quote yet
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Project Cost</h1>
        <p className="text-sm text-muted-foreground">
          Quote coverage across all projects
        </p>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-sm text-muted-foreground">
            No projects found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => {
            const total = getTotal(project.id);
            const quotedCount = getQuotedCategoryCount(project.id);
            const totalCats = rootCategories.length;
            const unquotedCount = totalCats - quotedCount;

            return (
              <Card
                key={project.id}
                className="hover-elevate cursor-pointer"
                onClick={() => setSelectedProjectId(project.id)}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">
                        {project.projectName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {project.clientName}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Total quoted</p>
                        <p className="text-sm font-medium tabular-nums">
                          {total > 0 ? formatCurrencyCompact(total) : "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Coverage</p>
                        <p className="text-sm font-medium">
                          {quotedCount}
                          <span className="text-muted-foreground font-normal">
                            /{totalCats}
                          </span>
                        </p>
                      </div>
                      {unquotedCount > 0 ? (
                        <Badge variant="secondary" className="text-xs">
                          {unquotedCount} not quoted
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">
                          All quoted
                        </Badge>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="mt-2.5 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{
                        width: `${
                          totalCats > 0 ? (quotedCount / totalCats) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
