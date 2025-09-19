import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ProjectCard from "./ProjectCard";
import QuotationRow from "./QuotationRow";
import { Search, Plus, Building2 } from "lucide-react";
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
}

export default function ProjectView({ projects, quotations, onAddProject, onEditProject, onViewProject }: ProjectViewProps) {
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
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {filteredProjects.map(project => (
              <div 
                key={project.id} 
                className={`cursor-pointer transition-colors ${
                  selectedProject === project.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => handleProjectSelect(project.id)}
                data-testid={`project-item-${project.id}`}
              >
                <ProjectCard
                  project={project}
                  vendorCount={project.vendorCount}
                  onEdit={onEditProject}
                  onView={onViewProject}
                />
              </div>
            ))}
          </div>

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
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground" data-testid="text-select-project">
                  Select a project to view participating vendors
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}