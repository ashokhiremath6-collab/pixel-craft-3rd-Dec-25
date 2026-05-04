import ProjectCard from '../ProjectCard';

export default function ProjectCardExample() {
  //todo: remove mock functionality
  const mockProject = {
    id: '1',
    projectName: 'City Center Mall Renovation',
    clientName: 'Metro Development Corp',
    clientEmail: 'metro@example.com',
    startDate: '2024-01-15',
    endDate: '2024-06-30',
    canvaLink: null,
    ganttChartLink: null,
    foyrNeoLink: null,
    orgId: null,
  };

  return (
    <div className="max-w-md">
      <ProjectCard project={mockProject} vendorCount={8} />
    </div>
  );
}