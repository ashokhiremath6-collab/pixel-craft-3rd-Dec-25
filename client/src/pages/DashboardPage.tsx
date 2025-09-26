import { useQuery } from "@tanstack/react-query";
import Dashboard from '@/components/Dashboard';
import type { Vendor, Project } from "@shared/schema";

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

  const { data: quotationsData, isLoading: quotationsLoading } = useQuery<QuotationsResponse>({
    queryKey: ['/api/quotations'],
  });

  const handleNavigate = (path: string) => {
    window.location.href = path;
  };

  const isLoading = vendorsLoading || quotationsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  // Transform vendors to match Dashboard component expectations
  const vendorsWithCategory: VendorWithCategory[] = (vendorsData || []).map(vendor => ({
    ...vendor,
    category: vendor.categoryName || 'Other'
  }));

  // Create recent quotations from project-vendor relationships
  const recentQuotations = Object.entries(quotationsData?.quotations || {})
    .flatMap(([projectId, projectQuotations]) => {
      const project = quotationsData?.projects.find(p => p.id === projectId);
      return projectQuotations.map(q => ({
        ...q,
        projectName: project?.projectName || 'Unknown Project'
      }));
    })
    .slice(0, 10); // Show latest 10 quotations

  return (
    <Dashboard 
      vendors={vendorsWithCategory}
      projects={quotationsData?.projects || []}
      recentQuotations={recentQuotations}
      onNavigate={handleNavigate}
    />
  );
}