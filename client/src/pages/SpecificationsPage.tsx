import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { FileViewerModal } from "@/components/FileViewerModal";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, MoreVertical, Pencil, Trash2, FileText, Download, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import type { Specification, VendorCategory } from "@shared/schema";

export default function SpecificationsPage() {
  const { toast } = useToast();
  const [category, setCategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSpec, setEditingSpec] = useState<Specification | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<{url: string, name: string} | null>(null);
  const [formData, setFormData] = useState({
    category: "",
    title: "",
    description: "",
  });

  // Fetch specifications
  const { data: specs = [], isLoading } = useQuery<Specification[]>({
    queryKey: ["/api/specifications", category],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category && category !== "all") {
        params.append("category", category);
      }
      const url = `/api/specifications${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to fetch specifications");
      }
      return response.json();
    },
  });

  // Fetch vendor categories (same as vendors page)
  const { data: vendorCategories = [] } = useQuery<VendorCategory[]>({
    queryKey: ['/api/vendor-categories/tree'],
  });

  // Extract flat list of category names for dropdown
  const categoryNames = useMemo(() => {
    const names: string[] = [];
    vendorCategories.forEach((cat) => {
      names.push(cat.name);
    });
    return names.sort();
  }, [vendorCategories]);

  // Filter specs based on selection
  const filteredSpecs = useMemo(() => {
    if (category === "all") return specs;
    return specs.filter((spec) => spec.category === category);
  }, [specs, category]);

  // Group specs by category
  const groupedSpecs = useMemo(() => {
    const groups = new Map<string, Specification[]>();
    filteredSpecs.forEach((spec) => {
      if (!groups.has(spec.category)) {
        groups.set(spec.category, []);
      }
      groups.get(spec.category)!.push(spec);
    });
    return new Map(Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)));
  }, [filteredSpecs]);

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { category: string; title: string; description: string }) => {
      const formDataToSend = new FormData();
      formDataToSend.append("category", data.category);
      formDataToSend.append("title", data.title);
      formDataToSend.append("description", data.description);
      
      if (selectedFile) {
        formDataToSend.append("file", selectedFile);
      } else if (!editingSpec) {
        throw new Error("File is required for new specifications");
      }

      const url = editingSpec ? `/api/specifications/${editingSpec.id}` : "/api/specifications";
      const method = editingSpec ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        body: formDataToSend,
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save specification");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/specifications"] });
      setDialogOpen(false);
      setEditingSpec(null);
      setSelectedFile(null);
      setFormData({ category: "", title: "", description: "" });
      toast({
        title: "Success",
        description: editingSpec ? "Specification updated successfully" : "Specification uploaded successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save specification",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/specifications/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to delete specification");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/specifications"] });
      toast({
        title: "Success",
        description: "Specification deleted successfully",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete specification",
      });
    },
  });

  const handleDelete = (id: string) => {
    setDeletingId(id);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteMutation.mutate(deletingId);
      setDeletingId(null);
    }
  };

  const handleOpenDialog = (spec?: Specification) => {
    setSelectedFile(null);
    if (spec) {
      setEditingSpec(spec);
      setFormData({
        category: spec.category,
        title: spec.title,
        description: spec.description || "",
      });
    } else {
      setEditingSpec(null);
      const defaultCategory = category !== "all" ? category : "";
      setFormData({
        category: defaultCategory,
        title: "",
        description: "",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSpec(null);
    setSelectedFile(null);
    setFormData({ category: "", title: "", description: "" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category || !formData.title) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Category and title are required",
      });
      return;
    }
    saveMutation.mutate(formData);
  };

  const getFileType = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'PDF';
      case 'docx': return 'Word';
      case 'doc': return 'Word';
      case 'xlsx': return 'Excel';
      case 'xls': return 'Excel';
      default: return 'File';
    }
  };


  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Specifications</h1>
            <p className="text-muted-foreground mt-1">
              Category-wise specification documents
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()} data-testid="button-add-spec">
            <Plus className="h-4 w-4 mr-2" />
            Add Specification
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filter by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={category}
              onValueChange={setCategory}
              data-testid="select-category"
            >
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all">All Categories</SelectItem>
                {categoryNames.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Specification Documents
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({filteredSpecs.length} {filteredSpecs.length === 1 ? "document" : "documents"})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading specifications...</div>
            ) : filteredSpecs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No specifications found. {category !== "all" && "Try changing your filter selection."}
              </div>
            ) : (
              <div className="space-y-4">
                {Array.from(groupedSpecs.entries()).map(([categoryName, categorySpecs]) => (
                  <div key={categoryName} className="space-y-2">
                    <h3 className="text-base font-semibold">{categoryName}</h3>
                    <div className="space-y-1.5">
                      {categorySpecs.map((spec) => (
                        <div
                          key={spec.id}
                          className="flex items-center justify-between p-2.5 border rounded-lg hover-elevate"
                          data-testid={`row-spec-${spec.id}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                              <div className="min-w-0">
                                <h4 className="font-medium text-sm">{spec.title}</h4>
                                {spec.description && (
                                  <p className="text-xs text-muted-foreground">{spec.description}</p>
                                )}
                                {spec.uploadedAt && (
                                  <p className="text-xs text-muted-foreground" data-testid={`text-upload-time-${spec.id}`}>
                                    {format(new Date(spec.uploadedAt), 'dd MMM yyyy, HH:mm')}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {spec.filePath && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setViewingFile({ url: spec.filePath!, name: spec.fileName || 'Document' })}
                                  data-testid={`button-view-${spec.id}`}
                                  className="text-primary"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <a
                                  href={spec.filePath}
                                  download={spec.fileName}
                                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 px-2"
                                  data-testid={`link-download-${spec.id}`}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  {spec.fileName && getFileType(spec.fileName)}
                                </a>
                              </>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  data-testid={`button-menu-${spec.id}`}
                                  className="h-7 w-7 p-0"
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleOpenDialog(spec)}
                                  data-testid={`button-edit-${spec.id}`}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDelete(spec.id)}
                                  data-testid={`button-delete-${spec.id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
          <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSpec ? "Edit Specification" : "Add Specification"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                  required
                >
                  <SelectTrigger id="category" data-testid="select-category-form">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {categoryNames.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., VRV System Requirements"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  data-testid="input-title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional description or notes"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  data-testid="input-description"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">
                  {editingSpec ? "Replace Document (optional)" : "Document *"}
                </Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  data-testid="input-file"
                  required={!editingSpec}
                />
                {editingSpec && editingSpec.fileName && !selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Current file: {editingSpec.fileName}
                  </p>
                )}
              </div>

              <DialogFooter className="gap-2">
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
                  {saveMutation.isPending ? "Saving..." : editingSpec ? "Update" : "Upload"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <DeleteConfirmDialog
          isOpen={!!deletingId}
          onClose={() => setDeletingId(null)}
          onConfirm={confirmDelete}
          isDeleting={deleteMutation.isPending}
        />

        <FileViewerModal
          isOpen={!!viewingFile}
          onClose={() => setViewingFile(null)}
          fileUrl={viewingFile?.url || ''}
          fileName={viewingFile?.name}
        />
      </div>
    </div>
  );
}
