import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Dashboard from '@/components/Dashboard';
import type { Vendor, Project, VendorCategory, ActivityLog, Task } from "@shared/schema";
import { differenceInDays, startOfDay } from "date-fns";

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
  const [selectedProjectId] = useState<string | null>(null);

  const { data: user } = useQuery<{ role: string }>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });
  
  const isDesignerOrAdmin = user?.role === 'designer' || user?.role === 'admin';
  
  const { data: vendorsData, isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ['/api/vendors'],
    enabled: isDesignerOrAdmin,
  });

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery<VendorCategory[]>({
    queryKey: ['/api/vendor-categories/tree'],
  });

  const { data: quotationsData, isLoading: quotationsLoading } = useQuery<QuotationsResponse>({
    queryKey: ['/api/quotations'],
  });

  const { data: activitiesData, isLoading: activitiesLoading } = useQuery<ActivityLog[]>({
    queryKey: ['/api/activities'],
    queryFn: async () => {
      const response = await fetch('/api/activities', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch activities');
      return response.json();
    }
  });

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

  const categoryMap = (categoriesData || []).reduce((acc, category) => {
    acc[category.id] = category.name;
    return acc;
  }, {} as Record<string, string>);

  const vendorsWithCategory: VendorWithCategory[] = (vendorsData || []).map(vendor => ({
    ...vendor,
    category: categoryMap[vendor.categoryId] || 'Unknown Category'
  }));

  const allQuotations = Object.entries(quotationsData?.quotations || {})
    .flatMap(([projectId, projectQuotations]) => {
      const project = quotationsData?.projects.find(p => p.id === projectId);
      return projectQuotations.map(q => ({
        ...q,
        projectName: project?.projectName || 'Unknown Project',
        category: q.category,
      }));
    });

  const recentQuotations = allQuotations
    .sort((a, b) => {
      const dateA = a.uploadedAt
        ? new Date(a.uploadedAt).getTime()
        : (a.dateOfQuotation ? new Date(a.dateOfQuotation).getTime() : 0);
      const dateB = b.uploadedAt
        ? new Date(b.uploadedAt).getTime()
        : (b.dateOfQuotation ? new Date(b.dateOfQuotation).getTime() : 0);
      return dateB - dateA;
    })
    .slice(0, 10);

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

  const filteredVendors = selectedProjectId
    ? vendorsWithCategory.filter(vendor => {
        const projectQuotations = quotationsData?.quotations[selectedProjectId] || [];
        return projectQuotations.some(q => q.vendorName === vendor.name);
      })
    : vendorsWithCategory;

  const parseLocalDate = (dateStr: string | Date | null) => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date(dateStr);
  };

  const getTaskAlerts = () => {
    if (!allTasksData || !quotationsData) return { upcomingStart: [], completionCountdown: [], overdue: [] };
    
    const now = new Date();
    const today = startOfDay(now);
    const upcomingStart: Array<Task & { projectName: string, daysUntilStart: number }> = [];
    const completionCountdown: Array<Task & { projectName: string, daysToGo: number }> = [];
    const overdue: Array<Task & { projectName: string, daysOverdue: number }> = [];
    
    allTasksData.forEach(task => {
      if (task.status === 'completed') return;
      const progress = Number(task.progressPercentage) || 0;
      if (progress >= 100) return;
      
      const taskName = task.name?.toUpperCase() || '';
      if (taskName.startsWith('PHASE') || taskName.startsWith('PACKAGE') || taskName.startsWith('EXECUTE')) return;
      if (task.startDate === '2099-12-31' || task.endDate === '2099-12-31') return;
      
      const project = quotationsData.projects.find(p => p.id === task.projectId);
      const projectName = project?.projectName || 'Unknown Project';
      
      if (task.startDate) {
        const startDate = startOfDay(new Date(task.startDate));
        const daysUntilStart = differenceInDays(startDate, today);
        if (daysUntilStart >= 0 && daysUntilStart <= 30) {
          upcomingStart.push({ ...task, projectName, daysUntilStart });
        }
      }
      
      if (task.endDate) {
        const endDate = parseLocalDate(task.endDate);
        if (endDate && endDate < now) {
          const daysOverdue = Math.max(1, differenceInDays(today, startOfDay(endDate)));
          overdue.push({ ...task, projectName, daysOverdue });
        } else if (endDate) {
          const daysToGo = differenceInDays(startOfDay(endDate), today);
          if (daysToGo >= 1 && daysToGo <= 5) {
            completionCountdown.push({ ...task, projectName, daysToGo });
          }
        }
      }
    });
    
    upcomingStart.sort((a, b) => a.daysUntilStart - b.daysUntilStart);
    completionCountdown.sort((a, b) => a.daysToGo - b.daysToGo);
    overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
    
    return { upcomingStart, completionCountdown, overdue };
  };

  const taskAlerts = getTaskAlerts();

  return (
    <div>
      <Dashboard 
        vendors={filteredVendors}
        projects={filteredProjects}
        recentQuotations={filteredRecentQuotations}
        allQuotations={filteredQuotations}
        activities={activitiesData || []}
        taskAlerts={taskAlerts}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
