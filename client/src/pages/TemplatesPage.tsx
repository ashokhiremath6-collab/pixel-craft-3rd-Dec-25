import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, FileText, Download, Edit, Trash2, ChevronRight, ChevronDown, Upload, PlusCircle, FileSpreadsheet, Eye } from "lucide-react";
import type { VendorCategory, QuoteTemplate } from "@shared/schema";
import { AddTemplateDialog } from "@/components/AddTemplateDialog";
import TemplateImport from "@/components/TemplateImport";
import { Link } from "wouter";

interface CategoryWithChildren extends VendorCategory {
  children: CategoryWithChildren[];
  level: number;
}

export default function TemplatesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QuoteTemplate | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  // Fetch vendor categories for hierarchical filtering
  const { 
    data: categories = [], 
    isLoading: categoriesLoading, 
    isError: categoriesError,
    refetch: refetchCategories 
  } = useQuery<VendorCategory[]>({
    queryKey: ['/api/vendor-categories/tree'],
  });

  // Fetch actual quote templates from API
  const { 
    data: templates = [], 
    isLoading: templatesLoading, 
    isError: templatesError,
    refetch: refetchTemplates 
  } = useQuery<QuoteTemplate[]>({
    queryKey: ['/api/quote-templates'],
  });

  // Helper function to flatten hierarchical category data if needed
  const flattenCategories = (data: any[]): VendorCategory[] => {
    const result: VendorCategory[] = [];
    
    const traverse = (items: any[]) => {
      items.forEach(item => {
        // Check if this looks like a category object
        if (item && typeof item === 'object' && item.id) {
          result.push({
            id: item.id,
            name: item.name,
            parentId: item.parentId || null,
            description: item.description || null,
            isActive: item.isActive ?? true
          });
          
          // If it has children, traverse them recursively
          if (item.children && Array.isArray(item.children)) {
            traverse(item.children);
          }
        }
      });
    };
    
    traverse(data);
    return result;
  };

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
      const category = categoryMap.get(cat.id)!;
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          category.level = parent.level + 1;
          parent.children.push(category);
        }
      } else {
        rootCategories.push(category);
      }
    });

    return rootCategories;
  };

  // Helper function to flatten category tree for Select dropdown
  const flattenCategoryTree = (tree: CategoryWithChildren[]): CategoryWithChildren[] => {
    const result: CategoryWithChildren[] = [];
    const traverse = (categories: CategoryWithChildren[]) => {
      categories.forEach(cat => {
        result.push(cat);
        if (cat.children.length > 0) {
          traverse(cat.children);
        }
      });
    };
    traverse(tree);
    return result;
  };

  // Helper function to get category and all its descendants
  const getCategoryWithDescendants = (categoryId: string, allCategories: VendorCategory[]): string[] => {
    const result = [categoryId];
    const children = allCategories.filter(cat => cat.parentId === categoryId);
    children.forEach(child => {
      result.push(...getCategoryWithDescendants(child.id, allCategories));
    });
    return result;
  };

  // Handle template export for vendors
  const handleTemplateExport = async (template: QuoteTemplate, format: 'csv' | 'excel') => {
    try {
      setIsExporting(true);

      // Get category name
      const categoryName = categoryIdToNameMap.get(template.categoryId) || 'Unknown';

      // Create export data for template
      const exportData = {
        template: {
          id: template.id,
          name: template.name,
          description: template.description,
          categoryId: template.categoryId,
          categoryName: categoryName,
          isActive: template.isActive,
          createdAt: template.createdAt
        },
        metadata: {
          exportDate: new Date().toISOString(),
          exportType: 'blank_template_for_vendor'
        }
      };

      const response = await fetch(`/api/templates/export/${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to export template as ${format.toUpperCase()}`);
      }

      // Get filename from response headers or create default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition?.match(/filename="?([^"]+)"?/)?.[1] || 
        `template_${template.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`;

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
        title: "Template Exported Successfully",
        description: `Blank template "${template.name}" exported as ${format.toUpperCase()} for vendor to complete`,
      });

    } catch (error) {
      console.error('Template export error:', error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export template",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Defensive handling for both flat and hierarchical category data  
  const normalizedCategories = flattenCategories(categories);
  const categoryTree = buildCategoryTree(normalizedCategories);
  const flatCategories = flattenCategoryTree(categoryTree);

  // Create a map of category IDs to names for filtering
  const categoryIdToNameMap = new Map<string, string>();
  normalizedCategories.forEach((cat) => {
    categoryIdToNameMap.set(cat.id, cat.name);
  });

  const filteredTemplates = templates.filter(template => {
    // Get category name for the template
    const templateCategoryName = categoryIdToNameMap.get(template.categoryId) || '';
    
    // Text search filter
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         templateCategoryName.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Category filter
    if (selectedCategory === "all") {
      return matchesSearch;
    }
    
    // Get the selected category and all its descendants
    const selectedCategoryIds = getCategoryWithDescendants(selectedCategory, normalizedCategories);
    
    const matchesCategory = selectedCategoryIds.includes(template.categoryId);
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 space-y-6" data-testid="templates-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-templates-title">
            Quote Templates
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage quote templates for different vendor categories
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              data-testid="button-add-template" 
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Template
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              onClick={() => setAddDialogOpen(true)}
              data-testid="menu-item-create-template"
              className="flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Create Template
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setImportDialogOpen(true)}
              data-testid="menu-item-import-template"
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Import Template
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-templates"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Select
            value={selectedCategory}
            onValueChange={setSelectedCategory}
            disabled={categoriesLoading}
            data-testid="select-category-filter"
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder={
                categoriesLoading ? "Loading categories..." : 
                "Filter by category"
              } />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="option-all-categories">
                All Categories
              </SelectItem>
              {!categoriesLoading && flatCategories.map((category) => (
                <SelectItem
                  key={category.id}
                  value={category.id}
                  data-testid={`option-category-${category.id}`}
                >
                  <span 
                    className="flex items-center gap-1"
                    style={{ marginLeft: `${category.level * 16}px` }}
                  >
                    {category.children.length > 0 && (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span>{category.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {categoriesError && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetchCategories()}
              className="text-destructive"
            >
              Retry Categories
            </Button>
          )}
        </div>
      </div>

      {templatesError ? (
        <div className="text-center py-12">
          <div className="text-destructive mb-4">Failed to load templates</div>
          <Button onClick={() => refetchTemplates()} variant="outline">
            Try Again
          </Button>
        </div>
      ) : templatesLoading ? (
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading templates...</div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((template) => (
                  <TableRow 
                    key={template.id} 
                    className="h-12"
                    data-testid={`row-template-${template.id}`}
                  >
                    <TableCell className="font-medium py-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span data-testid={`text-template-name-${template.id}`}>
                          {template.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge 
                        variant="secondary" 
                        className="text-xs"
                        data-testid={`badge-category-${template.id}`}
                      >
                        {categoryIdToNameMap.get(template.categoryId) || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge 
                        variant={template.isActive ? "default" : "destructive"}
                        className="text-xs"
                        data-testid={`badge-status-${template.id}`}
                      >
                        {template.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="text-sm text-muted-foreground" data-testid={`text-description-${template.id}`}>
                        {template.description}
                      </span>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="text-xs text-muted-foreground" data-testid={`text-last-modified-${template.id}`}>
                        {template.createdAt ? new Date(template.createdAt).toLocaleDateString() : 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <div className="flex gap-1 justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="flex items-center gap-1"
                              data-testid={`button-export-template-${template.id}`}
                            >
                              <Download className="h-3 w-3" />
                              Export
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => handleTemplateExport(template, 'csv')}
                              data-testid={`export-template-csv-${template.id}`}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Export as CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleTemplateExport(template, 'excel')}
                              data-testid={`export-template-excel-${template.id}`}
                            >
                              <FileSpreadsheet className="mr-2 h-4 w-4" />
                              Export as Excel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Link href={`/templates/${template.id}`}>
                          <Button 
                            size="sm" 
                            variant="outline"
                            data-testid={`button-view-${template.id}`}
                            aria-label={`View ${template.name} template`}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </Link>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setEditingTemplate(template)}
                          data-testid={`button-edit-${template.id}`}
                          aria-label={`Edit ${template.name} template`}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          data-testid={`button-delete-${template.id}`}
                          aria-label={`Delete ${template.name} template`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!templatesLoading && filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2" data-testid="text-empty-state-heading">
            No templates found
          </h3>
          <p className="text-muted-foreground" data-testid="text-empty-state-message">
            {searchTerm ? "Try adjusting your search criteria" : "Create your first quote template to get started"}
          </p>
        </div>
      )}

      <AddTemplateDialog 
        open={addDialogOpen || !!editingTemplate} 
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) setEditingTemplate(null);
        }}
        template={editingTemplate || undefined}
      />


      {importDialogOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setImportDialogOpen(false);
            }
          }}
        >
          <div 
            className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Import Template</h2>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setImportDialogOpen(false)}
                  data-testid="button-close-import"
                >
                  ×
                </Button>
              </div>
              <TemplateImport 
                onImportComplete={() => {
                  setImportDialogOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}