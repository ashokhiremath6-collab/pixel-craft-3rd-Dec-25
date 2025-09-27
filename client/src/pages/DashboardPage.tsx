import { useQuery } from "@tanstack/react-query";
import Dashboard from '@/components/Dashboard';
import type { Vendor, Project, VendorCategory } from "@shared/schema";

interface VendorWithCategory extends Omit<Vendor, 'categoryName'> {
  category: string;
}

interface QuotationData {
  id: string;
  vendorName: string;
  category: string;
  quotationValue: string;
  dateOfQuotation: string;
  status: "Quoted" | "Selected" | "Rejected";
  quotationFile?: string;
  notes?: string;
  isAboveAverage?: boolean;
}

interface QuotationsResponse {
  projects: Project[];
  quotations: Record<string, QuotationData[]>;
}

export default function DashboardPage() {
  // Fetch all data needed for dashboard
  const { data: vendorsData, isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ['/api/vendors'],
  });

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery<VendorCategory[]>({
    queryKey: ['/api/vendor-categories/tree'],
  });

  const { data: quotationsData, isLoading: quotationsLoading } = useQuery<QuotationsResponse>({
    queryKey: ['/api/quotations'],
  });

  const handleNavigate = (path: string) => {
    window.location.href = path;
  };

  const isLoading = vendorsLoading || quotationsLoading || categoriesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  // Create category lookup map
  const categoryMap = (categoriesData || []).reduce((acc, category) => {
    acc[category.id] = category.name;
    return acc;
  }, {} as Record<string, string>);

  // Transform vendors to match Dashboard component expectations
  const vendorsWithCategory: VendorWithCategory[] = (vendorsData || []).map(vendor => ({
    ...vendor,
    category: categoryMap[vendor.categoryId] || 'Unknown Category'
  }));

  // Create all quotations from project-vendor relationships
  const allQuotations = Object.entries(quotationsData?.quotations || {})
    .flatMap(([projectId, projectQuotations]) => {
      const project = quotationsData?.projects.find(p => p.id === projectId);
      return projectQuotations.map(q => ({
        ...q,
        projectName: project?.projectName || 'Unknown Project',
        category: q.category // Include category from API response
      }));
    });

  // Create recent quotations for display (latest 10 by submission date)
  const recentQuotations = allQuotations
    .sort((a, b) => {
      // Sort by dateOfQuotation if available, otherwise fall back to comparing IDs as a proxy for creation time
      const dateA = a.dateOfQuotation ? new Date(a.dateOfQuotation).getTime() : 0;
      const dateB = b.dateOfQuotation ? new Date(b.dateOfQuotation).getTime() : 0;
      return dateB - dateA; // Most recent first
    })
    .slice(0, 10);

  return (
    <Dashboard 
      vendors={vendorsWithCategory}
      projects={quotationsData?.projects || []}
      recentQuotations={recentQuotations}
      allQuotations={allQuotations} // Pass all quotations for total calculation
      onNavigate={handleNavigate}
    />
  );
}