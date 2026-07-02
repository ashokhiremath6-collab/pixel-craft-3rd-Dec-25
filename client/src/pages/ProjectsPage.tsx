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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Project, InsertProject } from "@shared/schema";
import { insertProjectSchema } from "@shared/schema";
import { PlanLimitBanner } from "@/components/PlanLimitBanner";
import { Zap, Lock, UserPlus, X } from "lucide-react";
import { useLocation } from "wouter";

interface UsageData {
  plan: string;
  limits: { maxProjects: number; maxUsers: number; maxCatalogueItems: number };
  usage: { projects: number; users: number; catalogueItems: number };
}

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

interface ProjectMember {
  userId: string;
  email: string;
  name: string;
}

const UNLIMITED = 999_999;

export default function ProjectsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [isRestricted, setIsRestricted] = useState(false);
  const [memberEmails, setMemberEmails] = useState<string[]>([""]);

  const { user } = useAuth();
  const isDesigner = user?.role === 'designer' || user?.role === 'admin';
  const canSeeUsage = (user?.role === 'admin' || user?.role === 'designer') && !!user?.orgId;
  const isAdmin = user?.role === 'admin';

  const { data: usageData } = useQuery<UsageData>({
    queryKey: ["/api/billing/usage"],
    enabled: canSeeUsage,
  });

  const projectLimit = usageData?.limits.maxProjects ?? UNLIMITED;
  const projectCount = usageData?.usage.projects ?? 0;
  const projectsAtLimit = projectLimit < UNLIMITED && projectCount >= projectLimit;

  const { data: quotationsData, isLoading } = useQuery<QuotationsResponse>({
    queryKey: ['/api/quotations'],
  });

  // Members for the project being edited (default fetcher joins queryKey with "/" → correct URL)
  const { data: members = [] } = useQuery<ProjectMember[]>({
    queryKey: ['/api/projects', editingProject?.id, 'members'],
    enabled: !!editingProject && isAdmin,
  });

  const addMemberMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest('POST', `/api/projects/${editingProject!.id}/members`, { email });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', editingProject?.id, 'members'] });
      setMemberEmails([""]);
      toast({ title: "Member added" });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: err?.message || "User not found in your organisation" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest('DELETE', `/api/projects/${editingProject!.id}/members/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', editingProject?.id, 'members'] });
      toast({ title: "Member removed" });
    },
  });

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

  const createProjectMutation = useMutation({
    mutationFn: async (project: InsertProject) => {
      return apiRequest('POST', '/api/projects', project);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/usage'] });
      setIsAddingProject(false);
      addForm.reset();
      toast({ title: "Success", description: "Project created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create project", variant: "destructive" });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data: { id: string; project: Partial<InsertProject> & { isRestricted?: boolean } }) => {
      return apiRequest('PUT', `/api/projects/${data.id}`, data.project);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
      setEditingProject(null);
      form.reset();
      toast({ title: "Success", description: "Project updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update project", variant: "destructive" });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/usage'] });
      setDeletingProject(null);
      toast({ title: "Success", description: "Project deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete project", variant: "destructive" });
    },
  });

  const projectsWithCounts: ProjectData[] = (quotationsData?.projects || []).map(project => ({
    ...project,
    vendorCount: quotationsData?.quotations[project.id]?.length || 0
  }));

  const handleAddProject = () => {
    if (projectsAtLimit) { setShowUpgradeDialog(true); return; }
    setIsAddingProject(true);
    addForm.reset();
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setIsRestricted(project.isRestricted ?? false);
    setMemberEmails([""]);
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
    toast({ title: "View Project", description: "View project details functionality will be implemented next" });
  };

  const handleDeleteProject = (project: Project) => { setDeletingProject(project); };
  const confirmDeleteProject = () => { if (deletingProject) deleteProjectMutation.mutate(deletingProject.id); };
  const cancelDeleteProject = () => setDeletingProject(null);

  const onSubmitEdit = (data: InsertProject) => {
    if (!editingProject) return;
    updateProjectMutation.mutate({ id: editingProject.id, project: { ...data, isRestricted } });
  };

  const handleCloseEditDialog = () => { setEditingProject(null); form.reset(); setMemberEmail(""); };
  const handleCloseAddDialog = () => { setIsAddingProject(false); addForm.reset(); };
  const onSubmitAdd = (data: InsertProject) => { createProjectMutation.mutate(data); };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="text-lg">Loading projects...</div></div>;
  }

  return (
    <>
      <div className="space-y-3">
        {canSeeUsage && (
          <PlanLimitBanner current={projectCount} limit={projectLimit} resourceLabel="Projects" />
        )}
        <ProjectView
          projects={projectsWithCounts}
          quotations={quotationsData?.quotations || {}}
          onAddProject={handleAddProject}
          onEditProject={handleEditProject}
          onViewProject={handleViewProject}
          onDeleteProject={handleDeleteProject}
          isDesigner={isDesigner}
        />
      </div>

      {/* Edit Project Dialog */}
      <Dialog open={!!editingProject} onOpenChange={handleCloseEditDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitEdit)} className="space-y-4">
              <FormField control={form.control} name="projectName" render={({ field }) => (
                <FormItem><FormLabel>Project Name</FormLabel><FormControl>
                  <Input placeholder="Enter project name" {...field} data-testid="input-project-name" />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="clientName" render={({ field }) => (
                <FormItem><FormLabel>Client Name</FormLabel><FormControl>
                  <Input placeholder="Enter client name" {...field} data-testid="input-client-name" />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="clientEmail" render={({ field }) => (
                <FormItem><FormLabel>Client Email</FormLabel><FormControl>
                  <Input type="email" placeholder="Enter client email" {...field} data-testid="input-client-email" />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem><FormLabel>Start Date</FormLabel><FormControl>
                  <Input type="date" {...field} data-testid="input-start-date" />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem><FormLabel>End Date (Optional)</FormLabel><FormControl>
                  <Input type="date" {...field} value={field.value || ""} data-testid="input-end-date" />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="foyrNeoLink" render={({ field }) => (
                <FormItem><FormLabel>Foyr Neo Link (Optional)</FormLabel><FormControl>
                  <Input type="url" placeholder="https://neo.foyr.com/..." {...field} value={field.value || ""} data-testid="input-foyr-neo-link" />
                </FormControl><FormMessage /></FormItem>
              )} />

              {/* Restricted access toggle — admin only */}
              {isAdmin && (
                <div className="rounded-md border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Restrict Access</p>
                        <p className="text-xs text-muted-foreground">Only listed members can see this project</p>
                      </div>
                    </div>
                    <Switch checked={isRestricted} onCheckedChange={setIsRestricted} />
                  </div>

                  {isRestricted && (
                    <div className="space-y-3 pt-1">
                      <p className="text-xs font-medium text-muted-foreground">Add members by email</p>
                      <div className="space-y-2">
                        {memberEmails.map((email, idx) => (
                          <div key={idx} className="flex gap-2">
                            <Input
                              placeholder="Email address"
                              value={email}
                              onChange={e => {
                                const next = [...memberEmails];
                                next[idx] = e.target.value;
                                setMemberEmails(next);
                              }}
                              className="text-sm"
                            />
                            {memberEmails.length > 1 && (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => setMemberEmails(memberEmails.filter((_, i) => i !== idx))}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setMemberEmails([...memberEmails, ""])}
                            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                          >
                            + Add another email
                          </button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={memberEmails.every(e => !e.trim()) || addMemberMutation.isPending}
                            onClick={async () => {
                              const toAdd = memberEmails.filter(e => e.trim());
                              for (const e of toAdd) {
                                await addMemberMutation.mutateAsync(e.trim()).catch(() => {});
                              }
                            }}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </div>
                      </div>

                      {members.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Current members</p>
                          <div className="flex flex-wrap gap-2">
                            {members.map(m => (
                              <Badge key={m.userId} variant="secondary" className="gap-1 pr-1">
                                {m.name || m.email}
                                <button
                                  type="button"
                                  onClick={() => removeMemberMutation.mutate(m.userId)}
                                  className="ml-1 rounded-full hover:bg-muted p-0.5"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {members.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No members yet — add emails above and click Add.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={handleCloseEditDialog} data-testid="button-cancel-edit">Cancel</Button>
                <Button type="submit" disabled={updateProjectMutation.isPending} data-testid="button-save-project">
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
        <DialogContent className="max-w-[95vw] sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Project</DialogTitle>
            <DialogDescription>Create a new project to track vendors and quotations.</DialogDescription>
          </DialogHeader>
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit(onSubmitAdd)} className="space-y-4">
              <FormField control={addForm.control} name="projectName" render={({ field }) => (
                <FormItem><FormLabel>Project Name</FormLabel><FormControl>
                  <Input placeholder="Enter project name" {...field} data-testid="input-project-name" />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={addForm.control} name="clientName" render={({ field }) => (
                <FormItem><FormLabel>Client Name</FormLabel><FormControl>
                  <Input placeholder="Enter client name" {...field} data-testid="input-client-name" />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={addForm.control} name="clientEmail" render={({ field }) => (
                <FormItem><FormLabel>Client Email</FormLabel><FormControl>
                  <Input type="email" placeholder="Enter client email" {...field} data-testid="input-client-email" />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={addForm.control} name="startDate" render={({ field }) => (
                <FormItem><FormLabel>Start Date</FormLabel><FormControl>
                  <Input type="date" {...field} data-testid="input-start-date" />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={addForm.control} name="endDate" render={({ field }) => (
                <FormItem><FormLabel>End Date</FormLabel><FormControl>
                  <Input type="date" {...field} value={field.value || ""} data-testid="input-end-date" />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={addForm.control} name="foyrNeoLink" render={({ field }) => (
                <FormItem><FormLabel>Foyr Neo Link (Optional)</FormLabel><FormControl>
                  <Input type="url" placeholder="https://neo.foyr.com/..." {...field} value={field.value || ""} data-testid="input-foyr-neo-link" />
                </FormControl><FormMessage /></FormItem>
              )} />
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={handleCloseAddDialog} data-testid="button-cancel-add">Cancel</Button>
                <Button type="submit" disabled={createProjectMutation.isPending} data-testid="button-submit-add">
                  {createProjectMutation.isPending ? "Creating..." : "Create Project"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Project limit reached</DialogTitle>
            <DialogDescription>
              You've used all {projectLimit} project{projectLimit === 1 ? '' : 's'} allowed on your current plan. Upgrade to add more.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>Cancel</Button>
            <Button onClick={() => { setShowUpgradeDialog(false); navigate("/settings"); }}>
              <Zap className="h-4 w-4 mr-2" />
              View plans
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
