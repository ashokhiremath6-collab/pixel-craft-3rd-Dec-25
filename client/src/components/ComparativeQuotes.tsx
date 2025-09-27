import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "./StatusBadge";
import QuoteDetailModal from "./QuoteDetailModal";
import { TrendingUp, TrendingDown, AlertTriangle, BarChart3, ChevronRight, Download, FileSpreadsheet, FileText, Loader2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Project, VendorCategory } from "@shared/schema";
import { formatCurrencyCompact, formatVendorNameWithCategory } from "@/lib/currencyUtils";

interface QuotationData {
  id: string;
  vendorName: string;
  category: string;
  quotationValue: string | null | undefined;
  dateOfQuotation: string | null | undefined;
  status: "Quoted" | "Selected" | "Rejected";
  quotationFile?: string;
  notes?: string;
  isAboveAverage?: boolean;
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
}

export default function ComparativeQuotes({ projects, categories, quotations, onStatusChange }: ComparativeQuotesProps) {
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{ vendorName: string; projectName: string } | null>(null);
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

  // Group by category and project
  const groupedData = filteredQuotations.reduce((acc, quotation) => {
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
    return formatCurrencyCompact(value);
  };

  const getAverageQuote = (categoryQuotations: typeof filteredQuotations) => {
    if (categoryQuotations.length === 0) return 0;
    const sum = categoryQuotations.reduce((acc, q) => {
      const value = q.quotationValue ? parseFloat(q.quotationValue) : 0;
      return acc + value;
    }, 0);
    return sum / categoryQuotations.length;
  };

  const getQuoteVariance = (value: string | null | undefined, average: number) => {
    if (!value || average === 0) return 0;
    const quotationValue = parseFloat(value);
    if (isNaN(quotationValue)) return 0;
    return ((quotationValue - average) / average) * 100;
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
          average: getAverageQuote(group.quotations)
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-comparative-quotes">
            Comparative Quotes
          </h1>
          <p className="text-muted-foreground">
            Compare vendor quotations side-by-side by project and category
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
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

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Project</label>
              <Select value={selectedProject} onValueChange={handleProjectFilter}>
                <SelectTrigger data-testid="select-project-filter">
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
              <label className="text-sm font-medium mb-2 block">Category</label>
              <Select value={selectedCategory} onValueChange={handleCategoryFilter}>
                <SelectTrigger data-testid="select-category-filter">
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
      {Object.entries(groupedData).map(([key, group]) => {
        const average = getAverageQuote(group.quotations);
        const sortedQuotations = [...group.quotations].sort((a, b) => 
          {
            const aValue = a.quotationValue ? parseFloat(a.quotationValue) : 0;
            const bValue = b.quotationValue ? parseFloat(b.quotationValue) : 0;
            return aValue - bValue;
          }
        );

        return (
          <Card key={key} className="" data-testid={`comparison-group-${key}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {group.category} - {group.projectName}
                  </CardTitle>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span data-testid="text-quote-count">
                      {group.quotations.length} quotes
                    </span>
                    <span data-testid="text-average-quote">
                      Average: {formatCurrency(average.toString())}
                    </span>
                  </div>
                </div>
                <Badge variant="outline" data-testid="badge-category">
                  {group.category}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Quote Value</TableHead>
                    <TableHead>Variance</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedQuotations.map((quotation, index) => {
                    const variance = getQuoteVariance(quotation.quotationValue, average);
                    const isLowest = index === 0;
                    const isHighest = index === sortedQuotations.length - 1;
                    
                    return (
                      <TableRow 
                        key={quotation.id}
                        className={quotation.status === "Selected" ? "bg-green-50 dark:bg-green-900/10" : ""}
                        data-testid={`quotation-row-${quotation.id}`}
                      >
                        <TableCell className="font-medium" data-testid="text-vendor-name">
                          {formatVendorNameWithCategory(quotation.vendorName, quotation.category)}
                        </TableCell>
                        
                        <TableCell data-testid="text-quotation-value">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold">
                              {(() => {
                                const quotationValue = quotation.quotationValue || '';
                                const numericValue = parseFloat(quotationValue);
                                return !isNaN(numericValue) && numericValue > 0 ? formatCurrency(quotationValue) : <span className="text-muted-foreground">No total</span>;
                              })()}
                            </span>
                            {isLowest && (
                              <Badge variant="outline" className="text-green-600 border-green-200">
                                Lowest
                              </Badge>
                            )}
                            {quotation.isAboveAverage && (
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell data-testid="text-variance">
                          <div className="flex items-center gap-1">
                            {variance > 0 ? (
                              <TrendingUp className="h-4 w-4 text-red-500" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-green-500" />
                            )}
                            <span className={variance > 0 ? "text-red-600" : "text-green-600"}>
                              {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        
                        <TableCell data-testid="text-quotation-date">
                          {quotation.dateOfQuotation ? new Date(quotation.dateOfQuotation).toLocaleDateString() : <span className="text-muted-foreground">No date</span>}
                        </TableCell>
                        
                        <TableCell data-testid="cell-status">
                          <StatusBadge status={quotation.status} />
                        </TableCell>
                        
                        <TableCell data-testid="cell-actions">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleQuoteClick(quotation, group.projectName)}
                              data-testid={`button-view-quote-${quotation.id}`}
                              title="View detailed quote breakdown"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {quotation.status !== "Selected" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onStatusChange?.(quotation.id, "Selected")}
                                data-testid="button-select-vendor"
                              >
                                Select
                              </Button>
                            )}
                            {quotation.status === "Quoted" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onStatusChange?.(quotation.id, "Rejected")}
                                data-testid="button-reject-vendor"
                              >
                                Reject
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  data-testid={`button-export-quote-${quotation.id}`}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  onClick={() => handleQuoteClick(quotation, group.projectName)}
                                  data-testid={`view-quote-${quotation.id}`}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Quote
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleIndividualQuoteExport(quotation, group, 'pdf')}
                                  data-testid={`export-quote-pdf-${quotation.id}`}
                                >
                                  <FileText className="mr-2 h-4 w-4" />
                                  Export as PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleIndividualQuoteExport(quotation, group, 'excel')}
                                  data-testid={`export-quote-excel-${quotation.id}`}
                                >
                                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                                  Export as Excel
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleIndividualQuoteExport(quotation, group, 'csv')}
                                  data-testid={`export-quote-csv-${quotation.id}`}
                                >
                                  <FileText className="mr-2 h-4 w-4" />
                                  Export as CSV
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {Object.keys(groupedData).length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="text-no-comparisons">
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
    </div>
  );
}