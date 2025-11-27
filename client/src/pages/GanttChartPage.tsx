import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Plus, Upload, Edit, Trash2, ChevronDown, ChevronRight, Download, FileText, ExternalLink, Activity, TrendingUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema } from "@shared/schema";
import type { Project, Task, ProjectSchedule } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

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

export default function GanttChartPage() {
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
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

  const { data: quotationsData, isLoading: isLoadingProjects } = useQuery<QuotationsResponse>({
    queryKey: ['/api/quotations'],
  });

  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery<Task[]>({
    queryKey: ['/api/tasks/project', selectedProjectId],
    enabled: !!selectedProjectId,
  });

  const { data: schedules = [] } = useQuery<ProjectSchedule[]>({
    queryKey: ['/api/schedules/project', selectedProjectId],
    enabled: !!selectedProjectId,
  });

  const form = useForm<z.infer<typeof taskFormSchema>>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      projectId: selectedProjectId,
      name: "",
      description: "",
      startDate: "",
      endDate: "",
      status: "not_started",
      priority: "medium",
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
      queryClient.invalidateQueries({ queryKey: ['/api/schedules/project', variables.projectId] });
      toast({ 
        title: "Schedule Imported", 
        description: `Successfully imported ${data.tasksCreated} tasks`,
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

  // Calculate date range for the chart
  const allDates = projects.flatMap(p => [
    parseLocalDate(p.startDate),
    parseLocalDate(p.endDate)
  ].filter(Boolean) as Date[]);

  // Include task dates if a project is selected
  if (selectedProjectId && tasks.length > 0) {
    tasks.forEach(task => {
      const start = parseLocalDate(task.startDate);
      const end = parseLocalDate(task.endDate);
      if (start) allDates.push(start);
      if (end) allDates.push(end);
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

  while (currentMarker <= paddedMaxDate) {
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
      const response = await fetch(`/api/schedules/export/${selectedProjectId}`);
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
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 flex-1">
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-[300px]" data-testid="select-project">
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
              <div className="flex items-center gap-2">
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
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="priority"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Priority</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-priority">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="critical">Critical</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
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
                        </div>
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
                              <div className="font-medium truncate" data-testid={`text-schedule-name-${schedule.id}`}>
                                {schedule.fileName}
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
                              variant="ghost"
                              asChild
                              data-testid={`button-view-schedule-${schedule.id}`}
                            >
                              <a href={schedule.filePath} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
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

      {/* Gantt Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Timeline View</span>
            <Badge variant="secondary">
              {selectedProjectId ? `${tasks.length} tasks` : `${projects.length} projects`}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="relative min-w-[800px]">
              {/* Timeline header with month markers */}
              <div className="relative h-8 border-b mb-6 ml-64">
                {monthMarkers.map((marker, idx) => (
                  <div
                    key={idx}
                    className="absolute top-0 flex flex-col justify-start"
                    style={{ left: `${marker.position}%` }}
                  >
                    <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                      {marker.label}
                    </div>
                    <div className="w-px h-2 bg-border" />
                  </div>
                ))}
              </div>
              
              {/* Month grid lines */}
              {monthMarkers.map((marker, idx) => (
                <div
                  key={`grid-${idx}`}
                  className="absolute top-8 bottom-0 w-px bg-border opacity-20 pointer-events-none ml-64"
                  style={{ left: `${marker.position}%` }}
                />
              ))}

            {/* Today indicator */}
            {showTodayLine && todayPosition >= 0 && todayPosition <= 100 && (
              <div 
                className="absolute top-8 bottom-0 w-px bg-primary z-10 pointer-events-none ml-64"
                style={{ left: `${todayPosition}%` }}
                title="Today"
              />
            )}

            {/* Always show all projects overview */}
            <div className="space-y-3">
                {projects.map((project) => {
                  const bar = getBar(project.startDate, project.endDate);
                  const isExpanded = expandedProjects.has(project.id);
                  const projectTasks = tasks.filter(t => t.projectId === project.id);
                  const isActive = !project.endDate || new Date(project.endDate) > today;
                  
                  return (
                    <div key={project.id} data-testid={`gantt-project-${project.id}`}>
                      <div className="relative">
                        <div className="flex items-center mb-1">
                          <div className="w-64 flex-shrink-0 pr-4 flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => toggleProjectExpansion(project.id)}
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate" data-testid={`text-project-name-${project.id}`}>
                                {project.projectName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {project.clientName}
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 relative h-10">
                            <div className="absolute inset-0 rounded-md bg-muted" />
                            <div
                              className="absolute top-1 bottom-1 rounded-md transition-all hover-elevate cursor-pointer"
                              style={{
                                left: bar.left,
                                width: bar.width,
                                backgroundColor: isActive 
                                  ? 'hsl(var(--primary))' 
                                  : 'hsl(var(--muted-foreground))',
                              }}
                              title={`${project.projectName}\n${project.startDate || 'No start'} - ${project.endDate || 'No end'}`}
                              data-testid={`gantt-bar-${project.id}`}
                              onClick={() => setSelectedProjectId(project.id)}
                            >
                              <div className="flex items-center justify-center h-full px-2">
                                <span className="text-xs text-primary-foreground font-medium truncate">
                                  {project.startDate && project.endDate && (
                                    <>
                                      {parseLocalDate(project.startDate)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      {' - '}
                                      {parseLocalDate(project.endDate)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            {/* Detailed tasks for selected project */}
            {selectedProjectId && (
              <div className="mt-8 pt-6 border-t">
                <h3 className="text-lg font-semibold mb-4">
                  Detailed Tasks - {selectedProject?.projectName}
                </h3>
                {isLoadingTasks ? (
                  <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No tasks yet. Add your first task or import from CSV.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((task) => {
                      const bar = getBar(task.startDate, task.endDate);
                      return (
                        <div key={task.id} className="relative group" data-testid={`gantt-task-${task.id}`}>
                          <div className="flex items-center mb-1">
                            <div className="w-64 flex-shrink-0 pr-4 flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate" data-testid={`text-task-name-${task.id}`}>
                                  {task.name}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs px-1 py-0">
                                    {task.priority}
                                  </Badge>
                                  <span>{task.progressPercentage}%</span>
                                </div>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-2">
                                <Button size="icon" variant="ghost" className="h-6 w-6" data-testid={`button-delete-task-${task.id}`} onClick={() => deleteTaskMutation.mutate(task.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex-1 relative h-8">
                              <div className="absolute inset-0 rounded-sm bg-muted" />
                              <div
                                className="absolute top-0.5 bottom-0.5 rounded-sm transition-all hover-elevate cursor-pointer flex items-center justify-between px-2"
                                style={{
                                  left: bar.left,
                                  width: bar.width,
                                  backgroundColor: getStatusColor(task.status),
                                }}
                                title={`${task.name}\n${task.status}\n${task.startDate} - ${task.endDate}`}
                                data-testid={`gantt-bar-task-${task.id}`}
                              >
                                <span className="text-xs text-white font-medium truncate">
                                  {parseLocalDate(task.startDate)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                                <span className="text-xs text-white font-medium truncate">
                                  {parseLocalDate(task.endDate)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task List Table - Designer View */}
      {selectedProjectId && tasks.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Task List</CardTitle>
              <Badge variant="secondary">{tasks.length} tasks</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-3 font-medium">Task</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                    <th className="text-left py-3 px-2 font-medium">Start</th>
                    <th className="text-left py-3 px-2 font-medium">End</th>
                    <th className="text-left py-3 px-2 font-medium">Owner</th>
                    <th className="text-left py-3 px-2 font-medium">Priority</th>
                    <th className="text-center py-3 px-2 font-medium">Progress</th>
                    <th className="text-center py-3 px-2 font-medium">Approval</th>
                    <th className="text-center py-3 px-2 font-medium w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, index) => {
                    const isPhaseHeader = task.outlineLevel === 1;
                    const indentLevel = task.outlineLevel ? Math.max(0, task.outlineLevel - 1) : 0;
                    return (
                      <tr 
                        key={task.id} 
                        className={`border-b hover-elevate ${isPhaseHeader ? 'bg-muted/30 font-medium' : index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}
                        data-testid={`row-task-${task.id}`}
                      >
                        <td className="py-2 px-3">
                          <div className={`${isPhaseHeader ? 'font-semibold text-primary' : ''} truncate max-w-[300px]`} title={task.name}>
                            {indentLevel > 0 && (
                              <span className="text-muted-foreground mr-1" style={{ marginLeft: `${indentLevel * 12}px` }}>•</span>
                            )}
                            {task.name}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <Badge 
                            variant={task.status === 'completed' ? 'default' : task.status === 'in_progress' ? 'secondary' : task.status === 'blocked' ? 'destructive' : 'outline'}
                            className="text-xs whitespace-nowrap"
                          >
                            {task.status?.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                          {task.startDate ? new Date(task.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '-'}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                          {task.endDate ? new Date(task.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '-'}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground truncate max-w-[100px]" title={task.owner || ''}>
                          {task.owner || '-'}
                        </td>
                        <td className="py-2 px-2">
                          <Badge 
                            variant="outline"
                            className={`text-xs ${
                              task.priority === 'critical' ? 'border-red-500 text-red-600 bg-red-50 dark:bg-red-950' :
                              task.priority === 'high' ? 'border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950' :
                              task.priority === 'medium' ? 'border-yellow-500 text-yellow-600 bg-yellow-50 dark:bg-yellow-950' :
                              'border-green-500 text-green-600 bg-green-50 dark:bg-green-950'
                            }`}
                          >
                            {task.priority}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center gap-1">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${task.progressPercentage || 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8">{task.progressPercentage || 0}%</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center">
                          {task.approvalRequired ? (
                            <Badge variant="outline" className="text-xs border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950">Yes</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6"
                            onClick={() => {
                              if (confirm(`Delete task "${task.name}"?`)) {
                                deleteTaskMutation.mutate(task.id);
                              }
                            }}
                            data-testid={`button-delete-task-row-${task.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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
          </div>
        </CardContent>
      </Card>
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

      {/* Gantt Chart Links - All Projects */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Gantt Chart Links
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No projects found. Create a project first.
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-md border hover-elevate"
                  data-testid={`project-link-${project.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" data-testid={`text-project-${project.id}`}>
                      {project.projectName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {project.ganttChartLink ? (
                      <>
                        <a
                          href={project.ganttChartLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1"
                          data-testid={`link-view-${project.id}`}
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Chart
                        </a>
                        {editingLinkProjectId === project.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={ganttLinkInput}
                              onChange={(e) => setGanttLinkInput(e.target.value)}
                              placeholder="https://..."
                              className="w-64"
                              data-testid={`input-link-${project.id}`}
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                updateGanttLinkMutation.mutate({ 
                                  id: project.id, 
                                  ganttChartLink: ganttLinkInput.trim() 
                                });
                                setEditingLinkProjectId(null);
                              }}
                              disabled={!ganttLinkInput.trim() || updateGanttLinkMutation.isPending}
                              data-testid={`button-save-link-${project.id}`}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingLinkProjectId(null)}
                              data-testid={`button-cancel-link-${project.id}`}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setGanttLinkInput(project.ganttChartLink || "");
                              setEditingLinkProjectId(project.id);
                            }}
                            data-testid={`button-edit-link-${project.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        {editingLinkProjectId === project.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={ganttLinkInput}
                              onChange={(e) => setGanttLinkInput(e.target.value)}
                              placeholder="https://..."
                              className="w-64"
                              data-testid={`input-link-${project.id}`}
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                updateGanttLinkMutation.mutate({ 
                                  id: project.id, 
                                  ganttChartLink: ganttLinkInput.trim() 
                                });
                                setEditingLinkProjectId(null);
                              }}
                              disabled={!ganttLinkInput.trim() || updateGanttLinkMutation.isPending}
                              data-testid={`button-save-link-${project.id}`}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingLinkProjectId(null)}
                              data-testid={`button-cancel-link-${project.id}`}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setGanttLinkInput("");
                              setEditingLinkProjectId(project.id);
                            }}
                            data-testid={`button-add-link-${project.id}`}
                          >
                            Add Link
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template Downloads - Collapsible */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Download Templates</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTemplates(!showTemplates)}
              data-testid="button-toggle-templates"
            >
              {showTemplates ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {showTemplates ? "Hide" : "Show"}
            </Button>
          </div>
        </CardHeader>
        {showTemplates && (
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4 flex-wrap">
            <Button 
              variant="outline" 
              onClick={() => handleDownloadTemplate('gantt')}
              data-testid="button-download-gantt-template"
            >
              <Download className="h-4 w-4 mr-2" />
              Gantt Template (250 tasks)
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleDownloadTemplate('dependencies')}
              data-testid="button-download-dependencies-template"
            >
              <Download className="h-4 w-4 mr-2" />
              Dependencies Template
            </Button>
            <Button 
              variant="default" 
              onClick={async () => {
                try {
                  const response = await fetch(`/api/templates/test-sample?v=${Date.now()}`);
                  if (!response.ok) throw new Error('Download failed');
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'Sample_New_5_Tasks.xlsx';
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                  toast({ title: "Test File Downloaded", description: "Sample file with 5 tasks ready to import!" });
                } catch (error) {
                  toast({ title: "Download Failed", description: "Could not download test file", variant: "destructive" });
                }
              }}
              data-testid="button-download-test-sample"
            >
              <Download className="h-4 w-4 mr-2" />
              Test Sample (5 Tasks)
            </Button>
            <Button
              variant="default"
              onClick={handleExportSchedule}
              disabled={!selectedProjectId || tasks.length === 0}
              data-testid="button-export-schedule"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Current Schedule
            </Button>
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
              <DialogTrigger asChild>
                <Button variant="default" data-testid="button-import-schedule">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Completed Schedule
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Project Schedule</DialogTitle>
                  <DialogDescription>
                    Upload a filled Gantt chart (XLSX or CSV) with tasks and dependencies
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Select Project</label>
                    <Select value={importProjectId} onValueChange={setImportProjectId}>
                      <SelectTrigger data-testid="select-import-project">
                        <SelectValue placeholder="Choose project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.projectName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Upload File</label>
                    <Input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      data-testid="input-import-file"
                    />
                  </div>
                  <Button
                    onClick={handleImport}
                    disabled={!selectedFile || !importProjectId || importScheduleMutation.isPending}
                    className="w-full"
                    data-testid="button-confirm-import"
                  >
                    {importScheduleMutation.isPending ? "Importing..." : "Import Schedule"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
        )}
      </Card>
    </div>
  );
}
