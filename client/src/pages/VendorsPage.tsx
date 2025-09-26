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
    onError: (error) => {
      console.error('Failed to delete vendor:', error);
      toast({
        title: "Error", 
        description: "Failed to delete vendor. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddVendor = () => {
    // This will be handled by the VendorList component's dialog
    console.log('Add vendor - handled by VendorList component');
  };

  const handleEditVendor = (vendor: Vendor) => {
    // TODO: Implement edit functionality with a dialog/modal
    console.log('Edit vendor:', vendor.name);
    toast({
      title: "Edit Feature",
      description: "Edit functionality will be implemented next",
    });
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
      onDeleteVendor={handleDeleteVendor}
    />
  );
}