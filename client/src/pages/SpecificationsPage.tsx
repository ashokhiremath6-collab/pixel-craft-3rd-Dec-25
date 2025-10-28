import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
import { Plus, MoreVertical, Pencil, Trash2, FileText, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import type { Specification } from "@shared/schema";

export default function SpecificationsPage() {
  const { toast } = useToast();
  const [category, setCategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSpec, setEditingSpec] = useState<Specification | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

  // Fetch categories
  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ["/api/specifications/categories"],
  });

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
      queryClient.invalidateQueries({ queryKey: ["/api/specifications/categories"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/specifications/categories"] });
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
    if (confirm("Are you sure you want to delete this specification?")) {
      deleteMutation.mutate(id);
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
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
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
              <div className="space-y-6">
                {Array.from(groupedSpecs.entries()).map(([categoryName, categorySpecs]) => (
                  <div key={categoryName} className="space-y-3">
                    <h3 className="text-lg font-semibold">{categoryName}</h3>
                    <div className="space-y-2">
                      {categorySpecs.map((spec) => (
                        <div
                          key={spec.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                          data-testid={`row-spec-${spec.id}`}
                        >
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-primary" />
                              <div>
                                <h4 className="font-medium">{spec.title}</h4>
                                {spec.description && (
                                  <p className="text-sm text-muted-foreground">{spec.description}</p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {spec.filePath && (
                              <a
                                href={spec.filePath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline flex items-center gap-1"
                                data-testid={`link-download-${spec.id}`}
                              >
                                <Download className="h-4 w-4" />
                                {spec.fileName && getFileType(spec.fileName)}
                              </a>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  data-testid={`button-menu-${spec.id}`}
                                >
                                  <MoreVertical className="h-4 w-4" />
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
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingSpec ? "Edit Specification" : "Add Specification"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  placeholder="e.g., AC Specifications, Audio System Specs"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  data-testid="input-category"
                  required
                />
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
      </div>
    </div>
  );
}
