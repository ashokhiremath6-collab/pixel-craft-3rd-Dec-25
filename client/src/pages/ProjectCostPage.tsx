import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import type { VendorCategory, Project, ProjectCostItem } from "@shared/schema";
import { formatCurrencyCompact } from "@/lib/currencyUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

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

interface EditableRowProps {
  item: ProjectCostItem;
  onSave: (id: string, fields: Partial<ProjectCostItem>) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
}

function SavedItemRow({ item, onSave, onDelete, canEdit }: EditableRowProps) {
  const [category, setCategory] = useState(item.categoryName);
  const [vendor, setVendor] = useState(item.vendorName);
  const [amount, setAmount] = useState(item.amount);
  const [amountFocused, setAmountFocused] = useState(false);

  const handleBlur = () => {
    setAmountFocused(false);
    if (
      category !== item.categoryName ||
      vendor !== item.vendorName ||
      amount !== item.amount
    ) {
      onSave(item.id, { categoryName: category, vendorName: vendor, amount });
    }
  };

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/20">
      <td className="px-3 py-1.5 text-muted-foreground text-xs align-middle">
        {canEdit && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        )}
      </td>
      <td className="px-1 py-1.5 align-middle">
        {canEdit ? (
          <input
            className="w-full bg-transparent border border-dashed border-transparent hover:border-border focus:border-primary/40 outline-none focus:ring-1 focus:ring-primary/40 rounded px-2 py-1 text-sm font-medium"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            onBlur={handleBlur}
          />
        ) : (
          <span className="px-2 text-sm font-medium">{category}</span>
        )}
      </td>
      <td className="px-1 py-1.5 align-middle">
        {canEdit ? (
          <input
            className="w-full bg-transparent border border-dashed border-transparent hover:border-border focus:border-primary/40 outline-none focus:ring-1 focus:ring-primary/40 rounded px-2 py-1 text-sm text-muted-foreground"
            value={vendor}
            placeholder="Vendor name"
            onChange={(e) => setVendor(e.target.value)}
            onBlur={handleBlur}
          />
        ) : (
          <span className="px-2 text-sm text-muted-foreground">{vendor || "—"}</span>
        )}
      </td>
      <td className="px-1 py-1.5 align-middle text-right">
        {canEdit ? (
          <div className="relative flex items-center justify-end">
            {!amountFocused && (
              <span className="absolute left-2 text-xs text-muted-foreground pointer-events-none">₹</span>
            )}
            <input
              className="w-full bg-transparent border border-dashed border-transparent hover:border-border focus:border-primary/40 outline-none focus:ring-1 focus:ring-primary/40 rounded px-2 py-1 text-sm font-medium tabular-nums text-right"
              value={amountFocused ? amount : (parseFloat(amount) > 0 ? formatCurrencyCompact(amount) : "")}
              placeholder="e.g. 500000"
              onFocus={() => setAmountFocused(true)}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={handleBlur}
            />
          </div>
        ) : (
          <span className="px-2 text-sm font-medium tabular-nums">
            {parseFloat(amount) > 0 ? formatCurrencyCompact(amount) : "—"}
          </span>
        )}
      </td>
    </tr>
  );
}

interface NewItemRowProps {
  onCommit: (fields: { categoryName: string; vendorName: string; amount: string }) => void;
  rowKey: number;
}

function NewItemRow({ onCommit, rowKey }: NewItemRowProps) {
  const [category, setCategory] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const committed = useRef(false);

  const handleBlur = () => {
    if (committed.current) return;
    if (category.trim()) {
      committed.current = true;
      onCommit({ categoryName: category.trim(), vendorName: vendor.trim(), amount: amount.trim() || "0" });
    }
  };

  const inputCls = "w-full bg-transparent border border-dashed border-border/60 hover:border-border focus:border-primary/40 outline-none focus:ring-1 focus:ring-primary/40 rounded px-2 py-1 text-sm";

  return (
    <tr key={rowKey} className="border-b last:border-b-0 hover:bg-muted/20">
      <td className="px-3 py-1.5 align-middle" />
      <td className="px-1 py-1.5 align-middle">
        <input
          className={`${inputCls} font-medium placeholder:text-muted-foreground/40 placeholder:italic`}
          placeholder="Add a custom line item…"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          onBlur={handleBlur}
        />
      </td>
      <td className="px-1 py-1.5 align-middle">
        <input
          className={`${inputCls} text-muted-foreground placeholder:text-muted-foreground/40`}
          placeholder="Vendor name"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          onBlur={handleBlur}
        />
      </td>
      <td className="px-1 py-1.5 align-middle text-right">
        <input
          className={`${inputCls} tabular-nums text-right font-medium placeholder:text-muted-foreground/40`}
          placeholder="e.g. 500000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={handleBlur}
        />
      </td>
    </tr>
  );
}

export default function ProjectCostPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [newRowKey, setNewRowKey] = useState(0);
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "designer";
  const [, navigate] = useLocation();

  const { data: categoriesData = [], isLoading: catLoading } = useQuery<VendorCategory[]>({
    queryKey: ["/api/vendor-categories/tree"],
  });

  const { data: quotationsData, isLoading: quotLoading } = useQuery<QuotationsResponse>({
    queryKey: ["/api/quotations"],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: customItems = [], isLoading: customLoading } = useQuery<ProjectCostItem[]>({
    queryKey: ["/api/project-cost-items", selectedProjectId],
    enabled: !!selectedProjectId,
    staleTime: 0,
  });

  const createItemMutation = useMutation({
    mutationFn: (fields: { categoryName: string; vendorName: string; amount: string }) =>
      apiRequest("POST", `/api/project-cost-items/${selectedProjectId}`, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-cost-items", selectedProjectId] });
      setNewRowKey((k) => k + 1);
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: Partial<ProjectCostItem> }) =>
      apiRequest("PUT", `/api/project-cost-items/${id}`, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-cost-items", selectedProjectId] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/project-cost-items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-cost-items", selectedProjectId] });
    },
  });

  const isLoading = catLoading || quotLoading;
  const projects = quotationsData?.projects ?? [];
  const quotations = quotationsData?.quotations ?? {};

  const rootCategories = [...categoriesData]
    .filter((c) => !c.parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const allCategories = categoriesData;

  const getSelectedQuotes = (projectId: string): QuotationData[] => {
    const quotes = quotations[projectId] ?? [];
    return quotes.filter((q) => isVendorQuote(q) && q.status === "Selected");
  };

  const getTotal = (projectId: string): number => {
    return getSelectedQuotes(projectId)
      .reduce((sum, q) => sum + parseFloat(q.quotationValue || "0"), 0);
  };

  const getQuotedCategoryCount = (projectId: string): number => {
    const quotedNames = new Set(
      getSelectedQuotes(projectId).map((q) => q.category)
    );
    return rootCategories.filter((cat) => {
      if (quotedNames.has(cat.name)) return true;
      const children = allCategories.filter((c) => c.parentId === cat.id);
      return children.some((child) => quotedNames.has(child.name));
    }).length;
  };

  const getSelectedQuotesForCategory = (
    projectId: string,
    cat: VendorCategory
  ): QuotationData[] => {
    const quotes = quotations[projectId] ?? [];
    const childNames = new Set(
      allCategories.filter((c) => c.parentId === cat.id).map((c) => c.name)
    );
    return quotes.filter(
      (q) =>
        isVendorQuote(q) &&
        q.status === "Selected" &&
        (q.category === cat.name || childNames.has(q.category))
    );
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
      const catQuotes = getSelectedQuotesForCategory(selectedProjectId, cat);
      const catTotal = catQuotes.reduce(
        (s, q) => s + parseFloat(q.quotationValue || "0"),
        0
      );
      const vendorNames = [...new Set(catQuotes.map((q) => q.vendorName))];
      return { cat, catQuotes, catTotal, vendorNames, idx: idx + 1 };
    });

    const quotesTotal = rows.reduce((sum, r) => sum + r.catTotal, 0);
    const customTotal = customItems.reduce((sum, item) => sum + parseFloat(item.amount || "0"), 0);
    const total = quotesTotal + customTotal;
    const startIdx = rows.length + 1;

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
                <th className="text-right px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground w-36">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ cat, catTotal, vendorNames, idx }) => {
                const hasQuote = catTotal > 0;
                return (
                  <tr
                    key={cat.id}
                    className={`border-b last:border-b-0 hover:bg-muted/20 ${hasQuote ? "cursor-pointer" : ""}`}
                    onClick={hasQuote ? () => navigate(`/quotes?project=${selectedProjectId}&category=${cat.id}`) : undefined}
                  >
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{idx}</td>
                    <td className="px-3 py-2.5 font-medium">{cat.name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {vendorNames.length > 0 ? vendorNames.join(", ") : (
                        <span className="italic text-muted-foreground/50 text-xs">No quote yet</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                      {hasQuote
                        ? <span className="underline decoration-dotted underline-offset-2">{formatCurrencyCompact(catTotal)}</span>
                        : <span className="text-muted-foreground/40">—</span>}
                    </td>
                  </tr>
                );
              })}

              {/* Saved custom items */}
              {!customLoading && customItems.map((item, idx) => (
                <SavedItemRow
                  key={item.id}
                  item={item}
                  canEdit={canEdit}
                  onSave={(id, fields) => updateItemMutation.mutate({ id, fields })}
                  onDelete={(id) => deleteItemMutation.mutate(id)}
                />
              ))}

              {/* New editable empty row — only for admin/designer */}
              {canEdit && (
                <NewItemRow
                  key={newRowKey}
                  rowKey={newRowKey}
                  onCommit={(fields) => createItemMutation.mutate(fields)}
                />
              )}
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
