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
import type { Project, Vendor, ProjectVendor, Boq, VendorCategory } from "@shared/schema";

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
  forceQuoteType?: "regular" | "unitrate";
  onSuccess?: () => void;
}

export default function QuoteImport({ onImportComplete, forceQuoteType, onSuccess }: QuoteImportProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [quoteType, setQuoteType] = useState<string>(forceQuoteType || "regular");
  const [unitRateSubtype, setUnitRateSubtype] = useState<string>("quote"); // "quote" or "comparative"
  const [vendorCategoryFilter, setVendorCategoryFilter] = useState<string>("all");
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

  // Fetch projects, vendors, and categories
  const { data: projects = [] } = useQuery({
    queryKey: ['/api/projects'],
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['/api/vendors'],
  });

  const { data: categories = [] } = useQuery<VendorCategory[]>({
    queryKey: ['/api/vendor-categories'],
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/quotes/import', {
        method: 'POST',
        credentials: 'include',
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
        const ct = response.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.details || error.error || 'Import failed');
        }
        throw new Error(`Upload failed (${response.status} ${response.statusText}). Please try again.`);
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
        setSelectedCategory("");
        setVendorCategoryFilter("all");
        setQuoteType(forceQuoteType || "regular");
        setUnitRateSubtype("quote");
        onImportComplete?.(result);
        onSuccess?.();
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
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resolutionData),
      });
      
      if (!response.ok) {
        const ct = response.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.details || error.error || 'Resolution failed');
        }
        throw new Error(`Upload failed (${response.status} ${response.statusText}). Please try again.`);
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
      setVendorCategoryFilter("all");
      setQuoteType(forceQuoteType || "regular");
      setUnitRateSubtype("quote");
      onImportComplete?.(result);
      onSuccess?.();
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
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/bmp',
      'image/tiff',
    ];
    const allowedExtensions = ['.xlsx', '.xls', '.csv', '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload an Excel (.xlsx, .xls), CSV, PDF, or image file (JPG, PNG, WebP).",
      });
      return;
    }
    
    if (file.size > 21 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "File size must be less than 21MB.",
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
    // Different validation for comparative statements vs regular quotes
    const isComparativeStatement = unitRateSubtype === "comparative" && (quoteType === 'unitrate' || forceQuoteType === 'unitrate');
    
    if (isComparativeStatement) {
      // Comparative statements require category instead of vendor
      if (!selectedFile || !selectedProject || !selectedCategory) {
        toast({
          variant: "destructive",
          title: "Missing information",
          description: "Please select a file, project, and category before importing.",
        });
        return;
      }
    } else {
      // Regular quotes require vendor
      if (!selectedFile || !selectedProject || !selectedVendor) {
        toast({
          variant: "destructive",
          title: "Missing information",
          description: "Please select a file, project, and vendor before importing.",
        });
        return;
      }
    }

    const formData = new FormData();
    formData.append('quoteFile', selectedFile);
    formData.append('projectId', selectedProject);
    formData.append('quoteType', quoteType);
    
    // For comparative statements, send categoryId; for regular quotes, send vendorId
    if (isComparativeStatement) {
      formData.append('categoryId', selectedCategory);
      const selectedCategoryData = categories.find(c => c.id === selectedCategory);
      if (selectedCategoryData) {
        formData.append('categoryName', selectedCategoryData.name);
      }
    } else {
      formData.append('vendorId', selectedVendor);
    }
    
    // Include unit rate subtype if importing unit rate quotes
    if (quoteType === 'unitrate' || forceQuoteType === 'unitrate') {
      formData.append('unitRateSubtype', unitRateSubtype);
    }

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

    const isComparativeStatement = unitRateSubtype === "comparative" && (quoteType === 'unitrate' || forceQuoteType === 'unitrate');

    const resolutionData: any = {
      tempFileId: conflictData.tempFileId,
      projectId: selectedProject,
      resolutionType,
      quotationName: resolutionType === "new_item" ? quotationName : undefined,
      itemCategory: resolutionType === "new_item" ? itemCategory : undefined,
      parentQuotationId: resolutionType === "option" ? selectedParentQuote : undefined,
    };
    
    // For comparative statements, send categoryId; for regular quotes, send vendorId
    if (isComparativeStatement) {
      resolutionData.categoryId = selectedCategory;
      const selectedCategoryData = categories.find(c => c.id === selectedCategory);
      if (selectedCategoryData) {
        resolutionData.categoryName = selectedCategoryData.name;
      }
    } else {
      resolutionData.vendorId = selectedVendor;
    }
    
    // Include unit rate subtype if importing unit rate quotes
    if (quoteType === 'unitrate' || forceQuoteType === 'unitrate') {
      resolutionData.unitRateSubtype = unitRateSubtype;
    }
    
    resolveConflictMutation.mutate(resolutionData);
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

  // Sorted + filtered vendors for selection
  const sortedVendors = [...(vendors as Vendor[])].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const filteredVendors = vendorCategoryFilter === "all"
    ? sortedVendors
    : sortedVendors.filter((v) => v.categoryId === vendorCategoryFilter);

  // Sorted categories
  const sortedCategories = [...(categories as VendorCategory[])].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

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
                    or click to browse for Excel (.xlsx, .xls), CSV, PDF, or image files (JPG, PNG, WebP)
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
                  accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.tif"
                  onChange={handleFileInputChange}
                  data-testid="input-file-hidden"
                />
              </div>
            )}
          </div>

          {/* Project Selection */}
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

          {/* Unit Rate Subtype Selection - only show when importing unit rate quotes */}
          {forceQuoteType === "unitrate" && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Unit Rate Type
              </label>
              <Select
                value={unitRateSubtype}
                onValueChange={setUnitRateSubtype}
                data-testid="select-unitrate-subtype"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose unit rate type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quote" data-testid="option-unitrate-quote">
                    Unit Rate Quote
                  </SelectItem>
                  <SelectItem value="comparative" data-testid="option-unitrate-comparative">
                    Unit Rate Comparative Statement
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Select the type of unit rate document you're uploading
              </p>
            </div>
          )}

          {/* Vendor/Category Selection - show after Unit Rate Type is selected */}
          <div className="space-y-3">
            {/* Show Category selection for comparative statements, Vendor for regular quotes */}
            {unitRateSubtype === "comparative" && forceQuoteType === "unitrate" ? (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select Category
                </label>
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                  data-testid="select-category"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedCategories.map((category) => (
                      <SelectItem
                        key={category.id}
                        value={category.id}
                        data-testid={`option-category-${category.id}`}
                      >
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  The comparative statement will compare multiple vendors in this category
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Filter by Category
                  </label>
                  <Select
                    value={vendorCategoryFilter}
                    onValueChange={(val) => {
                      setVendorCategoryFilter(val);
                      setSelectedVendor("");
                    }}
                    data-testid="select-vendor-category-filter"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {sortedCategories.map((category) => (
                        <SelectItem
                          key={category.id}
                          value={category.id}
                          data-testid={`option-filter-category-${category.id}`}
                        >
                          {category.name}
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
                      <SelectValue placeholder={filteredVendors.length === 0 ? (vendorCategoryFilter === "all" ? "No vendors found — add vendors first" : "No vendors in this category") : "Choose a vendor"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredVendors.length === 0 && vendorCategoryFilter === "all" ? (
                        <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                          No vendors in your organisation yet.{" "}
                          <a href="/vendors" className="underline text-foreground hover:text-primary">
                            Add vendors
                          </a>{" "}
                          to get started.
                        </div>
                      ) : (
                        filteredVendors.map((vendor) => (
                          <SelectItem
                            key={vendor.id}
                            value={vendor.id}
                            data-testid={`option-vendor-${vendor.id}`}
                          >
                            {vendor.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          {/* Quote Type Selection - only show if not forced */}
          {!forceQuoteType && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Quote Type
              </label>
              <Select
                value={quoteType}
                onValueChange={setQuoteType}
                data-testid="select-quote-type"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose quote type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular" data-testid="option-regular-quote">
                    Regular Quote (with total value)
                  </SelectItem>
                  <SelectItem value="unitrate" data-testid="option-unitrate-quote">
                    Unit Rate Quote (price list only)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Select "Unit Rate Quote" for price lists or rate cards without total values
              </p>
            </div>
          )}

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
            disabled={
              !selectedFile || 
              !selectedProject || 
              (unitRateSubtype === "comparative" && forceQuoteType === "unitrate" ? !selectedCategory : !selectedVendor) ||
              importMutation.isPending
            }
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