import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Trash2, Edit, FileImage, File, Plus, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import type { Project, FloorPlan } from "@shared/schema";

const uploadFormSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  version: z.string().min(1, "Version is required"),
});

type UploadFormData = z.infer<typeof uploadFormSchema>;

const editFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  version: z.string().min(1, "Version is required"),
  isActive: z.boolean(),
});

type EditFormData = z.infer<typeof editFormSchema>;

export default function FloorPlansPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingFloorPlan, setEditingFloorPlan] = useState<FloorPlan | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch floor plans only when a project is selected
  const { data: floorPlans = [], isLoading: floorPlansLoading } = useQuery<FloorPlan[]>({
    queryKey: ['/api/floor-plans/project', selectedProjectId],
    enabled: !!selectedProjectId,
    queryFn: async () => {
      const response = await fetch(`/api/floor-plans/project/${selectedProjectId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch floor plans');
      return response.json();
    },
  });

  // Fetch projects for dropdown
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Upload form
  const uploadForm = useForm<UploadFormData>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      version: "1.0",
    },
  });

  // Edit form  
  const editForm = useForm<EditFormData>({
    resolver: zodResolver(editFormSchema),
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: UploadFormData) => {
      if (!selectedFile) throw new Error("No file selected");
      
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('projectId', data.projectId);
      formData.append('name', data.name);
      formData.append('description', data.description || '');
      formData.append('version', data.version);
      
      const response = await fetch('/api/floor-plans', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Floor plan uploaded successfully",
        description: "The floor plan has been saved and is now available.",
      });
      setSelectedFile(null);
      setUploadDialogOpen(false);
      uploadForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/floor-plans'] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message,
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EditFormData }) => {
      const response = await fetch(`/api/floor-plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Update failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Floor plan updated successfully",
        description: "Changes have been saved.",
      });
      setEditDialogOpen(false);
      setEditingFloorPlan(null);
      editForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/floor-plans'] });
    },
    onError: (error) => {
      toast({
        variant: "destructive", 
        title: "Update failed",
        description: error.message,
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/floor-plans/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Delete failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Floor plan deleted successfully",
        description: "The floor plan has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/floor-plans'] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Delete failed", 
        description: error.message,
      });
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      }
    }
  };

  const validateFile = (file: File): boolean => {
    const allowedTypes = [
      'application/pdf',
      'image/png', 
      'image/jpeg',
      'image/gif',
      'image/bmp',
      'image/tiff',
      'application/dwg',
      'application/dxf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.dwg', '.dxf', '.xlsx', '.docx'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Only image files, CAD files (DWG, DXF), PDF, Word, and Excel files are allowed.",
      });
      return false;
    }
    
    // 50MB limit
    if (file.size > 50 * 1024 * 1024) {
      toast({
        variant: "destructive", 
        title: "File too large",
        description: "File size must be less than 50MB.",
      });
      return false;
    }
    
    return true;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.match(/^(png|jpg|jpeg|gif|bmp|tiff)$/i)) {
      return <FileImage className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  // Helper function to ensure file paths have leading slash
  const getFileUrl = (filePath: string) => {
    return filePath.startsWith('/') ? filePath : `/${filePath}`;
  };

  const handleView = (floorPlan: FloorPlan) => {
    window.open(getFileUrl(floorPlan.filePath), '_blank', 'noopener,noreferrer');
  };

  const formatFileSize = (bytes: string) => {
    const size = parseInt(bytes);
    if (size === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(size) / Math.log(k));
    return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleEdit = (floorPlan: FloorPlan) => {
    setEditingFloorPlan(floorPlan);
    editForm.reset({
      name: floorPlan.name,
      description: floorPlan.description || '',
      version: floorPlan.version,
      isActive: floorPlan.isActive,
    });
    setEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this floor plan? This action cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleDownload = (floorPlan: FloorPlan) => {
    const link = document.createElement('a');
    link.href = `/${floorPlan.filePath}`;
    link.download = floorPlan.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get current project name
  const getCurrentProjectName = () => {
    const project = projects.find(p => p.id === selectedProjectId);
    return project?.projectName || 'Unknown Project';
  };

  return (
    <div className="container mx-auto p-4 space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-floor-plans-title">Floor Plans</h1>
          <p className="text-sm text-muted-foreground">Manage architectural drawings and floor plans for your projects</p>
        </div>
        
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-upload-floor-plan">
              <Plus className="h-4 w-4 mr-2" />
              Upload Floor Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload Floor Plan</DialogTitle>
              <DialogDescription>
                Upload architectural drawings, CAD files, or other floor plan documents
              </DialogDescription>
            </DialogHeader>
            
            <Form {...uploadForm}>
              <form onSubmit={uploadForm.handleSubmit((data) => uploadMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={uploadForm.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-project">
                            <SelectValue placeholder="Select a project" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects.map((project) => (
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

                <FormField
                  control={uploadForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Floor Plan Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Ground Floor Layout, Basement Plan" 
                          data-testid="input-name"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Additional details about this floor plan"
                          data-testid="input-description"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="version"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Version</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="1.0" 
                          data-testid="input-version"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <Label>File Upload</Label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center space-y-4 transition-colors ${
                      dragActive 
                        ? 'border-primary bg-primary/10' 
                        : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    data-testid="drop-zone-floor-plan"
                  >
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {selectedFile ? selectedFile.name : 'Drop your file here or click to browse'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supports: Images (PNG, JPG, GIF, BMP, TIFF), CAD (DWG, DXF), PDF, Excel
                      </p>
                      <p className="text-xs text-muted-foreground">Maximum size: 50MB</p>
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-browse-files"
                    >
                      Browse Files
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileSelect}
                      accept=".pdf,.png,.jpg,.jpeg,.gif,.bmp,.tiff,.dwg,.dxf,.xlsx,.docx"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setUploadDialogOpen(false)}
                    data-testid="button-cancel-upload"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={!selectedFile || uploadMutation.isPending}
                    data-testid="button-submit-upload"
                  >
                    {uploadMutation.isPending ? 'Uploading...' : 'Upload Floor Plan'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Project Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Project</CardTitle>
          <CardDescription>Choose a project to view its floor plans</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm">
            <Label className="mb-2 block">Project</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger data-testid="select-project-filter">
                <SelectValue placeholder="Select a project to view floor plans" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.projectName} - {project.clientName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!selectedProjectId ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileImage className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select a project to begin</h3>
            <p className="text-muted-foreground">
              Choose a project from the dropdown above to view and manage its floor plans
            </p>
          </CardContent>
        </Card>
      ) : floorPlansLoading ? (
        <div className="text-center py-8">
          <p>Loading floor plans...</p>
        </div>
      ) : floorPlans.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileImage className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No floor plans yet</h3>
            <p className="text-muted-foreground mb-4">
              Upload your first floor plan to get started
            </p>
            <Button onClick={() => setUploadDialogOpen(true)} data-testid="button-upload-first-floor-plan">
              <Plus className="h-4 w-4 mr-2" />
              Upload Floor Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span data-testid={`text-project-${selectedProjectId}`}>{getCurrentProjectName()}</span>
              <Badge variant="secondary" data-testid={`badge-count-${selectedProjectId}`}>
                {floorPlans.length} floor plan{floorPlans.length !== 1 ? 's' : ''}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {floorPlans.map((floorPlan) => (
                    <Card key={floorPlan.id} className="p-3" data-testid={`card-floor-plan-${floorPlan.id}`}>
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-2">
                            {getFileIcon(floorPlan.fileType)}
                            <div>
                              <h4 className="font-medium text-sm" data-testid={`text-name-${floorPlan.id}`}>
                                {floorPlan.name}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                v{floorPlan.version}
                              </p>
                            </div>
                          </div>
                          <div className="flex space-x-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleView(floorPlan)}
                              data-testid={`button-view-${floorPlan.id}`}
                              title="View in new tab"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEdit(floorPlan)}
                              data-testid={`button-edit-${floorPlan.id}`}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(floorPlan.id)}
                              data-testid={`button-delete-${floorPlan.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        {floorPlan.description && (
                          <p className="text-xs text-muted-foreground" data-testid={`text-description-${floorPlan.id}`}>
                            {floorPlan.description}
                          </p>
                        )}
                        
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span data-testid={`text-file-size-${floorPlan.id}`}>
                              {floorPlan.fileSize ? formatFileSize(floorPlan.fileSize) : 'Unknown size'}
                            </span>
                            <Badge 
                              variant={floorPlan.isActive ? "default" : "secondary"}
                              data-testid={`badge-status-${floorPlan.id}`}
                            >
                              {floorPlan.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          {floorPlan.uploadedAt && (
                            <p className="text-xs text-muted-foreground" data-testid={`text-upload-time-${floorPlan.id}`}>
                              {format(new Date(floorPlan.uploadedAt), 'dd MMM yyyy, HH:mm')}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Floor Plan</DialogTitle>
            <DialogDescription>
              Update floor plan details
            </DialogDescription>
          </DialogHeader>
          
          {editingFloorPlan && (
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit((data) => 
                updateMutation.mutate({ id: editingFloorPlan.id, data })
              )} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Floor Plan Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Ground Floor Layout" 
                          data-testid="input-edit-name"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Additional details about this floor plan"
                          data-testid="input-edit-description"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="version"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Version</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="1.0" 
                          data-testid="input-edit-version"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setEditDialogOpen(false)}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateMutation.isPending}
                    data-testid="button-save-edit"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}