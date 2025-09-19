import ProjectView from '@/components/ProjectView';

export default function ProjectsPage() {
  //todo: remove mock functionality
  const mockProjects = [
    {
      id: '1',
      projectName: 'City Center Mall Renovation',
      clientName: 'Metro Development Corp',
      startDate: '2024-01-15',
      endDate: '2024-06-30',
      vendorCount: 8
    },
    {
      id: '2',
      projectName: 'Hospital Wing Construction',
      clientName: 'Regional Medical Center',
      startDate: '2024-03-01',
      endDate: null,
      vendorCount: 12
    },
    {
      id: '3',
      projectName: 'Office Complex Expansion',
      clientName: 'TechCorp Industries',
      startDate: '2024-02-01',
      endDate: '2024-08-15',
      vendorCount: 6
    },
    {
      id: '4',
      projectName: 'Residential Tower Development',
      clientName: 'Skyline Properties',
      startDate: '2024-04-01',
      endDate: '2024-12-31',
      vendorCount: 15
    }
  ];

  const mockQuotations = {
    '1': [
      {
        id: '1',
        vendorName: 'ABC Construction',
        category: 'Civil',
        quotationValue: '45000.00',
        dateOfQuotation: '2024-01-15',
        status: 'Selected' as const,
        quotationFile: 'abc_quote.pdf',
        notes: 'Best value for money'
      },
      {
        id: '2',
        vendorName: 'ElectroTech Solutions',
        category: 'Electrical',
        quotationValue: '78500.00',
        dateOfQuotation: '2024-01-18',
        status: 'Quoted' as const,
        quotationFile: 'electro_quote.pdf',
        isAboveAverage: true
      },
      {
        id: '3',
        vendorName: 'Bright Lights Co',
        category: 'Lighting',
        quotationValue: '32000.00',
        dateOfQuotation: '2024-01-20',
        status: 'Quoted' as const,
        quotationFile: 'lights_quote.pdf'
      }
    ],
    '2': [
      {
        id: '4',
        vendorName: 'BuildRight Corp',
        category: 'Civil',
        quotationValue: '120000.00',
        dateOfQuotation: '2024-03-05',
        status: 'Quoted' as const,
        quotationFile: 'buildright_quote.pdf'
      },
      {
        id: '5',
        vendorName: 'PowerPro Electric',
        category: 'Electrical',
        quotationValue: '95000.00',
        dateOfQuotation: '2024-03-08',
        status: 'Selected' as const,
        quotationFile: 'powerpro_quote.pdf'
      }
    ],
    '3': [
      {
        id: '6',
        vendorName: 'Urban Builders LLC',
        category: 'Civil',
        quotationValue: '67000.00',
        dateOfQuotation: '2024-02-10',
        status: 'Selected' as const,
        quotationFile: 'urban_quote.pdf'
      }
    ]
  };

  const handleAddProject = () => {
    console.log('Add project - would open form modal');
  };

  const handleEditProject = (project: any) => {
    console.log('Edit project:', project.projectName);
  };

  const handleViewProject = (project: any) => {
    console.log('View project details:', project.projectName);
  };

  return (
    <ProjectView 
      projects={mockProjects}
      quotations={mockQuotations}
      onAddProject={handleAddProject}
      onEditProject={handleEditProject}
      onViewProject={handleViewProject}
    />
  );
}