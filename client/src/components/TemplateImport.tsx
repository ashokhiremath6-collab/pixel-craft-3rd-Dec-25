import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import type { VendorCategory, QuoteTemplate } from "@shared/schema";

interface TemplateField {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
}

interface ImportResult {
  message: string;
  template: QuoteTemplate;
  fields: TemplateField[];
  totalFields: number;
  errors: string[];
}

interface TemplateImportProps {
  onImportComplete?: (result: ImportResult) => void;
}

export default function TemplateImport({ onImportComplete }: TemplateImportProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch vendor categories for template association
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<VendorCategory[]>({
    queryKey: ['/api/vendor-categories/tree'],
  });

  // Helper function to flatten hierarchical category data if needed
  const flattenCategories = (data: any[]): VendorCategory[] => {
    const result: VendorCategory[] = [];
    
    const flatten = (items: any[], level = 0) => {
      for (const item of items) {
        if (item.id && item.name) {
          result.push({
            ...item,
            level: level
          });
        }
        if (item.children && Array.isArray(item.children)) {
          flatten(item.children, level + 1);
        }
      }
    };
    
    flatten(data);
    return result;
  };

  // Build category tree with proper nesting
  const buildCategoryTree = (categories: VendorCategory[]) => {
    const categoryMap = new Map();
    const rootCategories: any[] = [];
    
    // Create map of all categories
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });
    
    // Build tree structure
    categories.forEach(cat => {
      const categoryNode = categoryMap.get(cat.id);
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId).children.push(categoryNode);
      } else {
        rootCategories.push(categoryNode);
      }
    });
    
    return rootCategories;
  };

  // Flatten tree for select options
  const flattenCategoryTree = (tree: any[]): any[] => {
    const result: any[] = [];
    
    const addCategory = (category: any, depth = 0) => {
      const prefix = '  '.repeat(depth);
      result.push({
        ...category,
        displayName: `${prefix}${category.name}`,
        depth
      });
      
      if (category.children && category.children.length > 0) {
        category.children.forEach((child: any) => addCategory(child, depth + 1));
      }
    };
    
    tree.forEach(category => addCategory(category));
    return result;
  };

  const normalizedCategories = flattenCategories(categories);
  const categoryTree = buildCategoryTree(normalizedCategories);
  const flatCategories = flattenCategoryTree(categoryTree);

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/quote-templates/import', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Template import failed');
      }
      
      return response.json() as Promise<ImportResult>;
    },
    onSuccess: (result) => {
      toast({
        title: "Template imported successfully",
        description: `Created template "${result.template.name}" with ${result.totalFields} fields`,
      });
      setImportResult(result);
      setSelectedFile(null);
      setSelectedCategory("");
      onImportComplete?.(result);
      queryClient.invalidateQueries({ queryKey: ['/api/quote-templates'] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Import failed",
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
      'text/csv'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload an Excel (.xlsx, .xls) or CSV file.",
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
    if (!selectedFile || !selectedCategory) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please select a file and category before importing.",
      });
      return;
    }

    const formData = new FormData();
    formData.append('templateFile', selectedFile);
    formData.append('categoryId', selectedCategory);

    importMutation.mutate(formData);
  };

  const getFileIcon = (filename: string) => {
    return <FileText className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6" data-testid="template-import">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Template
          </CardTitle>
          <CardDescription>
            Upload Excel or CSV files to create quote templates with field definitions
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
                    Drag and drop your template file here
                  </p>
                  <p className="text-muted-foreground">
                    or click to browse for Excel (.xlsx, .xls) or CSV files
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
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileInputChange}
                  data-testid="input-file-hidden"
                />
              </div>
            )}
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Select Category
            </label>
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
              disabled={categoriesLoading}
              data-testid="select-category"
            >
              <SelectTrigger>
                <SelectValue placeholder={categoriesLoading ? "Loading categories..." : "Choose a category"} />
              </SelectTrigger>
              <SelectContent>
                {!categoriesLoading && flatCategories.map((category) => (
                  <SelectItem
                    key={category.id}
                    value={category.id}
                    data-testid={`option-category-${category.id}`}
                  >
                    {category.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Import Progress */}
          {importMutation.isPending && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span className="text-sm">Processing file and creating template...</span>
              </div>
              <Progress value={undefined} className="w-full" />
            </div>
          )}

          {/* Import Button */}
          <Button
            onClick={handleImport}
            disabled={!selectedFile || !selectedCategory || importMutation.isPending}
            className="w-full"
            data-testid="button-import-template"
          >
            {importMutation.isPending ? "Importing..." : "Import Template"}
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
              Template has been created with field definitions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary" data-testid="text-total-fields">
                  {importResult.totalFields}
                </p>
                <p className="text-sm text-muted-foreground">Template Fields</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-primary" data-testid="text-template-name">
                  {importResult.template.name}
                </p>
                <p className="text-sm text-muted-foreground">Template Name</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  ID: {importResult.template.id.slice(0, 8)}...
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

            {/* Template Fields Preview */}
            {importResult.fields.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Template Fields Preview</h4>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Required</TableHead>
                        <TableHead>Default Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.fields.slice(0, 10).map((field, index) => (
                        <TableRow key={index} data-testid={`row-field-${index}`}>
                          <TableCell className="font-medium">
                            {field.name}
                          </TableCell>
                          <TableCell>{field.type}</TableCell>
                          <TableCell>{field.required ? "Yes" : "No"}</TableCell>
                          <TableCell>{field.defaultValue || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {importResult.fields.length > 10 && (
                    <div className="p-3 text-center text-sm text-muted-foreground border-t">
                      ... and {importResult.fields.length - 10} more fields
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}