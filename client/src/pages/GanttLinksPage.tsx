import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ExternalLink, Edit2, Save, X, Link as LinkIcon } from "lucide-react";
import type { Project } from "@shared/schema";

export default function GanttLinksPage() {
  const { toast } = useToast();
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editedLink, setEditedLink] = useState("");

  // Fetch all projects
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Mutation to update Gantt chart link
  const updateLinkMutation = useMutation({
    mutationFn: async ({ projectId, ganttChartLink }: { projectId: string; ganttChartLink: string }) => {
      return apiRequest("PATCH", `/api/projects/${projectId}`, { ganttChartLink });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Link updated",
        description: "Gantt chart link has been successfully updated.",
      });
      setEditingProjectId(null);
      setEditedLink("");
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update Gantt chart link",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (project: Project) => {
    setEditingProjectId(project.id);
    setEditedLink(project.ganttChartLink || "");
  };

  const handleSave = (projectId: string) => {
    updateLinkMutation.mutate({ projectId, ganttChartLink: editedLink });
  };

  const handleCancel = () => {
    setEditingProjectId(null);
    setEditedLink("");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-gantt-links">Gantt Chart Links</h1>
          <p className="text-muted-foreground">Manage external Gantt chart links for projects</p>
        </div>
        <div className="text-center py-8 text-muted-foreground">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="heading-gantt-links">Gantt Chart Links</h1>
        <p className="text-muted-foreground">Manage external Gantt chart links for projects</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Project Gantt Chart Links
          </CardTitle>
          <CardDescription>
            Add or update external Gantt chart links for each project (e.g., OnlineGantt, Google Sheets, MS Project Online)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <LinkIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No projects found. Create a project first.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => {
                const isEditing = editingProjectId === project.id;
                
                return (
                  <div
                    key={project.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-md border"
                    data-testid={`project-link-row-${project.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium mb-1" data-testid={`text-project-name-${project.id}`}>
                        {project.projectName}
                      </p>
                      <p className="text-sm text-muted-foreground mb-2">
                        {project.clientName}
                      </p>
                      
                      {isEditing ? (
                        <div className="space-y-2">
                          <Label htmlFor="gantt-link">Gantt Chart URL</Label>
                          <Input
                            id="gantt-link"
                            type="url"
                            placeholder="https://www.onlinegantt.com/#/public/..."
                            value={editedLink}
                            onChange={(e) => setEditedLink(e.target.value)}
                            data-testid={`input-gantt-link-${project.id}`}
                          />
                        </div>
                      ) : (
                        <>
                          {project.ganttChartLink ? (
                            <a
                              href={project.ganttChartLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline flex items-center gap-1"
                              data-testid={`link-gantt-${project.id}`}
                            >
                              <ExternalLink className="h-3 w-3" />
                              {project.ganttChartLink}
                            </a>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">No Gantt chart link set</p>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleSave(project.id)}
                            disabled={updateLinkMutation.isPending}
                            data-testid={`button-save-link-${project.id}`}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            {updateLinkMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancel}
                            disabled={updateLinkMutation.isPending}
                            data-testid={`button-cancel-link-${project.id}`}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(project)}
                          data-testid={`button-edit-link-${project.id}`}
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          {project.ganttChartLink ? "Edit Link" : "Add Link"}
                        </Button>
                      )}
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
