import { useQuery } from "@tanstack/react-query";
import VendorList from '@/components/VendorList';
import type { Vendor, VendorCategory } from "@shared/schema";

export default function VendorsPage() {
  // Fetch hierarchical category tree
  const { data: categories = [] } = useQuery<VendorCategory[]>({
    queryKey: ['/api/vendor-categories/tree'],
  });

  // Fetch vendors  
  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ['/api/vendors'],
  });

  const handleAddVendor = () => {
    console.log('Add vendor - would open form modal');
  };

  const handleEditVendor = (vendor: Vendor) => {
    console.log('Edit vendor:', vendor.name);
  };

  const handleDeleteVendor = (vendorId: string) => {
    console.log('Delete vendor:', vendorId);
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