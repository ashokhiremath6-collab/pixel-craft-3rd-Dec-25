import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import VendorCard from "./VendorCard";
import { Search, Plus, Filter, ChevronRight, FolderPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { vendorCategories } from "@shared/schema";
import type { Vendor, VendorCategory } from "@shared/schema";

interface CategoryWithChildren extends VendorCategory {
  children: CategoryWithChildren[];
  level: number;
}

const baseInsertSchema = createInsertSchema(vendorCategories);
const subcategoryFormSchema = baseInsertSchema.extend({
  parentId: z.string().min(1, "Parent category is required"),
}).omit({ id: true });

type SubcategoryFormData = z.infer<typeof subcategoryFormSchema>;

interface VendorListProps {
  vendors: Vendor[];
  categories: VendorCategory[];
  onAddVendor?: () => void;
  onEditVendor?: (vendor: Vendor) => void;
  onDeleteVendor?: (vendorId: string) => void;
}

export default function VendorList({ vendors, categories, onAddVendor, onEditVendor, onDeleteVendor }: VendorListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isSubcategoryDialogOpen, setIsSubcategoryDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const subcategoryForm = useForm<SubcategoryFormData>({
    resolver: zodResolver(subcategoryFormSchema),
    defaultValues: {
      name: "",
      description: "",
      parentId: "",
    },
  });

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    console.log('Search term:', value);
  };

  const handleCategoryFilter = (categoryId: string) => {
    setSelectedCategory(categoryId);
    console.log('Filter by category:', categoryId);
  };

  const handleAddVendor = () => {
    console.log('Add vendor clicked');
    console.log('Add vendor - would open form modal');
    onAddVendor?.();
  };

  // Create subcategory mutation
  const createSubcategoryMutation = useMutation({
    mutationFn: async (data: SubcategoryFormData) => {
      return apiRequest('POST', '/api/vendor-categories', {
        name: data.name,
        description: data.description || null,
        parentId: data.parentId,
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-categories/tree'] });
      setIsSubcategoryDialogOpen(false);
      subcategoryForm.reset();
      toast({
        title: "Success",
        description: "Subcategory created successfully",
      });
    },
    onError: (error) => {
      console.error('Failed to create subcategory:', error);
      toast({
        title: "Error",
        description: "Failed to create subcategory. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubcategory = (data: SubcategoryFormData) => {
    createSubcategoryMutation.mutate(data);
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

  // Filter vendors with hierarchical support
  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.contactPerson.toLowerCase().includes(searchTerm.toLowerCase());
    
    // For hierarchical filtering, include vendors from selected category and all its descendants
    let matchesCategory = selectedCategory === "all";
    if (!matchesCategory && selectedCategory !== "all") {
      const categoryIds = getCategoryWithDescendants(selectedCategory);
      matchesCategory = categoryIds.includes(vendor.categoryId);
    }
    
    return matchesSearch && matchesCategory;
  });

  // Group vendors by category with hierarchical display
  const vendorsByCategory = filteredVendors.reduce((acc, vendor) => {
    const category = categoryMap[vendor.categoryId];
    let categoryDisplayName = category?.name || 'Unknown';
    
    // Add parent category context for subcategories
    if (category?.parentId) {
      const parentCategory = categoryMap[category.parentId];
      if (parentCategory) {
        categoryDisplayName = `${parentCategory.name} > ${category.name}`;
      }
    }
    
    if (!acc[categoryDisplayName]) {
      acc[categoryDisplayName] = [];
    }
    acc[categoryDisplayName].push(vendor);
    return acc;
  }, {} as Record<string, Vendor[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-vendors">Vendors</h1>
          <p className="text-muted-foreground">
            Manage your vendor database by category
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isSubcategoryDialogOpen} onOpenChange={setIsSubcategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-add-subcategory">
                <FolderPlus className="h-4 w-4 mr-2" />
                Add Subcategory
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Subcategory</DialogTitle>
              </DialogHeader>
              <Form {...subcategoryForm}>
                <form onSubmit={subcategoryForm.handleSubmit(handleCreateSubcategory)} className="space-y-4">
                  <FormField
                    control={subcategoryForm.control}
                    name="parentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parent Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-parent-category">
                              <SelectValue placeholder="Select parent category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories
                              .filter(cat => !cat.parentId) // Only show main categories
                              .map(category => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={subcategoryForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subcategory Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Residential Electrical"
                            data-testid="input-subcategory-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={subcategoryForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Brief description of the subcategory"
                            data-testid="textarea-subcategory-description"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsSubcategoryDialogOpen(false)}
                      data-testid="button-cancel-subcategory"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createSubcategoryMutation.isPending}
                      data-testid="button-submit-subcategory"
                    >
                      {createSubcategoryMutation.isPending ? "Creating..." : "Create Subcategory"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Button onClick={handleAddVendor} data-testid="button-add-vendor">
            <Plus className="h-4 w-4 mr-2" />
            Add Vendor
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search vendors or contacts..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-vendors"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={handleCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48" data-testid="select-category-filter">
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
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span data-testid="text-results-count">
          {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''} found
        </span>
        {selectedCategory !== "all" && (
          <Badge variant="secondary" data-testid="badge-active-filter">
            {(() => {
              const category = categoryMap[selectedCategory];
              if (!category) return selectedCategory;
              
              // Show hierarchical name for active filter
              if (category.parentId) {
                const parentCategory = categoryMap[category.parentId];
                return parentCategory ? `${parentCategory.name} > ${category.name}` : category.name;
              }
              return category.name;
            })()}
          </Badge>
        )}
      </div>

      {/* Vendors by Category */}
      {Object.entries(vendorsByCategory).map(([category, categoryVendors]) => (
        <div key={category} className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold" data-testid={`heading-category-${category}`}>
              {category}
            </h2>
            <Badge variant="outline" data-testid={`badge-category-count-${category}`}>
              {categoryVendors.length} vendor{categoryVendors.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryVendors.map(vendor => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                onEdit={onEditVendor}
                onDelete={onDeleteVendor}
              />
            ))}
          </div>
        </div>
      ))}

      {filteredVendors.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground" data-testid="text-no-vendors">
              No vendors found matching your criteria.
            </p>
            <Button 
              variant="outline" 
              onClick={handleAddVendor}
              className="mt-4"
              data-testid="button-add-first-vendor"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add First Vendor
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}