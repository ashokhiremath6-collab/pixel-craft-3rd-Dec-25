import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
    const quotedCount = getQuotedCategoryCount(selectedProjectId);

    const rows = rootCategories.map((cat, idx) => {
      const quote = getBestQuoteForCategory(selectedProjectId, cat.name);
      const childCategories = allCategories.filter((c) => c.parentId === cat.id);
      const childQuote =
        childCategories
          .map((child) => getBestQuoteForCategory(selectedProjectId, child.name))
          .find(Boolean) ?? null;
      const displayQuote = quote ?? childQuote;
      return { cat, displayQuote, idx: idx + 1 };
    });

    const total = rows.reduce(
      (sum, { displayQuote }) => sum + parseFloat(displayQuote?.quotationValue || "0"),
      0
    );

    return (
      <div className="p-6 space-y-4 max-w-4xl">
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

        <div className="flex items-center justify-between border rounded-md px-4 py-3 bg-muted/30">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Total Project Cost
            </p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {total > 0 ? formatCurrencyCompact(total) : "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Categories covered</p>
            <p className="text-sm font-semibold">
              {quotedCount}{" "}
              <span className="text-muted-foreground font-normal">
                / {rootCategories.length}
              </span>
            </p>
          </div>
        </div>

        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground w-10">
                  Sr.
                </th>
                <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                  Category
                </th>
                <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                  Vendor
                </th>
                <th className="text-right px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground w-32">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ cat, displayQuote, idx }) => (
                <tr key={cat.id} className="border-b last:border-b-0 hover:bg-muted/20">
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">
                    {idx}
                  </td>
                  <td className="px-3 py-2.5 font-medium">{cat.name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {displayQuote ? displayQuote.vendorName : (
                      <span className="italic text-muted-foreground/50 text-xs">No quote yet</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                    {displayQuote?.quotationValue
                      ? formatCurrencyCompact(displayQuote.quotationValue)
                      : <span className="text-muted-foreground/40">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/40 border-t-2">
                <td className="px-3 py-3" />
                <td
                  colSpan={2}
                  className="px-3 py-3 font-bold text-xs uppercase tracking-wide"
                >
                  Total Project Cost
                </td>
                <td className="px-3 py-3 text-right font-bold tabular-nums">
                  {total > 0 ? formatCurrencyCompact(total) : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
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
                        <p className="text-xs text-muted-foreground">Total project cost</p>
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
                        width: `${totalCats > 0 ? (quotedCount / totalCats) * 100 : 0}%`,
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
