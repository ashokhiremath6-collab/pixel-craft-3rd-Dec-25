import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, ImageIcon, FileText, X, Eye, Trash2, Loader2, FolderOpen, ExternalLink } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Moodboard, Project } from "@shared/schema";

export default function MoodboardsPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [canvaLink, setCanvaLink] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(""); // For upload form
  const [filterProjectId, setFilterProjectId] = useState<string>("all"); // For filtering display

  // Fetch projects for selection
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch moodboards from backend (with optional project filter)
  const { data: moodboards = [], isLoading } = useQuery({
    queryKey: ["/api/moodboards", filterProjectId !== "all" ? { projectId: filterProjectId } : {}],
    queryFn: async () => {
      const url = filterProjectId === "all" 
        ? "/api/moodboards" 
        : `/api/moodboards?projectId=${filterProjectId}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch moodboards");
      return response.json();
    },
  });

  // Upload moodboard mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/moodboards", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moodboards"] });
      // Reset form
      setSelectedFile(null);
      setDescription("");
      setTags("");
      setCanvaLink("");
      setSelectedProjectId("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      toast({
        title: "Moodboard uploaded",
        description: "Your moodboard has been added to your collection.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message,
      });
    },
  });

  // Delete moodboard mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/moodboards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moodboards"] });
      toast({
        title: "Moodboard deleted",
        description: "Moodboard has been removed from your collection.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message,
      });
    },
  });

  // Handle file selection
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Validate file type (images and PDFs from Canva)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload images (JPEG, PNG, SVG, WebP) or PDFs from Canva.",
      });
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: "destructive", 
        title: "File too large",
        description: "Please select a file smaller than 10MB.",
      });
      return;
    }
    
    setSelectedFile(file);
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        // Preview will be handled in the upload process
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle drag and drop
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
      handleFileSelect(e.dataTransfer.files);
    }
  };

  // Upload moodboard
  const handleUpload = async () => {
    if (!selectedFile) return;
    
    const formData = new FormData();
    formData.append("moodboard", selectedFile);
    if (description.trim()) {
      formData.append("description", description.trim());
    }
    if (tags.trim()) {
      formData.append("tags", tags.trim());
    }
    if (selectedProjectId && selectedProjectId !== "general") {
      formData.append("projectId", selectedProjectId);
    }
    if (canvaLink.trim()) {
      formData.append("canvaLink", canvaLink.trim());
    }
    
    uploadMutation.mutate(formData);
  };

  // Update moodboard with Canva link
  const updateCanvaLinkMutation = useMutation({
    mutationFn: async (data: { id: string; canvaLink: string }) => {
      return apiRequest('PUT', `/api/moodboards/${data.id}`, { canvaLink: data.canvaLink });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moodboards"] });
      setCanvaLink("");
      toast({
        title: "Success",
        description: "Canva link added to moodboard",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update moodboard",
        variant: "destructive",
      });
    },
  });

  const updateMoodboardCanvaLink = (moodboardId: string) => {
    if (canvaLink.trim()) {
      updateCanvaLinkMutation.mutate({ id: moodboardId, canvaLink: canvaLink.trim() });
    }
  };

  // Save Canva link only (without file upload)
  const handleSaveCanvaLinkOnly = async () => {
    if (!canvaLink.trim()) {
      toast({
        title: "Error",
        description: "Please enter a Canva link",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("canvaLink", canvaLink.trim());
    formData.append("linkOnly", "true");
    
    if (selectedProjectId && selectedProjectId !== "general") {
      formData.append("projectId", selectedProjectId);
    }
    
    uploadMutation.mutate(formData);
  };

  // Delete moodboard
  const deleteMoodboard = (id: string) => {
    deleteMutation.mutate(id);
  };

  // Get project name for display
  const getProjectName = (projectId: string | null) => {
    if (!projectId) return "General";
    const project = projects.find(p => p.id === projectId);
    return project ? project.projectName : "Unknown Project";
  };

  // Create preview URL for display
  const getPreviewUrl = (moodboard: Moodboard) => {
    // Return null for link-only entries (no file uploaded)
    if (!moodboard.fileName) return null;
    // Check for PDF using MIME type stored in database
    if (moodboard.fileType === 'pdf' || moodboard.fileType === 'application/pdf') return null;
    return `/uploads/moodboards/${moodboard.fileName}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold" data-testid="heading-moodboards">
            Moodboards
          </h1>
          <p className="text-muted-foreground">
            Upload and manage your moodboards from Canva for client presentations
          </p>
        </div>
        
        {/* Project Filter */}
        <div className="flex items-center gap-2 min-w-[240px]">
          <Label htmlFor="filter-project" className="text-sm whitespace-nowrap">
            Filter by:
          </Label>
          <Select value={filterProjectId} onValueChange={setFilterProjectId}>
            <SelectTrigger id="filter-project" data-testid="select-filter-project">
              <SelectValue placeholder="Select project..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Moodboards</SelectItem>
              <SelectItem value="general">General (No Project)</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.projectName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Moodboard
          </CardTitle>
          <CardDescription>
            Upload images (JPEG, PNG, SVG, WebP) or PDFs exported from Canva
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone-moodboard"
          >
            <p className="text-lg font-medium mb-2">
              Drop your moodboard here, or click to browse
            </p>
            <p className="text-sm text-muted-foreground">
              Support for JPEG, PNG, SVG, WebP, and PDF files up to 10MB
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/svg+xml,image/webp,application/pdf"
              onChange={(e) => handleFileSelect(e.target.files)}
              data-testid="input-file"
            />
          </div>

          {/* Always visible Canva Link field */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/10">
            <div className="space-y-2">
              <Label htmlFor="canva-link-always">Canva Link</Label>
              <Input
                id="canva-link-always"
                type="url"
                placeholder="https://www.canva.com/design/..."
                value={canvaLink}
                onChange={(e) => setCanvaLink(e.target.value)}
                data-testid="input-canva-link-always"
              />
              <p className="text-xs text-muted-foreground">
                Paste your Canva design link here
              </p>
              
              {/* Show save/create options when there's a Canva link but no file selected */}
              {canvaLink.trim() && !selectedFile && (
                <div className="pt-3 space-y-3 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="project-for-link">Select Project</Label>
                    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                      <SelectTrigger id="project-for-link" data-testid="select-project-for-link">
                        <SelectValue placeholder="Select a project..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General (No Project)</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.projectName} - {project.clientName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    onClick={handleSaveCanvaLinkOnly}
                    disabled={updateCanvaLinkMutation.isPending}
                    className="w-full"
                    data-testid="button-save-canva-link"
                  >
                    {updateCanvaLinkMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Canva Link"
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Selected File Info */}
          {selectedFile && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {selectedFile.type.startsWith('image/') ? (
                    <ImageIcon className="h-8 w-8 text-primary" />
                  ) : (
                    <FileText className="h-8 w-8 text-primary" />
                  )}
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedFile(null)}
                  data-testid="button-clear-file"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Describe this moodboard (e.g., 'Living room concept - modern minimalist')"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  data-testid="input-description"
                />
              </div>

              {/* Project Selection */}
              <div className="space-y-2">
                <Label htmlFor="project">Project (Optional)</Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger id="project" data-testid="select-project">
                    <SelectValue placeholder="Select a project or leave general..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General (No Project)</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.projectName} - {project.clientName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (Optional)</Label>
                <Input
                  id="tags"
                  placeholder="e.g., living room, modern, minimalist (comma separated)"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  data-testid="input-tags"
                />
              </div>

              {/* Canva Link */}
              <div className="space-y-2">
                <Label htmlFor="canva-link">Canva Link (Optional)</Label>
                <Input
                  id="canva-link"
                  type="url"
                  placeholder="https://www.canva.com/design/..."
                  value={canvaLink}
                  onChange={(e) => setCanvaLink(e.target.value)}
                  data-testid="input-canva-link"
                />
              </div>

              {/* Upload Button */}
              <Button 
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
                className="w-full"
                data-testid="button-upload-moodboard"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload Moodboard"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="text-center py-12">
            <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin" />
            <p className="text-muted-foreground">Loading your moodboards...</p>
          </CardContent>
        </Card>
      )}

      {/* Uploaded Moodboards */}
      {!isLoading && moodboards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Moodboards ({moodboards.length})</CardTitle>
            <CardDescription>
              Manage your uploaded moodboard collection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {moodboards.map((moodboard: Moodboard) => (
                <div key={moodboard.id} className="flex items-center gap-4 p-4 border rounded-lg hover-elevate">
                  {/* Icon/Preview */}
                  <div className="flex-shrink-0">
                    {getPreviewUrl(moodboard) ? (
                      <div className="w-16 h-16 rounded overflow-hidden">
                        <img 
                          src={getPreviewUrl(moodboard)!} 
                          alt={moodboard.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : moodboard.canvaLink && !moodboard.filePath ? (
                      <div className="w-16 h-16 rounded bg-primary/10 flex items-center justify-center">
                        <ExternalLink className="h-8 w-8 text-primary" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold truncate" title={getProjectName(moodboard.projectId)}>
                      {getProjectName(moodboard.projectId)}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Canva Design</span>
                      <span>•</span>
                      <span>{new Date(moodboard.uploadedAt).toLocaleDateString()}</span>
                    </div>
                    
                    {moodboard.canvaLink && (
                      <a
                        href={moodboard.canvaLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 hover:underline mt-1"
                        data-testid={`link-canva-${moodboard.id}`}
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>View Canva Design</span>
                      </a>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {getPreviewUrl(moodboard) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => window.open(getPreviewUrl(moodboard)!, '_blank')}
                        data-testid={`button-view-${moodboard.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700"
                      onClick={() => deleteMoodboard(moodboard.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${moodboard.id}`}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {!isLoading && moodboards.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No moodboards yet</h3>
            <p className="text-muted-foreground mb-4">
              Upload your first moodboard from Canva to get started
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}