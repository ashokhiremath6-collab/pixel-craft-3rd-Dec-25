import { useState } from "react";
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
import { insertQuoteTemplateSchema, type InsertQuoteTemplate, type VendorCategory } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { ChevronRight } from "lucide-react";

interface AddTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CategoryWithChildren extends VendorCategory {
  children: CategoryWithChildren[];
  level: number;
}

export function AddTemplateDialog({ open, onOpenChange }: AddTemplateDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const createTemplateMutation = useMutation({
    mutationFn: async (data: InsertQuoteTemplate) => {
      return apiRequest('POST', '/api/quote-templates', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quote-templates'] });
      toast({
        title: "Success",
        description: "Template created successfully",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create template",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertQuoteTemplate) => {
    createTemplateMutation.mutate(data);
  };

  const handleDialogChange = (open: boolean) => {
    if (!open) {
      form.reset();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-add-template">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">Create Quote Template</DialogTitle>
          <DialogDescription>
            Create a new quote template for vendor quotations. Templates help standardize quote requests.
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
                disabled={createTemplateMutation.isPending}
                data-testid="button-create-template"
              >
                {createTemplateMutation.isPending ? "Creating..." : "Create Template"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}