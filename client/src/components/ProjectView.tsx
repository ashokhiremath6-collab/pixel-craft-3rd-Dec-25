import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import QuotationRow from "./QuotationRow";
import { Search, Plus, Building2, Calendar, Edit, Eye, Trash2 } from "lucide-react";
import type { Project } from "@shared/schema";

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

interface ProjectViewProps {
  projects: ProjectData[];
  quotations: Record<string, QuotationData[]>; // projectId -> quotations
  onAddProject?: () => void;
  onEditProject?: (project: Project) => void;
  onViewProject?: (project: Project) => void;
  onDeleteProject?: (project: Project) => void;
}

export default function ProjectView({ projects, quotations, onAddProject, onEditProject, onViewProject, onDeleteProject }: ProjectViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    console.log('Search term:', value);
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProject(selectedProject === projectId ? null : projectId);
    console.log('Selected project:', projectId);
  };

  const handleAddProject = () => {
    console.log('Add project clicked');
    onAddProject?.();
  };

  // Filter projects
  const filteredProjects = projects.filter(project =>
    project.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedProjectData = selectedProject ? projects.find(p => p.id === selectedProject) : null;
  const selectedProjectQuotations = selectedProject ? quotations[selectedProject] || [] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-projects">Projects</h1>
          <p className="text-muted-foreground">
            View all vendors participating in each project
          </p>
        </div>
        <Button onClick={handleAddProject} data-testid="button-add-project">
          <Plus className="h-4 w-4 mr-2" />
          Add Project
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects or clients..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search-projects"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Projects ({filteredProjects.length})
          </h2>
          
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-2">Project Name</TableHead>
                    <TableHead className="py-2">Client</TableHead>
                    <TableHead className="py-2">Timeline</TableHead>
                    <TableHead className="py-2">Status</TableHead>
                    <TableHead className="py-2">Vendors</TableHead>
                    <TableHead className="py-2 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                  <TableBody>
                    {filteredProjects.map(project => {
                      const formatDate = (dateString: string | null) => {
                        if (!dateString) return 'Not set';
                        return new Date(dateString).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        });
                      };
                      
                      const isActive = () => {
                        if (!project.endDate) return true;
                        return new Date(project.endDate) > new Date();
                      };
                      
                      return (
                        <TableRow 
                          key={project.id}
                          className={`cursor-pointer transition-colors h-12 ${
                            selectedProject === project.id ? 'bg-muted/50' : ''
                          }`}
                          onClick={() => handleProjectSelect(project.id)}
                          data-testid={`project-item-${project.id}`}
                        >
                          <TableCell className="font-medium py-2">
                            <span data-testid="text-project-name" className="text-sm">
                              {project.projectName}
                            </span>
                          </TableCell>
                          <TableCell className="py-2">
                            <span data-testid="text-client-name" className="text-sm">
                              {project.clientName}
                            </span>
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span data-testid="text-start-date">{formatDate(project.startDate)}</span>
                              {project.endDate && (
                                <>
                                  <span>→</span>
                                  <span data-testid="text-end-date">{formatDate(project.endDate)}</span>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge 
                              variant={isActive() ? "default" : "secondary"}
                              data-testid="badge-project-status"
                              className="text-xs px-2 py-1"
                            >
                              {isActive() ? 'Active' : 'Completed'}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge variant="outline" data-testid="badge-vendor-count" className="text-xs px-2 py-1">
                              {project.vendorCount}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <div className="flex gap-1 justify-end">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onViewProject?.(project);
                                }}
                                data-testid="button-view-project"
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditProject?.(project);
                                }}
                                data-testid="button-edit-project"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteProject?.(project);
                                }}
                                data-testid="button-delete-project"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
            </CardContent>
          </Card>

          {filteredProjects.length === 0 && (
            <Card className="text-center py-8">
              <CardContent>
                <p className="text-muted-foreground" data-testid="text-no-projects">
                  No projects found matching your criteria.
                </p>
                <Button 
                  variant="outline" 
                  onClick={handleAddProject}
                  className="mt-4"
                  data-testid="button-add-first-project"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Project
                </Button>
              </CardContent>
            </Card>
          )}

          {filteredProjects.length > 0 && !selectedProject && (
            <Card className="text-center py-6 mt-4">
              <CardContent>
                <div className="flex flex-col items-center gap-3">
                  <Building2 className="h-10 w-10 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground" data-testid="text-select-project-title">
                      Select a Project
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid="text-select-project-subtitle">
                      Click on any project above to view participating vendors and their quotations
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Project Details */}
        <div className="space-y-4">
          {selectedProjectData ? (
            <>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">Vendors in Project</h2>
                <span className="text-sm text-muted-foreground" data-testid="text-selected-project">
                  {selectedProjectData.projectName}
                </span>
              </div>
              
              {selectedProjectQuotations.length > 0 ? (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Quote Value</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedProjectQuotations.map(quotation => (
                          <QuotationRow key={quotation.id} quotation={quotation} />
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : (
                <Card className="text-center py-8">
                  <CardContent>
                    <p className="text-muted-foreground" data-testid="text-no-quotations">
                      No vendors have submitted quotations for this project yet.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}