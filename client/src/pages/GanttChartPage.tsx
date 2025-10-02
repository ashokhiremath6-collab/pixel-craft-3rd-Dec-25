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
import { Calendar, Plus, Upload, Edit, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema } from "@shared/schema";
import type { Project, Task } from "@shared/schema";
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

export default function GanttChartPage() {
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const { data: quotationsData, isLoading: isLoadingProjects } = useQuery<QuotationsResponse>({
    queryKey: ['/api/quotations'],
  });

  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery<Task[]>({
    queryKey: ['/api/tasks/project', selectedProjectId],
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

  const importTasksMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', selectedProjectId);

      const response = await fetch('/api/tasks/import/csv', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/project', selectedProjectId] });
      toast({ 
        title: "Import Complete", 
        description: data.message || `Imported ${data.success} tasks successfully`,
      });
      setIsImportOpen(false);
      setSelectedFile(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Import Failed", 
        description: error.message || "Failed to import tasks",
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

  // Calculate date range for the chart
  const allDates = projects.flatMap(p => [
    p.startDate ? new Date(p.startDate) : null,
    p.endDate ? new Date(p.endDate) : null
  ].filter(Boolean) as Date[]);

  // Include task dates if a project is selected
  if (selectedProjectId && tasks.length > 0) {
    tasks.forEach(task => {
      if (task.startDate) allDates.push(new Date(task.startDate));
      if (task.endDate) allDates.push(new Date(task.endDate));
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

  // Generate month markers
  const monthMarkers: { label: string; position: number }[] = [];
  const currentMarker = new Date(paddedMinDate);
  currentMarker.setDate(1);

  while (currentMarker <= paddedMaxDate) {
    const position = ((currentMarker.getTime() - paddedMinDate.getTime()) / (paddedMaxDate.getTime() - paddedMinDate.getTime())) * 100;
    monthMarkers.push({
      label: currentMarker.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      position
    });
    currentMarker.setMonth(currentMarker.getMonth() + 1);
  }

  const getBar = (startDate: string | Date | null, endDate: string | Date | null) => {
    const start = startDate ? new Date(startDate) : paddedMinDate;
    const end = endDate ? new Date(endDate) : paddedMaxDate;
    
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
    if (selectedFile) {
      importTasksMutation.mutate(selectedFile);
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
            Task Management & Timeline
          </h1>
          <p className="text-muted-foreground">
            Manage tasks and visualize project timelines with Gantt chart
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

                <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" data-testid="button-import-csv">
                      <Upload className="h-4 w-4 mr-2" />
                      Import CSV
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Import Tasks from CSV</DialogTitle>
                      <DialogDescription>
                        Upload a CSV file with task data for {selectedProject?.projectName}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">CSV File</label>
                        <Input
                          type="file"
                          accept=".csv"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          data-testid="input-csv-file"
                        />
                        <p className="text-xs text-muted-foreground">
                          Required columns: name, startDate, endDate. Optional: description, status, priority, progress
                        </p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsImportOpen(false)} data-testid="button-cancel-import">
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleImport} 
                          disabled={!selectedFile || importTasksMutation.isPending}
                          data-testid="button-submit-import"
                        >
                          {importTasksMutation.isPending ? "Importing..." : "Import"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

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
              <div className="relative h-8 border-b mb-6">
                {monthMarkers.map((marker, idx) => (
                  <div
                    key={idx}
                    className="absolute top-0 h-full flex flex-col justify-between"
                    style={{ left: `${marker.position}%` }}
                  >
                    <div className="text-xs text-muted-foreground font-medium">
                      {marker.label}
                    </div>
                    <div className="w-px h-2 bg-border" />
                  </div>
                ))}
              </div>

            {/* Today indicator */}
            {todayPosition >= 0 && todayPosition <= 100 && (
              <div 
                className="absolute top-8 bottom-0 w-px bg-primary z-10 pointer-events-none"
                style={{ left: `${todayPosition}%` }}
                title="Today"
              />
            )}

            {/* Display based on selected project */}
            {selectedProjectId ? (
              /* Show tasks for selected project */
              <div className="space-y-2">
                {isLoadingTasks ? (
                  <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No tasks yet. Add your first task or import from CSV.
                  </div>
                ) : (
                  tasks.map((task) => {
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
                              className="absolute top-0.5 bottom-0.5 rounded-sm transition-all hover-elevate cursor-pointer flex items-center px-2"
                              style={{
                                left: bar.left,
                                width: bar.width,
                                backgroundColor: getStatusColor(task.status),
                              }}
                              title={`${task.name}\n${task.status}\n${task.startDate} - ${task.endDate}`}
                              data-testid={`gantt-bar-task-${task.id}`}
                            >
                              <span className="text-xs text-white font-medium truncate">
                                {task.status.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                          <div className="w-32 flex-shrink-0 pl-4">
                            <Badge 
                              variant={task.status === 'completed' ? 'default' : 'secondary'} 
                              data-testid={`badge-task-status-${task.id}`}
                            >
                              {task.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* Show all projects */
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
                                      {new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      {' - '}
                                      {new Date(project.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="w-32 flex-shrink-0 pl-4">
                            <Badge variant={isActive ? "default" : "secondary"} data-testid={`badge-status-${project.id}`}>
                              {isActive ? 'Active' : 'Completed'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </div>
        </CardContent>
      </Card>

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
