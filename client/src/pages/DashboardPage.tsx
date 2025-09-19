import Dashboard from '@/components/Dashboard';

export default function DashboardPage() {
  //todo: remove mock functionality
  const mockVendors = [
    {
      id: '1',
      name: 'ABC Construction',
      category: 'Civil',
      contactPerson: 'John Smith',
      phone: '+1 (555) 123-4567',
      email: 'john@abcconstruction.com',
      notes: 'Reliable contractor with 15+ years experience'
    },
    {
      id: '2',
      name: 'ElectroTech Solutions',
      category: 'Electrical',
      contactPerson: 'Sarah Johnson',
      phone: '+1 (555) 234-5678',
      email: 'sarah@electrotech.com',
      notes: 'Specialized in commercial electrical systems'
    },
    {
      id: '3',
      name: 'Bright Lights Co',
      category: 'Lighting',
      contactPerson: 'Mike Chen',
      phone: '+1 (555) 345-6789',
      email: 'mike@brightlights.com',
      notes: 'Custom lighting solutions and LED installations'
    },
    {
      id: '4',
      name: 'BuildRight Corp',
      category: 'Civil',
      contactPerson: 'Lisa Wong',
      phone: '+1 (555) 456-7890',
      email: 'lisa@buildright.com',
      notes: 'Large-scale construction and renovation projects'
    }
  ];

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
    }
  ];

  const mockRecentQuotations = [
    {
      id: '1',
      vendorName: 'ABC Construction',
      projectName: 'City Center Mall Renovation',
      quotationValue: '45000.00',
      status: 'Selected' as const,
      dateOfQuotation: '2024-01-15'
    },
    {
      id: '2',
      vendorName: 'ElectroTech Solutions',
      projectName: 'City Center Mall Renovation',
      quotationValue: '78500.00',
      status: 'Quoted' as const,
      dateOfQuotation: '2024-01-18'
    },
    {
      id: '3',
      vendorName: 'Bright Lights Co',
      projectName: 'Hospital Wing Construction',
      quotationValue: '32000.00',
      status: 'Quoted' as const,
      dateOfQuotation: '2024-03-05'
    },
    {
      id: '4',
      vendorName: 'BuildRight Corp',
      projectName: 'Office Complex Expansion',
      quotationValue: '67000.00',
      status: 'Selected' as const,
      dateOfQuotation: '2024-02-10'
    }
  ];

  const handleNavigate = (path: string) => {
    window.location.href = path;
  };

  return (
    <Dashboard 
      vendors={mockVendors}
      projects={mockProjects}
      recentQuotations={mockRecentQuotations}
      onNavigate={handleNavigate}
    />
  );
}