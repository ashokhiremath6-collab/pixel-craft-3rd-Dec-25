import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Dashboard from '@/components/Dashboard';
import type { Vendor, Project, VendorCategory, ActivityLog, Task } from "@shared/schema";
import { MessageSquare, X } from "lucide-react";
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
  const [, setLocation] = useLocation();
  const [dismissedChat, setDismissedChat] = useState(false);

  const { data: user } = useQuery<{ role: string; id?: string }>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const userId = (user as any)?.id as string | undefined;

  const [chatLastReadAt, setChatLastReadAt] = useState<string>(() =>
    userId ? (localStorage.getItem(`chatLastReadAt_${userId}`) ?? new Date(0).toISOString()) : new Date(0).toISOString()
  );

  // Re-sync when user reads chat (e.g. if they open Chat in same tab)
  useEffect(() => {
    function onChatRead() {
      if (userId) {
        setChatLastReadAt(localStorage.getItem(`chatLastReadAt_${userId}`) ?? new Date(0).toISOString());
        setDismissedChat(false);
      }
    }
    window.addEventListener("chatRead", onChatRead);
    return () => window.removeEventListener("chatRead", onChatRead);
  }, [userId]);

  // Also read from localStorage once userId is available (first load)
  useEffect(() => {
    if (userId) {
      setChatLastReadAt(localStorage.getItem(`chatLastReadAt_${userId}`) ?? new Date(0).toISOString());
    }
  }, [userId]);

  const { data: unreadChat } = useQuery<{ total: number; byProject: { projectId: string; projectName: string; count: number }[] }>({
    queryKey: ['/api/messages/unread', chatLastReadAt],
    queryFn: () => fetch(`/api/messages/unread?since=${encodeURIComponent(chatLastReadAt)}`, { credentials: 'include' }).then(r => r.json()),
    enabled: !!userId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  
  const isDesignerOrAdmin = user?.role === 'designer' || user?.role === 'admin';
  
  const { data: vendorsData, isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ['/api/vendors'],
    enabled: isDesignerOrAdmin,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery<VendorCategory[]>({
    queryKey: ['/api/vendor-categories/tree'],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: quotationsData, isLoading: quotationsLoading } = useQuery<QuotationsResponse>({
    queryKey: ['/api/quotations'],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: projectsData } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: activitiesData, isFetching: activitiesLoading, refetch: refetchActivities } = useQuery<ActivityLog[]>({
    queryKey: ['/api/activities', { limit: 50 }],
    queryFn: () => fetch('/api/activities?limit=50', { credentials: 'include' }).then(r => r.json()),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const isStaffOrAdmin = user?.role === 'designer' || user?.role === 'admin' || user?.role === 'project_manager';

  const { data: vendorAlertsData } = useQuery<any[]>({
    queryKey: ['/api/dashboard/vendor-alerts'],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    enabled: isStaffOrAdmin,
  });

  const { data: allTasksData, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: rfqAlertsData } = useQuery<any[]>({
    queryKey: ['/api/dashboard/rfq-alerts'],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    enabled: isDesignerOrAdmin,
  });

  const handleNavigate = (path: string) => {
    setLocation(path);
  };

  // Only block rendering on the core data needed to build the page skeleton.
  // Task stats are computed independently — they default to 0/empty while loading
  // and update as soon as the tasks query resolves, so a Gantt import is reflected
  // on the dashboard the moment the user navigates here.
  const isCoreLoading = categoriesLoading || quotationsLoading || (isDesignerOrAdmin && vendorsLoading);

  if (isCoreLoading) {
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

  // Use the full projects list (from /api/projects) for the dashboard — this includes
  // projects that have a Gantt schedule but no quotations yet.
  const allProjects = projectsData || quotationsData?.projects || [];

  const filteredProjects = selectedProjectId
    ? allProjects.filter(p => p.id === selectedProjectId)
    : allProjects;

  const filteredQuotations = selectedProjectId
    ? allQuotations.filter(q => {
        const project = allProjects.find(p => p.projectName === q.projectName);
        return project?.id === selectedProjectId;
      })
    : allQuotations;

  const filteredRecentQuotations = selectedProjectId
    ? recentQuotations.filter(q => {
        const project = allProjects.find(p => p.projectName === q.projectName);
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

  // Build a project name lookup from all available sources so that tasks from projects
  // with no quotations (schedule-only) still get a proper project name on the dashboard.
  const projectNameMap = allProjects.reduce((acc, p) => {
    acc[p.id] = p.projectName;
    return acc;
  }, {} as Record<string, string>);

  const getTaskAlerts = () => {
    if (!allTasksData) return { upcomingStart: [], completionCountdown: [], overdue: [] };
    
    const now = new Date();
    const today = startOfDay(now);
    const upcomingStart: Array<Task & { projectName: string, daysUntilStart: number }> = [];
    const completionCountdown: Array<Task & { projectName: string, daysToGo: number }> = [];
    const overdue: Array<Task & { projectName: string, daysOverdue: number }> = [];

    const tasksToProcess = selectedProjectId
      ? allTasksData.filter(t => t.projectId === selectedProjectId)
      : allTasksData;
    
    tasksToProcess.forEach(task => {
      if (task.status === 'completed') return;
      const progress = Number(task.progressPercentage) || 0;
      if (progress >= 100) return;
      
      const taskName = task.name?.toUpperCase() || '';
      if (taskName.includes('PHASE') || taskName.includes('PACKAGE') || taskName.includes('EXECUTE')) return;
      if (task.startDate === '2099-12-31' || task.endDate === '2099-12-31') return;
      
      const projectName = task.projectId ? (projectNameMap[task.projectId] || 'Unknown Project') : 'Unknown Project';
      
      if (task.startDate) {
        const startDate = startOfDay(new Date(task.startDate));
        const daysUntilStart = differenceInDays(startDate, today);
        if (daysUntilStart >= 0 && daysUntilStart <= 90) {
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
          if (daysToGo >= 1 && daysToGo <= 14) {
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

  const isActionableTask = (task: Task) => {
    if (task.startDate === '2099-12-31' || task.endDate === '2099-12-31') return false;
    const taskName = task.name?.toUpperCase() || '';
    if (taskName.includes('PHASE') || taskName.includes('PACKAGE') || taskName.includes('EXECUTE')) return false;
    return true;
  };

  const isTaskCompleted = (task: Task) => {
    if (task.status === 'completed') return true;
    const progress = Number(task.progressPercentage) || 0;
    return progress >= 100;
  };

  const totalActiveTasks = allTasksData
    ? allTasksData.filter(t => isActionableTask(t) && !isTaskCompleted(t)).length
    : 0;

  const overdueCountByProject = taskAlerts.overdue.reduce((acc, task) => {
    if (task.projectId) {
      acc[task.projectId] = (acc[task.projectId] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const projectTaskBreakdown = (() => {
    if (!allTasksData) return [];
    const map: Record<string, { projectId: string; projectName: string; total: number; completed: number }> = {};
    allTasksData.forEach(task => {
      if (!task.projectId) return;
      if (!isActionableTask(task)) return;
      const pName = projectNameMap[task.projectId] || 'Unknown Project';
      if (!map[task.projectId]) {
        map[task.projectId] = { projectId: task.projectId, projectName: pName, total: 0, completed: 0 };
      }
      map[task.projectId].total += 1;
      if (isTaskCompleted(task)) {
        map[task.projectId].completed += 1;
      }
    });
    return Object.values(map)
      .map(entry => ({
        ...entry,
        remaining: entry.total - entry.completed,
        overdueCount: overdueCountByProject[entry.projectId] || 0,
      }))
      .filter(entry => entry.remaining > 0);
  })();

  const overdueTaskIds = new Set(taskAlerts.overdue.map(t => t.id));
  const remainingTasksByProject: Record<string, Array<Task & { projectName: string }>> = {};
  (allTasksData || []).forEach(task => {
    if (!task.projectId || !isActionableTask(task) || isTaskCompleted(task)) return;
    if (overdueTaskIds.has(task.id)) return;
    if (!remainingTasksByProject[task.projectId]) remainingTasksByProject[task.projectId] = [];
    const pName = projectNameMap[task.projectId] || 'Unknown Project';
    remainingTasksByProject[task.projectId].push({ ...task, projectName: pName });
  });

  const unreadTotal = unreadChat?.total ?? 0;
  const showChatAlert = unreadTotal > 0 && !dismissedChat;

  return (
    <div>
      {showChatAlert && (
        <div className="mx-6 mt-4 flex items-center gap-3 rounded-md border border-primary/20 bg-primary/5 px-4 py-3">
          <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground">
              {unreadTotal === 1
                ? "1 new chat message"
                : `${unreadTotal} new chat messages`}
            </span>
            {unreadChat && unreadChat.byProject.length > 0 && (
              <span className="ml-1.5 text-sm text-muted-foreground">
                — {unreadChat.byProject.map(p => p.projectName).join(", ")}
              </span>
            )}
          </div>
          <button
            onClick={() => setLocation("/chat")}
            className="shrink-0 text-sm font-medium text-primary hover:underline focus:outline-none"
          >
            Open Chat
          </button>
          <button
            onClick={() => setDismissedChat(true)}
            className="shrink-0 text-muted-foreground hover:text-foreground focus:outline-none"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <Dashboard 
        vendors={filteredVendors}
        projects={filteredProjects}
        recentQuotations={filteredRecentQuotations}
        allQuotations={filteredQuotations}
        activities={activitiesData || []}
        taskAlerts={taskAlerts}
        totalActiveTasks={totalActiveTasks}
        tasksLoading={tasksLoading}
        projectTaskBreakdown={projectTaskBreakdown}
        remainingTasksByProject={remainingTasksByProject}
        vendorAlerts={vendorAlertsData || []}
        rfqAlerts={rfqAlertsData || []}
        onNavigate={handleNavigate}
        isRefreshingActivities={activitiesLoading}
        onRefreshActivities={() => refetchActivities()}
      />
    </div>
  );
}
