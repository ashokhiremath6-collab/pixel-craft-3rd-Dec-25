import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Mail, User, Building, Trash2, UserPlus, Briefcase } from "lucide-react";

const clientAccessSchema = z.object({
  projectId: z.string().min(1, "Please select a project"),
  clientEmail: z.string().email("Please enter a valid email address"),
  clientName: z.string().optional(),
  role: z.string().min(1, "Please select a role"),
});

type ClientAccessData = z.infer<typeof clientAccessSchema>;

const CLIENT_ROLES = [
  { value: "client", label: "Client" },
  { value: "architect", label: "Architect" },
  { value: "manager", label: "Project Manager" },
  { value: "contractor", label: "Contractor" },
  { value: "family", label: "Family Member" },
  { value: "consultant", label: "Consultant" },
  { value: "other", label: "Other" },
];

export default function ClientAccessPage() {
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['/api/projects'],
  });

  // Fetch clients for selected project
  const { data: projectClients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['/api/projects', selectedProjectId, 'clients'],
    enabled: !!selectedProjectId,
  });

  // Form for adding client access
  const form = useForm<ClientAccessData>({
    resolver: zodResolver(clientAccessSchema),
    defaultValues: {
      projectId: "",
      clientEmail: "",
      clientName: "",
      role: "",
    },
  });

  // Mutation for adding a client to a project
  const addClientMutation = useMutation({
    mutationFn: async (data: ClientAccessData) => {
      const response = await apiRequest('POST', `/api/projects/${data.projectId}/clients`, {
        clientEmail: data.clientEmail,
        clientName: data.clientName || null,
        role: data.role,
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Client access added",
        description: "Client has been granted access to the project.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', variables.projectId, 'clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      form.setValue("clientEmail", "");
      form.setValue("clientName", "");
      form.setValue("role", "");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add client access",
        description: error.message || "An error occurred while adding client access.",
        variant: "destructive",
      });
    },
  });

  // Mutation for removing a client from a project
  const removeClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      await apiRequest('DELETE', `/api/project-clients/${clientId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Client access removed",
        description: "Client access has been revoked successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedProjectId, 'clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove client access",
        description: error.message || "An error occurred while removing client access.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ClientAccessData) => {
    addClientMutation.mutate(data);
  };

  const handleRemoveClient = (clientId: string) => {
    if (confirm("Are you sure you want to remove this client's access?")) {
      removeClientMutation.mutate(clientId);
    }
  };

  if (projectsLoading) {
    return <div className="p-6">Loading projects...</div>;
  }

  // Get selected project details
  const selectedProject = projects.find((p: any) => p.id === selectedProjectId);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="heading-client-access">
          Client Access Management
        </h1>
        <p className="text-muted-foreground">
          Manage multiple client email addresses per project. Family members, architects, and other stakeholders can all have access.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Selection & Add Client Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add Client Access
            </CardTitle>
            <CardDescription>
              Select a project and add client details to grant access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="projectId">Project</Label>
                <Select 
                  value={form.watch("projectId")} 
                  onValueChange={(value) => {
                    form.setValue("projectId", value);
                    setSelectedProjectId(value);
                  }}
                >
                  <SelectTrigger data-testid="select-project">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project: any) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.projectName} - {project.clientName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.projectId && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.projectId.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientEmail">Client Email *</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  placeholder="client@company.com"
                  {...form.register("clientEmail")}
                  data-testid="input-client-email"
                />
                {form.formState.errors.clientEmail && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.clientEmail.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name (Optional)</Label>
                <Input
                  id="clientName"
                  type="text"
                  placeholder="John Doe"
                  {...form.register("clientName")}
                  data-testid="input-client-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select 
                  value={form.watch("role")} 
                  onValueChange={(value) => form.setValue("role", value)}
                >
                  <SelectTrigger data-testid="select-role">
                    <SelectValue placeholder="Select client role" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.role && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.role.message}
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                disabled={addClientMutation.isPending || !selectedProjectId}
                data-testid="button-add-client"
              >
                {addClientMutation.isPending ? "Adding..." : "Add Client"}
              </Button>
            </form>

            {/* Show clients for selected project */}
            {selectedProjectId && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">
                    Current Clients ({projectClients.length})
                  </Label>
                  {selectedProject && (
                    <p className="text-xs text-muted-foreground">
                      {selectedProject.projectName}
                    </p>
                  )}
                </div>
                {clientsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading clients...</p>
                ) : projectClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No clients assigned to this project.</p>
                ) : (
                  <div className="space-y-2">
                    {projectClients.map((client: any) => (
                      <div 
                        key={client.id} 
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`client-item-${client.id}`}
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium" data-testid={`text-client-email-${client.id}`}>
                              {client.clientEmail}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 ml-6">
                            {client.clientName && (
                              <>
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {client.clientName}
                                </span>
                              </>
                            )}
                            {client.role && (
                              <>
                                <Briefcase className="h-3 w-3 text-muted-foreground ml-2" />
                                <Badge variant="secondary" className="text-xs">
                                  {CLIENT_ROLES.find(r => r.value === client.role)?.label || client.role}
                                </Badge>
                              </>
                            )}
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveClient(client.id)}
                          disabled={removeClientMutation.isPending}
                          data-testid={`button-remove-client-${client.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* All Projects Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              All Projects
            </CardTitle>
            <CardDescription>
              Overview of all projects and their client count.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {projects.length === 0 ? (
                <p className="text-muted-foreground text-sm">No projects found.</p>
              ) : (
                projects.map((project: any) => (
                  <div 
                    key={project.id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover-elevate cursor-pointer"
                    onClick={() => {
                      form.setValue("projectId", project.id);
                      setSelectedProjectId(project.id);
                    }}
                    data-testid={`project-item-${project.id}`}
                  >
                    <div className="space-y-1">
                      <p className="font-medium" data-testid={`text-project-name-${project.id}`}>
                        {project.projectName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {project.clientName}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant={selectedProjectId === project.id ? "default" : "secondary"}
                        data-testid={`badge-client-count-${project.id}`}
                      >
                        <User className="h-3 w-3 mr-1" />
                        Click to view
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How Multi-Client Access Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-400">
              1
            </div>
            <div>
              <p className="font-medium">Multiple Clients Per Project</p>
              <p className="text-sm text-muted-foreground">
                Add unlimited client emails to each project. Specify their role (Client, Architect, Manager, etc.) and optionally their name.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-400">
              2
            </div>
            <div>
              <p className="font-medium">Designer Access</p>
              <p className="text-sm text-muted-foreground">
                Users with "designer" or "admin" role can view and manage all projects regardless of client assignments.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-400">
              3
            </div>
            <div>
              <p className="font-medium">Client Access</p>
              <p className="text-sm text-muted-foreground">
                Users with "client" role can view projects where their email is in the project's client list.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-400">
              4
            </div>
            <div>
              <p className="font-medium">Role-Based Organization</p>
              <p className="text-sm text-muted-foreground">
                Track who's who on your project - easily identify architects, family members, contractors, and other stakeholders at a glance.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
