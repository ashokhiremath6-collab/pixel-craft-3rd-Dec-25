import ComparativeQuotes from '@/components/ComparativeQuotes';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { VendorCategory, Project } from '@shared/schema';

interface QuotationsResponse {
  projects: Project[];
  quotations: Record<string, any[]>;
}

export default function UnitRatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    <ComparativeQuotes 
      projects={projects}
      categories={categories as VendorCategory[]}
      quotations={filteredQuotations}
      onStatusChange={handleStatusChange}
    />
  );
}
