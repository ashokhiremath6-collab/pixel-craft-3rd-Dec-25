import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ProjectView from '@/components/ProjectView';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

interface QuotationsResponse {
  projects: Project[];
  quotations: Record<string, QuotationData[]>;
}

export default function ProjectsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch quotations data which includes projects and their vendor relationships
  const { data: quotationsData, isLoading } = useQuery<QuotationsResponse>({
    queryKey: ['/api/quotations'],
  });

  // Transform projects to include vendor counts
  const projectsWithCounts: ProjectData[] = (quotationsData?.projects || []).map(project => ({
    ...project,
    vendorCount: quotationsData?.quotations[project.id]?.length || 0
  }));

  const handleAddProject = () => {
    console.log('Add project - would open form modal');
    toast({
      title: "Add Project",
      description: "Add project functionality will be implemented next",
    });
  };

  const handleEditProject = (project: Project) => {
    console.log('Edit project:', project.projectName);
    toast({
      title: "Edit Project",
      description: "Edit project functionality will be implemented next",
    });
  };

  const handleViewProject = (project: Project) => {
    console.log('View project details:', project.projectName);
    toast({
      title: "View Project",
      description: "View project details functionality will be implemented next",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading projects...</div>
      </div>
    );
  }

  return (
    <ProjectView 
      projects={projectsWithCounts}
      quotations={quotationsData?.quotations || {}}
      onAddProject={handleAddProject}
      onEditProject={handleEditProject}
      onViewProject={handleViewProject}
    />
  );
}