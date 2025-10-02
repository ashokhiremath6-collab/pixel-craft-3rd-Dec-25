import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import type { Project } from "@shared/schema";

interface QuotationsResponse {
  projects: Project[];
  quotations: Record<string, any[]>;
}

export default function GanttChartPage() {
  const { data: quotationsData, isLoading } = useQuery<QuotationsResponse>({
    queryKey: ['/api/quotations'],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading projects...</div>
      </div>
    );
  }

  const projects = quotationsData?.projects || [];

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold" data-testid="heading-gantt-chart">
            Project Timeline
          </h1>
          <p className="text-muted-foreground">
            Visual timeline of all your projects
          </p>
        </div>
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No projects found. Create a project to see the timeline.
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

  const totalDays = Math.ceil((paddedMaxDate.getTime() - paddedMinDate.getTime()) / (1000 * 60 * 60 * 24));
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

  const getProjectBar = (project: Project) => {
    const start = project.startDate ? new Date(project.startDate) : paddedMinDate;
    const end = project.endDate ? new Date(project.endDate) : paddedMaxDate;
    
    const startPosition = ((start.getTime() - paddedMinDate.getTime()) / (paddedMaxDate.getTime() - paddedMinDate.getTime())) * 100;
    const endPosition = ((end.getTime() - paddedMinDate.getTime()) / (paddedMaxDate.getTime() - paddedMinDate.getTime())) * 100;
    const width = endPosition - startPosition;

    const isActive = !project.endDate || new Date(project.endDate) > today;

    return {
      left: `${startPosition}%`,
      width: `${width}%`,
      isActive
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold" data-testid="heading-gantt-chart">
          Project Timeline
        </h1>
        <p className="text-muted-foreground">
          Visual timeline of all your projects
        </p>
      </div>

      {/* Gantt Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Project Gantt Chart</span>
            <Badge variant="secondary">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Timeline header with month markers */}
            <div className="relative h-8 border-b">
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
                className="absolute top-8 bottom-0 w-px bg-primary z-10"
                style={{ left: `${todayPosition}%` }}
                title="Today"
              />
            )}

            {/* Projects */}
            <div className="space-y-4 relative">
              {projects.map((project) => {
                const bar = getProjectBar(project);
                return (
                  <div key={project.id} className="relative" data-testid={`gantt-project-${project.id}`}>
                    <div className="flex items-center mb-2">
                      <div className="w-48 flex-shrink-0 pr-4">
                        <div className="font-medium text-sm truncate" data-testid={`text-project-name-${project.id}`}>
                          {project.projectName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {project.clientName}
                        </div>
                      </div>
                      <div className="flex-1 relative h-10">
                        {/* Background grid */}
                        <div className="absolute inset-0 rounded-md bg-muted" />
                        
                        {/* Project bar */}
                        <div
                          className="absolute top-1 bottom-1 rounded-md transition-all hover-elevate cursor-pointer"
                          style={{
                            left: bar.left,
                            width: bar.width,
                            backgroundColor: bar.isActive 
                              ? 'hsl(var(--primary))' 
                              : 'hsl(var(--muted-foreground))',
                          }}
                          title={`${project.projectName}\n${project.startDate || 'No start'} - ${project.endDate || 'No end'}`}
                          data-testid={`gantt-bar-${project.id}`}
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
                      <div className="w-24 flex-shrink-0 pl-4">
                        <Badge variant={bar.isActive ? "default" : "secondary"} data-testid={`badge-status-${project.id}`}>
                          {bar.isActive ? 'Active' : 'Completed'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-primary" />
              <span>Active Projects</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted-foreground" />
              <span>Completed Projects</span>
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
