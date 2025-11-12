import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar } from "lucide-react";
import type { ProjectVendor, VendorCategory } from "@shared/schema";
import { format } from "date-fns";

interface WizardStepQuoteProps {
  quotes: ProjectVendor[];
  categoryId: string;
  categories: VendorCategory[];
}

export function WizardStepQuote({ quotes, categoryId, categories }: WizardStepQuoteProps) {
  const form = useFormContext();

  const filteredQuotes = useMemo(() => {
    console.log("=== Quote Filter Debug ===");
    console.log("categoryId:", categoryId);
    console.log("Total quotes:", quotes.length);
    console.log("All quotes:", quotes.map(q => ({ id: q.id, category: q.category, name: q.quotationName })));
    
    // Find the category name from the ID
    const selectedCategory = categories.find(c => c.id === categoryId);
    console.log("selectedCategory:", selectedCategory);
    
    if (!selectedCategory) {
      console.log("No category found for ID:", categoryId);
      return [];
    }
    
    // Filter quotes by category name (case-insensitive comparison)
    const categoryName = selectedCategory.name.toLowerCase().trim();
    console.log("Looking for quotes with category:", categoryName);
    
    const filtered = quotes.filter((q) => {
      const qCategory = q.category?.toLowerCase().trim();
      console.log(`Quote ${q.id}: category="${q.category}" (normalized: "${qCategory}") matches? ${qCategory === categoryName}`);
      return q.category && qCategory === categoryName;
    });
    
    console.log("Filtered quotes:", filtered.length);
    console.log("=========================");
    return filtered;
  }, [quotes, categoryId, categories]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Select Quote</h3>
        <p className="text-sm text-muted-foreground">
          {filteredQuotes.length > 0
            ? `Choose the quote to import into this works order.`
            : "No quotes found for this category."}
        </p>
      </div>

      <FormField
        control={form.control}
        name="projectVendorId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Available Quotes</FormLabel>
            <FormControl>
              <RadioGroup value={field.value} onValueChange={field.onChange}>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredQuotes.length === 0 ? (
                    <Card>
                      <CardContent className="flex items-center justify-center p-8 text-center">
                        <div className="space-y-2">
                          <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            No quotes available for this category.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    filteredQuotes.map((quote) => (
                      <Card
                        key={quote.id}
                        className={field.value === quote.id ? "border-primary" : ""}
                        data-testid={`card-quote-${quote.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value={quote.id} id={quote.id} />
                            <label
                              htmlFor={quote.id}
                              className="flex-1 cursor-pointer"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-primary" />
                                    <span className="font-medium">
                                      {quote.quotationName || "Quotation"}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  {quote.category && (
                                    <span>{quote.category}</span>
                                  )}
                                </div>
                              </div>
                            </label>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
