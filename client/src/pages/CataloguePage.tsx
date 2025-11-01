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
import { Plus, MoreVertical, Pencil, Trash2, FileText, Download, ExternalLink, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function CataloguePage() {
  const { toast } = useToast();
  const [mainCategory, setMainCategory] = useState<string>("all");
  const [subcategory, setSubcategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogueItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<"file" | "url">("file");

  const form = useForm<InsertCatalogueItem>({
    resolver: zodResolver(insertCatalogueItemSchema),
    defaultValues: {
      mainCategory: "",
      subcategory: "",
      vendorBrand: "",
      description: "",
      catalogueUrl: "",
      attributes: "",
    },
  });

  // Fetch catalogue items
  const { data: items = [], isLoading, error: itemsError } = useQuery<CatalogueItem[]>({
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
  const { data: mainCategories = [], isLoading: categoriesLoading, error: categoriesError } = useQuery<string[]>({
    queryKey: ["/api/catalogue/categories"],
  });

  // Fetch ALL catalogue items for library view (no filters)
  const { data: allItems = [], isLoading: allItemsLoading, error: allItemsError } = useQuery<CatalogueItem[]>({
    queryKey: ["/api/catalogue", "all"],
    queryFn: async () => {
      const response = await fetch("/api/catalogue", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to fetch catalogue items");
      }
      return response.json();
    },
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
      let objectPath = null;
      let fileName = null;

      // If there's a file to upload, use direct upload to object storage
      if (selectedFile) {
        // Step 1: Get signed upload URL
        const uploadUrlResponse = await fetch("/api/catalogue/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ 
            fileName: selectedFile.name,
            fileType: selectedFile.type 
          }),
        });

        if (!uploadUrlResponse.ok) {
          throw new Error("Failed to get upload URL");
        }

        const { uploadUrl, objectPath: path, fileName: fname } = await uploadUrlResponse.json();
        
        // Step 2: Upload file directly to object storage
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: selectedFile,
          headers: {
            "Content-Type": selectedFile.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload file to storage");
        }

        objectPath = path;
        fileName = fname;
      }

      // Step 3: Save metadata to database
      const payload: any = {
        mainCategory: data.mainCategory,
        subcategory: data.subcategory,
        attributes: data.attributes || '',
      };

      if (data.vendorBrand) payload.vendorBrand = data.vendorBrand;
      if (data.description) payload.description = data.description;
      if (data.catalogueUrl) payload.catalogueUrl = data.catalogueUrl;
      
      if (objectPath && fileName) {
        payload.filePath = objectPath;
        payload.fileName = fileName;
      }

      console.log('Submitting catalogue item:', payload);

      const url = editingItem ? `/api/catalogue/${editingItem.id}` : "/api/catalogue";
      const method = editingItem ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Server error:', errorData);
        throw new Error(errorData.error || "Failed to save catalogue item");
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
        description: editingItem ? "Catalogue item updated successfully" : "Catalogue item uploaded successfully",
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
      await apiRequest("DELETE", `/api/catalogue/${id}`);
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
      // Set upload type based on existing data
      if (item.catalogueUrl) {
        setUploadType("url");
      } else if (item.fileName) {
        setUploadType("file");
      } else {
        setUploadType("file"); // default
      }
      form.reset({
        mainCategory: item.mainCategory,
        subcategory: item.subcategory,
        vendorBrand: item.vendorBrand || "",
        description: item.description || "",
        catalogueUrl: item.catalogueUrl || "",
        attributes: item.attributes,
      });
    } else {
      setEditingItem(null);
      setUploadType("file"); // default to file upload for new items
      // Auto-fill category and subcategory from current filter selection
      form.reset({
        mainCategory: mainCategory !== "all" ? mainCategory : "",
        subcategory: subcategory !== "all" ? subcategory : "",
        vendorBrand: "",
        description: "",
        catalogueUrl: "",
        attributes: "",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setSelectedFile(null);
    setUploadType("file");
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

  // Group all items by category for library view (only items with files or URLs)
  const groupedItems = useMemo(() => {
    const catalogueItems = allItems.filter(
      (item) => (item.fileName && item.filePath) || item.catalogueUrl
    );

    const groups = new Map<string, Map<string, CatalogueItem[]>>();

    catalogueItems.forEach((item) => {
      if (!groups.has(item.mainCategory)) {
        groups.set(item.mainCategory, new Map());
      }
      const subgroups = groups.get(item.mainCategory)!;
      if (!subgroups.has(item.subcategory)) {
        subgroups.set(item.subcategory, []);
      }
      subgroups.get(item.subcategory)!.push(item);
    });

    // Sort categories and subcategories alphabetically
    const sortedGroups = new Map(
      Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
    );

    sortedGroups.forEach((subgroups) => {
      const sortedSubgroups = new Map(
        Array.from(subgroups.entries()).sort(([a], [b]) => a.localeCompare(b))
      );
      subgroups.clear();
      sortedSubgroups.forEach((items, key) => {
        subgroups.set(key, items);
      });
    });

    return sortedGroups;
  }, [allItems]);

  // Helper to get file type from filename
  const getFileType = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'PDF';
      case 'docx': return 'Word';
      case 'xlsx': return 'Excel';
      case 'png':
      case 'jpg':
      case 'jpeg': return 'Image';
      case 'gif':
      case 'bmp':
      case 'tiff': return 'Image';
      default: return 'File';
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 max-w-7xl mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Catalogues</h1>
            <p className="text-muted-foreground mt-1">
              Interior design product taxonomy for presentations
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()} data-testid="button-add-item">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>

        <Tabs defaultValue="grid" className="space-y-3">
          <TabsList data-testid="tabs-catalogue-view">
            <TabsTrigger value="grid" data-testid="tab-grid">Grid View</TabsTrigger>
            <TabsTrigger value="library" data-testid="tab-library">Library</TabsTrigger>
          </TabsList>

          <TabsContent value="grid" className="space-y-3">
            <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base">Filter Products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              <div className="text-center py-8 text-muted-foreground">Loading catalogue items...</div>
            ) : itemsError ? (
              <div className="text-center py-8 text-destructive">
                Error loading items. Please refresh the page.
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No catalogue items found. {items.length > 0 && "Try changing your filter selection."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold text-sm">Main Category</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Subcategory</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Vendor / Brand</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Description</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Attributes</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Reference</th>
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
                        <td className="py-3 px-4 text-sm">
                          {item.vendorBrand || <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {item.description || <span className="text-muted-foreground">-</span>}
                        </td>
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
                          ) : item.catalogueUrl ? (
                            <a
                              href={item.catalogueUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-primary hover:underline"
                              data-testid={`link-url-${item.id}`}
                            >
                              <Download className="h-4 w-4" />
                              View Catalogue
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
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
          </TabsContent>

          <TabsContent value="library" className="space-y-3">
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base">
                  Catalogue Library
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({Array.from(groupedItems.values()).reduce((sum, subgroups) => 
                      sum + Array.from(subgroups.values()).reduce((subSum, items) => subSum + items.length, 0), 0
                    )} catalogues)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {allItemsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading library...</div>
                ) : allItemsError ? (
                  <div className="text-center py-8 text-destructive">
                    Error loading catalogue library. Please refresh the page.
                  </div>
                ) : groupedItems.size === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No catalogues uploaded yet</p>
                    <p className="text-sm mt-1">Upload files or add URL links to see them here</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Array.from(groupedItems.entries()).map(([mainCat, subgroups]) => (
                      <Collapsible key={mainCat} defaultOpen>
                        <div className="border rounded-md">
                          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover-elevate active-elevate-2" data-testid={`category-${mainCat}`}>
                            <div className="flex items-center gap-2">
                              <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                              <h3 className="font-medium text-sm">{mainCat}</h3>
                              <Badge variant="secondary" className="ml-2">
                                {Array.from(subgroups.values()).reduce((sum, items) => sum + items.length, 0)}
                              </Badge>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t">
                              {Array.from(subgroups.entries()).map(([subcat, items]) => (
                                <div key={subcat} className="border-b last:border-b-0">
                                  <div className="bg-muted/50 px-4 py-2">
                                    <h4 className="font-medium text-sm">{subcat}</h4>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full">
                                      <thead>
                                        <tr className="border-b bg-muted/30">
                                          <th className="text-left py-2 px-4 text-xs font-semibold">Vendor/Brand</th>
                                          <th className="text-left py-2 px-4 text-xs font-semibold">Description</th>
                                          <th className="text-left py-2 px-4 text-xs font-semibold">File/Link</th>
                                          <th className="text-left py-2 px-4 text-xs font-semibold">Type</th>
                                          <th className="text-left py-2 px-4 text-xs font-semibold">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {items.map((item) => (
                                          <tr key={item.id} className="border-b last:border-b-0 hover-elevate" data-testid={`library-item-${item.id}`}>
                                            <td className="py-2 px-4 text-sm">
                                              {item.vendorBrand || <span className="text-muted-foreground">-</span>}
                                            </td>
                                            <td className="py-2 px-4 text-sm max-w-md">
                                              <div className="line-clamp-2">
                                                {item.description || <span className="text-muted-foreground">-</span>}
                                              </div>
                                            </td>
                                            <td className="py-2 px-4 text-sm">
                                              {item.fileName || 'URL Link'}
                                            </td>
                                            <td className="py-2 px-4 text-sm">
                                              {item.fileName ? (
                                                <Badge variant="outline" className="text-xs">
                                                  {getFileType(item.fileName)}
                                                </Badge>
                                              ) : (
                                                <Badge variant="outline" className="text-xs">
                                                  <ExternalLink className="h-3 w-3 mr-1" />
                                                  URL
                                                </Badge>
                                              )}
                                            </td>
                                            <td className="py-2 px-4 text-sm">
                                              {item.filePath ? (
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  asChild
                                                  data-testid={`button-view-${item.id}`}
                                                >
                                                  <a
                                                    href={item.filePath}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                  >
                                                    <Download className="h-4 w-4 mr-1" />
                                                    View
                                                  </a>
                                                </Button>
                                              ) : item.catalogueUrl ? (
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  asChild
                                                  data-testid={`button-open-${item.id}`}
                                                >
                                                  <a
                                                    href={item.catalogueUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                  >
                                                    <ExternalLink className="h-4 w-4 mr-1" />
                                                    Open
                                                  </a>
                                                </Button>
                                              ) : null}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
                  render={({ field }) => {
                    // Get subcategories for the selected main category
                    const selectedMainCategory = form.watch("mainCategory");
                    const availableSubcategories = selectedMainCategory
                      ? Array.from(
                          new Set(
                            allItems
                              .filter((item) => item.mainCategory === selectedMainCategory)
                              .map((item) => item.subcategory)
                          )
                        ).sort()
                      : [];

                    return (
                      <FormItem>
                        <FormLabel>Subcategory</FormLabel>
                        {availableSubcategories.length > 0 ? (
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-subcategory">
                                <SelectValue placeholder="Select a subcategory" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableSubcategories.map((subcat) => (
                                <SelectItem key={subcat} value={subcat}>
                                  {subcat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <FormControl>
                            <Input
                              placeholder="Enter subcategory (select main category first)"
                              {...field}
                              data-testid="input-subcategory"
                            />
                          </FormControl>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="vendorBrand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor / Brand (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., IKEA, Herman Miller, Godrej"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-vendor-brand"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Modern 3-seater sectional sofa with velvet upholstery"
                          rows={2}
                          {...field}
                          value={field.value || ""}
                          data-testid="input-description"
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
                      <FormLabel>Attributes (Optional)</FormLabel>
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
                  <label className="text-sm font-medium">Catalogue Reference (Optional)</label>
                  <Select
                    value={uploadType}
                    onValueChange={(value: "file" | "url") => {
                      setUploadType(value);
                      // Clear the other option when switching
                      if (value === "file") {
                        form.setValue("catalogueUrl", "");
                      } else {
                        setSelectedFile(null);
                      }
                    }}
                    data-testid="select-upload-type"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="file">Upload File</SelectItem>
                      <SelectItem value="url">Paste URL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {uploadType === "file" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Upload Catalogue File</label>
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
                    <p className="text-xs text-muted-foreground">
                      Accepted: PDF, Word (.docx), Excel (.xlsx), Images (PNG, JPG, GIF, BMP, TIFF)
                    </p>
                  </div>
                )}

                {uploadType === "url" && (
                  <FormField
                    control={form.control}
                    name="catalogueUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Catalogue URL</FormLabel>
                        <FormControl>
                          <Input
                            type="url"
                            placeholder="e.g., https://sleepwell.com/mattresses/catalogue"
                            {...field}
                            value={field.value || ""}
                            data-testid="input-catalogue-url"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Paste the link to the online product catalogue
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
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
                    {saveMutation.isPending ? "Uploading..." : editingItem ? "Update" : "Upload"}
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
