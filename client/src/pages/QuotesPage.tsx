import ComparativeQuotes from '@/components/ComparativeQuotes';
import { useQuery } from '@tanstack/react-query';
import type { VendorCategory } from '@shared/schema';

export default function QuotesPage() {
  // Fetch vendor categories for hierarchical filtering
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/vendor-categories/tree'],
  });

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
    },
    {
      id: '3',
      projectName: 'Office Complex Expansion',
      clientName: 'TechCorp Industries',
      startDate: '2024-02-01',
      endDate: '2024-08-15'
    },
    {
      id: '4',
      projectName: 'Residential Tower Development',
      clientName: 'Skyline Properties',
      startDate: '2024-04-01',
      endDate: '2024-12-31'
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
        status: 'Rejected' as const
      },
      {
        id: '5',
        vendorName: 'Bright Lights Co',
        category: 'Lighting',
        quotationValue: '32000.00',
        dateOfQuotation: '2024-01-22',
        status: 'Quoted' as const,
        quotationFile: 'lights_quote.pdf'
      },
      {
        id: '6',
        vendorName: 'Illumination Experts',
        category: 'Lighting',
        quotationValue: '35500.00',
        dateOfQuotation: '2024-01-24',
        status: 'Selected' as const
      }
    ],
    '2': [
      {
        id: '7',
        vendorName: 'Urban Builders LLC',
        category: 'Civil',
        quotationValue: '120000.00',
        dateOfQuotation: '2024-03-05',
        status: 'Quoted' as const
      },
      {
        id: '8',
        vendorName: 'BuildRight Corp',
        category: 'Civil',
        quotationValue: '135000.00',
        dateOfQuotation: '2024-03-06',
        status: 'Quoted' as const,
        isAboveAverage: true
      },
      {
        id: '9',
        vendorName: 'Smart Systems Co',
        category: 'Electrical',
        quotationValue: '95000.00',
        dateOfQuotation: '2024-03-08',
        status: 'Selected' as const
      }
    ],
    '3': [
      {
        id: '10',
        vendorName: 'ABC Construction',
        category: 'Civil',
        quotationValue: '67000.00',
        dateOfQuotation: '2024-02-10',
        status: 'Selected' as const
      }
    ]
  };

  const handleStatusChange = (quotationId: string, status: "Quoted" | "Selected" | "Rejected") => {
    console.log('Status change for quotation:', quotationId, 'to:', status);
  };

  return (
    <ComparativeQuotes 
      projects={mockProjects}
      categories={categories as VendorCategory[]}
      quotations={mockQuotations}
      onStatusChange={handleStatusChange}
    />
  );
}