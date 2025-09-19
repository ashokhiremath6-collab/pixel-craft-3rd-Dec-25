import QuoteImport from '@/components/QuoteImport';

export default function ImportPage() {
  const handleImportComplete = (result: any) => {
    console.log('Import completed:', result);
    // Could redirect to comparative quotes or show success message
  };

  return (
    <div className="p-6 space-y-6" data-testid="import-page">
      <div>
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-import-title">
          Import Quotes
        </h1>
        <p className="text-muted-foreground mt-2">
          Upload Excel or CSV files to import vendor quotations with detailed BOQ items
        </p>
      </div>
      
      <QuoteImport onImportComplete={handleImportComplete} />
    </div>
  );
}