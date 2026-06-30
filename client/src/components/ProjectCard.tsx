import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Building, Edit, Eye, Trash2, ExternalLink, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Project } from "@shared/schema";

interface ProjectCardProps {
  project: Project;
  vendorCount?: number;
  onEdit?: (project: Project) => void;
  onView?: (project: Project) => void;
  onDelete?: (project: Project) => void;
}

export default function ProjectCard({ project, vendorCount = 0, onEdit, onView, onDelete }: ProjectCardProps) {
  const handleEdit = () => {
    console.log('Edit project clicked:', project.id);
    onEdit?.(project);
  };

  const handleView = () => {
    console.log('View project clicked:', project.id);
    onView?.(project);
  };

  const handleDelete = () => {
    console.log('Delete project clicked:', project.id);
    onDelete?.(project);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  const isActive = () => {
    if (!project.endDate) return true;
    return new Date(project.endDate) > new Date();
  };

  return (
    <Card className="hover-elevate" data-testid={`card-project-${project.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <div className="flex-1">
          <CardTitle className="text-lg font-semibold" data-testid="text-project-name">
            {project.projectName}
          </CardTitle>
          <div className="flex items-center gap-2 mt-1">
            <Badge 
              variant={isActive() ? "default" : "secondary"}
              data-testid="badge-project-status"
            >
              {isActive() ? 'Active' : 'Completed'}
            </Badge>
            {vendorCount > 0 && (
              <Badge variant="outline" data-testid="badge-vendor-count">
                {vendorCount} vendors
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={handleView}
            data-testid="button-view-project"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={handleEdit}
            data-testid="button-edit-project"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" data-testid="button-menu-project">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleDelete}
                data-testid="button-delete-project"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building className="h-4 w-4" />
          <span data-testid="text-client-name">{project.clientName}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span data-testid="text-start-date">{formatDate(project.startDate)}</span>
          {project.endDate && (
            <>
              <span>→</span>
              <span data-testid="text-end-date">{formatDate(project.endDate)}</span>
            </>
          )}
        </div>
        {project.canvaLink && (
          <div className="flex items-center gap-2">
            <a
              href={project.canvaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium"
              data-testid="link-canva"
            >
              <ExternalLink className="h-4 w-4" />
              <span>View Canva Design</span>
            </a>
          </div>
        )}
        {project.foyrNeoLink && (
          <div className="flex items-center gap-2">
            <a
              href={project.foyrNeoLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium"
              data-testid="link-foyr-neo"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Open Foyr Neo</span>
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}