import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCatalogueItemSchema } from "@shared/schema";
import type { InsertCatalogueItem, CatalogueItem } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, MoreVertical, Pencil, Trash2, FileText, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

export default function CataloguePage() {
  const { toast } = useToast();
  const [mainCategory, setMainCategory] = useState<string>("all");
  const [subcategory, setSubcategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogueItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const form = useForm<InsertCatalogueItem>({
    resolver: zodResolver(insertCatalogueItemSchema),
    defaultValues: {
      mainCategory: "",
      subcategory: "",
      attributes: "",
    },
  });

  // Fetch catalogue items
  const { data: items = [], isLoading } = useQuery<CatalogueItem[]>({
    queryKey: ["/api/catalogue", mainCategory, subcategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (mainCategory && mainCategory !== "all") {
        params.append("mainCategory", mainCategory);
      }
      if (subcategory && subcategory !== "all") {
        params.append("subcategory", subcategory);
      }
      const url = `/api/catalogue${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to fetch catalogue items");
      }
      return response.json();
    },
  });

  // Fetch main categories
  const { data: mainCategories = [] } = useQuery<string[]>({
    queryKey: ["/api/catalogue/categories"],
  });

  // Get unique subcategories for the selected main category
  const subcategories = useMemo(() => {
    if (mainCategory === "all") return [];
    return Array.from(
      new Set(
        items
          .filter((item) => item.mainCategory === mainCategory)
          .map((item) => item.subcategory)
      )
    ).sort();
  }, [items, mainCategory]);

  // Reset subcategory when main category changes
  const handleMainCategoryChange = (value: string) => {
    setMainCategory(value);
    setSubcategory("all");
  };

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: InsertCatalogueItem) => {
      const formData = new FormData();
      formData.append("mainCategory", data.mainCategory);
      formData.append("subcategory", data.subcategory);
      formData.append("attributes", data.attributes);
      
      if (selectedFile) {
        formData.append("file", selectedFile);
      }

      const url = editingItem ? `/api/catalogue/${editingItem.id}` : "/api/catalogue";
      const method = editingItem ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to save catalogue item");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catalogue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/catalogue/categories"] });
      setDialogOpen(false);
      setEditingItem(null);
      setSelectedFile(null);
      form.reset();
      toast({
        title: "Success",
        description: editingItem ? "Catalogue item updated successfully" : "Catalogue item created successfully",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save catalogue item",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/catalogue/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catalogue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/catalogue/categories"] });
      toast({
        title: "Success",
        description: "Catalogue item deleted successfully",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete catalogue item",
      });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this catalogue item?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenDialog = (item?: CatalogueItem) => {
    setSelectedFile(null); // Always clear selected file when opening dialog
    if (item) {
      setEditingItem(item);
      form.reset({
        mainCategory: item.mainCategory,
        subcategory: item.subcategory,
        attributes: item.attributes,
      });
    } else {
      setEditingItem(null);
      form.reset({
        mainCategory: "",
        subcategory: "",
        attributes: "",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setSelectedFile(null);
    form.reset();
  };

  const onSubmit = (data: InsertCatalogueItem) => {
    saveMutation.mutate(data);
  };

  // Filter items based on selection
  const filteredItems = useMemo(() => {
    let result = items;
    if (mainCategory !== "all") {
      result = result.filter((item) => item.mainCategory === mainCategory);
    }
    if (subcategory !== "all") {
      result = result.filter((item) => item.subcategory === subcategory);
    }
    return result;
  }, [items, mainCategory, subcategory]);

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Catalogues</h1>
            <p className="text-muted-foreground mt-1">
              Interior design product taxonomy for presentations
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()} data-testid="button-add-item">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filter Products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Main Category</label>
                <Select
                  value={mainCategory}
                  onValueChange={handleMainCategoryChange}
                  data-testid="select-main-category"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">All Categories</SelectItem>
                    {mainCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Subcategory</label>
                <Select
                  value={subcategory}
                  onValueChange={setSubcategory}
                  disabled={mainCategory === "all" || subcategories.length === 0}
                  data-testid="select-subcategory"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subcategory" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">All Subcategories</SelectItem>
                    {subcategories.map((sub) => (
                      <SelectItem key={sub} value={sub}>
                        {sub}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Catalogue Items
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({filteredItems.length} {filteredItems.length === 1 ? "item" : "items"})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No catalogue items found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold text-sm">Main Category</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Subcategory</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Attributes</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">File</th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b hover-elevate"
                        data-testid={`row-catalogue-item-${item.id}`}
                      >
                        <td className="py-3 px-4 text-sm">{item.mainCategory}</td>
                        <td className="py-3 px-4 text-sm">{item.subcategory}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {item.attributes}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {item.fileName && item.filePath ? (
                            <a
                              href={item.filePath}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-primary hover:underline"
                              data-testid={`link-file-${item.id}`}
                            >
                              <FileText className="h-4 w-4" />
                              {item.fileName}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">No file</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-menu-${item.id}`}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleOpenDialog(item)}
                                data-testid={`button-edit-${item.id}`}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDelete(item.id)}
                                data-testid={`button-delete-${item.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "Edit Catalogue Item" : "Add Catalogue Item"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="mainCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Main Category</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Furniture, Lighting, Kitchens"
                          {...field}
                          data-testid="input-main-category"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subcategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subcategory</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Sofas & Sectionals, Ceiling Lights"
                          {...field}
                          data-testid="input-subcategory"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="attributes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Attributes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Style, seats, fabric/leather, modular, recliner, dimensions"
                          rows={3}
                          {...field}
                          data-testid="input-attributes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Catalogue File (Optional)</label>
                  <Input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.gif,.bmp,.tiff,.xlsx,.docx"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    data-testid="input-file"
                  />
                  {selectedFile && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {selectedFile.name}
                    </p>
                  )}
                  {editingItem?.fileName && !selectedFile && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Current file: {editingItem.fileName}
                    </p>
                  )}
                </div>
                
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={saveMutation.isPending}
                    data-testid="button-save"
                  >
                    {saveMutation.isPending ? "Saving..." : editingItem ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
