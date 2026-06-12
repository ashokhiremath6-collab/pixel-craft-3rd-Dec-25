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
import { Search, Plus, Filter, ChevronRight, ChevronDown, FolderPlus, Edit, Trash2, Phone, Mail, User, Building2, Users, FileText, AlertTriangle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { vendorCategories, insertVendorSchema } from "@shared/schema";
import type { Vendor, VendorCategory, VendorContact, InsertVendorContact } from "@shared/schema";

interface CategoryWithChildren extends VendorCategory {
  children: CategoryWithChildren[];
  level: number;
}

const baseInsertSchema = createInsertSchema(vendorCategories);

// Main category schema (no parent required)
const mainCategoryFormSchema = baseInsertSchema.extend({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
}).omit({ id: true, parentId: true });

// Subcategory schema (parent required)
const subcategoryFormSchema = baseInsertSchema.extend({
  parentId: z.string().min(1, "Parent category is required"),
}).omit({ id: true });

const vendorFormSchema = insertVendorSchema.extend({
  categoryId: z.string().min(1, "Category is required"),
});

const contactFormSchema = z.object({
  contactPerson: z.string().min(1, "Contact person is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  role: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

type MainCategoryFormData = z.infer<typeof mainCategoryFormSchema>;
type SubcategoryFormData = z.infer<typeof subcategoryFormSchema>;
type VendorFormData = z.infer<typeof vendorFormSchema>;
type ContactFormData = z.infer<typeof contactFormSchema>;

interface VendorListProps {
  vendors: Array<Vendor & { projects?: Array<{ projectId: string; projectName: string; clientName: string; status: string }> }>;
  categories: VendorCategory[];
  onAddVendor?: () => void;
  onEditVendor?: (vendor: Vendor) => void;
  onUpdateVendor?: (vendorId: string, data: Partial<Vendor>) => void;
  onDeleteVendor?: (vendorId: string) => void;
}

export default function VendorList({ vendors, categories, onAddVendor, onEditVendor, onUpdateVendor, onDeleteVendor }: VendorListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isMainCategoryDialogOpen, setIsMainCategoryDialogOpen] = useState(false);
  const [isSubcategoryDialogOpen, setIsSubcategoryDialogOpen] = useState(false);
  const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [isContactsDialogOpen, setIsContactsDialogOpen] = useState(false);
  const [selectedVendorForContacts, setSelectedVendorForContacts] = useState<Vendor | null>(null);
  const [editingContact, setEditingContact] = useState<VendorContact | null>(null);
  const [additionalContacts, setAdditionalContacts] = useState<Array<Omit<ContactFormData, 'isPrimary'>>>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (cat: string) =>
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const mainCategoryForm = useForm<MainCategoryFormData>({
    resolver: zodResolver(mainCategoryFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
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
    },
  });

  // Edit vendor form with simplified schema (no projectId required for editing)
  const editVendorFormSchema = insertVendorSchema.extend({
    categoryId: z.string().min(1, "Category is required"),
  });
  
  const editVendorForm = useForm<z.infer<typeof editVendorFormSchema>>({
    resolver: zodResolver(editVendorFormSchema),
    defaultValues: {
      name: "",
      categoryId: "",
      contactPerson: "",
      phone: "",
      email: "",
      notes: "",
    },
  });

  const contactForm = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      contactPerson: "",
      phone: "",
      email: "",
      role: "",
      isPrimary: false,
    },
  });

  // Fetch contacts for a specific vendor
  const { data: vendorContacts = [], refetch: refetchContacts } = useQuery<VendorContact[]>({
    queryKey: ['/api/vendors', selectedVendorForContacts?.id, 'contacts'],
    queryFn: async () => {
      if (!selectedVendorForContacts) return [];
      const response = await fetch(`/api/vendors/${selectedVendorForContacts.id}/contacts`, {
        credentials: 'include',
      });
      return response.json();
    },
    enabled: !!selectedVendorForContacts,
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
    setIsVendorDialogOpen(true);
  };

  // Create main category mutation
  const createMainCategoryMutation = useMutation({
    mutationFn: async (data: MainCategoryFormData) => {
      return apiRequest('POST', '/api/vendor-categories', {
        name: data.name,
        description: data.description || null,
        parentId: null, // No parent for main categories
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-categories/tree'] });
      setIsMainCategoryDialogOpen(false);
      mainCategoryForm.reset();
      toast({
        title: "Success",
        description: "Main category created successfully",
      });
    },
    onError: (error) => {
      console.error('Failed to create main category:', error);
      toast({
        title: "Error",
        description: "Failed to create main category. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateMainCategory = (data: MainCategoryFormData) => {
    createMainCategoryMutation.mutate(data);
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
    mutationFn: async (data: VendorFormData & { additionalContacts?: Array<Omit<ContactFormData, 'isPrimary'>> }) => {
      // Create the vendor (no project association)
      const vendorResponse = await apiRequest('POST', '/api/vendors', {
        name: data.name,
        categoryId: data.categoryId,
        contactPerson: data.contactPerson,
        phone: data.phone,
        email: data.email || null,
        notes: data.notes || null,
        additionalContacts: data.additionalContacts || [],
      });
      
      return await vendorResponse.json();
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
      });
      setAdditionalContacts([]);
      toast({
        title: "Success",
        description: "Vendor created successfully",
      });
    },
    onError: (error: any) => {
      console.error('Failed to create vendor:', error);
      // Extract server error message - format is "400: {\"error\":\"message\"}"
      let errorMessage = "Failed to create vendor. Please try again.";
      try {
        const match = error?.message?.match(/\d+:\s*(.+)/);
        if (match) {
          const jsonPart = JSON.parse(match[1]);
          errorMessage = jsonPart.error || errorMessage;
        }
      } catch { /* use default message */ }
      toast({
        title: "Cannot Create Vendor",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleCreateVendor = (data: VendorFormData) => {
    // Check if there are validation errors
    const errors = vendorForm.formState.errors;
    if (errors.email) {
      toast({
        title: "Error",
        description: "You need to enter an email ID.",
        variant: "destructive",
      });
      return;
    }
    createVendorMutation.mutate({ ...data, additionalContacts });
  };

  const handleAddAdditionalContact = () => {
    setAdditionalContacts([...additionalContacts, { contactPerson: '', phone: '', email: '', role: '' }]);
  };

  const handleRemoveAdditionalContact = (index: number) => {
    setAdditionalContacts(additionalContacts.filter((_, i) => i !== index));
  };

  const handleUpdateAdditionalContact = (index: number, field: keyof Omit<ContactFormData, 'isPrimary'>, value: string) => {
    const updated = [...additionalContacts];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalContacts(updated);
  };

  const handleEditClick = (vendor: Vendor) => {
    setEditingVendor(vendor);
    editVendorForm.reset({
      name: vendor.name,
      categoryId: vendor.categoryId,
      contactPerson: vendor.contactPerson,
      phone: vendor.phone,
      email: vendor.email || "",
      notes: vendor.notes || "",
    });
    setIsEditDialogOpen(true);
    onEditVendor?.(vendor);
  };

  const handleUpdateVendor = (data: z.infer<typeof editVendorFormSchema>) => {
    if (!editingVendor) return;
    
    onUpdateVendor?.(editingVendor.id, data);
    setIsEditDialogOpen(false);
    setEditingVendor(null);
    editVendorForm.reset();
  };

  // Contact management mutations
  const createContactMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      if (!selectedVendorForContacts) throw new Error("No vendor selected");
      return apiRequest('POST', `/api/vendors/${selectedVendorForContacts.id}/contacts`, data);
    },
    onSuccess: () => {
      refetchContacts();
      contactForm.reset();
      setEditingContact(null);
      toast({
        title: "Success",
        description: "Contact added successfully",
      });
    },
    onError: (error) => {
      console.error('Failed to create contact:', error);
      toast({
        title: "Error",
        description: "Failed to add contact. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ contactId, data }: { contactId: string; data: Partial<ContactFormData> }) => {
      if (!selectedVendorForContacts) throw new Error("No vendor selected");
      return apiRequest('PATCH', `/api/vendors/${selectedVendorForContacts.id}/contacts/${contactId}`, data);
    },
    onSuccess: () => {
      refetchContacts();
      contactForm.reset();
      setEditingContact(null);
      toast({
        title: "Success",
        description: "Contact updated successfully",
      });
    },
    onError: (error) => {
      console.error('Failed to update contact:', error);
      toast({
        title: "Error",
        description: "Failed to update contact. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      if (!selectedVendorForContacts) throw new Error("No vendor selected");
      return apiRequest('DELETE', `/api/vendors/${selectedVendorForContacts.id}/contacts/${contactId}`);
    },
    onSuccess: () => {
      refetchContacts();
      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Failed to delete contact:', error);
      toast({
        title: "Error",
        description: "Failed to delete contact. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleManageContacts = (vendor: Vendor) => {
    setSelectedVendorForContacts(vendor);
    setIsContactsDialogOpen(true);
  };

  const handleSaveContact = (data: ContactFormData) => {
    if (editingContact) {
      updateContactMutation.mutate({ contactId: editingContact.id, data });
    } else {
      createContactMutation.mutate(data);
    }
  };

  const handleEditContact = (contact: VendorContact) => {
    setEditingContact(contact);
    contactForm.reset({
      contactPerson: contact.contactPerson,
      phone: contact.phone,
      email: contact.email || "",
      role: contact.role || "",
      isPrimary: contact.isPrimary,
    });
  };

  const handleDeleteContact = (contactId: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      deleteContactMutation.mutate(contactId);
    }
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

    // Sort root categories alphabetically
    rootCategories.sort((a, b) => a.name.localeCompare(b.name));
    
    // Sort children of each category alphabetically
    const sortChildren = (nodes: CategoryWithChildren[]) => {
      nodes.forEach(node => {
        if (node.children.length > 0) {
          node.children.sort((a, b) => a.name.localeCompare(b.name));
          sortChildren(node.children);
        }
      });
    };
    sortChildren(rootCategories);

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

  // Sort vendors alphabetically within each category
  Object.keys(vendorsByCategory).forEach(category => {
    vendorsByCategory[category].sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  });

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-vendors">Vendors</h1>
          <p className="text-sm text-muted-foreground">
            Manage your vendor database by category
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isMainCategoryDialogOpen} onOpenChange={setIsMainCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-add-main-category">
                <FolderPlus className="h-4 w-4 mr-2" />
                Add Main Category
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Main Category</DialogTitle>
              </DialogHeader>
              <Form {...mainCategoryForm}>
                <form onSubmit={mainCategoryForm.handleSubmit(handleCreateMainCategory)} className="space-y-4">
                  <FormField
                    control={mainCategoryForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Project Manager"
                            data-testid="input-main-category-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={mainCategoryForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Brief description of the category"
                            data-testid="textarea-main-category-description"
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
                      onClick={() => setIsMainCategoryDialogOpen(false)}
                      data-testid="button-cancel-main-category"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMainCategoryMutation.isPending}
                      data-testid="button-submit-main-category"
                    >
                      {createMainCategoryMutation.isPending ? "Creating..." : "Create Main Category"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isSubcategoryDialogOpen} onOpenChange={setIsSubcategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-add-subcategory">
                <FolderPlus className="h-4 w-4 mr-2" />
                Add Subcategory
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
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
            <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                            value={field.value || ""}
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

                  {/* Additional Contacts Section */}
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Additional Contacts (Optional)</h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddAdditionalContact}
                        data-testid="button-add-additional-contact"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Contact
                      </Button>
                    </div>
                    
                    {additionalContacts.length > 0 && (
                      <div className="space-y-3">
                        {additionalContacts.map((contact, index) => (
                          <Card key={index} className="p-3">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Contact {index + 1}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveAdditionalContact(index)}
                                  data-testid={`button-remove-contact-${index}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-sm font-medium">Contact Person *</label>
                                  <Input
                                    placeholder="e.g., Jane Smith"
                                    value={contact.contactPerson}
                                    onChange={(e) => handleUpdateAdditionalContact(index, 'contactPerson', e.target.value)}
                                    data-testid={`input-additional-contact-person-${index}`}
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Phone *</label>
                                  <Input
                                    placeholder="e.g., +91 12345 67890"
                                    value={contact.phone}
                                    onChange={(e) => handleUpdateAdditionalContact(index, 'phone', e.target.value)}
                                    data-testid={`input-additional-phone-${index}`}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-sm font-medium">Email</label>
                                  <Input
                                    type="email"
                                    placeholder="e.g., jane@example.com"
                                    value={contact.email || ''}
                                    onChange={(e) => handleUpdateAdditionalContact(index, 'email', e.target.value)}
                                    data-testid={`input-additional-email-${index}`}
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Role</label>
                                  <Input
                                    placeholder="e.g., Project Manager"
                                    value={contact.role || ''}
                                    onChange={(e) => handleUpdateAdditionalContact(index, 'role', e.target.value)}
                                    data-testid={`input-additional-role-${index}`}
                                  />
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>

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

          {/* Edit Vendor Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Vendor</DialogTitle>
              </DialogHeader>
              <Form {...editVendorForm}>
                <form onSubmit={editVendorForm.handleSubmit(handleUpdateVendor)} className="space-y-4">
                  <FormField
                    control={editVendorForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., ABC Construction Ltd"
                            data-testid="input-edit-vendor-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editVendorForm.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {flatCategories.map(category => (
                              <SelectItem key={category.id} value={category.id}>
                                <div className="flex items-center">
                                  {category.level > 0 && (
                                    <span style={{ marginLeft: `${category.level * 8}px` }} className="text-muted-foreground">
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
                    control={editVendorForm.control}
                    name="contactPerson"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Person</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., John Doe"
                            data-testid="input-edit-contact-person"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editVendorForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., +91 98765 43210"
                            data-testid="input-edit-phone"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editVendorForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="e.g., contact@abcconstruction.com"
                            data-testid="input-edit-email"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editVendorForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Additional notes about the vendor"
                            data-testid="textarea-edit-notes"
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
                      onClick={() => setIsEditDialogOpen(false)}
                      data-testid="button-cancel-edit"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      data-testid="button-submit-edit"
                    >
                      Update Vendor
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
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
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
      </div>

      {/* Vendors by Category */}
      {Object.entries(vendorsByCategory)
        .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
        .map(([category, categoryVendors]) => {
          const isOpen = !collapsedCategories.has(category);
          return (
        <Collapsible key={category} open={isOpen} onOpenChange={() => toggleCategory(category)}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover-elevate rounded-md text-left">
              <div className="flex items-center gap-2">
                {isOpen
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <span className="font-medium" data-testid={`heading-category-${category}`}>{category}</span>
                <Badge variant="secondary" className="no-default-active-elevate" data-testid={`badge-category-count-${category}`}>
                  {categoryVendors.length} vendor{categoryVendors.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
          <Card className="mt-1 mb-3">
            <CardContent className="p-0 overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Contact</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead className="hidden lg:table-cell">Email</TableHead>
                    <TableHead className="hidden lg:table-cell">Projects</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryVendors.map((vendor: VendorListProps['vendors'][0]) => (
                    <TableRow key={vendor.id} data-testid={`vendor-row-${vendor.id}`} className="h-12">
                      <TableCell className="font-medium py-2">
                        <div>
                          <span data-testid="text-vendor-name" className="block">{vendor.name}</span>
                          <div className="text-xs text-muted-foreground">
                            {categoryMap[vendor.categoryId]?.name || 'Unknown Category'}
                          </div>
                          <div className="sm:hidden mt-1 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{vendor.contactPerson}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              <span>{vendor.phone}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 hidden sm:table-cell">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span data-testid="text-contact-person">{vendor.contactPerson}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 hidden md:table-cell">
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span data-testid="text-phone">{vendor.phone}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 hidden lg:table-cell">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span data-testid="text-email" className="text-sm">{vendor.email || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 hidden lg:table-cell">
                        {vendor.projects && vendor.projects.length > 0 ? (
                          <div className="space-y-1">
                            {vendor.projects.slice(0, 1).map((project: any, index: number) => {
                              const projectCount = vendor.projects?.length ?? 0;
                              return (
                                <div key={`${vendor.id}-${project.projectId}-${index}`} className="text-sm">
                                  <div className="flex items-center gap-1">
                                    <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                    <span className="font-medium" data-testid={`text-project-name-${index}`}>
                                      {project.projectName}
                                    </span>
                                    {projectCount > 1 && (
                                      <span className="text-xs text-muted-foreground flex-shrink-0">+{projectCount - 1}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No projects</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-2 flex-shrink-0">
                        <div className="flex gap-1 justify-end">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => handleManageContacts(vendor)}
                            data-testid="button-manage-contacts"
                            title="Manage Contacts"
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => handleEditClick(vendor)}
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
          </CollapsibleContent>
        </Collapsible>
          );
        })}

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

      {/* Contacts Management Dialog */}
      <Dialog open={isContactsDialogOpen} onOpenChange={(open) => {
        setIsContactsDialogOpen(open);
        if (!open) {
          setSelectedVendorForContacts(null);
          setEditingContact(null);
          contactForm.reset();
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Manage Contacts - {selectedVendorForContacts?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Contact Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {editingContact ? 'Edit Contact' : 'Add New Contact'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...contactForm}>
                  <form onSubmit={contactForm.handleSubmit(handleSaveContact)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={contactForm.control}
                        name="contactPerson"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Person *</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone *</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., +91 98765 43210" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={contactForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="e.g., john@example.com" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Sales Manager" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={contactForm.control}
                      name="isPrimary"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <input 
                              type="checkbox" 
                              checked={field.value} 
                              onChange={field.onChange}
                              className="h-4 w-4"
                            />
                          </FormControl>
                          <FormLabel className="!mt-0">Mark as Primary Contact</FormLabel>
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      {editingContact && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingContact(null);
                            contactForm.reset();
                          }}
                        >
                          Cancel Edit
                        </Button>
                      )}
                      <Button type="submit">
                        {editingContact ? 'Update Contact' : 'Add Contact'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Contacts List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Existing Contacts ({vendorContacts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {vendorContacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No additional contacts yet. Add one above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {vendorContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between p-3 border rounded-md hover-elevate"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{contact.contactPerson}</span>
                            {contact.isPrimary && (
                              <Badge variant="default" className="text-xs">Primary</Badge>
                            )}
                            {contact.role && (
                              <Badge variant="secondary" className="text-xs">{contact.role}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {contact.phone}
                            </div>
                            {contact.email && (
                              <div className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {contact.email}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEditContact(contact)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteContact(contact.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}