import { useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, ImageIcon, FileText, X, Eye, Trash2, Loader2, FolderOpen, ExternalLink, Download, FolderInput, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Moodboard, Project, User } from "@shared/schema";
import { User as UserIcon } from "lucide-react";
import { FileViewerModal } from "@/components/FileViewerModal";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

export default function MoodboardsPage() {
  const { toast } = useToast();
  const [location] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [canvaLink, setCanvaLink] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(""); // For upload form
  const [selectedFolder, setSelectedFolder] = useState<string>(""); // For working drawings folder
  // Require project selection - no "all" option
  const [filterProjectId, setFilterProjectId] = useState<string>("");
  const [previewImage, setPreviewImage] = useState<Moodboard | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Determine asset type based on route
  const assetType = useMemo(() => {
    if (location === "/working-drawings") return "working_drawing";
    if (location === "/renders") return "render";
    return "moodboard";
  }, [location]);

  // Dynamic labels based on asset type
  const labels = useMemo(() => {
    if (assetType === "working_drawing") {
      return {
        title: "Working Drawings",
        description: "Upload and manage your technical drawings for client presentations",
        uploadButton: "Upload Working Drawing",
        linkLabel: "Upload Link",
        emptyState: "No working drawings yet",
        emptyStateDescription: "Upload your first working drawing to get started",
        successTitle: "Working drawing uploaded",
        successDescription: "Your working drawing has been added to your collection.",
        deleteTitle: "Working drawing deleted",
        deleteDescription: "Working drawing has been removed from your collection.",
        uploadFailedTitle: "Upload failed",
        deleteFailedTitle: "Delete failed",
        dropzoneText: "Drop your working drawing here, or click to browse",
        linkOnlyError: "Please enter a link",
        linkAddedTitle: "Success",
        linkAddedDescription: "Link added to working drawing",
        updateFailedTitle: "Error",
        updateFailedDescription: "Failed to update working drawing",
        linkFieldLabel: "Upload Link",
        linkFieldPlaceholder: "https://...",
        linkFieldDescription: "Paste your design link here",
        saveOnlyLinkButton: "Save Link Only",
        listMetadataText: "Design",
        viewLinkText: "View Design",
        loadingText: "Loading your working drawings...",
        uploadDescription: "Upload images (JPEG, PNG, SVG, WebP) or PDFs",
        invalidFileTypeTitle: "Invalid file type",
        invalidFileTypeDescription: "Please upload images (JPEG, PNG, SVG, WebP) or PDFs.",
        fileTooLargeTitle: "File too large",
        fileTooLargeDescription: "Please select a file smaller than 10MB.",
        descriptionPlaceholder: "Describe this working drawing...",
      };
    }
    if (assetType === "render") {
      return {
        title: "Renders",
        description: "Upload and manage your rendered visuals for client presentations",
        uploadButton: "Upload Render",
        linkLabel: "Upload Link",
        emptyState: "No renders yet",
        emptyStateDescription: "Upload your first render to get started",
        successTitle: "Render uploaded",
        successDescription: "Your render has been added to your collection.",
        deleteTitle: "Render deleted",
        deleteDescription: "Render has been removed from your collection.",
        uploadFailedTitle: "Upload failed",
        deleteFailedTitle: "Delete failed",
        dropzoneText: "Drop your render here, or click to browse",
        linkOnlyError: "Please enter a link",
        linkAddedTitle: "Success",
        linkAddedDescription: "Link added to render",
        updateFailedTitle: "Error",
        updateFailedDescription: "Failed to update render",
        linkFieldLabel: "Upload Link",
        linkFieldPlaceholder: "https://...",
        linkFieldDescription: "Paste your design link here",
        saveOnlyLinkButton: "Save Link Only",
        listMetadataText: "Design",
        viewLinkText: "View Design",
        loadingText: "Loading your renders...",
        uploadDescription: "Upload images (JPEG, PNG, SVG, WebP) or PDFs",
        invalidFileTypeTitle: "Invalid file type",
        invalidFileTypeDescription: "Please upload images (JPEG, PNG, SVG, WebP) or PDFs.",
        fileTooLargeTitle: "File too large",
        fileTooLargeDescription: "Please select a file smaller than 10MB.",
        descriptionPlaceholder: "Describe this render...",
      };
    }
    return {
      title: "Moodboards",
      description: "Upload and manage your creative assets from Canva for client presentations",
      uploadButton: "Upload Moodboard",
      linkLabel: "Paste link",
      emptyState: "No moodboards yet",
      emptyStateDescription: "Upload your first moodboard from Canva to get started",
      successTitle: "Moodboard uploaded",
      successDescription: "Your moodboard has been added to your collection.",
      deleteTitle: "Moodboard deleted",
      deleteDescription: "Moodboard has been removed from your collection.",
      uploadFailedTitle: "Upload failed",
      deleteFailedTitle: "Delete failed",
      dropzoneText: "Drop your moodboard here, or click to browse",
      linkOnlyError: "Please enter a link",
      linkAddedTitle: "Success",
      linkAddedDescription: "Link added to moodboard",
      updateFailedTitle: "Error",
      updateFailedDescription: "Failed to update moodboard",
      linkFieldLabel: "Paste link",
      linkFieldPlaceholder: "https://www.canva.com/design/...",
      linkFieldDescription: "Paste your design link here",
      saveOnlyLinkButton: "Save Link Only",
      listMetadataText: "Canva Design",
      viewLinkText: "View Canva Design",
      loadingText: "Loading your moodboards...",
      uploadDescription: "Upload images (JPEG, PNG, SVG, WebP) or PDFs exported from Canva",
      invalidFileTypeTitle: "Invalid file type",
      invalidFileTypeDescription: "Please upload images (JPEG, PNG, SVG, WebP) or PDFs from Canva.",
      fileTooLargeTitle: "File too large",
      fileTooLargeDescription: "Please select a file smaller than 10MB.",
      descriptionPlaceholder: "Describe this moodboard...",
    };
  }, [assetType]);

  // Fetch projects for selection
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch users to display who saved each render
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Create a lookup map for users
  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((user: User) => {
      const name = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.email || 'Unknown';
      map.set(user.id, name);
    });
    return map;
  }, [users]);

  // Helper function to get user name by ID
  const getSavedByName = (userId: string | null | undefined) => {
    if (!userId) return null;
    return userMap.get(userId) || null;
  };

  // Fetch moodboards from backend (with optional project and assetType filters)
  // For working drawings/renders, require explicit project selection
  // For moodboards, load automatically when filterProjectId is set (including "all")
  const shouldFetchMoodboards = assetType === "moodboard" ? (filterProjectId !== "") : (filterProjectId !== "");
  
  const { data: moodboards = [], isLoading } = useQuery({
    queryKey: ["/api/moodboards", filterProjectId !== "all" ? { projectId: filterProjectId } : {}, assetType],
    enabled: shouldFetchMoodboards,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterProjectId && filterProjectId !== "all") {
        params.append("projectId", filterProjectId);
      }
      params.append("assetType", assetType);
      
      const url = `/api/moodboards?${params.toString()}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch moodboards");
      return response.json();
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Helper function to get project name
  const getProjectName = (projectId: string | null) => {
    if (!projectId) return "General";
    const project = projects.find(p => p.id === projectId);
    return project ? project.projectName : "Unknown Project";
  };

  // Helper function to strip project name prefix from display title
  const getDisplayTitle = (moodboard: Moodboard) => {
    const title = moodboard.description || moodboard.fileName || '';
    if (!moodboard.projectId || !title) return title;
    
    const projectName = getProjectName(moodboard.projectId);
    if (!projectName || projectName === "General" || projectName === "Unknown Project") return title;
    
    // Get all project names to check against (including the current one)
    const allProjectNames = projects.map(p => p.projectName).filter(Boolean);
    
    // Try to match any project name prefix and remove it
    for (const name of allProjectNames) {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const patterns = [
        new RegExp(`^${escapedName}\\s*[-–—:]?\\s*`, 'i'),
        new RegExp(`^${escapedName}\\s+`, 'i'),
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(title)) {
          return title.replace(pattern, '').trim();
        }
      }
    }
    return title;
  };

  // Room type order for sorting
  const roomTypeOrder = [
    "Living Room", "Bedroom", "Kitchen", "Dining Room", "Bathroom", 
    "Study", "Kids Room", "Guest Room", "Puja Room", "Hallway", 
    "Walk-in Closet", "Balcony", "General"
  ];

  // Folder options for working drawings
  const workingDrawingFolders = [
    "Floor Plans",
    "Elevations", 
    "Electrical Layouts",
    "Plumbing Layouts",
    "HVAC Layouts",
    "Ceiling Layouts",
    "Furniture Layouts",
    "Kitchen Details",
    "Wardrobe Details",
    "Bathroom Details",
    "Joinery Details",
    "Carpentry",
    "Automation",
    "Flooring",
    "Wall Finishes",
    "Art",
    "Acoustics",
    "Site Measurements",
    "As-Built Drawings",
    "Shop Drawings",
    "Other"
  ];

  // Group moodboards by project, and for renders also by room type, for working drawings by folder
  const groupedMoodboards = useMemo(() => {
    const groups: Record<string, { 
      projectName: string; 
      items: Moodboard[];
      roomGroups?: Record<string, Moodboard[]>;
      folderGroups?: Record<string, Moodboard[]>;
    }> = {};
    
    moodboards.forEach((moodboard: Moodboard) => {
      const projectId = moodboard.projectId || 'general';
      const projectName = getProjectName(moodboard.projectId);
      
      if (!groups[projectId]) {
        groups[projectId] = {
          projectName,
          items: [],
          roomGroups: assetType === "render" ? {} : undefined,
          folderGroups: assetType === "working_drawing" ? {} : undefined,
        };
      }
      groups[projectId].items.push(moodboard);
      
      // For renders, also group by room type
      if (assetType === "render" && groups[projectId].roomGroups) {
        const roomType = (moodboard as any).roomType || "General";
        if (!groups[projectId].roomGroups![roomType]) {
          groups[projectId].roomGroups![roomType] = [];
        }
        groups[projectId].roomGroups![roomType].push(moodboard);
      }
      
      // For working drawings, group by folder
      if (assetType === "working_drawing" && groups[projectId].folderGroups) {
        const folder = (moodboard as any).folder || "Uncategorized";
        if (!groups[projectId].folderGroups![folder]) {
          groups[projectId].folderGroups![folder] = [];
        }
        groups[projectId].folderGroups![folder].push(moodboard);
      }
    });
    
    // Sort room groups by predefined order
    if (assetType === "render") {
      Object.values(groups).forEach(group => {
        if (group.roomGroups) {
          const sortedRoomGroups: Record<string, Moodboard[]> = {};
          roomTypeOrder.forEach(roomType => {
            if (group.roomGroups![roomType]) {
              sortedRoomGroups[roomType] = group.roomGroups![roomType];
            }
          });
          // Add any room types not in predefined order
          Object.keys(group.roomGroups).forEach(roomType => {
            if (!sortedRoomGroups[roomType]) {
              sortedRoomGroups[roomType] = group.roomGroups![roomType];
            }
          });
          group.roomGroups = sortedRoomGroups;
        }
      });
    }
    
    // Sort folder groups by predefined order
    if (assetType === "working_drawing") {
      Object.values(groups).forEach(group => {
        if (group.folderGroups) {
          const sortedFolderGroups: Record<string, Moodboard[]> = {};
          workingDrawingFolders.forEach(folder => {
            if (group.folderGroups![folder]) {
              sortedFolderGroups[folder] = group.folderGroups![folder];
            }
          });
          // Add Uncategorized and any folders not in predefined order
          if (group.folderGroups["Uncategorized"]) {
            sortedFolderGroups["Uncategorized"] = group.folderGroups["Uncategorized"];
          }
          Object.keys(group.folderGroups).forEach(folder => {
            if (!sortedFolderGroups[folder]) {
              sortedFolderGroups[folder] = group.folderGroups![folder];
            }
          });
          group.folderGroups = sortedFolderGroups;
        }
      });
    }
    
    return groups;
  }, [moodboards, projects, assetType]);

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
      setSelectedFolder("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      toast({
        title: labels.successTitle,
        description: labels.successDescription,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: labels.uploadFailedTitle,
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
        title: labels.deleteTitle,
        description: labels.deleteDescription,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: labels.deleteFailedTitle,
        description: error.message,
      });
    },
  });

  // Move to folder mutation (for working drawings)
  const moveFolderMutation = useMutation({
    mutationFn: async ({ id, folder }: { id: string; folder: string }) => {
      return await apiRequest("PUT", `/api/moodboards/${id}`, { folder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moodboards"] });
      toast({
        title: "Moved",
        description: "Drawing moved to folder successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Move Failed",
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
        title: labels.invalidFileTypeTitle,
        description: labels.invalidFileTypeDescription,
      });
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: "destructive", 
        title: labels.fileTooLargeTitle,
        description: labels.fileTooLargeDescription,
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
    
    // Validate that a project is selected
    if (!selectedProjectId || selectedProjectId === "general") {
      toast({
        variant: "destructive",
        title: "Project Required",
        description: "Please select a project before uploading.",
      });
      return;
    }
    
    // Validate folder selection for working drawings
    if (assetType === "working_drawing" && !selectedFolder) {
      toast({
        variant: "destructive",
        title: "Folder Required",
        description: "Please select a folder for the working drawing.",
      });
      return;
    }
    
    const formData = new FormData();
    formData.append("moodboard", selectedFile);
    formData.append("assetType", assetType); // Add asset type
    if (description.trim()) {
      formData.append("description", description.trim());
    }
    if (tags.trim()) {
      formData.append("tags", tags.trim());
    }
    formData.append("projectId", selectedProjectId);
    if (canvaLink.trim()) {
      formData.append("canvaLink", canvaLink.trim());
    }
    // Include folder for working drawings
    if (assetType === "working_drawing" && selectedFolder) {
      formData.append("folder", selectedFolder);
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
        title: labels.linkAddedTitle,
        description: labels.linkAddedDescription,
      });
    },
    onError: () => {
      toast({
        title: labels.updateFailedTitle,
        description: labels.updateFailedDescription,
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
        title: labels.updateFailedTitle,
        description: labels.linkOnlyError,
        variant: "destructive",
      });
      return;
    }

    // Validate that a project is selected
    if (!selectedProjectId || selectedProjectId === "general") {
      toast({
        variant: "destructive",
        title: "Project Required",
        description: "Please select a project before saving.",
      });
      return;
    }

    // Validate folder selection for working drawings
    if (assetType === "working_drawing" && !selectedFolder) {
      toast({
        variant: "destructive",
        title: "Folder Required",
        description: "Please select a folder for the working drawing.",
      });
      return;
    }

    const formData = new FormData();
    formData.append("canvaLink", canvaLink.trim());
    formData.append("linkOnly", "true");
    formData.append("assetType", assetType); // Add asset type
    formData.append("projectId", selectedProjectId);
    // Include folder for working drawings
    if (assetType === "working_drawing" && selectedFolder) {
      formData.append("folder", selectedFolder);
    }
    
    uploadMutation.mutate(formData);
  };

  // Delete moodboard
  const deleteMoodboard = (id: string) => {
    setDeletingId(id);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteMutation.mutate(deletingId);
      setDeletingId(null);
    }
  };

  // Create preview/download URL for display
  const getPreviewUrl = (moodboard: Moodboard) => {
    // Return null for link-only entries (no file uploaded)
    if (!moodboard.fileName) return null;
    
    // If file is in object storage, use the filePath
    if (moodboard.filePath && moodboard.filePath.startsWith('/objects/')) {
      return moodboard.filePath;
    }
    
    // Fallback to old-style uploads path
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
    <div className="space-y-3 p-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-moodboards">
            {labels.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {labels.description}
          </p>
        </div>
        
        {/* Project Selector Card - Show for all asset types */}
        <Card>
          <CardHeader>
            <CardTitle className="font-bold">Select Project</CardTitle>
            <CardDescription>
              Choose a project to view and manage its {
                assetType === "working_drawing" ? "working drawings" : 
                assetType === "render" ? "renders" : "moodboards"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-sm">
              <Label className="mb-2 block">Project</Label>
              <Select value={filterProjectId} onValueChange={setFilterProjectId}>
                <SelectTrigger data-testid="select-project-filter">
                  <SelectValue placeholder="Select a project" />
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
      </div>

      {/* Show empty state when project not selected */}
      {!filterProjectId && (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select a project to begin</h3>
            <p className="text-muted-foreground">
              Choose a project from the dropdown above to view and manage its {
                assetType === "working_drawing" ? "working drawings" : 
                assetType === "render" ? "renders" : "moodboards"
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="text-center py-12">
            <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin" />
            <p className="text-muted-foreground">{labels.loadingText}</p>
          </CardContent>
        </Card>
      )}

      {/* Uploaded Moodboards - Grouped by Project (and Room Type for Renders) */}
      {!isLoading && moodboards.length > 0 && (
        <div className="space-y-6">
          {Object.entries(groupedMoodboards).map(([projectId, group]) => (
            <Card key={projectId}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-bold">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  {group.projectName}
                  <Badge variant="secondary" className="ml-auto">
                    {group.items.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* For renders, show grouped by room type */}
                {assetType === "render" && group.roomGroups ? (
                  <div className="space-y-6">
                    {Object.entries(group.roomGroups).map(([roomType, roomItems]) => (
                      <div key={roomType} className="space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b">
                          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                            {roomType}
                          </h4>
                          <Badge variant="outline" className="text-xs">
                            {roomItems.length}
                          </Badge>
                        </div>
                        <div className="space-y-3 pl-2">
                          {roomItems.map((moodboard: Moodboard) => (
                            <div key={moodboard.id} className="flex items-center justify-between gap-4 p-4 border rounded-lg hover-elevate" data-testid={`render-item-${moodboard.id}`}>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-base truncate mb-1" title={moodboard.name}>
                                  {moodboard.name}
                                </h4>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                                  <span>{format(new Date(moodboard.uploadedAt), 'dd MMM yyyy, HH:mm')}</span>
                                  {(moodboard as any).savedBy && getSavedByName((moodboard as any).savedBy) && (
                                    <>
                                      <span>•</span>
                                      <span className="flex items-center gap-1">
                                        <UserIcon className="h-3 w-3" />
                                        {getSavedByName((moodboard as any).savedBy)}
                                      </span>
                                    </>
                                  )}
                                </div>
                                {moodboard.canvaLink && (
                                  <a
                                    href={moodboard.canvaLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 hover:underline mt-1"
                                    data-testid={`link-external-${moodboard.id}`}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    <span>{labels.viewLinkText}</span>
                                  </a>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {getPreviewUrl(moodboard) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setPreviewImage(moodboard)}
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
                      </div>
                    ))}
                  </div>
                ) : assetType === "working_drawing" && group.folderGroups ? (
                  /* For working drawings, show grouped by folder */
                  <div className="space-y-6">
                    {Object.entries(group.folderGroups).map(([folderName, folderItems]) => (
                      <div key={folderName} className="space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b">
                          <FolderOpen className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                            {folderName}
                          </h4>
                          <Badge variant="outline" className="text-xs">
                            {folderItems.length}
                          </Badge>
                        </div>
                        <div className="space-y-3 pl-2">
                          {folderItems.map((moodboard: Moodboard) => (
                            <div key={moodboard.id} className="flex items-center justify-between gap-4 p-4 border rounded-lg hover-elevate" data-testid={`drawing-item-${moodboard.id}`}>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-base truncate mb-1" title={getDisplayTitle(moodboard)}>
                                  {getDisplayTitle(moodboard) || labels.listMetadataText}
                                </h4>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                                  {moodboard.description && moodboard.fileName && (
                                    <>
                                      <span>{moodboard.fileName}</span>
                                      <span>•</span>
                                    </>
                                  )}
                                  <span>{format(new Date(moodboard.uploadedAt), 'dd MMM yyyy, HH:mm')}</span>
                                  {(moodboard as any).savedBy && getSavedByName((moodboard as any).savedBy) && (
                                    <>
                                      <span>•</span>
                                      <span className="flex items-center gap-1">
                                        <UserIcon className="h-3 w-3" />
                                        {getSavedByName((moodboard as any).savedBy)}
                                      </span>
                                    </>
                                  )}
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
                                    <span>{labels.viewLinkText}</span>
                                  </a>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {getPreviewUrl(moodboard) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setPreviewImage(moodboard)}
                                    data-testid={`button-view-${moodboard.id}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" data-testid={`button-actions-${moodboard.id}`}>
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuSub>
                                      <DropdownMenuSubTrigger>
                                        <FolderInput className="h-4 w-4 mr-2" />
                                        Move to Folder
                                      </DropdownMenuSubTrigger>
                                      <DropdownMenuPortal>
                                        <DropdownMenuSubContent>
                                          {workingDrawingFolders.map((f) => (
                                            <DropdownMenuItem
                                              key={f}
                                              onClick={() => moveFolderMutation.mutate({ id: moodboard.id, folder: f })}
                                              className={(moodboard as any).folder === f ? "font-semibold bg-accent" : ""}
                                            >
                                              {f}
                                            </DropdownMenuItem>
                                          ))}
                                        </DropdownMenuSubContent>
                                      </DropdownMenuPortal>
                                    </DropdownMenuSub>
                                    <DropdownMenuItem
                                      onClick={() => deleteMoodboard(moodboard.id)}
                                      className="text-destructive"
                                      data-testid={`button-delete-${moodboard.id}`}
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
                ) : (
                  /* For moodboards, show flat list */
                  <div className="space-y-3">
                    {group.items.map((moodboard: Moodboard) => (
                      <div key={moodboard.id} className="flex items-center justify-between gap-4 p-4 border rounded-lg hover-elevate" data-testid={`drawing-item-${moodboard.id}`}>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-base truncate mb-1" title={getDisplayTitle(moodboard)}>
                            {getDisplayTitle(moodboard) || labels.listMetadataText}
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                            {moodboard.description && moodboard.fileName && (
                              <>
                                <span>{moodboard.fileName}</span>
                                <span>•</span>
                              </>
                            )}
                            <span>{format(new Date(moodboard.uploadedAt), 'dd MMM yyyy, HH:mm')}</span>
                            {(moodboard as any).savedBy && getSavedByName((moodboard as any).savedBy) && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <UserIcon className="h-3 w-3" />
                                  {getSavedByName((moodboard as any).savedBy)}
                                </span>
                              </>
                            )}
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
                              <span>{labels.viewLinkText}</span>
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
                              onClick={() => setPreviewImage(moodboard)}
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
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {!isLoading && moodboards.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">{labels.emptyState}</h3>
            <p className="text-muted-foreground mb-4">
              {labels.emptyStateDescription}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold">
            <Upload className="h-5 w-5" />
            {labels.uploadButton}
          </CardTitle>
          <CardDescription>
            {labels.uploadDescription}
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
              {labels.dropzoneText}
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
              <Label htmlFor="canva-link-always">{labels.linkFieldLabel}</Label>
              <Input
                id="canva-link-always"
                type="url"
                placeholder={labels.linkFieldPlaceholder}
                value={canvaLink}
                onChange={(e) => setCanvaLink(e.target.value)}
                data-testid="input-canva-link-always"
              />
              <p className="text-xs text-muted-foreground">
                {labels.linkFieldDescription}
              </p>
              
              {/* Show save/create options when there's a Canva link but no file selected */}
              {canvaLink.trim() && !selectedFile && (
                <div className="pt-3 space-y-3 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="project-for-link">Select Project <span className="text-red-500">*</span></Label>
                    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                      <SelectTrigger id="project-for-link" data-testid="select-project-for-link">
                        <SelectValue placeholder="Select a project..." />
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
                  
                  {/* Folder Selection for Working Drawings - Link Only */}
                  {assetType === "working_drawing" && (
                    <div className="space-y-2">
                      <Label htmlFor="folder-for-link">Select Folder <span className="text-red-500">*</span></Label>
                      <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                        <SelectTrigger id="folder-for-link" data-testid="select-folder-for-link">
                          <SelectValue placeholder="Select a folder..." />
                        </SelectTrigger>
                        <SelectContent>
                          {workingDrawingFolders.map((folder) => (
                            <SelectItem key={folder} value={folder}>
                              {folder}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
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
                      labels.saveOnlyLinkButton
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
                  placeholder={labels.descriptionPlaceholder}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  data-testid="input-description"
                />
              </div>

              {/* Project Selection */}
              <div className="space-y-2">
                <Label htmlFor="project">Project <span className="text-red-500">*</span></Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger id="project" data-testid="select-project">
                    <SelectValue placeholder="Select a project..." />
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

              {/* Folder Selection - Only for Working Drawings */}
              {assetType === "working_drawing" && (
                <div className="space-y-2">
                  <Label htmlFor="folder">Folder <span className="text-red-500">*</span></Label>
                  <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                    <SelectTrigger id="folder" data-testid="select-folder">
                      <SelectValue placeholder="Select a folder..." />
                    </SelectTrigger>
                    <SelectContent>
                      {workingDrawingFolders.map((folder) => (
                        <SelectItem key={folder} value={folder}>
                          {folder}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                <Label htmlFor="canva-link">{labels.linkLabel} (Optional)</Label>
                <Input
                  id="canva-link"
                  type="url"
                  placeholder={labels.linkFieldPlaceholder}
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
                  labels.uploadButton
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {previewImage && (
        <FileViewerModal
          isOpen={!!previewImage}
          onClose={() => setPreviewImage(null)}
          fileUrl={getPreviewUrl(previewImage) || ''}
          fileName={previewImage.description || previewImage.fileName || "Preview"}
        />
      )}

      <DeleteConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={confirmDelete}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}