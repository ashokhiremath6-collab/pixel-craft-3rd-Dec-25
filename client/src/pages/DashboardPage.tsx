import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Dashboard from '@/components/Dashboard';
import type { Vendor, Project, VendorCategory } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  // State for project filter
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Get user info to check role
  const { data: user } = useQuery<{ role: string }>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });
  
  const isDesigner = user?.role === 'designer';
  
  // Fetch all data needed for dashboard
  const { data: vendorsData, isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ['/api/vendors'],
    enabled: isDesigner, // Only load vendors for designers
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
  // For clients, vendors data will be empty since they don't need to see all vendors
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

  // Filter data based on selected project
  const filteredProjects = selectedProjectId 
    ? (quotationsData?.projects || []).filter(p => p.id === selectedProjectId)
    : quotationsData?.projects || [];

  const filteredQuotations = selectedProjectId
    ? allQuotations.filter(q => {
        const project = quotationsData?.projects.find(p => p.projectName === q.projectName);
        return project?.id === selectedProjectId;
      })
    : allQuotations;

  const filteredRecentQuotations = selectedProjectId
    ? recentQuotations.filter(q => {
        const project = quotationsData?.projects.find(p => p.projectName === q.projectName);
        return project?.id === selectedProjectId;
      })
    : recentQuotations;

  // Filter vendors to only show those associated with the selected project
  const filteredVendors = selectedProjectId
    ? vendorsWithCategory.filter(vendor => {
        const projectQuotations = quotationsData?.quotations[selectedProjectId] || [];
        return projectQuotations.some(q => q.vendorName === vendor.name);
      })
    : vendorsWithCategory;

  return (
    <div className="space-y-4">
      {/* Project Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                Filter by Project
              </label>
              <Select 
                value={selectedProjectId || "all"} 
                onValueChange={(value) => setSelectedProjectId(value === "all" ? null : value)}
              >
                <SelectTrigger data-testid="select-project-filter">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {(quotationsData?.projects || []).map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedProjectId && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedProjectId(null)}
                className="mt-6"
                data-testid="button-clear-filter"
                title="Clear filter"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dashboard 
        vendors={filteredVendors}
        projects={filteredProjects}
        recentQuotations={filteredRecentQuotations}
        allQuotations={filteredQuotations}
        onNavigate={handleNavigate}
      />
    </div>
  );
}