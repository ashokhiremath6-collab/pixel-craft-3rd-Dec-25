import { useState, useMemo, Fragment, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, Plus, Upload, Edit, Trash2, ChevronDown, ChevronRight, Download, FileText, ExternalLink, Activity, TrendingUp, Search, Eye, EyeOff, AlertTriangle, CheckCircle2, Clock, XCircle, Filter, Palette, ArrowUpDown, MessageSquare, History, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema } from "@shared/schema";
import type { Project, Task, ProjectSchedule } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { RecentBadge } from "@/components/RecentBadge";

interface QuotationsResponse {
  projects: Project[];
  quotations: Record<string, any[]>;
}

const taskFormSchema = insertTaskSchema.extend({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  progressPercentage: z.coerce.number().min(0).max(100).default(0),
});

interface CriticalPathTask {
  task: Task;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  totalFloat: number;
  isCritical: boolean;
}

interface CriticalPathResult {
  tasks: CriticalPathTask[];
  criticalPath: string[];
  projectDuration: number;
  criticalPathDuration: number;
}

// Helper function to compute progress state
// Returns "Completed" if progressPercentage >= 100, otherwise "Incomplete"
// Tasks must be explicitly marked as completed by clicking the badge
const getProgressState = (task: Task): 'Completed' | 'Incomplete' => {
  const progress = Number(task.progressPercentage || 0);
  return progress >= 100 ? 'Completed' : 'Incomplete';
};

export default function GanttChartPage() {
  const { toast } = useToast();

  const { data: currentUser } = useQuery<{ role: string }>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });
  const isAdmin = currentUser?.role === 'admin';
  const canEditRemarks = currentUser?.role === 'admin' || currentUser?.role === 'designer' || currentUser?.role === 'project_manager';
  const canEditProgress = currentUser?.role === 'admin' || currentUser?.role === 'designer' || currentUser?.role === 'project_manager';
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const selectedProjectId = new URLSearchParams(search).get("projectId") || "";
  const setSelectedProjectId = (value: string) => {
    const params = new URLSearchParams(search);
    if (value) {
      params.set("projectId", value);
    } else {
      params.delete("projectId");
    }
    const qs = params.toString();
    setLocation(qs ? `${location}?${qs}` : location);
  };
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importProjectId, setImportProjectId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedCriticalPath, setExpandedCriticalPath] = useState<Set<string>>(new Set());
  const [isGanttLinkOpen, setIsGanttLinkOpen] = useState(false);
  const [ganttLinkInput, setGanttLinkInput] = useState<string>("");
  const [isEditingGanttLink, setIsEditingGanttLink] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingLinkProjectId, setEditingLinkProjectId] = useState<string | null>(null);
  
  // Task table filters and settings
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [showOverdueOnly, setShowOverdueOnly] = useState(() => {
    const key = `gantt_overdue_filter_${new URLSearchParams(window.location.search).get('projectId') || ''}`;
    return localStorage.getItem(key) === 'true';
  });
  const [taskSortMode, setTaskSortMode] = useState<'original' | 'date' | 'category'>('original');
  
  // Inline editing for progress
  const [editingProgressTaskId, setEditingProgressTaskId] = useState<string | null>(null);
  const [editingProgressValue, setEditingProgressValue] = useState<string>("");
  
  // Inline editing for dates
  const [editingEndDateTaskId, setEditingEndDateTaskId] = useState<string | null>(null);
  const [editingStartDateTaskId, setEditingStartDateTaskId] = useState<string | null>(null);

  // Remarks popover
  const [remarksOpenTaskId, setRemarksOpenTaskId] = useState<string | null>(null);
  const [remarksValue, setRemarksValue] = useState<string>("");

  // Subcategory inline editing
  const [editingSubcategoryTaskId, setEditingSubcategoryTaskId] = useState<string | null>(null);
  const [subcategoryDraft, setSubcategoryDraft] = useState<string>("");

  // Expanded subcategory groups: key = "phaseKey|||subcategoryName"
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());

  // Deadline extension dialog
  const [extendDeadlineTask, setExtendDeadlineTask] = useState<Task | null>(null);
  const [extendDeadlineNewDate, setExtendDeadlineNewDate] = useState<string>("");
  const [extendDeadlineReason, setExtendDeadlineReason] = useState<string>("");

  // Deadline history popover
  const [deadlineHistoryTaskId, setDeadlineHistoryTaskId] = useState<string | null>(null);
  
  // Excel sync indicator: counts task edits made since last download
  const [pendingExcelChanges, setPendingExcelChanges] = useState(0);
  useEffect(() => { setPendingExcelChanges(0); }, [selectedProjectId]);

  // Persist overdue filter per project in localStorage
  useEffect(() => {
    const key = `gantt_overdue_filter_${selectedProjectId}`;
    localStorage.setItem(key, showOverdueOnly ? 'true' : 'false');
  }, [showOverdueOnly, selectedProjectId]);

  // Restore overdue filter when project changes
  useEffect(() => {
    const key = `gantt_overdue_filter_${selectedProjectId}`;
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      setShowOverdueOnly(saved === 'true');
    } else {
      setShowOverdueOnly(false);
    }
  }, [selectedProjectId]);

  // Reset expanded phases when project changes so auto-expand fires fresh
  useEffect(() => {
    setExpandedPhases(new Set());
  }, [selectedProjectId]);

  const downloadLatestExcel = async () => {
    if (!selectedProjectId) return;
    try {
      const response = await fetch(`/api/schedules/export/${selectedProjectId}`, { credentials: "include" });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = response.headers.get('Content-Disposition');
      const match = cd?.match(/filename="(.+)"/);
      a.download = match ? match[1] : 'Project_Schedule.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setPendingExcelChanges(0);
    } catch {
      toast({ title: "Export Failed", description: "Could not download schedule", variant: "destructive" });
    }
  };

  // Re-import Designer Export
  const [reimportScheduleId, setReimportScheduleId] = useState<string | null>(null);
  const reimportInputRef = useRef<HTMLInputElement>(null);
  const [visibleColumns, setVisibleColumns] = useState({
    subcategory: true,
    startDate: true,
    endDate: true,
    assigned: false,
    progress: true,
    remarks: true,
  });
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  const { data: quotationsData, isLoading: isLoadingProjects } = useQuery<QuotationsResponse>({
    queryKey: ['/api/quotations'],
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery<Task[]>({
    queryKey: ['/api/tasks/project', selectedProjectId],
    enabled: !!selectedProjectId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Auto-expand all phase groups when tasks first load for a project.
  // Must be declared AFTER `tasks` to avoid a Temporal Dead Zone crash.
  useEffect(() => {
    if (tasks.length === 0) return;
    if (selectedProjectId && !tasks.some(t => t.projectId === selectedProjectId)) return;
    setExpandedPhases(prev => {
      if (prev.size > 0) return prev;
      // Must mirror isPhaseHeader() exactly — uses .includes(), not .startsWith()
      const isPhase = (name: string | null | undefined) => {
        if (!name) return false;
        const upper = name.toUpperCase();
        return upper.includes('PHASE') || upper.includes('PACKAGE') || upper.includes('EXECUTE');
      };
      const phases = new Set<string>();
      tasks.forEach(task => {
        if (isPhase(task.name)) phases.add(task.name || '');
      });
      return phases;
    });
  }, [tasks, selectedProjectId]);

  const { data: schedules = [] } = useQuery<ProjectSchedule[]>({
    queryKey: ['/api/schedules/project', selectedProjectId],
    enabled: !!selectedProjectId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const form = useForm<z.infer<typeof taskFormSchema>>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      projectId: selectedProjectId,
      name: "",
      description: "",
      subcategory: "",
      startDate: "",
      endDate: "",
      status: "not_started",
      progressPercentage: 0,
      approvalRequired: false,
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: z.infer<typeof taskFormSchema>) => {
      return await apiRequest('POST', '/api/tasks', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/project', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({ title: "Success", description: "Task created successfully" });
      setIsAddTaskOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create task",
        variant: "destructive" 
      });
    },
  });

  const importScheduleMutation = useMutation({
    mutationFn: async ({ file, projectId }: { file: File; projectId: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId);
      formData.append('version', '1.0');

      const response = await fetch('/api/schedules/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/project', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/schedules/project', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      const parts = [`Successfully imported ${data.tasksCreated} tasks`];
      if (data.skippedEmpty > 0) parts.push(`${data.skippedEmpty} empty rows skipped`);
      if (data.tasksFailed > 0) parts.push(`${data.tasksFailed} rows failed`);
      if (data.totalRows) parts.push(`(${data.totalRows} total rows in file)`);
      toast({ 
        title: "Schedule Imported", 
        description: parts.join('. '),
        variant: data.tasksFailed > 0 ? "destructive" : "default",
      });
      setIsImportOpen(false);
      setSelectedFile(null);
      setImportProjectId("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Import Failed", 
        description: error.message || "Failed to import schedule",
        variant: "destructive" 
      });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest('DELETE', `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/project', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({ title: "Success", description: "Task deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete task",
        variant: "destructive" 
      });
    },
  });
  
  // Update task progress mutation — accessible to admin, designer, project_manager
  const updateProgressMutation = useMutation({
    mutationFn: async ({ taskId, progressPercentage }: { taskId: string; progressPercentage: number }) => {
      return await apiRequest('PATCH', `/api/tasks/${taskId}/progress`, { progressPercentage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/project', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setEditingProgressTaskId(null);
      setPendingExcelChanges(prev => prev + 1);
      toast({ title: "Success", description: "Progress updated" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update progress",
        variant: "destructive" 
      });
    },
  });

  // Update task end date mutation
  const updateEndDateMutation = useMutation({
    mutationFn: async ({ taskId, endDate }: { taskId: string; endDate: string }) => {
      return await apiRequest('PUT', `/api/tasks/${taskId}`, { endDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/project', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setEditingEndDateTaskId(null);
      setPendingExcelChanges(prev => prev + 1);
      toast({ title: "Success", description: "End date updated" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update end date",
        variant: "destructive" 
      });
    },
  });

  // Update task start date mutation
  const updateStartDateMutation = useMutation({
    mutationFn: async ({ taskId, startDate }: { taskId: string; startDate: string }) => {
      return await apiRequest('PUT', `/api/tasks/${taskId}`, { startDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/project', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setEditingStartDateTaskId(null);
      setPendingExcelChanges(prev => prev + 1);
      toast({ title: "Success", description: "Start date updated" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update start date",
        variant: "destructive" 
      });
    },
  });

  // Extend deadline mutation (admin only) — records missed deadline history
  const extendDeadlineMutation = useMutation({
    mutationFn: async ({ taskId, newEndDate, reason }: { taskId: string; newEndDate: string; reason: string }) => {
      return await apiRequest('PATCH', `/api/tasks/${taskId}/extend-deadline`, { newEndDate, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/project', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      setExtendDeadlineTask(null);
      setExtendDeadlineNewDate('');
      setExtendDeadlineReason('');
      setPendingExcelChanges(prev => prev + 1);
      toast({ title: "Deadline Extended", description: "The new deadline has been saved and the extension has been recorded." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to extend deadline", variant: "destructive" });
    },
  });

  // Update task subcategory mutation (admin + designer)
  const updateSubcategoryMutation = useMutation({
    mutationFn: async ({ taskId, subcategory }: { taskId: string; subcategory: string }) => {
      return await apiRequest('PATCH', `/api/tasks/${taskId}/subcategory`, { subcategory });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/project', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setEditingSubcategoryTaskId(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update subcategory", variant: "destructive" });
    },
  });

  // Update task remarks mutation (available to all authenticated users)
  const updateRemarksMutation = useMutation({
    mutationFn: async ({ taskId, remarks }: { taskId: string; remarks: string }) => {
      return await apiRequest('PATCH', `/api/tasks/${taskId}/remarks`, { remarks });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/project', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setRemarksOpenTaskId(null);
      setPendingExcelChanges(prev => prev + 1);
      toast({ title: "Remarks saved" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save remarks", variant: "destructive" });
    },
  });

  // Bulk-complete overdue tasks
  const bulkCompleteMutation = useMutation({
    mutationFn: async (taskIds: string[]) => {
      return await apiRequest('PATCH', '/api/tasks/bulk-complete', { taskIds });
    },
    onSuccess: (_, taskIds) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/project', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setPendingExcelChanges(prev => prev + taskIds.length);
      toast({ title: `${taskIds.length} task${taskIds.length !== 1 ? 's' : ''} marked as completed` });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to complete tasks", variant: "destructive" });
    },
  });

  // Re-import Designer Export mutation
  const reimportMutation = useMutation({
    mutationFn: async ({ scheduleId, file }: { scheduleId: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/schedules/${scheduleId}/designer-reimport`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to re-import');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/project', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/schedules/project', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      setReimportScheduleId(null);
      toast({ 
        title: "Success", 
        description: `${data.message}${data.failed > 0 ? ` (${data.failed} failed)` : ''}` 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Re-import Failed", 
        description: error.message || "Failed to re-import schedule",
        variant: "destructive" 
      });
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      const response = await fetch(`/api/schedules/${scheduleId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete schedule');
      return response.json();
    },
    onSuccess: (_, scheduleId) => {
      if (selectedProjectId) {
        queryClient.invalidateQueries({ queryKey: ['/api/schedules/project', selectedProjectId] });
        queryClient.invalidateQueries({ queryKey: ['/api/tasks/project', selectedProjectId] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      toast({ title: "Schedule Deleted", description: "Schedule and associated tasks have been removed" });
    },
    onError: (error: any) => {
      toast({ title: "Delete Failed", description: error.message || "Could not delete schedule", variant: "destructive" });
    }
  });

  const updateGanttLinkMutation = useMutation({
    mutationFn: async (data: { id: string; ganttChartLink: string }) => {
      return apiRequest('PUT', `/api/projects/${data.id}`, { ganttChartLink: data.ganttChartLink });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
      toast({ title: "Success", description: "Gantt chart link updated successfully" });
      setIsGanttLinkOpen(false);
      setGanttLinkInput("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update Gantt chart link",
        variant: "destructive" 
      });
    },
  });

  const projects = quotationsData?.projects || [];
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  if (isLoadingProjects) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading projects...</div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold" data-testid="heading-gantt-chart">
            Task Management & Timeline
          </h1>
          <p className="text-muted-foreground">
            Manage tasks and visualize project timelines
          </p>
        </div>
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No projects found. Create a project to start managing tasks.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Helper to parse dates consistently
  const parseLocalDate = (dateStr: string | Date | null) => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date(dateStr);
  };

  // Calculate date range for the chart.
  // Exclude the placeholder "2099-12-31" sentinel used for phase headers without dates —
  // including it would create a ~70-year chart span, freezing the browser.
  const PLACEHOLDER_DATE = '2099-12-31';
  const isPlaceholder = (d: string | null | undefined) => d === PLACEHOLDER_DATE;

  const allDates = projects.flatMap(p => [
    isPlaceholder(p.startDate) ? null : parseLocalDate(p.startDate),
    isPlaceholder(p.endDate)   ? null : parseLocalDate(p.endDate),
  ].filter(Boolean) as Date[]);

  // Include task dates if a project is selected
  if (selectedProjectId && tasks.length > 0) {
    tasks.forEach(task => {
      if (!isPlaceholder(task.startDate)) {
        const start = parseLocalDate(task.startDate);
        if (start) allDates.push(start);
      }
      if (!isPlaceholder(task.endDate)) {
        const end = parseLocalDate(task.endDate);
        if (end) allDates.push(end);
      }
    });
  }

  const minDate = allDates.length > 0 
    ? new Date(Math.min(...allDates.map(d => d.getTime())))
    : new Date();
  
  const maxDate = allDates.length > 0
    ? new Date(Math.max(...allDates.map(d => d.getTime())))
    : new Date();

  // Add padding to date range
  const paddedMinDate = new Date(minDate);
  paddedMinDate.setMonth(paddedMinDate.getMonth() - 1);
  
  const paddedMaxDate = new Date(maxDate);
  paddedMaxDate.setMonth(paddedMaxDate.getMonth() + 1);

  const today = new Date();
  const todayPosition = ((today.getTime() - paddedMinDate.getTime()) / (paddedMaxDate.getTime() - paddedMinDate.getTime())) * 100;
  const showTodayLine = today >= minDate && today <= maxDate;

  // Generate month markers - filter to prevent overlap
  const monthMarkers: { label: string; position: number }[] = [];
  const currentMarker = new Date(paddedMinDate.getFullYear(), paddedMinDate.getMonth(), 1);

  while (currentMarker <= paddedMaxDate && monthMarkers.length < 500) {
    const position = ((currentMarker.getTime() - paddedMinDate.getTime()) / (paddedMaxDate.getTime() - paddedMinDate.getTime())) * 100;
    
    // Only add if no marker within 8% to prevent overlap
    const tooClose = monthMarkers.some(m => Math.abs(m.position - position) < 8);
    if (!tooClose) {
      monthMarkers.push({
        label: currentMarker.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        position
      });
    }
    currentMarker.setMonth(currentMarker.getMonth() + 1);
  }

  const getBar = (startDate: string | Date | null, endDate: string | Date | null) => {
    // Parse dates without timezone issues by treating as local dates
    const parseDate = (dateStr: string | Date | null) => {
      if (!dateStr) return null;
      if (dateStr instanceof Date) return dateStr;
      // Parse YYYY-MM-DD format as local date
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
      return new Date(dateStr);
    };
    
    const start = parseDate(startDate) || paddedMinDate;
    const end = parseDate(endDate) || paddedMaxDate;
    
    const startPosition = ((start.getTime() - paddedMinDate.getTime()) / (paddedMaxDate.getTime() - paddedMinDate.getTime())) * 100;
    const endPosition = ((end.getTime() - paddedMinDate.getTime()) / (paddedMaxDate.getTime() - paddedMinDate.getTime())) * 100;
    const width = endPosition - startPosition;

    return {
      left: `${startPosition}%`,
      width: `${Math.max(width, 1)}%`,
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'hsl(var(--success))';
      case 'in_progress': return 'hsl(var(--primary))';
      case 'blocked': return 'hsl(var(--destructive))';
      case 'overdue': return 'hsl(var(--warning))';
      default: return 'hsl(var(--muted-foreground))';
    }
  };

  const toggleProjectExpansion = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const handleSubmit = (data: z.infer<typeof taskFormSchema>) => {
    createTaskMutation.mutate({ ...data, projectId: selectedProjectId });
  };

  const handleImport = () => {
    if (selectedFile && importProjectId) {
      importScheduleMutation.mutate({ file: selectedFile, projectId: importProjectId });
    }
  };

  const handleDownloadTemplate = async (type: 'gantt' | 'dependencies') => {
    try {
      const response = await fetch(`/api/templates/${type}`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'gantt' ? 'Interior_Gantt_Template.xlsx' : 'Dependencies_Template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "Template Downloaded", description: `${type === 'gantt' ? 'Gantt' : 'Dependencies'} template ready for use` });
    } catch (error) {
      toast({ title: "Download Failed", description: "Could not download template", variant: "destructive" });
    }
  };

  const handleExportSchedule = async () => {
    if (!selectedProjectId) {
      toast({ title: "No Project Selected", description: "Please select a project first", variant: "destructive" });
      return;
    }

    try {
      const response = await fetch(`/api/schedules/export/${selectedProjectId}`, { credentials: "include" });
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from response header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      a.download = filenameMatch ? filenameMatch[1] : 'Project_Schedule.xlsx';
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "Schedule Exported", description: `Schedule downloaded with ${tasks.length} tasks` });
    } catch (error) {
      toast({ title: "Export Failed", description: "Could not export schedule", variant: "destructive" });
    }
  };

  // When form opens, update projectId
  const handleAddTaskOpen = (open: boolean) => {
    if (open && selectedProjectId) {
      form.setValue('projectId', selectedProjectId);
    }
    setIsAddTaskOpen(open);
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input for re-import */}
      <input
        type="file"
        ref={reimportInputRef}
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && reimportScheduleId) {
            reimportMutation.mutate({ scheduleId: reimportScheduleId, file });
          }
          e.target.value = ''; // Reset input
        }}
        data-testid="input-reimport-file"
      />
      
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold" data-testid="heading-gantt-chart">
            Project scheduling
          </h1>
          <p className="text-muted-foreground">
            Manage tasks and visualize project timelines
          </p>
        </div>
      </div>

      {/* Project Selector and Actions */}
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-full sm:w-[300px]" data-testid="select-project">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProject && (
                <div className="text-sm text-muted-foreground">
                  {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            {selectedProjectId && (
              <div className="flex items-center gap-2 flex-wrap">
                <Dialog open={isGanttLinkOpen} onOpenChange={(open) => {
                  setIsGanttLinkOpen(open);
                  if (open && selectedProject) {
                    setGanttLinkInput(selectedProject.ganttChartLink || "");
                    setIsEditingGanttLink(false);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" data-testid="button-gantt-link">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {selectedProject?.ganttChartLink ? "View Gantt Chart" : "Add Link"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    {selectedProject?.ganttChartLink && !isEditingGanttLink ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 hover-elevate rounded-md">
                          <ExternalLink className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <a 
                            href={selectedProject.ganttChartLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-base text-primary hover:underline break-all"
                            data-testid="link-current-gantt"
                          >
                            {selectedProject.ganttChartLink}
                          </a>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setGanttLinkInput(selectedProject.ganttChartLink || "");
                            setIsEditingGanttLink(true);
                          }}
                          className="w-full"
                          data-testid="button-edit-gantt-link"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Link
                        </Button>
                      </div>
                    ) : (
                      <>
                        <DialogHeader>
                          <DialogTitle>Gantt Chart Link</DialogTitle>
                          <DialogDescription>
                            {selectedProject?.ganttChartLink ? "Update the external Gantt chart link" : "Add an external Gantt chart link"}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Input
                            value={ganttLinkInput}
                            onChange={(e) => setGanttLinkInput(e.target.value)}
                            placeholder="https://docs.google.com/spreadsheets/..."
                            data-testid="input-gantt-link"
                          />
                          <div className="flex gap-2">
                            {selectedProject?.ganttChartLink && (
                              <Button
                                variant="outline"
                                onClick={() => setIsEditingGanttLink(false)}
                                data-testid="button-cancel-edit"
                              >
                                Cancel
                              </Button>
                            )}
                            <Button
                              onClick={() => {
                                if (selectedProjectId) {
                                  updateGanttLinkMutation.mutate({ 
                                    id: selectedProjectId, 
                                    ganttChartLink: ganttLinkInput.trim() 
                                  });
                                  setIsEditingGanttLink(false);
                                }
                              }}
                              disabled={!ganttLinkInput.trim() || updateGanttLinkMutation.isPending}
                              className="flex-1"
                              data-testid="button-save-gantt-link"
                            >
                              {updateGanttLinkMutation.isPending ? "Saving..." : "Save Link"}
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </DialogContent>
                </Dialog>
                <Dialog open={isImportOpen} onOpenChange={(open) => {
                  setIsImportOpen(open);
                  if (!open) {
                    setSelectedFile(null);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" data-testid="button-import-schedule-header">
                      <Upload className="h-4 w-4 mr-2" />
                      Import Schedule
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Import Schedule for {selectedProject?.projectName}</DialogTitle>
                      <DialogDescription>
                        Upload a filled Gantt chart (XLSX or CSV) with your project tasks
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        data-testid="input-import-file-header"
                      />
                      <Button
                        onClick={() => {
                          if (selectedFile && selectedProjectId) {
                            importScheduleMutation.mutate({ file: selectedFile, projectId: selectedProjectId });
                          }
                        }}
                        disabled={!selectedFile || importScheduleMutation.isPending}
                        className="w-full"
                        data-testid="button-confirm-import-header"
                      >
                        {importScheduleMutation.isPending ? "Importing..." : "Import Schedule"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={isAddTaskOpen} onOpenChange={handleAddTaskOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-task">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Task</DialogTitle>
                      <DialogDescription>
                        Add a new task to {selectedProject?.projectName}
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Task Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Enter task name" data-testid="input-task-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea {...field} value={field.value || ""} placeholder="Enter description" data-testid="input-task-description" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="subcategory"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Subcategory <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="e.g. Plumbing, Electrical, Finishing..." data-testid="input-task-subcategory" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="startDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Start Date</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} data-testid="input-start-date" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="endDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>End Date</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} data-testid="input-end-date" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-status">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="not_started">Not Started</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="blocked">Blocked</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setIsAddTaskOpen(false)} data-testid="button-cancel-task">
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createTaskMutation.isPending} data-testid="button-submit-task">
                            {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Schedule Files */}
      {selectedProjectId && schedules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Uploaded Schedules</span>
              <Badge variant="secondary">{schedules.length} file{schedules.length !== 1 ? 's' : ''}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {schedules.map((schedule) => {
                const isExpanded = expandedCriticalPath.has(schedule.id);
                
                return (
                  <Card key={schedule.id} className="hover-elevate" data-testid={`schedule-card-${schedule.id}`}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <FileText className="h-8 w-8 text-primary" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-medium truncate" data-testid={`text-schedule-name-${schedule.id}`}>
                                  {schedule.fileName}
                                </div>
                                <RecentBadge date={schedule.uploadedAt} />
                              </div>
                              <div className="text-sm text-muted-foreground">v{schedule.version}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {schedule.fileSize ? `${(Number(schedule.fileSize) / 1024).toFixed(2)} KB` : ''} • 
                                {new Date(schedule.uploadedAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={schedule.status === 'active' ? 'default' : 'secondary'} data-testid={`badge-schedule-status-${schedule.id}`}>
                              {schedule.status}
                            </Badge>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = `/api/schedules/${schedule.id}/download-original`;
                                link.style.display = 'none';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              title="Download original uploaded file"
                              data-testid={`button-view-schedule-${schedule.id}`}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Original
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = `/api/schedules/${schedule.id}/designer-export`;
                                link.style.display = 'none';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              title="Open Designer-Formatted Excel (editable)"
                              data-testid={`button-designer-export-${schedule.id}`}
                            >
                              <Palette className="h-4 w-4 mr-1" />
                              Designer
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setReimportScheduleId(schedule.id);
                                reimportInputRef.current?.click();
                              }}
                              disabled={reimportMutation.isPending}
                              title="Re-import edited Designer Export to update tasks"
                              data-testid={`button-reimport-${schedule.id}`}
                            >
                              <Upload className="h-4 w-4 mr-1" />
                              {reimportMutation.isPending && reimportScheduleId === schedule.id ? 'Updating...' : 'Re-import'}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Delete schedule "${schedule.fileName}"? This will remove all associated tasks.`)) {
                                  deleteScheduleMutation.mutate(schedule.id);
                                }
                              }}
                              disabled={deleteScheduleMutation.isPending}
                              data-testid={`button-delete-schedule-${schedule.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Critical Path Analysis */}
                        <div className="border-t pt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const newSet = new Set(expandedCriticalPath);
                              if (isExpanded) {
                                newSet.delete(schedule.id);
                              } else {
                                newSet.add(schedule.id);
                              }
                              setExpandedCriticalPath(newSet);
                            }}
                            className="w-full"
                            data-testid={`button-critical-path-${schedule.id}`}
                          >
                            <Activity className="h-4 w-4 mr-2" />
                            {isExpanded ? 'Hide' : 'Show'} Critical Path Analysis
                            {isExpanded ? <ChevronDown className="h-4 w-4 ml-2" /> : <ChevronRight className="h-4 w-4 ml-2" />}
                          </Button>

                          {isExpanded && <CriticalPathDisplay scheduleId={schedule.id} />}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Task List Table - Designer View */}
      {selectedProjectId && tasks.length > 0 && (() => {
        // Helper functions for task table
        const isTaskOverdue = (task: Task) => {
          // Check both status field AND progressPercentage (which is what the UI shows)
          if (task.status === 'completed') return false;
          const progress = Number(task.progressPercentage || 0);
          if (progress >= 100) return false; // Task is completed based on progress percentage
          if (!task.endDate) return false;
          // Skip placeholder dates (2099-12-31) used for header rows without real dates
          if (task.endDate === '2099-12-31') return false;
          // Skip header rows (PHASE, PACKAGE, EXECUTE)
          const name = (task.name || '').toUpperCase();
          if (name.startsWith('PHASE') || name.startsWith('PACKAGE') || name.startsWith('EXECUTE')) return false;
          const endDate = parseLocalDate(task.endDate);
          return endDate && endDate < new Date();
        };

        const isPhaseHeader = (name: string | null | undefined) => {
          if (!name) return false;
          const upperName = name.toUpperCase();
          return upperName.includes('PHASE') || upperName.includes('PACKAGE') || upperName.includes('EXECUTE');
        };

        // Helper to extract category from task name (e.g., "Civil: RFQs Issued" -> "Civil")
        const extractCategory = (name: string): string => {
          if (!name) return 'Other';
          // Check for colon-separated category (e.g., "Civil: RFQs Issued")
          const colonMatch = name.match(/^([^:]+):/);
          if (colonMatch) return colonMatch[1].trim();
          // Check for common prefixes
          const upperName = name.toUpperCase();
          if (upperName.startsWith('PHASE') || upperName.startsWith('PACKAGE') || upperName.startsWith('EXECUTE')) {
            return 'Headers';
          }
          return 'General';
        };

        // Filter tasks
        const filteredTasks = tasks.filter(task => {
          // Search filter
          if (taskSearchQuery && !(task.name || '').toLowerCase().includes(taskSearchQuery.toLowerCase())) {
            return false;
          }
          // Overdue filter
          if (showOverdueOnly && !isTaskOverdue(task)) {
            return false;
          }
          return true;
        });

        // Sort tasks based on mode
        // Build an index map from the original API-returned order (backend already sorts correctly)
        const apiOrderIndex = new Map<string, number>();
        filteredTasks.forEach((t, i) => apiOrderIndex.set(t.id, i));

        const sortedTasks = [...filteredTasks].sort((a, b) => {
          if (taskSortMode === 'original') {
            // Primary: rowIndex (original Excel row position), nulls last
            const rowA = a.rowIndex !== null && a.rowIndex !== undefined ? a.rowIndex : Infinity;
            const rowB = b.rowIndex !== null && b.rowIndex !== undefined ? b.rowIndex : Infinity;
            if (rowA !== rowB) return rowA - rowB;
            // Secondary: createdAt (insertion time) — tasks in same batch may share rowIndex across imports
            const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            if (createdA !== createdB) return createdA - createdB;
            // Final tiebreaker: preserve the order the backend returned (schedule uploadedAt is already baked in)
            return (apiOrderIndex.get(a.id) ?? 0) - (apiOrderIndex.get(b.id) ?? 0);
          } else if (taskSortMode === 'category') {
            const catA = extractCategory(a.name || '');
            const catB = extractCategory(b.name || '');
            if (catA !== catB) return catA.localeCompare(catB);
            const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
            const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
            return dateA - dateB;
          } else {
            const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
            const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
            return dateA - dateB;
          }
        });

        // Group tasks by phase (or category when sorting by category)
        const groupedTasks: { phase: string; tasks: Task[] }[] = [];
        let currentPhase = 'General Tasks';
        let currentGroup: Task[] = [];

        sortedTasks.forEach(task => {
          const taskName = task.name || 'Untitled Task';
          if (isPhaseHeader(taskName)) {
            if (currentGroup.length > 0) {
              groupedTasks.push({ phase: currentPhase, tasks: currentGroup });
            }
            currentPhase = taskName;
            currentGroup = [task];
          } else {
            currentGroup.push(task);
          }
        });
        if (currentGroup.length > 0) {
          groupedTasks.push({ phase: currentPhase, tasks: currentGroup });
        }

        // Count stats
        const overdueTasks = tasks.filter(isTaskOverdue);
        const overdueCount = overdueTasks.length;
        const completedCount = tasks.filter(t => t.status === 'completed').length;
        const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;

        const togglePhase = (phase: string) => {
          const newExpanded = new Set(expandedPhases);
          if (newExpanded.has(phase)) {
            newExpanded.delete(phase);
          } else {
            newExpanded.add(phase);
          }
          setExpandedPhases(newExpanded);
        };

        const toggleColumn = (column: keyof typeof visibleColumns) => {
          setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
        };

        return (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">Task List</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        {filteredTasks.length} of {tasks.length}
                      </Badge>
                      {overdueCount > 0 && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {overdueCount} overdue
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Column Visibility Toggle */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Eye className="h-4 w-4" />
                        Columns
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48" align="end">
                      <div className="space-y-2">
                        <p className="text-sm font-medium mb-2">Show/Hide Columns</p>
                        {Object.entries(visibleColumns).map(([key, value]) => {
                          const labelMap: Record<string, string> = {
                            subcategory: 'Subcategory',
                            startDate: 'Start Date',
                            endDate: 'End Date',
                            assigned: 'Assigned',
                            progress: 'Status',
                          };
                          return (
                            <div key={key} className="flex items-center gap-2">
                              <Checkbox 
                                id={`col-${key}`}
                                checked={value}
                                onCheckedChange={() => toggleColumn(key as keyof typeof visibleColumns)}
                              />
                              <label htmlFor={`col-${key}`} className="text-sm cursor-pointer">
                                {labelMap[key] || key}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Summary Stats Bar */}
                <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm"><strong>{completedCount}</strong> completed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span className="text-sm"><strong>{inProgressCount}</strong> in progress</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-sm"><strong>{overdueCount}</strong> overdue</span>
                    {overdueCount > 0 && canEditProgress && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 border-red-300 text-red-700 dark:border-red-700 dark:text-red-400"
                        disabled={bulkCompleteMutation.isPending}
                        onClick={() => {
                          if (confirm(`Mark all ${overdueCount} overdue task${overdueCount !== 1 ? 's' : ''} as completed?`)) {
                            bulkCompleteMutation.mutate(overdueTasks.map(t => t.id));
                          }
                        }}
                        data-testid="button-bulk-complete-overdue"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Mark all done
                      </Button>
                    )}
                  </div>
                  <div className="flex-1" />
                  {pendingExcelChanges > 0 && selectedProjectId && (
                    <Button
                      size="sm"
                      variant="default"
                      className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                      onClick={downloadLatestExcel}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Updated Excel ({pendingExcelChanges} change{pendingExcelChanges !== 1 ? 's' : ''})
                    </Button>
                  )}
                  <div className="text-sm text-muted-foreground">
                    {Math.round((completedCount / tasks.length) * 100)}% complete
                  </div>
                </div>

                {/* Search and Filter Bar */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search tasks..."
                      value={taskSearchQuery}
                      onChange={(e) => setTaskSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-task-search"
                    />
                  </div>
                  <Button
                    variant={showOverdueOnly ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => setShowOverdueOnly(!showOverdueOnly)}
                    className="gap-2"
                    data-testid="button-overdue-filter"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    {showOverdueOnly ? "Showing Overdue" : "Show Overdue"}
                  </Button>
                  <Button
                    variant={taskSortMode !== 'original' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTaskSortMode(taskSortMode === 'original' ? 'date' : taskSortMode === 'date' ? 'category' : 'original')}
                    className="gap-2"
                    data-testid="button-sort-mode"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    {taskSortMode === 'original' ? "Original Order" : taskSortMode === 'date' ? "By Date" : "By Category"}
                  </Button>
                  {(taskSearchQuery || showOverdueOnly) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTaskSearchQuery("");
                        setShowOverdueOnly(false);
                      }}
                      data-testid="button-clear-filters"
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No tasks match your filters</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-3 px-3 font-medium">Task</th>
                        {visibleColumns.subcategory && <th className="text-left py-3 px-2 font-medium">Subcategory</th>}
                        {visibleColumns.startDate && <th className="text-left py-3 px-2 font-medium">Start</th>}
                        {visibleColumns.endDate && <th className="text-left py-3 px-2 font-medium">End</th>}
                        {visibleColumns.assigned && <th className="text-left py-3 px-2 font-medium">Assigned</th>}
                        {visibleColumns.progress && <th className="text-center py-3 px-2 font-medium" title="Click badges to toggle status">Status</th>}
                        {visibleColumns.remarks && <th className="text-left py-3 px-2 font-medium min-w-[200px]">Remarks</th>}
                        <th className="text-center py-3 px-2 font-medium w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedTasks.map((group, groupIndex) => (
                        <Fragment key={`group-${groupIndex}`}>
                          {/* Phase Header Row */}
                          {group.phase !== 'General Tasks' && isPhaseHeader(group.tasks[0]?.name || '') && (
                            <tr 
                              key={`phase-${groupIndex}`}
                              className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-b-2 border-blue-200 dark:border-blue-800 cursor-pointer"
                              onClick={() => togglePhase(group.phase)}
                            >
                              <td 
                                colSpan={Object.values(visibleColumns).filter(Boolean).length + 2} 
                                className="py-3 px-3"
                              >
                                <div className="flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-300">
                                  {expandedPhases.has(group.phase) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <span>{group.tasks[0]?.name}</span>
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {group.tasks.length - 1} tasks
                                  </Badge>
                                </div>
                              </td>
                            </tr>
                          )}
                          {/* Task Rows */}
                          {(group.phase === 'General Tasks' || expandedPhases.has(group.phase) || !isPhaseHeader(group.tasks[0]?.name || '')) && 
                            group.tasks
                              .filter((task, idx) => !(isPhaseHeader(task.name) && idx === 0 && group.phase !== 'General Tasks'))
                              .flatMap((task, index, arr) => {
                                const subcat = (task as any).subcategory || '';
                                const subcatKey = `${group.phase}|||${subcat}`;
                                const isFirstInSubcat = !!(subcat && arr.filter(t => ((t as any).subcategory || '') === subcat)[0]?.id === task.id);
                                const subcatIsCollapsed = !!(subcat && !expandedSubcategories.has(subcatKey));
                                const completedInSubcat = arr.filter(t => ((t as any).subcategory || '') === subcat && Number(t.progressPercentage || 0) >= 100).length;
                                const totalInSubcat = arr.filter(t => ((t as any).subcategory || '') === subcat).length;
                                const subcatPct = totalInSubcat > 0 ? Math.round((completedInSubcat / totalInSubcat) * 100) : 0;
                                const overdueInSubcat = arr.filter(t => ((t as any).subcategory || '') === subcat && isTaskOverdue(t)).length;
                                const colSpan = Object.values(visibleColumns).filter(Boolean).length + 2;

                                const subcatHeaderRow = (isFirstInSubcat && subcat) ? (
                                  <tr key={`subcat-header-${subcatKey}`}
                                      className="bg-violet-50/80 dark:bg-violet-950/30 border-b border-violet-100 dark:border-violet-900 cursor-pointer hover:bg-violet-100/60 dark:hover:bg-violet-900/40 transition-colors"
                                      onClick={() => {
                                        const s = new Set(expandedSubcategories);
                                        if (s.has(subcatKey)) s.delete(subcatKey); else s.add(subcatKey);
                                        setExpandedSubcategories(new Set(s));
                                      }}
                                  >
                                    <td colSpan={colSpan} className="py-2 pl-8 pr-4">
                                      <div className="flex items-center gap-3">
                                        {expandedSubcategories.has(subcatKey)
                                          ? <ChevronDown className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                                          : <ChevronRight className="h-3.5 w-3.5 text-violet-500 shrink-0" />}
                                        <span className="text-sm font-medium text-violet-700 dark:text-violet-300">{subcat}</span>
                                        <Badge variant="outline" className="text-xs border-violet-300 text-violet-600 dark:border-violet-700 dark:text-violet-400 shrink-0">
                                          {totalInSubcat} task{totalInSubcat !== 1 ? 's' : ''}
                                        </Badge>
                                        {overdueInSubcat > 0 && (
                                          <Badge variant="destructive" className="text-xs shrink-0">{overdueInSubcat} overdue</Badge>
                                        )}
                                        <div className="flex-1 flex items-center gap-2 max-w-[200px]">
                                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                            <div className="bg-violet-500 h-1.5 rounded-full transition-all" style={{ width: `${subcatPct}%` }} />
                                          </div>
                                          <span className="text-xs text-muted-foreground w-8 text-right shrink-0">{subcatPct}%</span>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                ) : null;

                                const overdue = isTaskOverdue(task);
                                const isPhase = isPhaseHeader(task.name);
                                
                                const taskRow = (
                                  <tr 
                                    key={task.id} 
                                    className={`border-b transition-colors ${
                                      overdue 
                                        ? 'bg-red-50/50 dark:bg-red-950/30 hover:bg-red-100/50 dark:hover:bg-red-900/30' 
                                        : isPhase
                                          ? 'bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50'
                                          : index % 2 === 0 
                                            ? 'bg-background hover:bg-muted/20' 
                                            : 'bg-muted/10 hover:bg-muted/30'
                                    }`}
                                    data-testid={`row-task-${task.id}`}
                                  >
                                    <td className="py-2.5 px-3">
                                      <div className="flex items-center gap-2">
                                        {overdue && <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                                        <div className={`truncate max-w-[350px] ${isPhase ? 'font-semibold text-slate-700 dark:text-slate-300' : ''}`} title={task.name}>
                                          {task.name}
                                        </div>
                                      </div>
                                    </td>
                                    {visibleColumns.subcategory && !isPhase && (
                                      <td className="py-2.5 px-2 min-w-[120px]">
                                        {editingSubcategoryTaskId === task.id ? (
                                          <input
                                            autoFocus
                                            className="border rounded px-2 py-0.5 text-xs w-full bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                            value={subcategoryDraft}
                                            onChange={(e) => setSubcategoryDraft(e.target.value)}
                                            onBlur={() => {
                                              updateSubcategoryMutation.mutate({ taskId: task.id, subcategory: subcategoryDraft });
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') updateSubcategoryMutation.mutate({ taskId: task.id, subcategory: subcategoryDraft });
                                              if (e.key === 'Escape') setEditingSubcategoryTaskId(null);
                                            }}
                                            list={`subcats-${group.phase.replace(/\s/g, '-')}`}
                                          />
                                        ) : canEditRemarks ? (
                                          <button
                                            className={`text-xs px-2 py-0.5 rounded border transition-colors hover:border-primary/50 ${(task as any).subcategory ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800' : 'border-dashed border-muted-foreground/30 text-muted-foreground/50 hover:text-muted-foreground'}`}
                                            onClick={() => { setEditingSubcategoryTaskId(task.id); setSubcategoryDraft((task as any).subcategory || ''); }}
                                            title="Click to set subcategory"
                                          >
                                            {(task as any).subcategory || '+ add'}
                                          </button>
                                        ) : (
                                          <span className={`text-xs px-2 py-0.5 rounded ${(task as any).subcategory ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300' : 'text-muted-foreground/40'}`}>
                                            {(task as any).subcategory || '—'}
                                          </span>
                                        )}
                                        {/* Datalist for autocomplete from existing subcategories in this phase */}
                                        <datalist id={`subcats-${group.phase.replace(/\s/g, '-')}`}>
                                          {Array.from(new Set(
                                            group.tasks
                                              .map(t => (t as any).subcategory)
                                              .filter(Boolean)
                                          )).map(s => <option key={s} value={s} />)}
                                        </datalist>
                                      </td>
                                    )}
                                    {visibleColumns.subcategory && isPhase && (
                                      <td className="py-2.5 px-2" />
                                    )}
                                    {visibleColumns.startDate && (
                                      <td className="py-2.5 px-2 text-muted-foreground whitespace-nowrap">
                                        {editingStartDateTaskId === task.id ? (
                                          <div className="flex items-center gap-1">
                                            <Input
                                              type="date"
                                              defaultValue={task.startDate && !isPlaceholder(task.startDate) ? task.startDate.split('T')[0] : ''}
                                              className="w-32 h-7 text-xs"
                                              autoFocus
                                              onChange={(e) => {
                                                if (e.target.value) {
                                                  updateStartDateMutation.mutate({ taskId: task.id, startDate: e.target.value });
                                                }
                                              }}
                                              onBlur={() => setEditingStartDateTaskId(null)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Escape') {
                                                  setEditingStartDateTaskId(null);
                                                }
                                              }}
                                              data-testid={`input-startdate-${task.id}`}
                                            />
                                          </div>
                                        ) : isAdmin ? (
                                          <button 
                                            className="flex items-center gap-1 hover:bg-muted/50 rounded px-1.5 py-0.5 transition-colors cursor-pointer group"
                                            onClick={() => setEditingStartDateTaskId(task.id)}
                                            title="Click to change start date"
                                            data-testid={`button-edit-startdate-${task.id}`}
                                          >
                                            <span>
                                              {task.startDate && !isPlaceholder(task.startDate) ? parseLocalDate(task.startDate)?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                                            </span>
                                            <CalendarIcon className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                          </button>
                                        ) : (
                                          <span className="px-1.5 py-0.5">
                                            {task.startDate && !isPlaceholder(task.startDate) ? parseLocalDate(task.startDate)?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                                          </span>
                                        )}
                                      </td>
                                    )}
                                    {visibleColumns.endDate && (
                                      <td className={`py-2.5 px-2 whitespace-nowrap ${overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'}`}>
                                        {editingEndDateTaskId === task.id ? (
                                          <div className="flex items-center gap-1">
                                            <Input
                                              type="date"
                                              defaultValue={task.endDate && !isPlaceholder(task.endDate) ? task.endDate.split('T')[0] : ''}
                                              className="w-32 h-7 text-xs"
                                              autoFocus
                                              onChange={(e) => {
                                                if (e.target.value) {
                                                  updateEndDateMutation.mutate({ taskId: task.id, endDate: e.target.value });
                                                }
                                              }}
                                              onBlur={() => setEditingEndDateTaskId(null)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Escape') {
                                                  setEditingEndDateTaskId(null);
                                                }
                                              }}
                                              data-testid={`input-enddate-${task.id}`}
                                            />
                                          </div>
                                        ) : isAdmin ? (
                                          <div className="flex items-center gap-1">
                                            <button 
                                              className="flex items-center gap-1 hover:bg-muted/50 rounded px-1.5 py-0.5 transition-colors cursor-pointer group"
                                              onClick={() => {
                                                if (overdue) {
                                                  // Overdue: open extension dialog with reason capture
                                                  setExtendDeadlineTask(task);
                                                  setExtendDeadlineNewDate(task.endDate ? task.endDate.split('T')[0] : '');
                                                  setExtendDeadlineReason('');
                                                } else {
                                                  setEditingEndDateTaskId(task.id);
                                                }
                                              }}
                                              title={overdue ? "This task is overdue — click to extend deadline" : "Click to change end date"}
                                              data-testid={`button-edit-enddate-${task.id}`}
                                            >
                                              <span>
                                                {task.endDate && !isPlaceholder(task.endDate) ? parseLocalDate(task.endDate)?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                                              </span>
                                              <CalendarIcon className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                            {/* Deadline history indicator */}
                                            {Array.isArray((task as any).deadlineHistory) && (task as any).deadlineHistory.length > 0 && (
                                              <Popover open={deadlineHistoryTaskId === task.id} onOpenChange={(open) => setDeadlineHistoryTaskId(open ? task.id : null)}>
                                                <PopoverTrigger asChild>
                                                  <button
                                                    className="ml-0.5 p-0.5 rounded hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                                                    title={`${(task as any).deadlineHistory.length} deadline extension(s) recorded`}
                                                  >
                                                    <History className="h-3 w-3 text-orange-500" />
                                                  </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-80 p-0" align="end">
                                                  <div className="p-3 border-b">
                                                    <p className="text-sm font-semibold flex items-center gap-2">
                                                      <History className="h-4 w-4 text-orange-500" />
                                                      Deadline Extension History
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.name}</p>
                                                  </div>
                                                  <div className="max-h-64 overflow-y-auto">
                                                    {((task as any).deadlineHistory as Array<{ previousDeadline: string; newDeadline: string; reason: string; extendedByName: string; extendedAt: string }>).map((entry, idx) => (
                                                      <div key={idx} className="p-3 border-b last:border-0 text-xs space-y-1">
                                                        <div className="flex items-center gap-2 text-muted-foreground">
                                                          <span className="font-medium text-foreground">{new Date(entry.extendedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                          <span>by {entry.extendedByName}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                          <span className="line-through text-red-500">{entry.previousDeadline}</span>
                                                          <span className="text-muted-foreground">→</span>
                                                          <span className="text-green-600 dark:text-green-400 font-medium">{entry.newDeadline}</span>
                                                        </div>
                                                        <p className="text-muted-foreground italic">"{entry.reason}"</p>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </PopoverContent>
                                              </Popover>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1 px-1.5 py-0.5">
                                            <span>
                                              {task.endDate && !isPlaceholder(task.endDate) ? parseLocalDate(task.endDate)?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                                            </span>
                                            {/* Show history icon for non-admins too */}
                                            {Array.isArray((task as any).deadlineHistory) && (task as any).deadlineHistory.length > 0 && (
                                              <Popover open={deadlineHistoryTaskId === task.id} onOpenChange={(open) => setDeadlineHistoryTaskId(open ? task.id : null)}>
                                                <PopoverTrigger asChild>
                                                  <button className="p-0.5 rounded hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors" title="Deadline history">
                                                    <History className="h-3 w-3 text-orange-500" />
                                                  </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-80 p-0" align="end">
                                                  <div className="p-3 border-b">
                                                    <p className="text-sm font-semibold flex items-center gap-2">
                                                      <History className="h-4 w-4 text-orange-500" />
                                                      Deadline Extension History
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.name}</p>
                                                  </div>
                                                  <div className="max-h-64 overflow-y-auto">
                                                    {((task as any).deadlineHistory as Array<{ previousDeadline: string; newDeadline: string; reason: string; extendedByName: string; extendedAt: string }>).map((entry, idx) => (
                                                      <div key={idx} className="p-3 border-b last:border-0 text-xs space-y-1">
                                                        <div className="flex items-center gap-2 text-muted-foreground">
                                                          <span className="font-medium text-foreground">{new Date(entry.extendedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                          <span>by {entry.extendedByName}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                          <span className="line-through text-red-500">{entry.previousDeadline}</span>
                                                          <span className="text-muted-foreground">→</span>
                                                          <span className="text-green-600 dark:text-green-400 font-medium">{entry.newDeadline}</span>
                                                        </div>
                                                        <p className="text-muted-foreground italic">"{entry.reason}"</p>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </PopoverContent>
                                              </Popover>
                                            )}
                                          </div>
                                        )}
                                      </td>
                                    )}
                                    {visibleColumns.assigned && (
                                      <td className="py-2.5 px-2 text-muted-foreground truncate max-w-[100px]">
                                        {task.assignedTo || '-'}
                                      </td>
                                    )}
                                    {visibleColumns.progress && (
                                      <td className="py-2.5 px-2 text-center">
                                        {editingProgressTaskId === task.id ? (
                                          <div className="flex items-center gap-1 justify-center" onClick={e => e.stopPropagation()}>
                                            <input
                                              type="tel"
                                              inputMode="numeric"
                                              pattern="[0-9]*"
                                              autoComplete="off"
                                              data-form-type="other"
                                              data-lpignore="true"
                                              data-1p-ignore="true"
                                              className="w-14 text-center text-sm border rounded px-1 py-0.5 bg-background"
                                              value={editingProgressValue}
                                              placeholder={String(Number(task.progressPercentage) || 0)}
                                              onChange={e => {
                                                const raw = e.target.value.replace(/[^0-9]/g, '');
                                                if (raw === '') { setEditingProgressValue(''); return; }
                                                const n = Math.min(100, Math.max(0, parseInt(raw, 10)));
                                                setEditingProgressValue(String(n));
                                              }}
                                              autoFocus
                                              onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                  const val = editingProgressValue === '' ? (Number(task.progressPercentage) || 0) : Math.min(100, Math.max(0, parseInt(editingProgressValue, 10) || 0));
                                                  updateProgressMutation.mutate({ taskId: task.id, progressPercentage: val });
                                                } else if (e.key === 'Escape') {
                                                  setEditingProgressTaskId(null);
                                                }
                                              }}
                                            />
                                            <span className="text-xs text-muted-foreground">%</span>
                                            <Button size="icon" variant="ghost" className="h-6 w-6"
                                              onClick={() => {
                                                const val = editingProgressValue === '' ? (Number(task.progressPercentage) || 0) : Math.min(100, Math.max(0, parseInt(editingProgressValue, 10) || 0));
                                                updateProgressMutation.mutate({ taskId: task.id, progressPercentage: val });
                                              }}>
                                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-6 w-6"
                                              onClick={() => setEditingProgressTaskId(null)}>
                                              <X className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        ) : (
                                          <div
                                            className={`flex flex-col items-center gap-1 ${canEditProgress ? 'cursor-pointer group' : ''}`}
                                            title={canEditProgress ? "Click to set % completion" : undefined}
                                            onClick={canEditProgress ? () => {
                                              setEditingProgressValue("");
                                              setEditingProgressTaskId(task.id);
                                            } : undefined}
                                            data-testid={`progress-display-${task.id}`}
                                          >
                                            {(() => {
                                              const pct = Number(task.progressPercentage) || 0;
                                              const color = pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : pct > 0 ? 'bg-amber-500' : 'bg-gray-200 dark:bg-gray-700';
                                              return (
                                                <>
                                                  <span className={`text-xs font-semibold ${pct >= 100 ? 'text-green-600 dark:text-green-400' : pct > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                    {pct}%
                                                  </span>
                                                  <div className="w-16 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                                    <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                                                  </div>
                                                </>
                                              );
                                            })()}
                                          </div>
                                        )}
                                      </td>
                                    )}
                                    {/* Inline Remarks column */}
                                    {visibleColumns.remarks && (
                                      <td
                                        className="py-1.5 px-2 align-top"
                                        onClick={e => e.stopPropagation()}
                                      >
                                        {remarksOpenTaskId === task.id ? (
                                          <div className="flex flex-col gap-1">
                                            <textarea
                                              autoFocus
                                              rows={4}
                                              className="w-full text-sm border rounded px-2 py-1 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring min-w-[200px]"
                                              value={remarksValue}
                                              onChange={e => setRemarksValue(e.target.value)}
                                              placeholder="Add notes, reason for delay, stage of completion..."
                                              onKeyDown={e => {
                                                if (e.key === 'Escape') setRemarksOpenTaskId(null);
                                                if (e.key === 'Enter' && e.ctrlKey) {
                                                  updateRemarksMutation.mutate({ taskId: task.id, remarks: remarksValue });
                                                }
                                              }}
                                            />
                                            <div className="flex gap-1 justify-end">
                                              <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setRemarksOpenTaskId(null)}>Cancel</Button>
                                              <Button size="sm" className="h-6 text-xs px-2"
                                                disabled={updateRemarksMutation.isPending}
                                                onClick={() => updateRemarksMutation.mutate({ taskId: task.id, remarks: remarksValue })}>
                                                Save
                                              </Button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div
                                            className={`text-sm whitespace-pre-wrap leading-snug ${canEditRemarks ? 'cursor-pointer rounded hover-elevate min-h-[28px] px-1 py-0.5' : ''} ${(task as any).remarks ? 'text-foreground' : 'text-muted-foreground/50'}`}
                                            title={canEditRemarks ? "Click to edit remarks" : undefined}
                                            onClick={canEditRemarks ? () => {
                                              setRemarksValue((task as any).remarks || "");
                                              setRemarksOpenTaskId(task.id);
                                            } : undefined}
                                          >
                                            {(task as any).remarks || (canEditRemarks ? <span className="italic text-xs">Click to add remarks…</span> : '')}
                                          </div>
                                        )}
                                      </td>
                                    )}
                                    <td className="py-2.5 px-2 text-center">
                                      <div className="flex items-center justify-center gap-0.5">
                                        {/* Remarks button — visible to all; editable by admin/designer */}
                                        <Popover
                                          open={remarksOpenTaskId === task.id}
                                          onOpenChange={(open) => {
                                            if (open) {
                                              setRemarksOpenTaskId(task.id);
                                              setRemarksValue((task as any).remarks || "");
                                            } else {
                                              setRemarksOpenTaskId(null);
                                            }
                                          }}
                                        >
                                          <PopoverTrigger asChild>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className={`h-7 w-7 transition-opacity ${(task as any).remarks ? 'opacity-100 text-blue-500 dark:text-blue-400' : 'opacity-40 hover:opacity-100'}`}
                                              title={(task as any).remarks ? `Remarks: ${(task as any).remarks}` : canEditRemarks ? "Add remarks" : "No remarks"}
                                              data-testid={`button-remarks-${task.id}`}
                                            >
                                              <MessageSquare className={`h-3.5 w-3.5 ${(task as any).remarks ? 'fill-blue-100 dark:fill-blue-900' : ''}`} />
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-80 p-4" align="end">
                                            <div className="space-y-3">
                                              <div>
                                                <p className="text-sm font-medium">Remarks</p>
                                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.name}</p>
                                              </div>
                                              {canEditRemarks ? (
                                                <>
                                                  <Textarea
                                                    value={remarksValue}
                                                    onChange={(e) => setRemarksValue(e.target.value)}
                                                    placeholder="Add notes, reason for delay, stage of completion..."
                                                    className="text-sm min-h-[90px] resize-none"
                                                    onKeyDown={(e) => { if (e.key === 'Escape') setRemarksOpenTaskId(null); }}
                                                    autoFocus
                                                  />
                                                  <div className="flex justify-end gap-2">
                                                    <Button size="sm" variant="ghost" onClick={() => setRemarksOpenTaskId(null)}>Cancel</Button>
                                                    <Button
                                                      size="sm"
                                                      onClick={() => updateRemarksMutation.mutate({ taskId: task.id, remarks: remarksValue })}
                                                      disabled={updateRemarksMutation.isPending}
                                                    >
                                                      Save
                                                    </Button>
                                                  </div>
                                                </>
                                              ) : (
                                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                                  {(task as any).remarks || "No remarks added yet."}
                                                </p>
                                              )}
                                            </div>
                                          </PopoverContent>
                                        </Popover>

                                        {/* Delete — admin only */}
                                        {isAdmin && (
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 opacity-40 hover:opacity-100"
                                            onClick={() => {
                                              if (confirm(`Delete task "${task.name}"?`)) {
                                                deleteTaskMutation.mutate(task.id);
                                              }
                                            }}
                                            data-testid={`button-delete-task-row-${task.id}`}
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                                return [subcatHeaderRow, subcatIsCollapsed ? null : taskRow].filter((x): x is JSX.Element => x !== null);
                              })
                          }
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Legend */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: getStatusColor('completed') }} />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: getStatusColor('in_progress') }} />
              <span>In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: getStatusColor('blocked') }} />
              <span>Blocked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: getStatusColor('not_started') }} />
              <span>Not Started</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-px h-4 bg-primary" />
              <span>Today</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <History className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-orange-600 dark:text-orange-400">Deadline extended (click to view history)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Extend Deadline Dialog */}
      <Dialog open={!!extendDeadlineTask} onOpenChange={(open) => { if (!open) { setExtendDeadlineTask(null); setExtendDeadlineReason(''); setExtendDeadlineNewDate(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-orange-500" />
              Extend Deadline
            </DialogTitle>
            <DialogDescription>
              This task's deadline has passed. A reason is required to record this extension.
            </DialogDescription>
          </DialogHeader>
          {extendDeadlineTask && (
            <div className="space-y-4 pt-2">
              <div className="bg-red-50 dark:bg-red-950/30 rounded-md p-3 text-sm">
                <p className="font-medium text-foreground line-clamp-2">{extendDeadlineTask.name}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Original deadline: <span className="text-red-600 dark:text-red-400 font-medium">{extendDeadlineTask.endDate}</span>
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">New Deadline</label>
                <Input
                  type="date"
                  value={extendDeadlineNewDate}
                  onChange={(e) => setExtendDeadlineNewDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  data-testid="input-extend-deadline-date"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Reason for Extension <span className="text-destructive">*</span></label>
                <Textarea
                  placeholder="e.g. Material delivery delayed, site access issue, scope change..."
                  value={extendDeadlineReason}
                  onChange={(e) => setExtendDeadlineReason(e.target.value)}
                  rows={3}
                  data-testid="textarea-extend-deadline-reason"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setExtendDeadlineTask(null); setExtendDeadlineReason(''); setExtendDeadlineNewDate(''); }}>
                  Cancel
                </Button>
                <Button
                  disabled={!extendDeadlineNewDate || !extendDeadlineReason.trim() || extendDeadlineMutation.isPending}
                  onClick={() => {
                    if (extendDeadlineTask && extendDeadlineNewDate && extendDeadlineReason.trim()) {
                      extendDeadlineMutation.mutate({
                        taskId: extendDeadlineTask.id,
                        newEndDate: extendDeadlineNewDate,
                        reason: extendDeadlineReason,
                      });
                    }
                  }}
                  data-testid="button-confirm-extend-deadline"
                >
                  {extendDeadlineMutation.isPending ? "Saving..." : "Save Extension"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Critical Path Display Component
function CriticalPathDisplay({ scheduleId }: { scheduleId: string }) {
  const { data: criticalPathData, isLoading, error, isError } = useQuery<CriticalPathResult>({
    queryKey: ['/api/schedules', scheduleId, 'critical-path'],
    queryFn: async () => {
      const response = await fetch(`/api/schedules/${scheduleId}/critical-path`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch critical path');
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="mt-3 p-4 bg-muted/50 rounded-md">
        <div className="text-sm text-muted-foreground">Calculating critical path...</div>
      </div>
    );
  }

  if (isError) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to calculate critical path';
    const isCircularDependency = errorMessage.includes('Circular dependency');
    
    return (
      <div className="mt-3 p-4 bg-destructive/10 rounded-md border border-destructive/20">
        <div className="flex items-start gap-2">
          <div className="text-destructive mt-0.5">
            <Activity className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-destructive text-sm mb-1">
              {isCircularDependency ? 'Circular Dependency Detected' : 'Calculation Error'}
            </div>
            <div className="text-sm text-muted-foreground">
              {errorMessage}
            </div>
            {isCircularDependency && (
              <div className="text-xs text-muted-foreground mt-2">
                Please review your task dependencies and remove any circular references where tasks depend on each other in a loop.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!criticalPathData || criticalPathData.tasks.length === 0) {
    return (
      <div className="mt-3 p-4 bg-muted/50 rounded-md">
        <div className="text-sm text-muted-foreground">No tasks found in this schedule</div>
      </div>
    );
  }

  const criticalTasks = criticalPathData.tasks.filter(t => t.isCritical);
  const totalTasks = criticalPathData.tasks.length;
  const criticalPercentage = ((criticalTasks.length / totalTasks) * 100).toFixed(0);

  return (
    <div className="mt-3 space-y-4">
      {/* Compact Summary Banner */}
      <div className="bg-muted/30 rounded-lg p-4">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">Project Duration</div>
            <div className="text-2xl font-bold text-primary" data-testid="text-project-duration">
              {criticalPathData.projectDuration} days
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">Critical Tasks</div>
            <div className="text-2xl font-bold text-destructive" data-testid="text-critical-tasks-count">
              {criticalTasks.length} / {totalTasks}
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">Critical %</div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {criticalPercentage}%
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">Non-Critical</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {totalTasks - criticalTasks.length}
            </div>
          </div>
        </div>
      </div>

      {/* Critical Tasks List */}
      {criticalTasks.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-destructive" />
                <CardTitle className="text-base">Critical Path Tasks (Zero Float)</CardTitle>
              </div>
              <Badge variant="destructive" className="font-mono">
                {criticalTasks.length} tasks
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {criticalTasks
                .sort((a, b) => a.earlyStart - b.earlyStart)
                .map((taskNode, index) => (
                  <div 
                    key={taskNode.task.id} 
                    className="group flex items-center gap-3 p-3 bg-destructive/5 hover-elevate rounded-lg border border-destructive/20"
                    data-testid={`critical-task-${taskNode.task.id}`}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-destructive/10 text-destructive font-semibold text-sm flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm mb-1 truncate">{taskNode.task.name}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                        <span>ES: Day {taskNode.earlyStart.toFixed(0)}</span>
                        <span>→</span>
                        <span>EF: Day {taskNode.earlyFinish.toFixed(0)}</span>
                      </div>
                    </div>
                    <Badge variant="destructive" className="flex-shrink-0 font-mono">
                      Float: 0
                    </Badge>
                  </div>
                ))
              }
            </div>
          </CardContent>
        </Card>
      )}

      {/* Non-Critical Tasks with Float */}
      {totalTasks > criticalTasks.length && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Tasks with Float</CardTitle>
              <Badge variant="secondary" className="font-mono">
                {totalTasks - criticalTasks.length} tasks
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {criticalPathData.tasks
                .filter(t => !t.isCritical)
                .sort((a, b) => b.totalFloat - a.totalFloat)
                .slice(0, 10)
                .map((taskNode) => (
                  <div 
                    key={taskNode.task.id} 
                    className="group flex items-center gap-3 p-3 bg-muted/20 hover-elevate rounded-lg"
                    data-testid={`noncritical-task-${taskNode.task.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm mb-1 truncate">{taskNode.task.name}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                        <span>LS: Day {taskNode.lateStart.toFixed(0)}</span>
                        <span>→</span>
                        <span>LF: Day {taskNode.lateFinish.toFixed(0)}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="flex-shrink-0 font-mono">
                      Float: {taskNode.totalFloat.toFixed(1)}d
                    </Badge>
                  </div>
                ))}
              {criticalPathData.tasks.filter(t => !t.isCritical).length > 10 && (
                <div className="text-xs text-center pt-2 text-muted-foreground">
                  + {criticalPathData.tasks.filter(t => !t.isCritical).length - 10} more tasks with float
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
