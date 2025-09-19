import VendorCard from '../VendorCard';

export default function VendorCardExample() {
  //todo: remove mock functionality
  const mockVendor = {
    id: '1',
    name: 'ABC Construction',
    category: 'Civil',
    contactPerson: 'John Smith',
    phone: '+1 (555) 123-4567',
    email: 'john@abcconstruction.com',
    notes: 'Reliable contractor with 15+ years experience'
  };

  return (
    <div className="max-w-md">
      <VendorCard vendor={mockVendor} />
    </div>
  );
}