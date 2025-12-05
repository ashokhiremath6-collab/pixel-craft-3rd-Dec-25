import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import VendorList from '@/components/VendorList';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Vendor, VendorCategory } from "@shared/schema";

export default function VendorsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch hierarchical category tree
  const { data: categories = [] } = useQuery<VendorCategory[]>({
    queryKey: ['/api/vendor-categories/tree'],
  });

  // Fetch vendors with project information
  const { data: vendors = [], isLoading } = useQuery<Array<Vendor & { projects: Array<{ projectId: string; projectName: string; clientName: string; status: string }> }>>({
    queryKey: ['/api/vendors-with-projects'],
  });

  // Update vendor mutation
  const updateVendorMutation = useMutation({
    mutationFn: async ({ vendorId, data }: { vendorId: string; data: Partial<Vendor> }) => {
      return apiRequest('PATCH', `/api/vendors/${vendorId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendors-with-projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      toast({
        title: "Success",
        description: "Vendor updated successfully",
      });
    },
    onError: (error) => {
      console.error('Failed to update vendor:', error);
      toast({
        title: "Error", 
        description: "Failed to update vendor. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete vendor mutation
  const deleteVendorMutation = useMutation({
    mutationFn: async (vendorId: string) => {
      return apiRequest('DELETE', `/api/vendors/${vendorId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendors-with-projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      toast({
        title: "Success",
        description: "Vendor deleted successfully",
      });
    },
    onError: (error: any) => {
      console.error('Failed to delete vendor:', error);
      // Extract server error message - format is "400: {\"error\":\"message\"}"
      let errorMessage = "Failed to delete vendor. Please try again.";
      try {
        const match = error?.message?.match(/\d+:\s*(.+)/);
        if (match) {
          const jsonPart = JSON.parse(match[1]);
          errorMessage = jsonPart.error || errorMessage;
        }
      } catch { /* use default message */ }
      toast({
        title: "Cannot Delete Vendor", 
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleAddVendor = () => {
    // This will be handled by the VendorList component's dialog
    console.log('Add vendor - handled by VendorList component');
  };

  const handleEditVendor = (vendor: Vendor) => {
    // Editing is now handled by the VendorList component's edit dialog
    console.log('Edit vendor:', vendor.name);
  };

  const handleUpdateVendor = (vendorId: string, data: Partial<Vendor>) => {
    updateVendorMutation.mutate({ vendorId, data });
  };

  const handleDeleteVendor = (vendorId: string) => {
    if (confirm('Are you sure you want to delete this vendor? This action cannot be undone.')) {
      deleteVendorMutation.mutate(vendorId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading vendors...</div>
      </div>
    );
  }

  return (
    <VendorList 
      vendors={vendors}
      categories={categories}
      onAddVendor={handleAddVendor}
      onEditVendor={handleEditVendor}
      onUpdateVendor={handleUpdateVendor}
      onDeleteVendor={handleDeleteVendor}
    />
  );
}