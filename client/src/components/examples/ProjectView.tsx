import ProjectView from '../ProjectView';

export default function ProjectViewExample() {
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
      }
    ],
    '2': [
      {
        id: '3',
        vendorName: 'BuildRight Corp',
        category: 'Civil',
        quotationValue: '120000.00',
        dateOfQuotation: '2024-03-05',
        status: 'Quoted' as const,
        quotationFile: 'buildright_quote.pdf'
      }
    ]
  };

  return (
    <div className="max-w-7xl">
      <ProjectView projects={mockProjects} quotations={mockQuotations} />
    </div>
  );
}