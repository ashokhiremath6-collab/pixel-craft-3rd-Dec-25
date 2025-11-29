import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Dashboard from '@/components/Dashboard';
import type { Vendor, Project, VendorCategory, ActivityLog, Task } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, FileUp, Clock, AlertCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, differenceInDays, startOfDay, format } from "date-fns";

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
  uploaderName?: string | null;
  uploadedAt?: string | null;
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
  
  const isDesignerOrAdmin = user?.role === 'designer' || user?.role === 'admin';
  
  // Fetch all data needed for dashboard
  const { data: vendorsData, isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ['/api/vendors'],
    enabled: isDesignerOrAdmin, // Load vendors for designers and admins
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

  // Fetch all tasks across all projects for alerts
  const { data: allTasksData } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
    queryFn: async () => {
      const response = await fetch('/api/tasks', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch tasks');
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
      }));
    });

  // Create recent quotations for display (latest 10 by submission date)
  const recentQuotations = allQuotations
    .sort((a, b) => {
      // Sort by uploadedAt if available, otherwise dateOfQuotation, otherwise fall back to IDs
      const dateA = a.uploadedAt 
        ? new Date(a.uploadedAt).getTime() 
        : (a.dateOfQuotation ? new Date(a.dateOfQuotation).getTime() : 0);
      const dateB = b.uploadedAt 
        ? new Date(b.uploadedAt).getTime() 
        : (b.dateOfQuotation ? new Date(b.dateOfQuotation).getTime() : 0);
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
      'floor_plan_delete': 'Floor Plan',
      'moodboard_upload': 'Moodboard',
      'moodboard_delete': 'Moodboard',
      'render_upload': 'Render',
      'render_delete': 'Render',
      'working_drawing_upload': 'Working Drawing',
      'working_drawing_delete': 'Working Drawing',
      'quote_upload': 'Quotation',
      'quote_file_delete': 'Quotation',
      'schedule_upload': 'Project Schedule',
      'specification_upload': 'Specification',
      'specification_delete': 'Specification',
      'catalogue_upload': 'Catalogue Item',
      'catalogue_delete': 'Catalogue Item',
      'invoice_create': 'Invoice',
      'invoice_update': 'Invoice',
      'invoice_delete': 'Invoice',
      'vendor_payment': 'Payment',
      'vendor_create': 'Vendor',
      'vendor_update': 'Vendor',
      'vendor_delete': 'Vendor'
    };
    return labels[activityType] || activityType;
  };

  // Helper function to get activity action (uploaded or deleted)
  const getActivityAction = (activityType: string) => {
    if (activityType.endsWith('_delete')) return 'deleted';
    if (activityType.endsWith('_upload')) return 'uploaded';
    if (activityType.endsWith('_create')) return 'created';
    if (activityType.endsWith('_update')) return 'updated';
    if (activityType === 'vendor_payment') return 'recorded';
    return 'performed';
  };

  // Calculate task alerts - Starting Today and Completion Countdown (5 days before)
  const getTaskAlerts = () => {
    if (!allTasksData || !quotationsData) return { startingToday: [], completionCountdown: [] };
    
    const today = startOfDay(new Date());
    const startingToday: Array<Task & { projectName: string }> = [];
    const completionCountdown: Array<Task & { projectName: string, daysToGo: number }> = [];
    
    allTasksData.forEach(task => {
      // Skip PHASE, PACKAGE, and EXECUTE header rows - these are grouping headers, not actual tasks
      const taskName = task.name?.toUpperCase() || '';
      if (taskName.startsWith('PHASE') || taskName.startsWith('PACKAGE') || taskName.startsWith('EXECUTE')) return;
      
      // Skip rows where startDate = endDate and duration is null (likely header rows without real dates)
      if (task.startDate && task.endDate && !task.duration) {
        const startDate = startOfDay(new Date(task.startDate));
        const endDate = startOfDay(new Date(task.endDate));
        if (differenceInDays(endDate, startDate) === 0) return;
      }
      
      const project = quotationsData.projects.find(p => p.id === task.projectId);
      const projectName = project?.projectName || 'Unknown Project';
      
      // Skip tasks that have been manually marked as complete
      const progress = Number(task.progressPercentage) || 0;
      if (progress >= 100) return;
      
      // Check for tasks starting today
      if (task.startDate) {
        const startDate = startOfDay(new Date(task.startDate));
        const daysUntilStart = differenceInDays(startDate, today);
        if (daysUntilStart === 0) {
          startingToday.push({ ...task, projectName });
        }
      }
      
      // Check for completion countdown (5 days or less before end date)
      if (task.endDate) {
        const endDate = startOfDay(new Date(task.endDate));
        const daysToGo = differenceInDays(endDate, today);
        if (daysToGo >= 1 && daysToGo <= 5) {
          completionCountdown.push({ ...task, projectName, daysToGo });
        }
      }
    });
    
    // Sort completion countdown by days remaining (ascending)
    completionCountdown.sort((a, b) => a.daysToGo - b.daysToGo);
    
    return { startingToday, completionCountdown };
  };

  const taskAlerts = getTaskAlerts();
  const hasAlerts = taskAlerts.startingToday.length > 0 || taskAlerts.completionCountdown.length > 0;

  return (
    <div className="space-y-4">
      {/* Task Alerts */}
      {hasAlerts && (
        <Card className="border-orange-200 dark:border-orange-900">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-lg">Task Alerts</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tasks Starting Today */}
            {taskAlerts.startingToday.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-600 hover:bg-blue-700 font-semibold">
                    Starting Today
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {taskAlerts.startingToday.length} task{taskAlerts.startingToday.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-2">
                  {taskAlerts.startingToday.map(task => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-md bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30"
                      data-testid={`alert-start-${task.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate" data-testid={`text-task-name-${task.id}`}>
                          {task.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span data-testid={`text-project-${task.id}`}>{task.projectName}</span>
                        </div>
                      </div>
                      <Badge className="bg-blue-600 hover:bg-blue-700 flex-shrink-0">
                        Starts Today
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Completion Countdown (5 days or less) */}
            {taskAlerts.completionCountdown.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-900/30 text-orange-900 dark:text-orange-100 font-semibold">
                    Completion Countdown
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {taskAlerts.completionCountdown.length} task{taskAlerts.completionCountdown.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-2">
                  {taskAlerts.completionCountdown.map(task => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-md bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30"
                      data-testid={`alert-countdown-${task.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm" data-testid={`text-task-name-${task.id}`}>
                          <span className="truncate">{task.name}</span>
                          <span className="text-orange-700 dark:text-orange-300 ml-2">
                            - {task.daysToGo} day{task.daysToGo !== 1 ? 's' : ''} to go for completion
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span data-testid={`text-project-${task.id}`}>{task.projectName}</span>
                        </div>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={`flex-shrink-0 ${
                          task.daysToGo <= 2 
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-100' 
                            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-900 dark:text-orange-100'
                        }`}
                      >
                        {task.daysToGo} day{task.daysToGo !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-lg font-medium">Recent Activity</CardTitle>
          <FileUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {!activitiesData || activitiesData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-activities">
              No recent activity
            </div>
          ) : (
            <div className="space-y-3">
              {activitiesData.slice(0, 10).map((activity) => {
                const project = quotationsData?.projects.find(p => p.id === activity.projectId);
                const activityDate = new Date(activity.createdAt);
                const formattedDateTime = format(activityDate, "MMM d, yyyy 'at' h:mm a");
                
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
                        <span className="text-sm text-muted-foreground">{getActivityAction(activity.activityType)}</span>
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
                        <span data-testid={`text-time-${activity.id}`}>{formattedDateTime}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}