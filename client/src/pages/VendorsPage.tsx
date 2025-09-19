import VendorList from '@/components/VendorList';

export default function VendorsPage() {
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
    },
    {
      id: '5',
      name: 'PowerPro Electric',
      category: 'Electrical',
      contactPerson: 'David Martinez',
      phone: '+1 (555) 567-8901',
      email: 'david@powerpro.com',
      notes: 'Industrial electrical installations and maintenance'
    },
    {
      id: '6',
      name: 'Illumination Experts',
      category: 'Lighting',
      contactPerson: 'Rachel Green',
      phone: '+1 (555) 678-9012',
      email: 'rachel@illuminationexperts.com',
      notes: 'High-end architectural lighting design'
    },
    {
      id: '7',
      name: 'Urban Builders LLC',
      category: 'Civil',
      contactPerson: 'Tom Wilson',
      phone: '+1 (555) 789-0123',
      email: 'tom@urbanbuilders.com',
      notes: 'Sustainable construction practices specialist'
    },
    {
      id: '8',
      name: 'Smart Systems Co',
      category: 'Electrical',
      contactPerson: 'Anna Kim',
      phone: '+1 (555) 890-1234',
      email: 'anna@smartsystems.com',
      notes: 'Smart building automation and controls'
    }
  ];

  const handleAddVendor = () => {
    console.log('Add vendor - would open form modal');
  };

  const handleEditVendor = (vendor: any) => {
    console.log('Edit vendor:', vendor.name);
  };

  const handleDeleteVendor = (vendorId: string) => {
    console.log('Delete vendor:', vendorId);
  };

  return (
    <VendorList 
      vendors={mockVendors}
      onAddVendor={handleAddVendor}
      onEditVendor={handleEditVendor}
      onDeleteVendor={handleDeleteVendor}
    />
  );
}