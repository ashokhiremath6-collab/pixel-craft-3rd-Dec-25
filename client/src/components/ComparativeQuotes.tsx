import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import StatusBadge from "./StatusBadge";
import QuoteDetailModal from "./QuoteDetailModal";
import { TrendingUp, TrendingDown, AlertTriangle, BarChart3, ChevronRight, Download, FileSpreadsheet, FileText, Loader2, Eye, Trash2, Edit2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project, VendorCategory } from "@shared/schema";
import { formatCurrencyCompact, formatVendorNameWithCategory } from "@/lib/currencyUtils";

interface QuotationData {
  id: string;
  vendorName: string;
  category: string;
  quotationName: string; // "Main Quote", "Option A", "Kitchen Cabinets", etc.
  quotationType: "item" | "option"; // Type of quotation
  parentQuotationId?: string | null; // For grouping options under main items
  itemCategory?: string | null; // For organizing different items in folders
  quotationValue: string | null | undefined;
  dateOfQuotation: string | null | undefined;
  status: "Quoted" | "Selected" | "Rejected";
  quotationFile?: string;
  notes?: string;
  isAboveAverage?: boolean;
  isNegotiated?: boolean; // Mark as final negotiated quote
  unitRateSubtype?: string | null; // "quote" or "comparative" for unit rate quotes
}

interface CategoryWithChildren extends VendorCategory {
  children: CategoryWithChildren[];
  level: number;
}

interface ComparativeQuotesProps {
  projects: Project[];
  categories: VendorCategory[];
  quotations: Record<string, QuotationData[]>; // projectId -> quotations
  onStatusChange?: (quotationId: string, status: "Quoted" | "Selected" | "Rejected") => void;
  hideValueColumns?: boolean; // Hide quote value and variance columns
}

export default function ComparativeQuotes({ projects, categories, quotations, onStatusChange, hideValueColumns = false }: ComparativeQuotesProps) {
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{ vendorName: string; projectName: string } | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<QuotationData | null>(null);
  const [editFormData, setEditFormData] = useState({
    quotationName: "",
    quotationValue: "",
    dateOfQuotation: "",
    notes: "",
    isNegotiated: false
  });
  const { toast } = useToast();

  const handleProjectFilter = (projectId: string) => {
    setSelectedProject(projectId);
    console.log('Filter by project:', projectId);
  };

  const handleCategoryFilter = (category: string) => {
    setSelectedCategory(category);
    console.log('Filter by category:', category);
  };

  const handleQuoteClick = (quotation: QuotationData, projectName: string) => {
    setSelectedQuoteId(quotation.id);
    setModalData({
      vendorName: quotation.vendorName,
      projectName: projectName
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedQuoteId(null);
    setModalData(null);
  };

  const handleEditQuote = (quotation: QuotationData) => {
    setEditingQuote(quotation);
    setEditFormData({
      quotationName: quotation.quotationName || "Main Quote",
      quotationValue: quotation.quotationValue || "",
      dateOfQuotation: quotation.dateOfQuotation || "",
      notes: quotation.notes || "",
      isNegotiated: quotation.isNegotiated || false
    });
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingQuote(null);
    setEditFormData({ quotationName: "", quotationValue: "", dateOfQuotation: "", notes: "", isNegotiated: false });
  };

  // Update quote mutation
  const updateQuoteMutation = useMutation({
    mutationFn: async (data: { quoteId: string; updates: any }) => {
      const response = await apiRequest('PUT', `/api/project-vendors/${data.quoteId}`, data.updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/project-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vendors-with-projects'] });
      handleCloseEditModal();
      toast({
        title: "Success",
        description: "Quote updated successfully",
      });
    },
    onError: (error) => {
      console.error('Failed to update quote:', error);
      toast({
        title: "Error",
        description: "Failed to update quote. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSaveEdit = () => {
    if (!editingQuote) return;
    
    updateQuoteMutation.mutate({
      quoteId: editingQuote.id,
      updates: {
        quotationName: editFormData.quotationName || "Main Quote",
        quotationValue: editFormData.quotationValue || null,
        dateOfQuotation: editFormData.dateOfQuotation || null,
        notes: editFormData.notes || null,
        isNegotiated: editFormData.isNegotiated
      }
    });
  };

  // Handle quote deletion
  const handleDeleteQuote = async (quotationId: string, vendorName: string) => {
    try {
      await apiRequest('DELETE', `/api/project-vendors/${quotationId}`);
      
      // Invalidate the quotations cache to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
      
      toast({
        title: "Quote deleted",
        description: `Quote from ${vendorName} has been deleted successfully.`,
      });
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast({
        title: "Error",
        description: "Failed to delete quote. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle individual quote export
  const handleIndividualQuoteExport = async (quotation: QuotationData, group: any, format: 'csv' | 'excel' | 'pdf') => {
    try {
      setIsExporting(true);

      // Create export data for individual quote
      const exportData = {
        quotation: {
          id: quotation.id,
          vendorName: quotation.vendorName,
          category: quotation.category,
          quotationValue: quotation.quotationValue || '',
          dateOfQuotation: quotation.dateOfQuotation || '',
          status: quotation.status,
          quotationFile: quotation.quotationFile || '',
          notes: quotation.notes || '',
          projectName: group.projectName,
          projectId: group.projectId
        },
        metadata: {
          exportDate: new Date().toISOString(),
          exportType: 'individual_quote'
        }
      };

      const response = await fetch(`/api/quotes/export/individual/${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to export quote as ${format.toUpperCase()}`);
      }

      // Get filename from response headers or create default
      const contentDisposition = response.headers.get('Content-Disposition');
      const getFileExtension = () => {
        switch (format) {
          case 'excel': return 'xlsx';
          case 'pdf': return 'pdf';
          case 'csv': 
          default: return 'csv';
        }
      };
      const filename = contentDisposition?.match(/filename="?([^"]+)"?/)?.[1] || 
        `quote_${quotation.vendorName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.${getFileExtension()}`;

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Quote Exported Successfully",
        description: `Individual quote from ${quotation.vendorName} exported as ${format.toUpperCase()}`,
      });

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export quote",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Get all quotations
  const allQuotations = Object.entries(quotations).flatMap(([projectId, quots]) =>
    quots.map(q => ({
      ...q,
      projectId,
      projectName: projects.find(p => p.id === projectId)?.projectName || 'Unknown'
    }))
  );

  // Helper function to build category tree structure
  const buildCategoryTree = (categories: VendorCategory[]): CategoryWithChildren[] => {
    const categoryMap = new Map<string, CategoryWithChildren>();
    const rootCategories: CategoryWithChildren[] = [];

    // First pass: create all categories with children arrays
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [], level: 0 });
    });

    // Second pass: organize into tree structure and set levels
    categories.forEach(cat => {
      const categoryWithChildren = categoryMap.get(cat.id)!;
      
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          categoryWithChildren.level = parent.level + 1;
          parent.children.push(categoryWithChildren);
        }
      } else {
        rootCategories.push(categoryWithChildren);
      }
    });

    return rootCategories;
  };

  // Helper function to flatten tree for easy lookup
  const flattenCategoryTree = (tree: CategoryWithChildren[]): CategoryWithChildren[] => {
    const result: CategoryWithChildren[] = [];
    
    const traverse = (nodes: CategoryWithChildren[]) => {
      nodes.forEach(node => {
        result.push(node);
        traverse(node.children);
      });
    };
    
    traverse(tree);
    return result;
  };

  // Build category tree and flatten for select options
  const categoryTree = buildCategoryTree(categories);
  const flatCategories = flattenCategoryTree(categoryTree);

  // Create a map of categoryId to category for easy lookup
  const categoryMap = categories.reduce((acc, cat) => {
    acc[cat.id] = cat;
    return acc;
  }, {} as Record<string, VendorCategory>);

  // Helper function to get all descendant category IDs
  const getCategoryWithDescendants = (categoryId: string): string[] => {
    const result = [categoryId];
    const category = flatCategories.find(cat => cat.id === categoryId);
    
    if (category) {
      const addDescendants = (cat: CategoryWithChildren) => {
        cat.children.forEach(child => {
          result.push(child.id);
          addDescendants(child);
        });
      };
      addDescendants(category);
    }
    
    return result;
  };

  // Filter quotations with hierarchical category support
  const filteredQuotations = allQuotations.filter(quotation => {
    const matchesProject = selectedProject === "all" || quotation.projectId === selectedProject;
    
    // For hierarchical filtering, include quotations from selected category and all its descendants
    let matchesCategory = selectedCategory === "all";
    if (!matchesCategory && selectedCategory !== "all") {
      const categoryIds = getCategoryWithDescendants(selectedCategory);
      // Try to find a matching category by name (for backward compatibility with existing quotation data)
      const categoryNames = categoryIds.map(id => categoryMap[id]?.name).filter(Boolean);
      matchesCategory = categoryNames.includes(quotation.category);
    }
    
    return matchesProject && matchesCategory;
  });

  // Separate regular quotes from comparative statements
  const regularQuotes = filteredQuotations.filter(q => q.unitRateSubtype !== 'comparative');
  const comparativeStatements = filteredQuotations.filter(q => q.unitRateSubtype === 'comparative');

  // Group regular quotes by category and project
  const groupedData = regularQuotes.reduce((acc, quotation) => {
    const key = `${quotation.category}-${quotation.projectId}`;
    if (!acc[key]) {
      acc[key] = {
        category: quotation.category,
        projectName: quotation.projectName,
        projectId: quotation.projectId,
        quotations: []
      };
    }
    acc[key].quotations.push(quotation);
    return acc;
  }, {} as Record<string, {
    category: string;
    projectName: string;
    projectId: string;
    quotations: typeof filteredQuotations;
  }>);

  // Group comparative statements by category and project
  const groupedComparativeData = comparativeStatements.reduce((acc, quotation) => {
    const key = `${quotation.category}-${quotation.projectId}`;
    if (!acc[key]) {
      acc[key] = {
        category: quotation.category,
        projectName: quotation.projectName,
        projectId: quotation.projectId,
        quotations: []
      };
    }
    acc[key].quotations.push(quotation);
    return acc;
  }, {} as Record<string, {
    category: string;
    projectName: string;
    projectId: string;
    quotations: typeof filteredQuotations;
  }>);

  const formatCurrency = (value: string) => {
    // Check if this is a unit rates quote (marked with -1)
    if (value === '-1' || value === '-1.00') {
      return <span className="text-muted-foreground italic">unit rates</span>;
    }
    return formatCurrencyCompact(value);
  };

  const getLowestQuote = (categoryQuotations: typeof filteredQuotations) => {
    if (categoryQuotations.length === 0) return 0;
    // Exclude unit rates quotes (-1) and zero/null values from lowest quote calculation
    const validQuotes = categoryQuotations.filter(q => {
      const value = q.quotationValue ? parseFloat(q.quotationValue) : 0;
      return value > 0; // Exclude -1 (unit rates), 0, and invalid values
    });
    if (validQuotes.length === 0) return 0;
    const lowestValue = Math.min(...validQuotes.map(q => {
      const value = q.quotationValue ? parseFloat(q.quotationValue) : 0;
      return value;
    }));
    return lowestValue;
  };

  const getQuoteVariance = (value: string | null | undefined, lowestQuote: number) => {
    if (!value || lowestQuote === 0) return 0;
    const quotationValue = parseFloat(value);
    if (isNaN(quotationValue) || quotationValue < 0) return 0; // Skip unit rates (-1)
    // Calculate variance relative to lowest quote (lowest will be 0%, others positive)
    return ((quotationValue - lowestQuote) / lowestQuote) * 100;
  };

  // Export functions
  const handleExportCSV = () => {
    exportQuotes('csv');
  };

  const handleExportExcel = () => {
    exportQuotes('excel');
  };

  const exportQuotes = async (format: 'csv' | 'excel') => {
    if (isExporting) return; // Prevent multiple simultaneous exports
    
    setIsExporting(true);
    
    try {
      // Check if there's data to export
      if (filteredQuotations.length === 0) {
        toast({
          variant: "destructive",
          title: "No data to export",
          description: "Please adjust your filters to include quotations for export."
        });
        return;
      }

      const exportData = {
        filters: {
          project: selectedProject,
          category: selectedCategory
        },
        quotations: filteredQuotations,
        groupedData: Object.entries(groupedData).map(([key, group]) => ({
          key,
          category: group.category,
          projectName: group.projectName,
          projectId: group.projectId,
          quotations: group.quotations,
          lowestQuote: getLowestQuote(group.quotations)
        }))
      };

      // Call API endpoint for export
      const response = await fetch(`/api/quotes/export/${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Export failed: ${response.statusText}`);
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `quotes_export_${timestamp}.${format === 'excel' ? 'xlsx' : format}`;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Show success message
      toast({
        title: "Export successful",
        description: `${format.toUpperCase()} file downloaded successfully with ${filteredQuotations.length} quotations.`
      });

    } catch (error) {
      console.error('Export failed:', error);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred during export."
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold" data-testid="heading-comparative-quotes">
              Comparative Quotes
            </h1>
            <p className="text-sm text-muted-foreground">
              Compare vendor quotations side-by-side by project and category
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {Object.keys(groupedData).length} comparison groups
              </span>
            </div>
            
            {/* Export Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={isExporting || filteredQuotations.length === 0}
                  data-testid="button-export-quotes"
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {isExporting ? "Exporting..." : "Export"}
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={handleExportCSV} 
                disabled={isExporting || filteredQuotations.length === 0}
                data-testid="menu-item-export-csv"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleExportExcel} 
                disabled={isExporting || filteredQuotations.length === 0}
                data-testid="menu-item-export-excel"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem 
                disabled={true}
                data-testid="menu-item-export-pdf"
                className="opacity-50"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export as PDF (Coming Soon)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium mb-1 block">Project</label>
              <Select value={selectedProject} onValueChange={handleProjectFilter}>
                <SelectTrigger data-testid="select-project-filter" className="h-8">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1">
              <label className="text-xs font-medium mb-1 block">Category</label>
              <Select value={selectedCategory} onValueChange={handleCategoryFilter}>
                <SelectTrigger data-testid="select-category-filter" className="h-8">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {flatCategories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center">
                        {category.level > 0 && (
                          <span style={{ marginLeft: `${category.level * 16}px` }} className="text-muted-foreground">
                            <ChevronRight className="h-3 w-3 inline mr-1" />
                          </span>
                        )}
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Groups */}
      {Object.entries(groupedData)
        .sort((a, b) => a[1].category.localeCompare(b[1].category, undefined, { sensitivity: 'base' }))
        .map(([key, group]) => {
        const lowestQuote = getLowestQuote(group.quotations);
        const sortedQuotations = [...group.quotations].sort((a, b) => 
          {
            const aValue = a.quotationValue ? parseFloat(a.quotationValue) : 0;
            const bValue = b.quotationValue ? parseFloat(b.quotationValue) : 0;
            return aValue - bValue;
          }
        );

        return (
          <Card key={key} className="" data-testid={`comparison-group-${key}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {group.category} - {group.projectName}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 overflow-x-auto">
              <Table className="table-fixed min-w-[800px]">
                <colgroup>
                  <col className={hideValueColumns ? "w-[35%]" : "w-[25%]"} />
                  {!hideValueColumns && (
                    <>
                      <col className="w-[18%]" />
                      <col className="w-[12%]" />
                    </>
                  )}
                  <col className="w-[15%]" />
                  <col className="w-[12%]" />
                  <col className={hideValueColumns ? "w-[38%]" : "w-[18%]"} />
                </colgroup>
                <TableHeader>
                  <TableRow className="h-8">
                    <TableHead className="text-xs font-medium">Vendor</TableHead>
                    {!hideValueColumns && (
                      <>
                        <TableHead className="text-xs font-medium">Quote Value</TableHead>
                        <TableHead className="text-xs font-medium">Variance</TableHead>
                      </>
                    )}
                    <TableHead className="text-xs font-medium">Date</TableHead>
                    <TableHead className="text-xs font-medium">Status</TableHead>
                    <TableHead className="text-xs font-medium">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    // Group quotations by vendor to support multiple quotes per vendor
                    const vendorGroups = sortedQuotations.reduce((acc, quotation) => {
                      if (!acc[quotation.vendorName]) {
                        acc[quotation.vendorName] = [];
                      }
                      acc[quotation.vendorName].push(quotation);
                      return acc;
                    }, {} as Record<string, typeof sortedQuotations>);

                    // Sort vendors alphabetically
                    const sortedVendorEntries = Object.entries(vendorGroups).sort((a, b) => 
                      a[0].localeCompare(b[0], undefined, { sensitivity: 'base' })
                    );

                    return sortedVendorEntries.flatMap(([vendorName, vendorQuotations], vendorIndex) => {
                      // Sort vendor quotations: items first, then options
                      const sortedVendorQuotations = vendorQuotations.sort((a, b) => {
                        if (a.quotationType !== b.quotationType) {
                          return a.quotationType === "item" ? -1 : 1;
                        }
                        const aName = a.quotationName || "Main Quote";
                        const bName = b.quotationName || "Main Quote";
                        return aName.localeCompare(bName);
                      });

                      return sortedVendorQuotations.map((quotation, quotationIndex) => {
                        const globalIndex = sortedQuotations.findIndex(q => q.id === quotation.id);
                        const variance = getQuoteVariance(quotation.quotationValue, lowestQuote);
                        // Only mark as lowest if it has a valid value and equals the lowest quote
                        const quotationValue = quotation.quotationValue ? parseFloat(quotation.quotationValue) : 0;
                        const isLowest = quotationValue > 0 && quotationValue === lowestQuote;
                        const isFirstQuoteForVendor = quotationIndex === 0;
                        
                        return (
                          <TableRow 
                            key={quotation.id}
                            className={`h-10 ${quotation.status === "Selected" ? "bg-green-50 dark:bg-green-900/10" : ""}`}
                            data-testid={`quotation-row-${quotation.id}`}
                          >
                            <TableCell className="font-medium text-sm py-2" data-testid="text-vendor-name">
                              <div className="flex flex-col">
                                {/* Show vendor name only for first quotation */}
                                {isFirstQuoteForVendor && (
                                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                                    {quotation.vendorName}
                                  </div>
                                )}
                                {/* Show quotation name and type */}
                                <div className={`text-xs ${isFirstQuoteForVendor ? 'text-gray-600 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300 ml-2'} flex items-center gap-1`}>
                                  {quotation.quotationType === "option" && <span className="text-orange-500">└</span>}
                                  <span className="font-medium">
                                    {quotation.unitRateSubtype === 'comparative' 
                                      ? 'Unit rate comparative statement' 
                                      : quotation.quotationName}
                                  </span>
                                  {quotation.quotationType === "option" && (
                                    <Badge variant="outline" className="text-xs px-1 py-0">Option</Badge>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                        
                        {!hideValueColumns && (
                          <>
                            <TableCell className="py-2" data-testid="text-quotation-value">
                              <div className="flex items-center gap-1">
                                <span className="font-mono font-semibold text-sm">
                                  {(() => {
                                    const quotationValue = quotation.quotationValue || '';
                                    const numericValue = parseFloat(quotationValue);
                                    return !isNaN(numericValue) && numericValue > 0 ? formatCurrency(quotationValue) : <span className="text-muted-foreground">No total</span>;
                                  })()}
                                </span>
                                {isLowest && (
                                  <Badge variant="outline" className="text-xs text-green-600 border-green-200 px-1">
                                    Lowest
                                  </Badge>
                                )}
                                {quotation.isNegotiated && (
                                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 px-1">
                                    Negotiated
                                  </Badge>
                                )}
                                {quotation.isAboveAverage && (
                                  <AlertTriangle className="h-3 w-3 text-orange-500" />
                                )}
                              </div>
                            </TableCell>
                            
                            <TableCell className="py-2" data-testid="text-variance">
                              <div className="flex items-center gap-1">
                                {variance === 0 ? (
                                  <>
                                    <span className="text-xs text-green-600 font-medium">0.0%</span>
                                  </>
                                ) : (
                                  <>
                                    <TrendingUp className="h-3 w-3 text-red-500" />
                                    <span className="text-xs text-red-600">
                                      +{variance.toFixed(1)}%
                                    </span>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </>
                        )}
                        
                        <TableCell className="py-2 text-xs" data-testid="text-quotation-date">
                          {quotation.dateOfQuotation ? new Date(quotation.dateOfQuotation).toLocaleDateString() : <span className="text-muted-foreground">No date</span>}
                        </TableCell>
                        
                        <TableCell className="py-2" data-testid="cell-status">
                          <StatusBadge status={quotation.status} />
                        </TableCell>
                        
                        <TableCell className="py-2" data-testid="cell-actions">
                          <div className="flex gap-0.5">
                            <Button
                              size="icon"
                              className="h-6 w-6"
                              variant="ghost"
                              onClick={() => handleQuoteClick(quotation, group.projectName)}
                              data-testid={`button-view-quote-${quotation.id}`}
                              title="View detailed quote breakdown"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              className="h-6 w-6"
                              variant="ghost"
                              onClick={() => handleEditQuote(quotation)}
                              data-testid={`button-edit-quote-${quotation.id}`}
                              title="Edit quote values"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            {quotation.status === "Quoted" && (
                              <>
                                <Button
                                  size="sm"
                                  className="h-6 text-xs px-2"
                                  variant="outline"
                                  onClick={() => onStatusChange?.(quotation.id, "Selected")}
                                  data-testid="button-select-vendor"
                                >
                                  Select
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-6 text-xs px-2"
                                  variant="outline"
                                  onClick={() => onStatusChange?.(quotation.id, "Rejected")}
                                  data-testid="button-reject-vendor"
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {quotation.status === "Selected" && (
                              <Button
                                size="sm"
                                className="h-6 text-xs px-2"
                                variant="outline"
                                onClick={() => onStatusChange?.(quotation.id, "Quoted")}
                                data-testid="button-unselect-vendor"
                              >
                                Unselect
                              </Button>
                            )}
                            {quotation.status === "Rejected" && (
                              <Button
                                size="sm"
                                className="h-6 text-xs px-2"
                                variant="outline"
                                onClick={() => onStatusChange?.(quotation.id, "Quoted")}
                                data-testid="button-unreject-vendor"
                              >
                                Unreject
                              </Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700 h-6 w-6"
                                  data-testid={`button-delete-quote-${quotation.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Quote</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the quote from {quotation.vendorName}? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteQuote(quotation.id, quotation.vendorName)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  className="h-6 w-6"
                                  variant="ghost"
                                  data-testid={`button-export-quote-${quotation.id}`}
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  onClick={() => handleQuoteClick(quotation, group.projectName)}
                                  data-testid={`view-quote-${quotation.id}`}
                                  className="text-xs"
                                >
                                  <Eye className="mr-2 h-3 w-3" />
                                  View Quote
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleIndividualQuoteExport(quotation, group, 'pdf')}
                                  data-testid={`export-quote-pdf-${quotation.id}`}
                                  className="text-xs"
                                >
                                  <FileText className="mr-2 h-3 w-3" />
                                  Export as PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleIndividualQuoteExport(quotation, group, 'excel')}
                                  data-testid={`export-quote-excel-${quotation.id}`}
                                  className="text-xs"
                                >
                                  <FileSpreadsheet className="mr-2 h-3 w-3" />
                                  Export as Excel
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleIndividualQuoteExport(quotation, group, 'csv')}
                                  data-testid={`export-quote-csv-${quotation.id}`}
                                  className="text-xs"
                                >
                                  <FileText className="mr-2 h-3 w-3" />
                                  Export as CSV
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                        );
                      });
                    });
                  })()}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {/* Comparative Statements Section */}
      {Object.keys(groupedComparativeData).length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-4">Unit Rate Comparative Statements</h2>
          {Object.entries(groupedComparativeData)
            .sort((a, b) => a[1].category.localeCompare(b[1].category, undefined, { sensitivity: 'base' }))
            .map(([key, group]) => {
            const lowestQuote = getLowestQuote(group.quotations);
            const sortedQuotations = [...group.quotations].sort((a, b) => 
              {
                const aValue = a.quotationValue ? parseFloat(a.quotationValue) : 0;
                const bValue = b.quotationValue ? parseFloat(b.quotationValue) : 0;
                return aValue - bValue;
              }
            );

            return (
              <Card key={key} className="mb-4" data-testid={`comparison-group-comparative-${key}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {group.category} - {group.projectName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 overflow-x-auto">
                  <Table className="table-fixed min-w-[800px]">
                    <colgroup>
                      <col className={hideValueColumns ? "w-[35%]" : "w-[25%]"} />
                      {!hideValueColumns && (
                        <>
                          <col className="w-[18%]" />
                          <col className="w-[12%]" />
                        </>
                      )}
                      <col className="w-[15%]" />
                      <col className="w-[12%]" />
                      <col className={hideValueColumns ? "w-[38%]" : "w-[18%]"} />
                    </colgroup>
                    <TableHeader>
                      <TableRow className="h-8">
                        <TableHead className="text-xs font-medium">Vendor</TableHead>
                        {!hideValueColumns && (
                          <>
                            <TableHead className="text-xs font-medium">Quote Value</TableHead>
                            <TableHead className="text-xs font-medium">Variance</TableHead>
                          </>
                        )}
                        <TableHead className="text-xs font-medium">Date</TableHead>
                        <TableHead className="text-xs font-medium">Status</TableHead>
                        <TableHead className="text-xs font-medium">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        // Group quotations by vendor to support multiple quotes per vendor
                        const vendorGroups = sortedQuotations.reduce((acc, quotation) => {
                          if (!acc[quotation.vendorName]) {
                            acc[quotation.vendorName] = [];
                          }
                          acc[quotation.vendorName].push(quotation);
                          return acc;
                        }, {} as Record<string, typeof sortedQuotations>);

                        // Sort vendors alphabetically
                        const sortedVendorEntries = Object.entries(vendorGroups).sort((a, b) => 
                          a[0].localeCompare(b[0], undefined, { sensitivity: 'base' })
                        );

                        return sortedVendorEntries.flatMap(([vendorName, vendorQuotations], vendorIndex) => {
                          // Sort vendor quotations: items first, then options
                          const sortedVendorQuotations = vendorQuotations.sort((a, b) => {
                            if (a.quotationType !== b.quotationType) {
                              return a.quotationType === "item" ? -1 : 1;
                            }
                            const aName = a.quotationName || "Main Quote";
                            const bName = b.quotationName || "Main Quote";
                            return aName.localeCompare(bName);
                          });

                          return sortedVendorQuotations.map((quotation, quotationIndex) => {
                            const globalIndex = sortedQuotations.findIndex(q => q.id === quotation.id);
                            const variance = getQuoteVariance(quotation.quotationValue, lowestQuote);
                            // Only mark as lowest if it has a valid value and equals the lowest quote
                            const quotationValue = quotation.quotationValue ? parseFloat(quotation.quotationValue) : 0;
                            const isLowest = quotationValue > 0 && quotationValue === lowestQuote;
                            const isFirstQuoteForVendor = quotationIndex === 0;
                            
                            return (
                              <TableRow 
                                key={quotation.id}
                                className={`h-10 ${quotation.status === "Selected" ? "bg-green-50 dark:bg-green-900/10" : ""}`}
                                data-testid={`quotation-row-${quotation.id}`}
                              >
                                <TableCell className="font-medium text-sm py-2" data-testid="text-vendor-name">
                                  <div className="flex flex-col">
                                    {/* Show vendor name only for first quotation */}
                                    {isFirstQuoteForVendor && (
                                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                                        {quotation.vendorName}
                                      </div>
                                    )}
                                    {/* Show quotation name and type */}
                                    <div className={`text-xs ${isFirstQuoteForVendor ? 'text-gray-600 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300 ml-2'} flex items-center gap-1`}>
                                      {quotation.quotationType === "option" && <span className="text-orange-500">└</span>}
                                      <span className="font-medium">
                                        Unit rate comparative statement
                                      </span>
                                      {quotation.quotationType === "option" && (
                                        <Badge variant="outline" className="text-xs px-1 py-0">Option</Badge>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                            
                            {!hideValueColumns && (
                              <>
                                <TableCell className="py-2" data-testid="text-quotation-value">
                                  <div className="flex items-center gap-1">
                                    <span className="font-mono font-semibold text-sm">
                                      {(() => {
                                        const quotationValue = quotation.quotationValue || '';
                                        const numericValue = parseFloat(quotationValue);
                                        return !isNaN(numericValue) && numericValue > 0 ? formatCurrency(quotationValue) : <span className="text-muted-foreground">No total</span>;
                                      })()}
                                    </span>
                                    {isLowest && (
                                      <Badge variant="outline" className="text-xs text-green-600 border-green-200 px-1">
                                        Lowest
                                      </Badge>
                                    )}
                                    {quotation.isNegotiated && (
                                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 px-1">
                                        Negotiated
                                      </Badge>
                                    )}
                                    {quotation.isAboveAverage && (
                                      <AlertTriangle className="h-3 w-3 text-orange-500" />
                                    )}
                                  </div>
                                </TableCell>
                                
                                <TableCell className="py-2" data-testid="text-variance">
                                  <div className="flex items-center gap-1">
                                    {variance === 0 ? (
                                      <>
                                        <span className="text-xs text-green-600 font-medium">0.0%</span>
                                      </>
                                    ) : (
                                      <>
                                        <TrendingUp className="h-3 w-3 text-red-500" />
                                        <span className="text-xs text-red-600">
                                          +{variance.toFixed(1)}%
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </>
                            )}
                            
                            <TableCell className="py-2 text-xs" data-testid="text-quotation-date">
                              {quotation.dateOfQuotation ? new Date(quotation.dateOfQuotation).toLocaleDateString() : <span className="text-muted-foreground">No date</span>}
                            </TableCell>
                            
                            <TableCell className="py-2" data-testid="cell-status">
                              <StatusBadge status={quotation.status} />
                            </TableCell>
                            
                            <TableCell className="py-2" data-testid="cell-actions">
                              <div className="flex gap-0.5">
                                <Button
                                  size="icon"
                                  className="h-6 w-6"
                                  variant="ghost"
                                  onClick={() => handleQuoteClick(quotation, group.projectName)}
                                  data-testid={`button-view-quote-${quotation.id}`}
                                  title="View detailed quote breakdown"
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  className="h-6 w-6"
                                  variant="ghost"
                                  onClick={() => handleEditQuote(quotation)}
                                  data-testid={`button-edit-quote-${quotation.id}`}
                                  title="Edit quote values"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                {quotation.status === "Quoted" && (
                                  <>
                                    <Button
                                      size="sm"
                                      className="h-6 text-xs px-2"
                                      variant="outline"
                                      onClick={() => onStatusChange?.(quotation.id, "Selected")}
                                      data-testid="button-select-vendor"
                                    >
                                      Select
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-6 text-xs px-2"
                                      variant="outline"
                                      onClick={() => onStatusChange?.(quotation.id, "Rejected")}
                                      data-testid="button-reject-vendor"
                                    >
                                      Reject
                                    </Button>
                                  </>
                                )}
                                {quotation.status === "Selected" && (
                                  <Button
                                    size="sm"
                                    className="h-6 text-xs px-2"
                                    variant="outline"
                                    onClick={() => onStatusChange?.(quotation.id, "Quoted")}
                                    data-testid="button-unselect-vendor"
                                  >
                                    Unselect
                                  </Button>
                                )}
                                {quotation.status === "Rejected" && (
                                  <Button
                                    size="sm"
                                    className="h-6 text-xs px-2"
                                    variant="outline"
                                    onClick={() => onStatusChange?.(quotation.id, "Quoted")}
                                    data-testid="button-unreject-vendor"
                                  >
                                    Unreject
                                  </Button>
                                )}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="text-red-600 hover:text-red-700 h-6 w-6"
                                      data-testid={`button-delete-quote-${quotation.id}`}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Quote</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete the quote from {quotation.vendorName}? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteQuote(quotation.id, quotation.vendorName)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="icon"
                                      className="h-6 w-6"
                                      variant="ghost"
                                      data-testid={`button-export-quote-${quotation.id}`}
                                    >
                                      <Download className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem 
                                      onClick={() => handleQuoteClick(quotation, group.projectName)}
                                      data-testid={`view-quote-${quotation.id}`}
                                      className="text-xs"
                                    >
                                      <Eye className="mr-2 h-3 w-3" />
                                      View Quote
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => handleIndividualQuoteExport(quotation, group, 'pdf')}
                                      data-testid={`export-quote-pdf-${quotation.id}`}
                                      className="text-xs"
                                    >
                                      <FileText className="mr-2 h-3 w-3" />
                                      Export as PDF
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => handleIndividualQuoteExport(quotation, group, 'excel')}
                                      data-testid={`export-quote-excel-${quotation.id}`}
                                      className="text-xs"
                                    >
                                      <FileSpreadsheet className="mr-2 h-3 w-3" />
                                      Export as Excel
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => handleIndividualQuoteExport(quotation, group, 'csv')}
                                      data-testid={`export-quote-csv-${quotation.id}`}
                                      className="text-xs"
                                    >
                                      <FileText className="mr-2 h-3 w-3" />
                                      Export as CSV
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                            );
                          });
                        });
                      })()}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {Object.keys(groupedData).length === 0 && Object.keys(groupedComparativeData).length === 0 && (
        <Card className="text-center py-8">
          <CardContent>
            <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground" data-testid="text-no-comparisons">
              No quotations available for comparison with the selected filters.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quote Detail Modal */}
      <QuoteDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        quoteId={selectedQuoteId}
        vendorName={modalData?.vendorName}
        projectName={modalData?.projectName}
      />

      {/* Edit Quote Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={handleCloseEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Quote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="quotationName">Quote Title</Label>
              <Input
                id="quotationName"
                type="text"
                placeholder="e.g., Main Quote, Option A, Kitchen Cabinets"
                value={editFormData.quotationName}
                onChange={(e) => setEditFormData(prev => ({ ...prev, quotationName: e.target.value }))}
                data-testid="input-edit-quotation-name"
              />
            </div>
            <div>
              <Label htmlFor="quotationValue">Quotation Value</Label>
              <Input
                id="quotationValue"
                type="number"
                step="0.01"
                placeholder="Enter amount"
                value={editFormData.quotationValue}
                onChange={(e) => setEditFormData(prev => ({ ...prev, quotationValue: e.target.value }))}
                data-testid="input-edit-quotation-value"
              />
            </div>
            <div>
              <Label htmlFor="dateOfQuotation">Date of Quotation</Label>
              <Input
                id="dateOfQuotation"
                type="date"
                value={editFormData.dateOfQuotation}
                onChange={(e) => setEditFormData(prev => ({ ...prev, dateOfQuotation: e.target.value }))}
                data-testid="input-edit-quotation-date"
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add any additional notes"
                value={editFormData.notes}
                onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                data-testid="textarea-edit-notes"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isNegotiated"
                checked={editFormData.isNegotiated}
                onCheckedChange={(checked) => setEditFormData(prev => ({ ...prev, isNegotiated: checked as boolean }))}
                data-testid="checkbox-is-negotiated"
              />
              <Label htmlFor="isNegotiated" className="text-sm font-normal cursor-pointer">
                Mark as final negotiated quote
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCloseEditModal} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={updateQuoteMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateQuoteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}