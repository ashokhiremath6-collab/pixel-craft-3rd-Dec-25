import VendorList from '../VendorList';

export default function VendorListExample() {
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

  return (
    <div className="max-w-6xl">
      <VendorList vendors={mockVendors} />
    </div>
  );
}