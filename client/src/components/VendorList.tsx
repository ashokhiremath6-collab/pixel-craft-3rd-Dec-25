import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import { Search, Plus, Filter, ChevronRight, FolderPlus, Edit, Trash2, Phone, Mail, User, Building2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { vendorCategories, insertVendorSchema } from "@shared/schema";
import type { Vendor, VendorCategory, Project } from "@shared/schema";

interface CategoryWithChildren extends VendorCategory {
  children: CategoryWithChildren[];
  level: number;
}

const baseInsertSchema = createInsertSchema(vendorCategories);
const subcategoryFormSchema = baseInsertSchema.extend({
  parentId: z.string().min(1, "Parent category is required"),
}).omit({ id: true });

const vendorFormSchema = insertVendorSchema.extend({
  categoryId: z.string().min(1, "Category is required"),
  projectId: z.string().min(1, "Project is required"),
});

type SubcategoryFormData = z.infer<typeof subcategoryFormSchema>;
type VendorFormData = z.infer<typeof vendorFormSchema>;

interface VendorListProps {
  vendors: Array<Vendor & { projects?: Array<{ projectId: string; projectName: string; clientName: string; status: string }> }>;
  categories: VendorCategory[];
  onAddVendor?: () => void;
  onEditVendor?: (vendor: Vendor) => void;
  onDeleteVendor?: (vendorId: string) => void;
}

export default function VendorList({ vendors, categories, onAddVendor, onEditVendor, onDeleteVendor }: VendorListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [isSubcategoryDialogOpen, setIsSubcategoryDialogOpen] = useState(false);
  const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch projects for project selection
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });
  
  const subcategoryForm = useForm<SubcategoryFormData>({
    resolver: zodResolver(subcategoryFormSchema),
    defaultValues: {
      name: "",
      description: "",
      parentId: "",
    },
  });
  
  const vendorForm = useForm<VendorFormData>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      name: "",
      categoryId: "",
      contactPerson: "",
      phone: "",
      email: "",
      notes: "",
      projectId: "",
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

  const handleProjectFilter = (projectId: string) => {
    setSelectedProject(projectId);
    console.log('Filter by project:', projectId);
  };

  const handleAddVendor = () => {
    console.log('Add vendor clicked');
    setIsVendorDialogOpen(true);
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

  // Create vendor mutation
  const createVendorMutation = useMutation({
    mutationFn: async (data: VendorFormData) => {
      // First create the vendor
      const vendorResponse = await apiRequest('POST', '/api/vendors', {
        name: data.name,
        categoryId: data.categoryId,
        contactPerson: data.contactPerson,
        phone: data.phone,
        email: data.email,
        notes: data.notes || null,
      });
      
      const vendor = await vendorResponse.json();
      
      // Then create the project-vendor relationship
      await apiRequest('POST', '/api/project-vendors', {
        projectId: data.projectId,
        vendorId: vendor.id,
        status: 'Quoted',
      });
      
      return vendor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vendors-with-projects'] });
      setIsVendorDialogOpen(false);
      vendorForm.reset({
        name: "",
        categoryId: "",
        contactPerson: "",
        phone: "",
        email: "",
        notes: "",
        projectId: "",
      });
      toast({
        title: "Success",
        description: "Vendor created successfully and linked to project",
      });
    },
    onError: (error) => {
      console.error('Failed to create vendor:', error);
      toast({
        title: "Error",
        description: "Failed to create vendor. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateVendor = (data: VendorFormData) => {
    createVendorMutation.mutate(data);
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

  // Filter vendors with hierarchical support and project filtering
  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.contactPerson.toLowerCase().includes(searchTerm.toLowerCase());
    
    // For hierarchical filtering, include vendors from selected category and all its descendants
    let matchesCategory = selectedCategory === "all";
    if (!matchesCategory && selectedCategory !== "all") {
      const categoryIds = getCategoryWithDescendants(selectedCategory);
      matchesCategory = categoryIds.includes(vendor.categoryId);
    }
    
    // Project filtering
    let matchesProject = selectedProject === "all";
    if (!matchesProject && selectedProject !== "all") {
      matchesProject = vendor.projects?.some(project => project.projectId === selectedProject) || false;
    }
    
    return matchesSearch && matchesCategory && matchesProject;
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
                            value={field.value || ""}
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
          <Dialog open={isVendorDialogOpen} onOpenChange={setIsVendorDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddVendor} data-testid="button-add-vendor">
                <Plus className="h-4 w-4 mr-2" />
                Add Vendor
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Vendor</DialogTitle>
              </DialogHeader>
              <Form {...vendorForm}>
                <form onSubmit={vendorForm.handleSubmit(handleCreateVendor)} className="space-y-4">
                  <FormField
                    control={vendorForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., ABC Construction Ltd"
                            data-testid="input-vendor-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={vendorForm.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-vendor-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={vendorForm.control}
                    name="projectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-vendor-project">
                              <SelectValue placeholder="Select project" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {projects.map(project => (
                              <SelectItem key={project.id} value={project.id}>
                                {project.projectName} - {project.clientName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={vendorForm.control}
                      name="contactPerson"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Person</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., John Doe"
                              data-testid="input-contact-person"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={vendorForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., +91 98765 43210"
                              data-testid="input-vendor-phone"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={vendorForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="e.g., contact@abcconstruction.com"
                            data-testid="input-vendor-email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={vendorForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Additional notes about the vendor"
                            data-testid="textarea-vendor-notes"
                            {...field}
                            value={field.value || ""}
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
                      onClick={() => setIsVendorDialogOpen(false)}
                      data-testid="button-cancel-vendor"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createVendorMutation.isPending}
                      data-testid="button-submit-vendor"
                    >
                      {createVendorMutation.isPending ? "Creating..." : "Create Vendor"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
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
            <Select value={selectedProject} onValueChange={handleProjectFilter}>
              <SelectTrigger className="w-full sm:w-48" data-testid="select-project-filter">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.projectName} - {project.clientName}
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
          <Badge variant="secondary" data-testid="badge-active-category-filter">
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
        {selectedProject !== "all" && (
          <Badge variant="secondary" data-testid="badge-active-project-filter">
            {(() => {
              const project = projects.find(p => p.id === selectedProject);
              return project ? `${project.projectName} - ${project.clientName}` : selectedProject;
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
          
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Projects</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryVendors.map((vendor: VendorListProps['vendors'][0]) => (
                    <TableRow key={vendor.id} data-testid={`vendor-row-${vendor.id}`} className="h-12">
                      <TableCell className="font-medium py-2">
                        <div>
                          <span data-testid="text-vendor-name">{vendor.name}</span>
                          <div className="text-xs text-muted-foreground">
                            {categoryMap[vendor.categoryId]?.name || 'Unknown Category'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span data-testid="text-contact-person">{vendor.contactPerson}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span data-testid="text-phone">{vendor.phone}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span data-testid="text-email" className="text-sm">{vendor.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        {vendor.projects && vendor.projects.length > 0 ? (
                          <div className="space-y-1">
                            {vendor.projects.slice(0, 2).map((project: any, index: number) => (
                              <div key={`${vendor.id}-${project.projectId}-${index}`} className="text-sm">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-medium" data-testid={`text-project-name-${index}`}>
                                    {project.projectName}
                                  </span>
                                  <Badge 
                                    variant={project.status === 'Selected' ? 'default' : 'secondary'} 
                                    className="text-xs"
                                  >
                                    {project.status}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground ml-5" data-testid={`text-client-name-${index}`}>
                                  {project.clientName}
                                </div>
                              </div>
                            ))}
                            {vendor.projects && vendor.projects.length > 2 && (
                              <div className="text-xs text-muted-foreground ml-5">
                                +{vendor.projects.length - 2} more project{vendor.projects.length - 2 > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No projects</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-2">
                        <div className="flex gap-1 justify-end">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => onEditVendor?.(vendor)}
                            data-testid="button-edit-vendor"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => onDeleteVendor?.(vendor.id)}
                            data-testid="button-delete-vendor"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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