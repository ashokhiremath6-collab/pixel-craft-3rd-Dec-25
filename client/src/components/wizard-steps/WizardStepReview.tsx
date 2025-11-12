import { useFormContext } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Folder, FileCheck, StickyNote } from "lucide-react";
import type { VendorCategory, WorksOrderDocument, ProjectVendor } from "@shared/schema";

export function WizardStepReview() {
  const form = useFormContext();
  const values = form.getValues();

  const { data: categories = [] } = useQuery<VendorCategory[]>({
    queryKey: ["/api/vendor-categories/tree"],
  });

  const { data: templates = [] } = useQuery<WorksOrderDocument[]>({
    queryKey: ["/api/works-order-templates"],
  });

  const { data: quotesData } = useQuery<{ projects: any[] }>({
    queryKey: ["/api/quotations"],
  });

  const quotes: ProjectVendor[] = quotesData?.projects?.flatMap(p => 
    p.quotes?.map((q: any) => ({ ...q, projectId: p.id, projectName: p.name })) || []
  ) || [];

  const selectedCategory = categories.find((c) => c.id === values.categoryId);
  const selectedTemplate = templates.find((t) => t.id === values.templateId);
  const selectedQuote = quotes.find((q) => q.id === values.projectVendorId);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Review & Confirm</h3>
        <p className="text-sm text-muted-foreground">
          Review your selections before creating the works order.
        </p>
      </div>

      <div className="space-y-4">
        {/* Works Order Name */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Works Order Name
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{values.name}</p>
          </CardContent>
        </Card>

        {/* Category */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Folder className="w-4 h-4" />
              Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{selectedCategory?.name || "-"}</p>
          </CardContent>
        </Card>

        {/* Template */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              Template
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="font-medium">{selectedTemplate?.fileName || "-"}</p>
              {selectedTemplate?.version && (
                <p className="text-xs text-muted-foreground">
                  Version {selectedTemplate.version}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quote */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Quote
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="font-medium">
                {selectedQuote?.quotationName || "Quotation"}
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {selectedQuote?.category && <span>{selectedQuote.category}</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {values.notes && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <StickyNote className="w-4 h-4" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{values.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
