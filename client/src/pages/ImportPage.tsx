import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Upload } from "lucide-react";
import QuoteImport from '@/components/QuoteImport';

export default function ImportPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-6 space-y-6" data-testid="import-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-import-title">
            Import Quotes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload Excel or CSV files to import vendor quotations with detailed BOQ items
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Import Quote
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[480px] flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle>Import Quote</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <QuoteImport
              onImportComplete={(result) => {
                console.log('Import completed:', result);
                setOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
