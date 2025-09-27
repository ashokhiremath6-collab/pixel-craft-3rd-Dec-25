// No imports needed from React for this component
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, Calendar, IndianRupee, Package, User, AlertCircle, Eye, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Boq, ProjectVendor } from "@shared/schema";

interface QuoteDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteId: string | null;
  vendorName?: string;
  projectName?: string;
}

interface QuoteDetails {
  quote: ProjectVendor;
  boqItems: Boq[];
}

export default function QuoteDetailModal({ 
  isOpen, 
  onClose, 
  quoteId, 
  vendorName, 
  projectName 
}: QuoteDetailModalProps) {
  const { toast } = useToast();

  // Use React Query for data fetching
  const { 
    data: quoteDetails, 
    isLoading, 
    error,
    refetch 
  } = useQuery<QuoteDetails>({
    queryKey: ['/api/quotes', quoteId, 'boq'],
    enabled: !!quoteId && isOpen,
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Handle errors with toast
  if (error && isOpen) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load quote details';
    
    // Only show toast for non-404 errors
    if (!errorMessage.includes('404') && !errorMessage.includes('not found')) {
      toast({
        title: "Error",
        description: "Failed to load quote details. Please try again.",
        variant: "destructive",
      });
    }
  }

  const formatCurrency = (value: string | number) => {
    const numValue = parseLocalizedNumber(value);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(numValue);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const parseLocalizedNumber = (value: string | number) => {
    if (typeof value === 'number') return value;
    // Remove commas, currency symbols, and other non-numeric characters except dots
    const cleanValue = value.toString().replace(/[,₹$\s]/g, '');
    const numValue = parseFloat(cleanValue);
    return isNaN(numValue) ? 0 : numValue;
  };

  const getTotalAmount = () => {
    // Use the quote's parsed total value if available, otherwise sum BOQ items
    if (quoteDetails?.quote.quotationValue) {
      return parseLocalizedNumber(quoteDetails.quote.quotationValue);
    }
    if (!quoteDetails?.boqItems) return 0;
    return quoteDetails.boqItems.reduce((sum, item) => 
      sum + parseLocalizedNumber(item.totalAmount), 0
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Selected': return 'bg-green-100 text-green-800 border-green-200';
      case 'Rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const groupedBoqItems = quoteDetails?.boqItems.reduce((acc, item) => {
    const category = item.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, Boq[]>) || {};

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden" data-testid="dialog-quote-details">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="title-quote-details">
            <FileText className="h-5 w-5" />
            Quote Details - {vendorName}
          </DialogTitle>
          <DialogDescription data-testid="description-quote-details">
            Detailed breakdown of quotation for {projectName}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-8" data-testid="loading-quote-details">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading quote details...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center" data-testid="error-quote-details">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {error instanceof Error && error.message.includes('404') ? 'Quote Not Found' : 'Failed to Load Quote'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error && error.message.includes('404') 
                ? 'This quote may have been deleted or moved.'
                : 'There was a problem loading the quote details. Please try again.'
              }
            </p>
            <Button onClick={() => refetch()} data-testid="button-retry-quote">
              Try Again
            </Button>
          </div>
        ) : quoteDetails ? (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {/* Quote Summary */}
              <Card data-testid="card-quote-summary">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Quote Summary</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        Vendor
                      </div>
                      <p className="font-medium" data-testid="text-vendor-name">{vendorName}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        Quotation Date
                      </div>
                      <p className="font-medium" data-testid="text-quote-date">
                        {formatDate(quoteDetails.quote.dateOfQuotation)}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Package className="h-4 w-4" />
                        Status
                      </div>
                      <Badge 
                        className={getStatusColor(quoteDetails.quote.status)} 
                        data-testid="badge-quote-status"
                      >
                        {quoteDetails.quote.status}
                      </Badge>
                    </div>
                  </div>

                  {quoteDetails.quote.notes && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Notes</h4>
                      <p className="text-sm text-muted-foreground" data-testid="text-quote-notes">
                        {quoteDetails.quote.notes}
                      </p>
                    </div>
                  )}

                  {/* Original Quote File */}
                  {quoteDetails.quote.quotationFile && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Original Quote File</h4>
                      <div className="border rounded-lg p-4 bg-muted/50">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {quoteDetails.quote.quotationFile.split('/').pop()}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => quoteDetails.quote.quotationFile && window.open(quoteDetails.quote.quotationFile, '_blank')}
                            data-testid="button-view-original-file"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Original File
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = quoteDetails.quote.quotationFile!;
                              link.download = quoteDetails.quote.quotationFile!.split('/').pop() || 'quote.pdf';
                              link.click();
                            }}
                            data-testid="button-download-original-file"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <Separator className="my-3" />

                  {/* Total Summary */}
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium">Total Quote Value:</span>
                    <div className="flex items-center gap-2">
                      <IndianRupee className="h-5 w-5 text-green-600" />
                      <span className="text-2xl font-bold text-green-600" data-testid="text-total-value">
                        {formatCurrency(getTotalAmount())}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* BOQ Items by Category */}
              {Object.keys(groupedBoqItems).length > 0 ? (
                Object.entries(groupedBoqItems).map(([category, items]) => (
                  <Card key={category} data-testid={`card-category-${category.replace(/\s+/g, '-').toLowerCase()}`}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>{category}</span>
                        <Badge variant="outline" data-testid={`badge-item-count-${category.replace(/\s+/g, '-').toLowerCase()}`}>
                          {items.length} item{items.length !== 1 ? 's' : ''}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item Description</TableHead>
                            <TableHead className="text-center">Qty</TableHead>
                            <TableHead className="text-center">Unit</TableHead>
                            <TableHead className="text-right">Rate</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item, index) => (
                            <TableRow key={item.id} data-testid={`row-boq-item-${item.id}`}>
                              <TableCell>
                                <div>
                                  <p className="font-medium" data-testid="text-item-description">
                                    {item.itemDescription}
                                  </p>
                                  {item.specifications && (
                                    <p className="text-sm text-muted-foreground mt-1" data-testid="text-item-specifications">
                                      {item.specifications}
                                    </p>
                                  )}
                                  {item.itemCode && (
                                    <p className="text-xs text-muted-foreground font-mono mt-1" data-testid="text-item-code">
                                      Code: {item.itemCode}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center font-mono" data-testid="text-item-quantity">
                                {parseFloat(item.quantity.toString()).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-center" data-testid="text-item-unit">
                                {item.unit}
                              </TableCell>
                              <TableCell className="text-right font-mono" data-testid="text-item-rate">
                                {formatCurrency(item.unitRate.toString())}
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium" data-testid="text-item-total">
                                {formatCurrency(item.totalAmount.toString())}
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Category Subtotal */}
                          <TableRow className="border-t-2 bg-muted/30">
                            <TableCell colSpan={4} className="font-medium">
                              {category} Subtotal
                            </TableCell>
                            <TableCell className="text-right font-bold" data-testid={`text-category-subtotal-${category.replace(/\s+/g, '-').toLowerCase()}`}>
                              {formatCurrency(
                                items.reduce((sum, item) => 
                                  sum + parseLocalizedNumber(item.totalAmount), 0
                                )
                              )}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No BOQ Items Found</h3>
                    <p className="text-muted-foreground">
                      This quote doesn't have detailed line items imported yet.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">No quote details available.</p>
            <Button onClick={() => refetch()} className="mt-4">
              Try Again
            </Button>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t">
          <Button onClick={onClose} data-testid="button-close-modal">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}