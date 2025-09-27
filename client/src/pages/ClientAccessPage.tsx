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
import { Mail, User, Building } from "lucide-react";

const clientAccessSchema = z.object({
  projectId: z.string().min(1, "Please select a project"),
  clientEmail: z.string().email("Please enter a valid email address"),
});

type ClientAccessData = z.infer<typeof clientAccessSchema>;

export default function ClientAccessPage() {
  const { toast } = useToast();

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['/api/projects'],
  });

  // Form for assigning client access
  const form = useForm<ClientAccessData>({
    resolver: zodResolver(clientAccessSchema),
    defaultValues: {
      projectId: "",
      clientEmail: "",
    },
  });

  // Mutation for updating project client email
  const updateProjectMutation = useMutation({
    mutationFn: async (data: ClientAccessData) => {
      const response = await apiRequest('PUT', `/api/projects/${data.projectId}`, {
        clientEmail: data.clientEmail
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Client access updated",
        description: "Client email has been assigned to the project successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update client access",
        description: error.message || "An error occurred while updating client access.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ClientAccessData) => {
    updateProjectMutation.mutate(data);
  };

  if (projectsLoading) {
    return <div className="p-6">Loading projects...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="heading-client-access">
          Client Access Management
        </h1>
        <p className="text-muted-foreground">
          Assign client email addresses to projects to control access. Clients can only view projects assigned to their email.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assignment Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Assign Client Access
            </CardTitle>
            <CardDescription>
              Select a project and enter the client's email address to grant access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="projectId">Project</Label>
                <Select 
                  value={form.watch("projectId")} 
                  onValueChange={(value) => form.setValue("projectId", value)}
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
                <Label htmlFor="clientEmail">Client Email</Label>
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

              <Button 
                type="submit" 
                disabled={updateProjectMutation.isPending}
                data-testid="button-assign-access"
              >
                {updateProjectMutation.isPending ? "Assigning..." : "Assign Access"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Current Assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Current Client Assignments
            </CardTitle>
            <CardDescription>
              View all projects and their assigned client email addresses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {projects.length === 0 ? (
                <p className="text-muted-foreground text-sm">No projects found.</p>
              ) : (
                projects.map((project: any) => (
                  <div key={project.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <p className="font-medium" data-testid={`text-project-name-${project.id}`}>
                        {project.projectName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {project.clientName}
                      </p>
                    </div>
                    <div className="text-right">
                      {project.clientEmail ? (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span data-testid={`text-client-email-${project.id}`}>
                            {project.clientEmail}
                          </span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" data-testid={`text-no-client-${project.id}`}>
                          No client assigned
                        </Badge>
                      )}
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
          <CardTitle>How Client Access Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-400">
              1
            </div>
            <div>
              <p className="font-medium">Designer Access</p>
              <p className="text-sm text-muted-foreground">
                Users with "designer" role can view and manage all projects regardless of client assignments.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-400">
              2
            </div>
            <div>
              <p className="font-medium">Client Access</p>
              <p className="text-sm text-muted-foreground">
                Users with "client" role can only view projects where their email matches the assigned client email.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-400">
              3
            </div>
            <div>
              <p className="font-medium">Email Assignment</p>
              <p className="text-sm text-muted-foreground">
                Assign client email addresses to projects using the form above. Clients can register using their assigned email.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}