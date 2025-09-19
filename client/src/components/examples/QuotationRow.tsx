import QuotationRow from '../QuotationRow';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function QuotationRowExample() {
  //todo: remove mock functionality
  const mockQuotations = [
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
  ];

  return (
    <div className="max-w-4xl">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendor</TableHead>
            <TableHead>Quote Value</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mockQuotations.map(quotation => (
            <QuotationRow key={quotation.id} quotation={quotation} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}