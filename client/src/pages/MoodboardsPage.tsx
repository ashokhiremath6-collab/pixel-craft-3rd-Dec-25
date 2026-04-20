import { useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, ImageIcon, FileText, X, Eye, Trash2, Loader2, FolderOpen, ExternalLink, Download, FolderInput, MoreVertical, FileCode2, Layers, ChevronDown, ChevronUp } from "lucide-react";
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
import type { Moodboard, Project, User, FloorPlan } from "@shared/schema";
import { User as UserIcon } from "lucide-react";
import { FileViewerModal } from "@/components/FileViewerModal";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function MoodboardsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [location] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cadFileInputRef = useRef<HTMLInputElement>(null);
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

  // CAD import state (Working Drawings only)
  const [cadImportOpen, setCadImportOpen] = useState(false);
  const [cadFile, setCadFile] = useState<File | null>(null);
  const [cadDragActive, setCadDragActive] = useState(false);
  const [cadName, setCadName] = useState("");
  const [cadDrawingType, setCadDrawingType] = useState("");
  const [cadScale, setCadScale] = useState("");
  const [cadDiscipline, setCadDiscipline] = useState("");
  const [cadRevision, setCadRevision] = useState("A");
  const [cadNotes, setCadNotes] = useState("");
  const [cadProjectId, setCadProjectId] = useState("");
  const [cadFolder, setCadFolder] = useState("");
  const [cadLayers, setCadLayers] = useState<string[]>([]);
  const [cadLayersExpanded, setCadLayersExpanded] = useState(false);
  const [cadUploadProgress, setCadUploadProgress] = useState(0);
  
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
        uploadDescription: "Upload images (JPEG, PNG, SVG, WebP), PDFs, or CAD files (DXF, DWG)",
        invalidFileTypeTitle: "Invalid file type",
        invalidFileTypeDescription: "Please upload images (JPEG, PNG, SVG, WebP), PDFs, or CAD files (DXF, DWG).",
        fileTooLargeTitle: "File too large",
        fileTooLargeDescription: "Please select a file smaller than 21MB.",
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
        fileTooLargeDescription: "Please select a file smaller than 21MB.",
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
      fileTooLargeDescription: "Please select a file smaller than 21MB.",
      descriptionPlaceholder: "Describe this moodboard...",
    };
  }, [assetType]);

  // Fetch projects for selection
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch users to display who saved each render — admin only (designers don't have access to the full user list)
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === 'admin',
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
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  // Floor plans query — fetched when on working-drawings route and a project is selected
  const { data: allFloorPlans = [] } = useQuery<FloorPlan[]>({
    queryKey: ["/api/floor-plans"],
    enabled: assetType === "working_drawing" && !!filterProjectId,
    queryFn: async () => {
      const response = await fetch("/api/floor-plans", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch floor plans");
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Group floor plans by projectId for easy lookup
  const floorPlansByProject = allFloorPlans.reduce((acc, fp) => {
    if (!acc[fp.projectId]) acc[fp.projectId] = [];
    acc[fp.projectId].push(fp);
    return acc;
  }, {} as Record<string, FloorPlan[]>);

  // Helper function to get project name
  const getProjectName = (projectId: string | null) => {
    if (!projectId) return "General";
    const project = projects.find(p => p.id === projectId);
    return project ? project.projectName : "Unknown Project";
  };

  // Helper function to strip project name prefix from display title
  const getDisplayTitle = (moodboard: Moodboard) => {
    // For CAD files, extract the name from the stored metadata
    if (moodboard.description?.startsWith('__CAD_META__:')) {
      try {
        const meta = JSON.parse(moodboard.description.slice(13));
        return meta.name || moodboard.fileName || '';
      } catch { return moodboard.fileName || ''; }
    }
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
    "Acoustics",
    "Art",
    "As-Built Drawings",
    "Automation",
    "Bathroom Details",
    "Carpentry",
    "Ceiling Layouts",
    "Electrical Layouts",
    "Elevations",
    "Floor Plans",
    "Flooring",
    "Furniture Layouts",
    "HVAC Layouts",
    "Joinery Details",
    "Kitchen Details",
    "Lighting",
    "Plumbing Layouts",
    "Shop Drawings",
    "Site Measurements",
    "Wall Finishes",
    "Wardrobe Details",
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
    
    // For working drawings: also ensure projects that have floor plans but no drawings still get a group
    if (assetType === "working_drawing") {
      allFloorPlans.forEach((fp: FloorPlan) => {
        const pid = fp.projectId;
        if (!pid) return;
        // Apply project filter consistent with moodboards query
        if (filterProjectId && filterProjectId !== "all" && pid !== filterProjectId) return;
        if (!groups[pid]) {
          groups[pid] = {
            projectName: getProjectName(pid),
            items: [],
            folderGroups: {},
          };
        }
      });
    }

    return groups;
  }, [moodboards, projects, assetType, allFloorPlans, filterProjectId]);

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
    
    // Validate file type — working drawings also allow DXF (SketchUp/AutoCAD exports)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp', 'application/pdf', 'application/vnd.sketchup.skp'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'svg', 'webp', 'pdf'];
    if (assetType === 'working_drawing') {
      allowedExtensions.push('dxf', 'dwg');
    }
    if (assetType === 'render') {
      allowedExtensions.push('skp');
    }
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext || '')) {
      toast({
        variant: "destructive",
        title: labels.invalidFileTypeTitle,
        description: labels.invalidFileTypeDescription,
      });
      return;
    }
    
    // Validate file size (max 21MB)
    if (file.size > 21 * 1024 * 1024) {
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

  // Returns true for CAD files that can't be previewed in browser (DXF, DWG)
  const isCadFile = (moodboard: Moodboard) => {
    const ext = (moodboard.fileName || '').split('.').pop()?.toLowerCase();
    return ext === 'dxf' || ext === 'dwg';
  };

  const downloadFile = (moodboard: Moodboard) => {
    const url = getPreviewUrl(moodboard);
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = moodboard.fileName || 'download';
    link.click();
  };

  // Parse CAD metadata from description field
  const parseCadMeta = (desc: string | null | undefined) => {
    if (!desc?.startsWith('__CAD_META__:')) return null;
    try { return JSON.parse(desc.slice(13)); } catch { return null; }
  };

  // Handle CAD file selection and layer extraction
  const handleCadFileSelect = async (file: File) => {
    setCadFile(file);
    const ext = file.name.split('.').pop()?.toLowerCase();
    const name = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim();
    setCadName(prev => prev || name);
    if (ext === 'dxf') {
      try {
        const text = await file.text();
        const layerSet = new Set<string>();
        const lines = text.split('\n').map(l => l.trim());
        for (let i = 0; i < lines.length - 1; i++) {
          if (lines[i] === '8') { const layer = lines[i + 1]; if (layer && layer !== '0') layerSet.add(layer); }
        }
        setCadLayers(Array.from(layerSet).slice(0, 100));
      } catch { setCadLayers([]); }
    }
  };

  const resetCadForm = () => {
    setCadFile(null); setCadLayers([]); setCadName(""); setCadDrawingType("");
    setCadScale(""); setCadDiscipline(""); setCadRevision("A"); setCadNotes("");
    setCadProjectId(""); setCadFolder(""); setCadLayersExpanded(false);
  };

  const cadImportMutation = useMutation({
    mutationFn: (): Promise<any> => new Promise((resolve, reject) => {
      if (!cadFile) { reject(new Error("No file selected")); return; }
      if (!cadProjectId) { reject(new Error("Project is required")); return; }
      if (!cadName.trim()) { reject(new Error("Drawing name is required")); return; }
      if (!cadFolder) { reject(new Error("Folder is required for Working Drawings")); return; }
      const meta = { name: cadName.trim(), type: cadDrawingType, scale: cadScale, discipline: cadDiscipline, revision: cadRevision, layers: cadLayers, notes: cadNotes };
      const formData = new FormData();
      formData.append('moodboard', cadFile);
      formData.append('assetType', 'working_drawing');
      formData.append('projectId', cadProjectId);
      formData.append('description', `__CAD_META__:${JSON.stringify(meta)}`);
      formData.append('folder', cadFolder);

      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setCadUploadProgress(Math.round((e.loaded / e.total) * 85));
        }
      };
      xhr.onload = () => {
        setCadUploadProgress(100);
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({}); }
        } else {
          try { reject(new Error(JSON.parse(xhr.responseText)?.error || 'Import failed')); }
          catch { reject(new Error('Import failed')); }
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed — check your connection'));
      xhr.open('POST', '/api/moodboards');
      xhr.withCredentials = true;
      xhr.send(formData);
    }),
    onSuccess: () => {
      toast({ title: "CAD drawing imported", description: `${cadName} has been added to Working Drawings.` });
      resetCadForm();
      setCadImportOpen(false);
      setCadUploadProgress(0);
      queryClient.invalidateQueries({ queryKey: ["/api/moodboards"] });
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Import failed", description: e.message });
      setCadUploadProgress(0);
    },
  });

  return (
    <div className="space-y-3 p-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-moodboards">
              {labels.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {labels.description}
            </p>
          </div>
          {assetType === "working_drawing" && (
            <Button variant="outline" onClick={() => setCadImportOpen(true)} className="shrink-0" data-testid="button-import-cad">
              <FileCode2 className="h-4 w-4 mr-2" />
              Import AutoCAD Drawing
            </Button>
          )}
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
                    {/* Floor Plans from the dedicated floor plans library — shown first */}
                    {(() => {
                      const fps = floorPlansByProject[projectId] ?? [];
                      if (fps.length === 0) return null;
                      const latestFpId = fps.reduce((a: FloorPlan | null, b: FloorPlan) =>
                        !a || new Date(b.uploadedAt) > new Date(a.uploadedAt) ? b : a
                      , null)?.id;
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 pb-2 border-b">
                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                            <h4 className="font-bold text-sm uppercase tracking-wide">Floor Plans</h4>
                            <Badge variant="outline" className="text-xs">{fps.length}</Badge>
                          </div>
                          <div className="space-y-3 pl-2">
                            {fps.map((fp: FloorPlan) => {
                              const isLatest = fp.id === latestFpId;
                              const isCAD = fp.fileType === "dxf" || fp.fileType === "dwg" || fp.fileName?.toLowerCase().endsWith(".dxf") || fp.fileName?.toLowerCase().endsWith(".dwg");
                              return (
                                <div key={fp.id}
                                  className={`flex items-center justify-between gap-4 p-4 rounded-lg hover-elevate ${
                                    isLatest
                                      ? "border-2 border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/30"
                                      : "border"
                                  }`}>
                                  <div className="flex-1 min-w-0 flex items-start gap-3">
                                    {isCAD && <FileCode2 className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <h4 className="font-medium text-base truncate" title={fp.name}>{fp.name}</h4>
                                        {isLatest && (
                                          <Badge className="text-[10px] shrink-0 bg-emerald-600 hover:bg-emerald-600 text-white">Latest Version</Badge>
                                        )}
                                        {fp.version && (
                                          <Badge variant="outline" className="text-[10px] shrink-0">v{fp.version}</Badge>
                                        )}
                                        {fp.isActive && (
                                          <Badge className="text-[10px] shrink-0 bg-blue-600 hover:bg-blue-600 text-white">Active</Badge>
                                        )}
                                        {isCAD && (
                                          <Badge variant="secondary" className="text-xs shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">CAD</Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                                        {fp.fileName && <span>{fp.fileName}</span>}
                                        {fp.fileName && <span>•</span>}
                                        <span>{format(new Date(fp.uploadedAt), 'dd MMM yyyy, HH:mm')}</span>
                                        {fp.description && <><span>•</span><span className="italic">{fp.description}</span></>}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {fp.filePath && (
                                      <Button variant="ghost" size="icon"
                                        onClick={() => window.open(fp.filePath, "_blank")}
                                        title="Download floor plan">
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {Object.entries(group.folderGroups).map(([folderName, folderItems]) => {
                      // Identify the latest item in this folder by uploadedAt
                      const latestId = folderItems.reduce((latestItem: Moodboard | null, item: Moodboard) =>
                        !latestItem || new Date(item.uploadedAt) > new Date(latestItem.uploadedAt) ? item : latestItem
                      , null)?.id;
                      return (
                      <div key={folderName} className="space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b">
                          <FolderOpen className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-bold text-sm uppercase tracking-wide">
                            {folderName}
                          </h4>
                          <Badge variant="outline" className="text-xs">
                            {folderItems.length}
                          </Badge>
                        </div>
                        <div className="space-y-3 pl-2">
                          {folderItems.map((moodboard: Moodboard) => {
                            const cadMeta = parseCadMeta(moodboard.description);
                            const isCAD = isCadFile(moodboard);
                            const isLatest = moodboard.id === latestId;
                            return (
                            <div key={moodboard.id}
                              className={`flex items-center justify-between gap-4 p-4 rounded-lg hover-elevate ${
                                isLatest
                                  ? "border-2 border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/30"
                                  : "border"
                              }`}
                              data-testid={`drawing-item-${moodboard.id}`}>
                              <div className="flex-1 min-w-0 flex items-start gap-3">
                                {isCAD && <FileCode2 className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <h4 className="font-medium text-base truncate" title={getDisplayTitle(moodboard)}>
                                      {getDisplayTitle(moodboard) || labels.listMetadataText}
                                    </h4>
                                    {isLatest && (
                                      <Badge className="text-[10px] shrink-0 bg-emerald-600 hover:bg-emerald-600 text-white">
                                        Latest Version
                                      </Badge>
                                    )}
                                    {isCAD && <Badge variant="secondary" className="text-xs shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">CAD</Badge>}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                                    {cadMeta ? (
                                      <>
                                        {cadMeta.type && <span>{cadMeta.type}</span>}
                                        {cadMeta.type && cadMeta.scale && <span>•</span>}
                                        {cadMeta.scale && <span>{cadMeta.scale}</span>}
                                        {(cadMeta.type || cadMeta.scale) && cadMeta.discipline && <span>•</span>}
                                        {cadMeta.discipline && <span>{cadMeta.discipline}</span>}
                                        {cadMeta.revision && <><span>•</span><span>Rev {cadMeta.revision}</span></>}
                                        {cadMeta.layers?.length > 0 && (
                                          <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{cadMeta.layers.length} layers</span>
                                        )}
                                        <span>•</span>
                                        <span>{format(new Date(moodboard.uploadedAt), 'dd MMM yyyy')}</span>
                                      </>
                                    ) : (
                                      <>
                                        {moodboard.description && moodboard.fileName && (
                                          <>
                                            <span>{moodboard.fileName}</span>
                                            <span>•</span>
                                          </>
                                        )}
                                        <span>{format(new Date(moodboard.uploadedAt), 'dd MMM yyyy, HH:mm')}</span>
                                      </>
                                    )}
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
                                  {cadMeta?.notes && <p className="text-xs text-muted-foreground mt-1">{cadMeta.notes}</p>}
                                  {moodboard.canvaLink && (
                                    <a href={moodboard.canvaLink} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 hover:underline mt-1"
                                      data-testid={`link-canva-${moodboard.id}`}
                                    >
                                      <ExternalLink className="h-3 w-3" /><span>{labels.viewLinkText}</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {getPreviewUrl(moodboard) && (
                                  isCAD ? (
                                    <div className="flex items-center gap-1">
                                      <Button variant="ghost" size="icon" onClick={() => setPreviewImage(moodboard)} title="Preview CAD drawing" data-testid={`button-view-${moodboard.id}`}>
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      <Button variant="outline" size="sm" onClick={() => downloadFile(moodboard)} title="Download for AutoCAD" data-testid={`button-download-${moodboard.id}`}>
                                        <Download className="h-3.5 w-3.5 mr-1.5" />Download
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button variant="ghost" size="icon" onClick={() => setPreviewImage(moodboard)} data-testid={`button-view-${moodboard.id}`}>
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  )
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
                          );
                          })}
                        </div>
                      </div>
                      );
                    })}

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
              {assetType === 'working_drawing'
                ? 'Support for JPEG, PNG, SVG, WebP, PDF, DXF, and DWG files up to 21MB'
                : assetType === 'render'
                  ? 'Support for JPEG, PNG, SVG, WebP, PDF, and SketchUp (.skp) files up to 21MB'
                  : 'Support for JPEG, PNG, SVG, WebP, and PDF files up to 21MB'}
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={assetType === 'working_drawing'
                ? "image/jpeg,image/png,image/svg+xml,image/webp,application/pdf,.dxf,.dwg"
                : assetType === 'render'
                  ? "image/jpeg,image/png,image/svg+xml,image/webp,application/pdf,.skp,application/vnd.sketchup.skp"
                  : "image/jpeg,image/png,image/svg+xml,image/webp,application/pdf"}
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

      {/* CAD Import Dialog — Working Drawings only */}
      <Dialog open={cadImportOpen} onOpenChange={(open) => { setCadImportOpen(open); if (!open) resetCadForm(); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode2 className="h-5 w-5" />
              Import AutoCAD Drawing
            </DialogTitle>
            <DialogDescription>
              Import DXF or DWG files from AutoCAD, SketchUp, or any CAD application into Working Drawings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Project */}
            <div className="space-y-1">
              <Label>Project <span className="text-destructive">*</span></Label>
              <Select value={cadProjectId} onValueChange={setCadProjectId}>
                <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.projectName} - {p.clientName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Folder */}
            <div className="space-y-1">
              <Label>Folder <span className="text-destructive">*</span></Label>
              <Select value={cadFolder} onValueChange={setCadFolder}>
                <SelectTrigger><SelectValue placeholder="Select folder" /></SelectTrigger>
                <SelectContent>
                  {workingDrawingFolders.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Drawing Name */}
            <div className="space-y-1">
              <Label>Drawing Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g., Ground Floor Plan, Section AA" value={cadName} onChange={e => setCadName(e.target.value)} />
            </div>

            {/* Type + Scale */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Drawing Type</Label>
                <Select value={cadDrawingType} onValueChange={setCadDrawingType}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {["Floor Plan","Reflected Ceiling Plan","Elevation","Section","Site Plan","Detail Drawing","Joinery Drawing","MEP / Services","Structural"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Scale</Label>
                <Select value={cadScale} onValueChange={setCadScale}>
                  <SelectTrigger><SelectValue placeholder="Select scale" /></SelectTrigger>
                  <SelectContent>
                    {["1:5","1:10","1:20","1:50","1:100","1:200","1:500","1:1000","NTS"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Discipline + Revision */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Discipline</Label>
                <Select value={cadDiscipline} onValueChange={setCadDiscipline}>
                  <SelectTrigger><SelectValue placeholder="Select discipline" /></SelectTrigger>
                  <SelectContent>
                    {["Architectural","Interior Design","Structural","MEP","Joinery","Landscape","Civil"].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Revision</Label>
                <Input placeholder="e.g., A, B, 1" value={cadRevision} onChange={e => setCadRevision(e.target.value)} />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label>Notes (Optional)</Label>
              <Textarea placeholder="Additional notes..." value={cadNotes} onChange={e => setCadNotes(e.target.value)} className="resize-none" rows={2} />
            </div>

            {/* File drop zone */}
            <div className="space-y-2">
              <Label>CAD File <span className="text-destructive">*</span></Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center space-y-3 transition-colors cursor-pointer ${cadDragActive ? 'border-primary bg-primary/10' : cadFile ? 'border-green-500 bg-green-500/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'}`}
                onDragEnter={e => { e.preventDefault(); setCadDragActive(true); }}
                onDragLeave={e => { e.preventDefault(); setCadDragActive(false); }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); setCadDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) handleCadFileSelect(f); }}
                onClick={() => cadFileInputRef.current?.click()}
              >
                <FileCode2 className={`h-10 w-10 mx-auto ${cadFile ? 'text-green-500' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-sm font-medium">{cadFile ? cadFile.name : 'Drop DXF or DWG file here, or click to browse'}</p>
                  <p className="text-xs text-muted-foreground mt-1">Accepts: .dxf, .dwg — Max 100MB</p>
                </div>
                {!cadFile && (
                  <Button type="button" variant="outline" size="sm" onClick={e => { e.stopPropagation(); cadFileInputRef.current?.click(); }}>Browse CAD Files</Button>
                )}
                <input ref={cadFileInputRef} type="file" className="hidden" accept=".dxf,.dwg" onChange={e => { const f = e.target.files?.[0]; if (f) handleCadFileSelect(f); }} />
              </div>

              {cadLayers.length > 0 && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <button type="button" className="flex items-center gap-2 text-xs font-medium w-full text-left" onClick={() => setCadLayersExpanded(v => !v)}>
                    <Layers className="h-3.5 w-3.5" />
                    {cadLayers.length} layers detected
                    {cadLayersExpanded ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
                  </button>
                  {cadLayersExpanded && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {cadLayers.map(l => <Badge key={l} variant="secondary" className="text-xs">{l}</Badge>)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Upload progress */}
            {cadImportMutation.isPending && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{cadUploadProgress < 100 ? 'Uploading file…' : 'Saving to cloud…'}</span>
                  <span>{cadUploadProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all duration-200"
                    style={{ width: `${cadUploadProgress}%` }}
                  />
                </div>
                {cadFile && (
                  <p className="text-xs text-muted-foreground">
                    File: {cadFile.name} ({(cadFile.size / 1024 / 1024).toFixed(1)} MB)
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setCadImportOpen(false); resetCadForm(); }} disabled={cadImportMutation.isPending}>Cancel</Button>
              <Button onClick={() => cadImportMutation.mutate()} disabled={!cadFile || !cadProjectId || !cadName.trim() || !cadFolder || cadImportMutation.isPending}>
                {cadImportMutation.isPending ? `Importing… ${cadUploadProgress}%` : 'Import Drawing'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}