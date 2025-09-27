import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertQuoteTemplateSchema, type InsertQuoteTemplate, type VendorCategory, type QuoteTemplate } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { ChevronRight, Plus, Trash2, Edit3 } from "lucide-react";
import { generateTemplateName } from "@/lib/templateUtils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table";

interface AddTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: QuoteTemplate; // Optional template for edit mode
}

interface CategoryWithChildren extends VendorCategory {
  children: CategoryWithChildren[];
  level: number;
}

// Define field structure for template fields
interface TemplateField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export function AddTemplateDialog({ open, onOpenChange, template }: AddTemplateDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!template;
  
  // State for managing template fields
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  const [editingField, setEditingField] = useState<TemplateField | null>(null);
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);

  // Fetch vendor categories for the form
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<VendorCategory[]>({
    queryKey: ['/api/vendor-categories/tree'],
  });

  // Helper function to flatten hierarchical category data if needed
  const flattenCategories = (data: any[]): VendorCategory[] => {
    const result: VendorCategory[] = [];
    
    const traverse = (items: any[]) => {
      items.forEach(item => {
        if (item && typeof item === 'object' && item.id) {
          result.push({
            id: item.id,
            name: item.name,
            parentId: item.parentId || null,
            description: item.description || null,
            isActive: item.isActive ?? true
          });
          
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

    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [], level: 0 });
    });

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

  const normalizedCategories = flattenCategories(categories);
  const categoryTree = buildCategoryTree(normalizedCategories);
  const flatCategories = flattenCategoryTree(categoryTree);

  const form = useForm<InsertQuoteTemplate>({
    resolver: zodResolver(insertQuoteTemplateSchema),
    defaultValues: {
      name: "",
      description: "",
      categoryId: "",
      isActive: true,
    },
  });

  // Reset form when template changes (for edit mode)
  useEffect(() => {
    if (template) {
      // Load template fields if they exist
      const fields = template.fields ? JSON.parse(JSON.stringify(template.fields)) : [];
      setTemplateFields(Array.isArray(fields) ? fields : []);
      
      form.reset({
        name: template.name || "",
        description: template.description || "",
        categoryId: template.categoryId || "",
        isActive: template.isActive ?? true,
        fields: template.fields || null,
      });
    } else {
      setTemplateFields([]);
      form.reset({
        name: "",
        description: "",
        categoryId: "",
        isActive: true,
        fields: null,
      });
    }
  }, [template, form]);

  const saveTemplateMutation = useMutation({
    mutationFn: async (data: InsertQuoteTemplate) => {
      if (isEditing && template) {
        return apiRequest('PUT', `/api/quote-templates/${template.id}`, data);
      } else {
        return apiRequest('POST', '/api/quote-templates', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quote-templates'] });
      toast({
        title: "Success",
        description: isEditing ? "Template updated successfully" : "Template created successfully",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || (isEditing ? "Failed to update template" : "Failed to create template"),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertQuoteTemplate) => {
    // Include template fields in the submission data
    const submissionData = {
      ...data,
      fields: templateFields.length > 0 ? templateFields : null,
    };
    saveTemplateMutation.mutate(submissionData);
  };

  // Auto-generate template name based on selected category
  const handleCategoryChange = (categoryId: string) => {
    const selectedCategory = flatCategories.find(cat => cat.id === categoryId);
    if (selectedCategory && !isEditing) {
      // Auto-generate name using shared utility
      const autoGeneratedName = generateTemplateName(selectedCategory.name);
      form.setValue('name', autoGeneratedName);
    }
    form.setValue('categoryId', categoryId);
  };

  // Field management functions
  const addField = (field: TemplateField) => {
    setTemplateFields([...templateFields, field]);
    setFieldDialogOpen(false);
    setEditingField(null);
  };

  const updateField = (index: number, field: TemplateField) => {
    const updated = [...templateFields];
    updated[index] = field;
    setTemplateFields(updated);
    setFieldDialogOpen(false);
    setEditingField(null);
  };

  const deleteField = (index: number) => {
    setTemplateFields(templateFields.filter((_, i) => i !== index));
  };

  const handleDialogChange = (open: boolean) => {
    if (!open) {
      form.reset();
    }
    onOpenChange(open);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-add-template">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            {isEditing ? "Edit Quote Template" : "Create Quote Template"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Edit the quote template details below." 
              : "Create a new quote template for vendor quotations. Templates help standardize quote requests."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Civil Construction Quote Template"
                      data-testid="input-template-name"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={handleCategoryChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-template-category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {flatCategories.map((category) => (
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe what this template is for and when to use it..."
                      className="min-h-[80px]"
                      data-testid="textarea-template-description"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional description to help vendors understand the template purpose
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Template</FormLabel>
                    <FormDescription>
                      Active templates are visible to vendors and can be used for quotes
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-template-active"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Template Fields Section - only show when editing */}
            {isEditing && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Edit3 className="h-4 w-4" />
                        Template Fields
                        {templateFields.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {templateFields.length} field{templateFields.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Define the fields that vendors need to fill when using this template
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingField(null);
                        setFieldDialogOpen(true);
                      }}
                      data-testid="button-add-field"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Field
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {templateFields.length > 0 ? (
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Field Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Required</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {templateFields.map((field, index) => (
                            <TableRow key={index} data-testid={`field-row-${index}`}>
                              <TableCell className="font-medium">{field.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {field.type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={field.required ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {field.required ? 'Required' : 'Optional'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {field.description || 'No description'}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingField(field);
                                      setFieldDialogOpen(true);
                                    }}
                                    data-testid={`button-edit-field-${index}`}
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteField(index)}
                                    data-testid={`button-delete-field-${index}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Edit3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No Fields Defined</h3>
                      <p className="text-sm mb-4">
                        Add fields to define what information vendors need to provide
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingField(null);
                          setFieldDialogOpen(true);
                        }}
                        data-testid="button-add-first-field"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Field
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => handleDialogChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={saveTemplateMutation.isPending}
                data-testid={isEditing ? "button-update-template" : "button-create-template"}
              >
                {saveTemplateMutation.isPending 
                  ? (isEditing ? "Updating..." : "Creating...") 
                  : (isEditing ? "Update Template" : "Create Template")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    {/* Field Dialog */}
    {fieldDialogOpen && (
      <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingField ? 'Edit Field' : 'Add Field'}
            </DialogTitle>
            <DialogDescription>
              Define a field that vendors need to fill when using this template
            </DialogDescription>
          </DialogHeader>
          <FieldForm
            field={editingField}
            onSave={(field) => {
              if (editingField) {
                const index = templateFields.findIndex(f => f === editingField);
                updateField(index, field);
              } else {
                addField(field);
              }
            }}
            onCancel={() => {
              setFieldDialogOpen(false);
              setEditingField(null);
            }}
          />
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}

// Simple inline field form component
function FieldForm({ 
  field, 
  onSave, 
  onCancel 
}: { 
  field: TemplateField | null; 
  onSave: (field: TemplateField) => void; 
  onCancel: () => void; 
}) {
  const [name, setName] = useState(field?.name || '');
  const [type, setType] = useState(field?.type || 'text');
  const [required, setRequired] = useState(field?.required || false);
  const [description, setDescription] = useState(field?.description || '');

  const handleSave = () => {
    if (!name.trim()) return;
    
    onSave({
      name: name.trim(),
      type,
      required,
      description: description.trim() || undefined,
    });
  };

  const fieldTypes = [
    'text', 'number', 'email', 'date', 'textarea', 'select', 'checkbox', 'file'
  ];

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="field-name">Field Name</Label>
        <Input
          id="field-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Project Budget"
          data-testid="input-field-name"
        />
      </div>

      <div>
        <Label htmlFor="field-type">Field Type</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger data-testid="select-field-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fieldTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="field-description">Description (Optional)</Label>
        <Textarea
          id="field-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Help text for vendors"
          data-testid="textarea-field-description"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="field-required"
          checked={required}
          onCheckedChange={setRequired}
          data-testid="switch-field-required"
        />
        <Label htmlFor="field-required">Required field</Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          type="button" 
          onClick={handleSave}
          disabled={!name.trim()}
          data-testid="button-save-field"
        >
          {field ? 'Update Field' : 'Add Field'}
        </Button>
      </DialogFooter>
    </div>
  );
}