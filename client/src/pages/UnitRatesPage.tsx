import ComparativeQuotes from '@/components/ComparativeQuotes';
import QuoteImport from '@/components/QuoteImport';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { VendorCategory, Project } from '@shared/schema';

interface QuotationsResponse {
  projects: Project[];
  quotations: Record<string, any[]>;
}

export default function UnitRatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Fetch vendor categories for hierarchical filtering
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/vendor-categories/tree'],
  });

  // Fetch real quotations data from API
  const { data: quotationsData, isLoading: quotationsLoading, error: quotationsError } = useQuery<QuotationsResponse>({
    queryKey: ['/api/quotations'],
  });

  // Mutation for updating quotation status
  const statusUpdateMutation = useMutation({
    mutationFn: async ({ quotationId, status }: { quotationId: string, status: "Quoted" | "Selected" | "Rejected" }) => {
      return await apiRequest('PUT', `/api/project-vendors/${quotationId}`, { status });
    },
    onSuccess: () => {
      // Invalidate and refetch quotations
      queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
      toast({
        title: "Status Updated",
        description: "Quotation status has been updated successfully",
      });
    },
    onError: (error) => {
      console.error('Status update error:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update quotation status",
        variant: "destructive",
      });
    }
  });

  const handleStatusChange = (quotationId: string, status: "Quoted" | "Selected" | "Rejected") => {
    statusUpdateMutation.mutate({ quotationId, status });
  };

  // Show loading state
  if (quotationsLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading quotations...</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (quotationsError) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-destructive mb-4">Failed to load quotations</div>
          <button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/quotations'] })}
            className="px-4 py-2 bg-primary text-primary-foreground rounded"
            data-testid="button-retry"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Filter quotations to only show unit rate quotes (quotationValue === -1)
  const projects = quotationsData?.projects || [];
  const allQuotations = quotationsData?.quotations || {};
  
  // Filter to only include unit rate quotes
  const filteredQuotations: Record<string, any[]> = {};
  Object.keys(allQuotations).forEach((projectId) => {
    const unitRateQuotes = allQuotations[projectId].filter(
      (quote: any) => {
        const value = parseFloat(quote.quotationValue);
        return value === -1;
      }
    );
    if (unitRateQuotes.length > 0) {
      filteredQuotations[projectId] = unitRateQuotes;
    }
  });

  return (
    <div className="space-y-6">
      {/* Import Button */}
      <div className="flex justify-end">
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-open-import-dialog">
              <Upload className="h-4 w-4 mr-2" />
              Import Unit Rate Quote
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Import Unit Rate Quote</DialogTitle>
              <DialogDescription>
                Upload Excel, CSV, or PDF files to import unit rate quotations
              </DialogDescription>
            </DialogHeader>
            <QuoteImport 
              forceQuoteType="unitrate"
              onSuccess={() => {
                setImportDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <ComparativeQuotes 
        projects={projects}
        categories={categories as VendorCategory[]}
        quotations={filteredQuotations}
        onStatusChange={handleStatusChange}
        hideValueColumns={true}
      />
    </div>
  );
}
