import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Dashboard from '@/components/Dashboard';
import type { Vendor, Project, VendorCategory, ActivityLog } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, FileUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

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

  const { data: activitiesData, isLoading: activitiesLoading } = useQuery<ActivityLog[]>({
    queryKey: selectedProjectId ? ['/api/activities', selectedProjectId] : ['/api/activities'],
    queryFn: async () => {
      const url = selectedProjectId 
        ? `/api/activities?projectId=${selectedProjectId}` 
        : '/api/activities';
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch activities');
      return response.json();
    }
  });

  const handleNavigate = (path: string) => {
    window.location.href = path;
  };

  const isLoading = vendorsLoading || quotationsLoading || categoriesLoading || activitiesLoading;

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
        category: q.category, // Include category from API response
        uploaderName: q.uploaderName || null // Include uploader name from API response
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

  // Helper function to get activity type label
  const getActivityTypeLabel = (activityType: string) => {
    const labels: Record<string, string> = {
      'floor_plan_upload': 'Floor Plan',
      'moodboard_upload': 'Moodboard',
      'render_upload': 'Render',
      'working_drawing_upload': 'Working Drawing',
      'quote_upload': 'Quotation',
      'schedule_upload': 'Project Schedule'
    };
    return labels[activityType] || activityType;
  };

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

      {/* Recent Uploads */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-lg font-medium">Recent Uploads</CardTitle>
          <FileUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {!activitiesData || activitiesData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-activities">
              No recent uploads
            </div>
          ) : (
            <div className="space-y-3">
              {activitiesData.slice(0, 10).map((activity) => {
                const project = quotationsData?.projects.find(p => p.id === activity.projectId);
                const timeAgo = formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true });
                
                return (
                  <div 
                    key={activity.id} 
                    className="flex items-start gap-3 p-3 rounded-md hover-elevate"
                    data-testid={`activity-${activity.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm" data-testid={`text-user-${activity.id}`}>
                          {activity.userName}
                        </span>
                        <span className="text-sm text-muted-foreground">uploaded</span>
                        <span className="text-sm font-medium text-primary" data-testid={`text-type-${activity.id}`}>
                          {getActivityTypeLabel(activity.activityType)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-sm text-muted-foreground truncate" data-testid={`text-filename-${activity.id}`}>
                          {activity.fileName}
                        </span>
                        {project && (
                          <>
                            <span className="text-sm text-muted-foreground">•</span>
                            <span className="text-sm text-muted-foreground" data-testid={`text-project-${activity.id}`}>
                              {project.projectName}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span data-testid={`text-time-${activity.id}`}>{timeAgo}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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