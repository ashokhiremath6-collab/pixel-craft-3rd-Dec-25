import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle, AlertCircle, Download, X } from "lucide-react";
import type { Project, Vendor, ProjectVendor, Boq } from "@shared/schema";

interface ImportResult {
  message: string;
  projectVendor: ProjectVendor;
  boqItems: Boq[];
  totalItems: number;
  totalValue: string;
  errors: string[];
}

interface ConflictData {
  conflictType: string;
  message: string;
  existingQuotes: {
    id: string;
    quotationName: string;
    quotationType: string;
    quotationValue: string;
    itemCategory?: string;
  }[];
  tempFileId: string;
  parsedDataPreview: {
    totalItems: number;
    estimatedValue: number;
  };
}

interface QuoteImportProps {
  onImportComplete?: (result: ImportResult) => void;
}

export default function QuoteImport({ onImportComplete }: QuoteImportProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [conflictData, setConflictData] = useState<ConflictData | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [resolutionType, setResolutionType] = useState<string>("");
  const [quotationName, setQuotationName] = useState<string>("");
  const [itemCategory, setItemCategory] = useState<string>("");
  const [selectedParentQuote, setSelectedParentQuote] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch projects and vendors
  const { data: projects = [] } = useQuery({
    queryKey: ['/api/projects'],
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['/api/vendors'],
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/quotes/import', {
        method: 'POST',
        body: formData,
      });
      
      if (response.status === 409) {
        // Handle conflict response
        const conflictResponse = await response.json() as ConflictData;
        setConflictData(conflictResponse);
        setShowConflictDialog(true);
        return null; // Don't treat this as an error
      }
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Import failed');
      }
      
      return response.json() as Promise<ImportResult>;
    },
    onSuccess: (result) => {
      if (result) {
        toast({
          title: "Quote imported successfully",
          description: `Imported ${result.totalItems} BOQ items with total value ₹${parseFloat(result.totalValue).toLocaleString('en-IN')}`,
        });
        setImportResult(result);
        setSelectedFile(null);
        setSelectedProject("");
        setSelectedVendor("");
        onImportComplete?.(result);
        queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
        queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
      }
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Import failed",
        description: error.message,
      });
    },
  });

  // Resolve conflict mutation
  const resolveConflictMutation = useMutation({
    mutationFn: async (resolutionData: {
      tempFileId: string;
      projectId: string;
      vendorId: string;
      resolutionType: string;
      quotationName?: string;
      itemCategory?: string;
      parentQuotationId?: string;
    }) => {
      const response = await fetch('/api/quotes/import/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resolutionData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Resolution failed');
      }
      
      return response.json() as Promise<ImportResult>;
    },
    onSuccess: (result) => {
      toast({
        title: "Quote imported successfully",
        description: `Imported ${result.totalItems} BOQ items with total value ₹${parseFloat(result.totalValue).toLocaleString('en-IN')}`,
      });
      setImportResult(result);
      setShowConflictDialog(false);
      setConflictData(null);
      setSelectedFile(null);
      setSelectedProject("");
      setSelectedVendor("");
      onImportComplete?.(result);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Resolution failed",
        description: error.message,
      });
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (file: File) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/pdf'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload an Excel (.xlsx, .xls), CSV, or PDF file.",
      });
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "File size must be less than 10MB.",
      });
      return;
    }
    
    setSelectedFile(file);
    setImportResult(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileChange(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = () => {
    if (!selectedFile || !selectedProject || !selectedVendor) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please select a file, project, and vendor before importing.",
      });
      return;
    }

    const formData = new FormData();
    formData.append('quoteFile', selectedFile);
    formData.append('projectId', selectedProject);
    formData.append('vendorId', selectedVendor);

    importMutation.mutate(formData);
  };

  const handleConflictResolution = () => {
    if (!conflictData || !resolutionType) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please select how you want to handle this quote.",
      });
      return;
    }

    if (resolutionType === "option" && !selectedParentQuote) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please select which existing quote this is an option for.",
      });
      return;
    }

    if (resolutionType === "new_item" && (!quotationName || !itemCategory)) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please provide a quotation name and item description for the new item.",
      });
      return;
    }

    resolveConflictMutation.mutate({
      tempFileId: conflictData.tempFileId,
      projectId: selectedProject,
      vendorId: selectedVendor,
      resolutionType,
      quotationName: resolutionType === "new_item" ? quotationName : undefined,
      itemCategory: resolutionType === "new_item" ? itemCategory : undefined,
      parentQuotationId: resolutionType === "option" ? selectedParentQuote : undefined,
    });
  };

  const handleCloseConflictDialog = () => {
    setShowConflictDialog(false);
    setConflictData(null);
    setResolutionType("");
    setQuotationName("");
    setItemCategory("");
    setSelectedParentQuote("");
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(parseFloat(value));
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return <FileText className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6" data-testid="quote-import">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Quote
          </CardTitle>
          <CardDescription>
            Upload Excel, CSV, or PDF files to import quotations with BOQ details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            data-testid="file-drop-zone"
          >
            {selectedFile ? (
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-2">
                  {getFileIcon(selectedFile.name)}
                  <div className="text-left">
                    <p className="font-medium" data-testid="selected-filename">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveFile}
                  data-testid="button-remove-file"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-lg font-medium">
                    Drag and drop your quote file here
                  </p>
                  <p className="text-muted-foreground">
                    or click to browse for Excel (.xlsx, .xls), CSV, or PDF files
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-browse-files"
                >
                  Browse Files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv,.pdf"
                  onChange={handleFileInputChange}
                  data-testid="input-file-hidden"
                />
              </div>
            )}
          </div>

          {/* Project and Vendor Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Project
              </label>
              <Select
                value={selectedProject}
                onValueChange={setSelectedProject}
                data-testid="select-project"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a project" />
                </SelectTrigger>
                <SelectContent>
                  {(projects as Project[]).map((project) => (
                    <SelectItem
                      key={project.id}
                      value={project.id}
                      data-testid={`option-project-${project.id}`}
                    >
                      {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Select Vendor
              </label>
              <Select
                value={selectedVendor}
                onValueChange={setSelectedVendor}
                data-testid="select-vendor"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {(vendors as Vendor[]).map((vendor) => (
                    <SelectItem
                      key={vendor.id}
                      value={vendor.id}
                      data-testid={`option-vendor-${vendor.id}`}
                    >
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Import Progress */}
          {importMutation.isPending && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span className="text-sm">Processing file and importing data...</span>
              </div>
              <Progress value={undefined} className="w-full" />
            </div>
          )}

          {/* Import Button */}
          <Button
            onClick={handleImport}
            disabled={!selectedFile || !selectedProject || !selectedVendor || importMutation.isPending}
            className="w-full"
            data-testid="button-import-quote"
          >
            {importMutation.isPending ? "Importing..." : "Import Quote"}
          </Button>
        </CardContent>
      </Card>

      {/* Import Results */}
      {importResult && (
        <Card data-testid="import-results">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Import Successful
            </CardTitle>
            <CardDescription>
              Quote has been imported with BOQ details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary" data-testid="text-total-items">
                  {importResult.totalItems}
                </p>
                <p className="text-sm text-muted-foreground">BOQ Items</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary" data-testid="text-total-value">
                  {formatCurrency(importResult.totalValue)}
                </p>
                <p className="text-sm text-muted-foreground">Total Value</p>
              </div>
              <div className="text-center">
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {importResult.projectVendor.status}
                </Badge>
                <p className="text-sm text-muted-foreground">Status</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  Quote ID: {importResult.projectVendor.id.slice(0, 8)}...
                </p>
                <p className="text-sm text-muted-foreground">Reference</p>
              </div>
            </div>

            {/* Error Messages */}
            {importResult.errors.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warnings:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {importResult.errors.map((error, index) => (
                      <li key={index} className="text-sm">{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

          </CardContent>
        </Card>
      )}

      {/* Conflict Resolution Dialog */}
      <Dialog open={showConflictDialog} onOpenChange={handleCloseConflictDialog}>
        <DialogContent className="sm:max-w-[600px]" data-testid="dialog-conflict-resolution">
          <DialogHeader>
            <DialogTitle>Quote Import Conflict</DialogTitle>
            <DialogDescription>
              {conflictData?.message}
            </DialogDescription>
          </DialogHeader>
          
          {conflictData && (
            <div className="space-y-6">
              {/* Existing Quotes */}
              <div>
                <h4 className="font-medium mb-3">Existing Quotes:</h4>
                <div className="space-y-2">
                  {conflictData.existingQuotes.map((quote) => (
                    <div key={quote.id} className="p-3 border rounded-lg bg-muted/50">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{quote.quotationName}</span>
                          {quote.itemCategory && (
                            <span className="text-sm text-muted-foreground ml-2">
                              ({quote.itemCategory})
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-medium">{formatCurrency(quote.quotationValue)}</span>
                          <div className="text-xs text-muted-foreground capitalize">
                            {quote.quotationType}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* New Quote Preview */}
              <div>
                <h4 className="font-medium mb-3">New Quote Preview:</h4>
                <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">
                      {conflictData.parsedDataPreview.totalItems} items
                    </span>
                    <span className="font-medium">
                      {conflictData.parsedDataPreview.estimatedValue > 0 
                        ? formatCurrency(conflictData.parsedDataPreview.estimatedValue.toString())
                        : "Value to be calculated"
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Resolution Options */}
              <div>
                <h4 className="font-medium mb-3">How should this quote be handled?</h4>
                <RadioGroup
                  value={resolutionType}
                  onValueChange={setResolutionType}
                  data-testid="radio-resolution-type"
                >
                  <div className="space-y-4">
                    <div className="flex items-start space-x-2">
                      <RadioGroupItem value="option" id="option" data-testid="radio-option" />
                      <div className="grid gap-1.5 leading-none">
                        <Label htmlFor="option">
                          This is an <strong>option</strong> for an existing item
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          The quote will appear grouped with the selected existing quote as an alternative option
                        </p>
                      </div>
                    </div>
                    
                    {resolutionType === "option" && (
                      <div className="ml-6 space-y-2">
                        <Label htmlFor="parent-quote">Select which existing quote this is an option for:</Label>
                        <Select
                          value={selectedParentQuote}
                          onValueChange={setSelectedParentQuote}
                          data-testid="select-parent-quote"
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose existing quote" />
                          </SelectTrigger>
                          <SelectContent>
                            {conflictData.existingQuotes.map((quote) => (
                              <SelectItem key={quote.id} value={quote.id}>
                                {quote.quotationName} - {formatCurrency(quote.quotationValue)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    <div className="flex items-start space-x-2">
                      <RadioGroupItem value="new_item" id="new_item" data-testid="radio-new-item" />
                      <div className="grid gap-1.5 leading-none">
                        <Label htmlFor="new_item">
                          This is a <strong>different item</strong> category
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          The quote will be displayed separately with its own description
                        </p>
                      </div>
                    </div>
                    
                    {resolutionType === "new_item" && (
                      <div className="ml-6 space-y-4">
                        <div>
                          <Label htmlFor="quotation-name">Quotation Name:</Label>
                          <Input
                            id="quotation-name"
                            value={quotationName}
                            onChange={(e) => setQuotationName(e.target.value)}
                            placeholder="e.g., 'Premium Option', 'Alternative Quote'"
                            data-testid="input-quotation-name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="item-category">Item Description:</Label>
                          <Input
                            id="item-category"
                            value={itemCategory}
                            onChange={(e) => setItemCategory(e.target.value)}
                            placeholder="e.g., 'Premium Fixtures', 'Electrical Package B'"
                            data-testid="input-item-category"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseConflictDialog}
              disabled={resolveConflictMutation.isPending}
              data-testid="button-cancel-conflict"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConflictResolution}
              disabled={resolveConflictMutation.isPending || !resolutionType}
              data-testid="button-resolve-conflict"
            >
              {resolveConflictMutation.isPending ? "Processing..." : "Import Quote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}