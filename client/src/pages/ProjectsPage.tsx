import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import ProjectView from '@/components/ProjectView';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Project, InsertProject } from "@shared/schema";
import { insertProjectSchema } from "@shared/schema";

interface ProjectData extends Project {
  vendorCount: number;
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

export default function ProjectsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [isAddingProject, setIsAddingProject] = useState(false);

  // Get user info to check role - use the auth hook which has the correct user data with role
  const { user } = useAuth();
  
  const isDesigner = user?.role === 'designer' || user?.role === 'admin';

  // Fetch quotations data which includes projects and their vendor relationships
  const { data: quotationsData, isLoading } = useQuery<QuotationsResponse>({
    queryKey: ['/api/quotations'],
  });

  // Form for editing projects
  const form = useForm<InsertProject>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      projectName: "",
      clientName: "",
      clientEmail: "",
      startDate: "",
      endDate: "",
      foyrNeoLink: "",
    },
  });

  // Form for adding new projects
  const addForm = useForm<InsertProject>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      projectName: "",
      clientName: "",
      clientEmail: "",
      startDate: "",
      endDate: "",
      foyrNeoLink: "",
    },
  });

  // Create mutation
  const createProjectMutation = useMutation({
    mutationFn: async (project: InsertProject) => {
      return apiRequest('POST', '/api/projects', project);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
      setIsAddingProject(false);
      addForm.reset();
      toast({
        title: "Success",
        description: "Project created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create project",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateProjectMutation = useMutation({
    mutationFn: async (data: { id: string; project: Partial<InsertProject> }) => {
      return apiRequest('PUT', `/api/projects/${data.id}`, data.project);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
      setEditingProject(null);
      form.reset();
      toast({
        title: "Success",
        description: "Project updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update project",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
      setDeletingProject(null);
      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive",
      });
    },
  });

  // Transform projects to include vendor counts
  const projectsWithCounts: ProjectData[] = (quotationsData?.projects || []).map(project => ({
    ...project,
    vendorCount: quotationsData?.quotations[project.id]?.length || 0
  }));

  const handleAddProject = () => {
    setIsAddingProject(true);
    addForm.reset();
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    form.reset({
      projectName: project.projectName,
      clientName: project.clientName,
      clientEmail: project.clientEmail,
      startDate: project.startDate,
      endDate: project.endDate || "",
      foyrNeoLink: project.foyrNeoLink || "",
    });
  };

  const handleViewProject = (project: Project) => {
    console.log('View project details:', project.projectName);
    toast({
      title: "View Project",
      description: "View project details functionality will be implemented next",
    });
  };

  const handleDeleteProject = (project: Project) => {
    setDeletingProject(project);
  };

  const confirmDeleteProject = () => {
    if (!deletingProject) return;
    deleteProjectMutation.mutate(deletingProject.id);
  };

  const cancelDeleteProject = () => {
    setDeletingProject(null);
  };

  const onSubmitEdit = (data: InsertProject) => {
    if (!editingProject) return;
    updateProjectMutation.mutate({
      id: editingProject.id,
      project: data,
    });
  };

  const handleCloseEditDialog = () => {
    setEditingProject(null);
    form.reset();
  };

  const handleCloseAddDialog = () => {
    setIsAddingProject(false);
    addForm.reset();
  };

  const onSubmitAdd = (data: InsertProject) => {
    createProjectMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading projects...</div>
      </div>
    );
  }

  return (
    <>
      <ProjectView 
        projects={projectsWithCounts}
        quotations={quotationsData?.quotations || {}}
        onAddProject={handleAddProject}
        onEditProject={handleEditProject}
        onViewProject={handleViewProject}
        onDeleteProject={handleDeleteProject}
        isDesigner={isDesigner}
      />

      {/* Edit Project Dialog */}
      <Dialog open={!!editingProject} onOpenChange={handleCloseEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitEdit)} className="space-y-4">
              <FormField
                control={form.control}
                name="projectName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter project name" 
                        {...field} 
                        data-testid="input-project-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter client name" 
                        {...field} 
                        data-testid="input-client-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email"
                        placeholder="Enter client email" 
                        {...field} 
                        data-testid="input-client-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        data-testid="input-start-date"
                      />
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
                    <FormLabel>End Date (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        value={field.value || ""}
                        data-testid="input-end-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="foyrNeoLink"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Foyr Neo Link (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="url"
                        placeholder="https://neo.foyr.com/..." 
                        {...field} 
                        value={field.value || ""}
                        data-testid="input-foyr-neo-link"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCloseEditDialog}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateProjectMutation.isPending}
                  data-testid="button-save-project"
                >
                  {updateProjectMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingProject} onOpenChange={cancelDeleteProject}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the project "{deletingProject?.projectName}"? 
              This action cannot be undone and will remove all associated vendor relationships and quotations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteProject}
              disabled={deleteProjectMutation.isPending}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProjectMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Project Dialog */}
      <Dialog open={isAddingProject} onOpenChange={handleCloseAddDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Project</DialogTitle>
            <DialogDescription>
              Create a new project to track vendors and quotations.
            </DialogDescription>
          </DialogHeader>
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit(onSubmitAdd)} className="space-y-4">
              <FormField
                control={addForm.control}
                name="projectName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter project name" 
                        {...field} 
                        data-testid="input-project-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter client name" 
                        {...field} 
                        data-testid="input-client-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="clientEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email"
                        placeholder="Enter client email" 
                        {...field} 
                        data-testid="input-client-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        data-testid="input-start-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        value={field.value || ""}
                        data-testid="input-end-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="foyrNeoLink"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Foyr Neo Link (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="url"
                        placeholder="https://neo.foyr.com/..." 
                        {...field} 
                        value={field.value || ""}
                        data-testid="input-foyr-neo-link"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCloseAddDialog}
                  data-testid="button-cancel-add"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createProjectMutation.isPending}
                  data-testid="button-submit-add"
                >
                  {createProjectMutation.isPending ? "Creating..." : "Create Project"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}