import ComparativeQuotes from '../ComparativeQuotes';

export default function ComparativeQuotesExample() {
  //todo: remove mock functionality
  const mockProjects = [
    {
      id: '1',
      projectName: 'City Center Mall Renovation',
      clientName: 'Metro Development Corp',
      startDate: '2024-01-15',
      endDate: '2024-06-30'
    },
    {
      id: '2', 
      projectName: 'Hospital Wing Construction',
      clientName: 'Regional Medical Center',
      startDate: '2024-03-01',
      endDate: null
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
        quotationFile: 'abc_quote.pdf'
      },
      {
        id: '2',
        vendorName: 'BuildRight Corp',
        category: 'Civil', 
        quotationValue: '52000.00',
        dateOfQuotation: '2024-01-16',
        status: 'Quoted' as const,
        quotationFile: 'buildright_quote.pdf'
      },
      {
        id: '3',
        vendorName: 'ElectroTech Solutions',
        category: 'Electrical',
        quotationValue: '78500.00',
        dateOfQuotation: '2024-01-18',
        status: 'Quoted' as const,
        quotationFile: 'electro_quote.pdf',
        isAboveAverage: true
      },
      {
        id: '4',
        vendorName: 'PowerPro Electric',
        category: 'Electrical',
        quotationValue: '65000.00',
        dateOfQuotation: '2024-01-20',
        status: 'Quoted' as const
      }
    ],
    '2': [
      {
        id: '5',
        vendorName: 'MegaBuild Inc',
        category: 'Civil',
        quotationValue: '120000.00',
        dateOfQuotation: '2024-03-05',
        status: 'Quoted' as const
      }
    ]
  };

  const mockCategories = [
    { id: '1', name: 'Civil', parentId: null, description: 'Civil construction', isActive: true },
    { id: '2', name: 'Electrical', parentId: null, description: 'Electrical systems', isActive: true },
  ];

  return (
    <div className="max-w-7xl">
      <ComparativeQuotes 
        projects={mockProjects} 
        categories={mockCategories}
        quotations={mockQuotations} 
      />
    </div>
  );
}