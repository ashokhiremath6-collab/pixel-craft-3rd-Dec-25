import { useState, useRef, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, ImageIcon, FileText, X, Eye, Trash2, Loader2, FolderOpen, ExternalLink, Download, FolderInput, MoreVertical, FileCode2, Layers, ChevronDown, ChevronUp, Pencil, BookmarkCheck, Bookmark } from "lucide-react";
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
import { RecentBadge } from "@/components/RecentBadge";
import { format } from "date-fns";
import type { Moodboard, Project, User, FloorPlan } from "@shared/schema";
import { User as UserIcon } from "lucide-react";
import { FileViewerModal } from "@/components/FileViewerModal";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function MoodboardsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const filterProjectId = new URLSearchParams(search).get("projectId") || "";
  const deepLinkFileId = new URLSearchParams(search).get("file") || "";
  const setFilterProjectId = (value: string) => {
    const params = new URLSearchParams(search);
    if (value) {
      params.set("projectId", value);
    } else {
      params.delete("projectId");
    }
    const qs = params.toString();
    setLocation(qs ? `${location}?${qs}` : location);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cadFileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [canvaLink, setCanvaLink] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(""); // For upload form
  const [selectedFolder, setSelectedFolder] = useState<string>(""); // For working drawings folder
  const [previewImage, setPreviewImage] = useState<Moodboard | null>(null);
  const [floorPlanViewer, setFloorPlanViewer] = useState<{url: string, name: string} | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingFpId, setDeletingFpId] = useState<string | null>(null);

  // Edit render state
  const [editingRender, setEditingRender] = useState<Moodboard | null>(null);
  const [editName, setEditName] = useState("");
  const [editRoomType, setEditRoomType] = useState("");

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
  // Use startsWith to handle cases where location may include a query string
  const assetType = useMemo(() => {
    if (location.startsWith("/working-drawings")) return "working_drawing";
    if (location.startsWith("/renders")) return "render";
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
  const { data: moodboards = [], isLoading, isFetching, isError, error, refetch: refetchMoodboards } = useQuery({
    queryKey: ["/api/moodboards/by-type", assetType, filterProjectId !== "all" ? filterProjectId : null],
    queryFn: async () => {
      // Return empty immediately if no project selected — no HTTP call needed
      if (!filterProjectId) return [];
      
      const params = new URLSearchParams();
      if (filterProjectId !== "all") {
        params.append("projectId", filterProjectId);
      }
      
      // Use path-based URL (/by-type/:type) to avoid proxy WAF blocks on assetType query param
      const url = `/api/moodboards/by-type/${encodeURIComponent(assetType)}${params.size > 0 ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status}: ${text}`);
      }
      const data = await response.json();
      return data;
    },
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  // Auto-open file viewer when navigated from dashboard activity card
  useEffect(() => {
    if (!deepLinkFileId || isLoading || moodboards.length === 0) return;
    const target = moodboards.find((m: Moodboard) => m.id === deepLinkFileId);
    if (target && getPreviewUrl(target)) {
      setPreviewImage(target);
    }
  }, [deepLinkFileId, isLoading, moodboards]);

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
    "Living Room", "Foyer", "Bedroom", "Kitchen", "Dining Room", "Bathroom", 
    "Study", "Kids Room", "Guest Room", "Puja Room", "Hallway", 
    "Walk-in Closet", "Balcony", "General"
  ];

  // Client-side room type inference — mirrors server-side detectRoomType in gemini.ts.
  // Used as a display fallback when a render's stored roomType is "General" or unset,
  // so all existing renders are automatically grouped correctly without DB changes.
  const inferRoomType = (name: string): string => {
    if (!name) return "General";
    const n = name.toLowerCase().replace(/[-_]/g, " ");
    if (/foyer/.test(n)) return "Foyer";
    if (/living|lounge|sitting|family room|great room/.test(n)) return "Living Room";
    if (/bedroom|master|kids room|children room/.test(n)) return "Bedroom";
    if (/kitchen|pantry|cook/.test(n)) return "Kitchen";
    if (/dining|dinner room|breakfast/.test(n)) return "Dining Room";
    if (/bathroom|toilet|washroom|powder room|bath/.test(n)) return "Bathroom";
    if (/study|library|work room|den/.test(n)) return "Study";
    if (/\boffice\b/.test(n)) return "Study";
    if (/nursery|playroom/.test(n)) return "Kids Room";
    if (/\bkids\b|\bchildren\b/.test(n)) return "Kids Room";
    if (/\bguest\b/.test(n)) return "Guest Room";
    if (/puja|prayer|pooja|temple|mandir/.test(n)) return "Puja Room";
    if (/hallway|corridor|entrance|entry/.test(n)) return "Hallway";
    if (/closet|wardrobe|dressing/.test(n)) return "Walk-in Closet";
    if (/balcony|terrace|patio|verandah/.test(n)) return "Balcony";
    return "General";
  };

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
      
      // For renders, also group by room type.
      // When the stored roomType is absent or "General", infer it from the render name
      // so that existing renders are correctly grouped without needing a DB update.
      if (assetType === "render" && groups[projectId].roomGroups) {
        const storedRoomType = (moodboard as any).roomType;
        const roomType = (storedRoomType && storedRoomType !== "General")
          ? storedRoomType
          : inferRoomType(moodboard.name || moodboard.description || '');
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
    
    // Sort items within each folder: latest version of each duplicate-name group floats to the top
    if (assetType === "working_drawing") {
      Object.values(groups).forEach(group => {
        if (!group.folderGroups) return;
        Object.keys(group.folderGroups).forEach(folderName => {
          const items = group.folderGroups![folderName];
          // Build name → ids map
          const byName: Record<string, string[]> = {};
          items.forEach(item => {
            const title = getDisplayTitle(item) || item.id;
            if (!byName[title]) byName[title] = [];
            byName[title].push(item.id);
          });
          // Collect IDs of the latest item per name group (only when there are actual duplicates)
          const latestDuplicateIds = new Set<string>();
          Object.values(byName).forEach(ids => {
            if (ids.length < 2) return;
            const latest = items
              .filter(i => ids.includes(i.id))
              .reduce((a, b) => new Date(a.uploadedAt) > new Date(b.uploadedAt) ? a : b);
            latestDuplicateIds.add(latest.id);
          });
          // Sort: latest-of-duplicate-name items first, then by uploadedAt descending
          group.folderGroups![folderName] = [...items].sort((a, b) => {
            const aTop = latestDuplicateIds.has(a.id);
            const bTop = latestDuplicateIds.has(b.id);
            if (aTop && !bTop) return -1;
            if (!aTop && bTop) return 1;
            return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
          });
        });
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

  // Update render name / room type mutation
  const updateRenderMutation = useMutation({
    mutationFn: async ({ id, name, roomType }: { id: string; name: string; roomType: string }) => {
      return await apiRequest("PUT", `/api/moodboards/${id}`, { name: name.trim(), roomType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moodboards"] });
      setEditingRender(null);
      toast({ title: "Render updated", description: "Name and room type saved." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Update failed", description: error.message });
    },
  });

  // Toggle "Latest Version" pin mutation (for working drawings)
  const toggleLatestVersionMutation = useMutation({
    mutationFn: async ({ id, isLatestVersion }: { id: string; isLatestVersion: boolean }) => {
      return await apiRequest("PUT", `/api/moodboards/${id}`, { isLatestVersion });
    },
    onSuccess: (_data, { isLatestVersion }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/moodboards"] });
      toast({
        title: isLatestVersion ? "Marked as Latest Version" : "Label removed",
        description: isLatestVersion
          ? "This drawing is now labelled as the Latest Version."
          : "Latest Version label has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Update failed", description: error.message });
    },
  });

  const deleteFloorPlanMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/floor-plans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/floor-plans"] });
      toast({ title: "Floor plan deleted", description: "The floor plan has been removed." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Delete failed", description: error.message });
    },
  });

  const confirmDeleteFp = () => {
    if (deletingFpId) {
      deleteFloorPlanMutation.mutate(deletingFpId);
      setDeletingFpId(null);
    }
  };

  const toggleFloorPlanLatestVersionMutation = useMutation({
    mutationFn: async ({ id, isLatestVersion }: { id: string; isLatestVersion: boolean }) => {
      return await apiRequest("PUT", `/api/floor-plans/${id}`, { isLatestVersion });
    },
    onSuccess: (_data, { isLatestVersion }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/floor-plans"] });
      toast({
        title: isLatestVersion ? "Marked as Latest Version" : "Label removed",
        description: isLatestVersion
          ? "This floor plan is now labelled as the Latest Version."
          : "Latest Version label has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Update failed", description: error.message });
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
    // HEIC/HEIF included for iOS photo library compatibility (Safari auto-converts to JPEG but
    // some paths may preserve the original MIME type)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp', 'image/heic', 'image/heif', 'application/pdf', 'application/vnd.sketchup.skp'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'svg', 'webp', 'pdf', 'heic', 'heif'];
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
        
        {/* Project Selector - compact inline */}
        <div className="flex items-center gap-3">
          <Label className="shrink-0 text-sm font-medium">Project</Label>
          <Select value={filterProjectId} onValueChange={setFilterProjectId}>
            <SelectTrigger className="max-w-xs" data-testid="select-project-filter">
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
      </div>

      {/* Show hint when project not selected */}
      {!filterProjectId && (
        <p className="text-sm text-muted-foreground">
          Select a project above to view and manage its {
            assetType === "working_drawing" ? "working drawings" :
            assetType === "render" ? "renders" : "moodboards"
          }.
        </p>
      )}

      {/* Loading State - show when first loading OR when fetching with no cached data yet */}
      {(isLoading || (isFetching && moodboards.length === 0)) && filterProjectId && (
        <Card>
          <CardContent className="text-center py-12">
            <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin" />
            <p className="text-muted-foreground">{labels.loadingText}</p>
          </CardContent>
        </Card>
      )}

      {/* Error State - shown when query fails */}
      {isError && filterProjectId && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-destructive font-medium mb-2">Failed to load {assetType === "working_drawing" ? "working drawings" : assetType === "render" ? "renders" : "moodboards"}.</p>
            <p className="text-sm text-muted-foreground mb-4">{(error as Error)?.message}</p>
            <Button variant="outline" onClick={() => refetchMoodboards()}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State - project selected but no items found */}
      {!isLoading && !isFetching && !isError && filterProjectId && moodboards.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">{labels.emptyState}</p>
            <p className="text-sm text-muted-foreground mt-1">{labels.emptyStateDescription}</p>
          </CardContent>
        </Card>
      )}

      {/* Uploaded Moodboards - Grouped by Project (and Room Type for Renders) */}
      {!isLoading && !(isFetching && moodboards.length === 0) && moodboards.length > 0 && (
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
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h4 className="font-semibold text-base truncate" title={moodboard.name}>
                                    {moodboard.name}
                                  </h4>
                                  <RecentBadge date={moodboard.uploadedAt} />
                                </div>
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
                                    className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline mt-1 font-medium"
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
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setEditingRender(moodboard);
                                    setEditName(moodboard.name || "");
                                    const stored = (moodboard as any).roomType;
                                    setEditRoomType((stored && stored !== "General") ? stored : inferRoomType(moodboard.name || ""));
                                  }}
                                  data-testid={`button-edit-${moodboard.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
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
                    {/* Floor Plans — dedicated library + any working drawings uploaded to "Floor Plans" folder */}
                    {(() => {
                      const fps = floorPlansByProject[projectId] ?? [];
                      const moodboardFps = group.folderGroups?.["Floor Plans"] ?? [];
                      if (fps.length === 0 && moodboardFps.length === 0) return null;
                      const latestFpId = fps.reduce((a: FloorPlan | null, b: FloorPlan) =>
                        !a || new Date(b.uploadedAt) > new Date(a.uploadedAt) ? b : a
                      , null)?.id;
                      const totalCount = fps.length + moodboardFps.length;
                      // Duplicate-name detection for moodboardFps items
                      const fpNameToIds: Record<string, string[]> = {};
                      moodboardFps.forEach((m: Moodboard) => {
                        const title = getDisplayTitle(m) || m.id;
                        if (!fpNameToIds[title]) fpNameToIds[title] = [];
                        fpNameToIds[title].push(m.id);
                      });
                      const fpLatestOfNameIds = new Set<string>();
                      const fpOlderVersionIds = new Set<string>();
                      Object.values(fpNameToIds).forEach(ids => {
                        if (ids.length < 2) return;
                        const candidates = moodboardFps.filter((i: Moodboard) => ids.includes(i.id));
                        const latest = candidates.reduce((a: Moodboard, b: Moodboard) =>
                          new Date(a.uploadedAt) > new Date(b.uploadedAt) ? a : b
                        );
                        fpLatestOfNameIds.add(latest.id);
                        candidates.forEach((c: Moodboard) => { if (c.id !== latest.id) fpOlderVersionIds.add(c.id); });
                      });
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 pb-2 border-b">
                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                            <h4 className="font-bold text-sm uppercase tracking-wide">Floor Plans</h4>
                            <Badge variant="outline" className="text-xs">{totalCount}</Badge>
                          </div>
                          <div className="space-y-3 pl-2">
                            {fps.map((fp: FloorPlan) => {
                              const isPinnedFpLatest = fp.isLatestVersion === true;
                              const isLatest = isPinnedFpLatest || fp.id === latestFpId;
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
                                  <div className="flex items-center gap-2 shrink-0">
                                    {fp.filePath && (
                                      <>
                                        <Button variant="ghost" size="icon"
                                          onClick={() => setFloorPlanViewer({ url: fp.filePath, name: fp.fileName || 'Floor Plan' })}
                                          title="View floor plan">
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon"
                                          onClick={() => {
                                            const a = document.createElement('a');
                                            a.href = fp.filePath;
                                            a.download = fp.fileName || 'floor-plan';
                                            a.click();
                                          }}
                                          title="Download floor plan">
                                          <Download className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => toggleFloorPlanLatestVersionMutation.mutate({ id: fp.id, isLatestVersion: !isPinnedFpLatest })}
                                      title={isPinnedFpLatest ? "Remove Latest Version label" : "Mark as Latest Version"}
                                      className={isPinnedFpLatest ? "text-emerald-600" : "text-muted-foreground"}
                                    >
                                      {isPinnedFpLatest
                                        ? <BookmarkCheck className="h-4 w-4" />
                                        : <Bookmark className="h-4 w-4" />
                                      }
                                    </Button>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        {isPinnedFpLatest ? (
                                          <DropdownMenuItem onClick={() => toggleFloorPlanLatestVersionMutation.mutate({ id: fp.id, isLatestVersion: false })}>
                                            <Badge className="h-3 w-3 mr-2 p-0 bg-emerald-600" />
                                            Remove Latest label
                                          </DropdownMenuItem>
                                        ) : (
                                          <DropdownMenuItem onClick={() => toggleFloorPlanLatestVersionMutation.mutate({ id: fp.id, isLatestVersion: true })}>
                                            <Badge className="h-3 w-3 mr-2 p-0 bg-emerald-600" />
                                            Mark as Latest Version
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={() => setDeletingFpId(fp.id)}
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
                            {/* Moodboard/working-drawing items uploaded to "Floor Plans" folder */}
                            {moodboardFps.map((moodboard: Moodboard) => {
                              const cadMeta = parseCadMeta(moodboard.description);
                              const isCAD = isCadFile(moodboard);
                              const isPinnedLatest = (moodboard as any).isLatestVersion === true;
                              const isFpLatest = isPinnedLatest || fpLatestOfNameIds.has(moodboard.id);
                              const isFpOlder = !isPinnedLatest && fpOlderVersionIds.has(moodboard.id);
                              return (
                                <div key={moodboard.id}
                                  className={`flex items-center justify-between gap-4 p-4 rounded-lg hover-elevate ${
                                    isFpLatest
                                      ? "border-2 border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/30"
                                      : isFpOlder
                                        ? "border border-dashed opacity-70"
                                        : "border"
                                  }`}
                                  data-testid={`drawing-item-${moodboard.id}`}>
                                  <div className="flex-1 min-w-0 flex items-start gap-3">
                                    {isCAD && <FileCode2 className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <h4 className="font-medium text-base truncate" title={getDisplayTitle(moodboard)}>
                                          {getDisplayTitle(moodboard) || "Floor Plan"}
                                        </h4>
                                        {isFpLatest && (
                                          <Badge className="text-[10px] shrink-0 bg-emerald-600 hover:bg-emerald-600 text-white">Latest Version</Badge>
                                        )}
                                        {isFpOlder && (
                                          <Badge variant="outline" className="text-[10px] shrink-0 text-muted-foreground">Older Version</Badge>
                                        )}
                                        {isCAD && <Badge variant="secondary" className="text-xs shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">CAD</Badge>}
                                        <RecentBadge date={moodboard.uploadedAt} />
                                      </div>
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                                        {cadMeta ? (
                                          <>
                                            {cadMeta.type && <span>{cadMeta.type}</span>}
                                            {cadMeta.scale && <><span>•</span><span>{cadMeta.scale}</span></>}
                                            <span>•</span>
                                            <span>{format(new Date(moodboard.uploadedAt), 'dd MMM yyyy')}</span>
                                          </>
                                        ) : (
                                          <>
                                            {moodboard.description && moodboard.fileName && (
                                              <><span>{moodboard.fileName}</span><span>•</span></>
                                            )}
                                            <span>{format(new Date(moodboard.uploadedAt), 'dd MMM yyyy, HH:mm')}</span>
                                          </>
                                        )}
                                      </div>
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
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => toggleLatestVersionMutation.mutate({ id: moodboard.id, isLatestVersion: !isPinnedLatest })}
                                      title={isPinnedLatest ? "Remove Latest Version label" : "Mark as Latest Version"}
                                      className={isPinnedLatest ? "text-emerald-600" : "text-muted-foreground"}
                                      data-testid={`button-latest-${moodboard.id}`}
                                    >
                                      {isPinnedLatest
                                        ? <BookmarkCheck className="h-4 w-4" />
                                        : <Bookmark className="h-4 w-4" />
                                      }
                                    </Button>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" data-testid={`button-actions-${moodboard.id}`}>
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        {isPinnedLatest ? (
                                          <DropdownMenuItem onClick={() => toggleLatestVersionMutation.mutate({ id: moodboard.id, isLatestVersion: false })}>
                                            <Badge className="h-3 w-3 mr-2 p-0 bg-emerald-600" />
                                            Remove Latest label
                                          </DropdownMenuItem>
                                        ) : (
                                          <DropdownMenuItem onClick={() => toggleLatestVersionMutation.mutate({ id: moodboard.id, isLatestVersion: true })}>
                                            <Badge className="h-3 w-3 mr-2 p-0 bg-emerald-600" />
                                            Mark as Latest Version
                                          </DropdownMenuItem>
                                        )}
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
                                                  onClick={() => moveMoodboardToFolder(moodboard.id, f)}
                                                >
                                                  {f}
                                                </DropdownMenuItem>
                                              ))}
                                            </DropdownMenuSubContent>
                                          </DropdownMenuPortal>
                                        </DropdownMenuSub>
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={() => deleteMoodboard(moodboard.id)}
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
                    })()}

                    {Object.entries(group.folderGroups).filter(([folderName]) => folderName !== "Floor Plans").map(([folderName, folderItems]) => {
                      // Build per-name duplicate groups to detect which items share a name
                      const nameToIds: Record<string, string[]> = {};
                      folderItems.forEach((item: Moodboard) => {
                        const title = getDisplayTitle(item) || item.id;
                        if (!nameToIds[title]) nameToIds[title] = [];
                        nameToIds[title].push(item.id);
                      });
                      // Latest-of-name IDs: newest item per name group, but only when duplicates exist
                      const latestOfNameIds = new Set<string>();
                      const olderVersionIds = new Set<string>();
                      Object.values(nameToIds).forEach(ids => {
                        if (ids.length < 2) return;
                        const candidates = folderItems.filter((i: Moodboard) => ids.includes(i.id));
                        const latest = candidates.reduce((a: Moodboard, b: Moodboard) =>
                          new Date(a.uploadedAt) > new Date(b.uploadedAt) ? a : b
                        );
                        latestOfNameIds.add(latest.id);
                        candidates.forEach((c: Moodboard) => { if (c.id !== latest.id) olderVersionIds.add(c.id); });
                      });
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
                            const isPinnedLatest = (moodboard as any).isLatestVersion === true;
                            const isLatest = isPinnedLatest || latestOfNameIds.has(moodboard.id);
                            const isOlder = !isPinnedLatest && olderVersionIds.has(moodboard.id);
                            return (
                            <div key={moodboard.id}
                              className={`flex items-center justify-between gap-4 p-4 rounded-lg hover-elevate ${
                                isLatest
                                  ? "border-2 border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/30"
                                  : isOlder
                                    ? "border border-dashed opacity-70"
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
                                    {isOlder && (
                                      <Badge variant="outline" className="text-[10px] shrink-0 text-muted-foreground">
                                        Older Version
                                      </Badge>
                                    )}
                                    {isCAD && <Badge variant="secondary" className="text-xs shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">CAD</Badge>}
                                    <RecentBadge date={moodboard.uploadedAt} />
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
                                      className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline mt-1 font-medium"
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
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => toggleLatestVersionMutation.mutate({ id: moodboard.id, isLatestVersion: !isPinnedLatest })}
                                  title={isPinnedLatest ? "Remove Latest Version label" : "Mark as Latest Version"}
                                  className={isPinnedLatest ? "text-emerald-600" : "text-muted-foreground"}
                                  data-testid={`button-latest-${moodboard.id}`}
                                >
                                  {isPinnedLatest
                                    ? <BookmarkCheck className="h-4 w-4" />
                                    : <Bookmark className="h-4 w-4" />
                                  }
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" data-testid={`button-actions-${moodboard.id}`}>
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {isPinnedLatest ? (
                                      <DropdownMenuItem
                                        onClick={() => toggleLatestVersionMutation.mutate({ id: moodboard.id, isLatestVersion: false })}
                                      >
                                        <Badge className="h-3 w-3 mr-2 p-0 bg-emerald-600" />
                                        Remove Latest label
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem
                                        onClick={() => toggleLatestVersionMutation.mutate({ id: moodboard.id, isLatestVersion: true })}
                                      >
                                        <Badge className="h-3 w-3 mr-2 p-0 bg-emerald-600" />
                                        Mark as Latest Version
                                      </DropdownMenuItem>
                                    )}
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
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-medium text-base truncate" title={getDisplayTitle(moodboard)}>
                              {getDisplayTitle(moodboard) || labels.listMetadataText}
                            </h4>
                            <RecentBadge date={moodboard.uploadedAt} />
                          </div>
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
                              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline mt-1 font-medium"
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
              multiple
              accept={assetType === 'working_drawing'
                ? "image/*,application/pdf,.dxf,.dwg"
                : assetType === 'render'
                  ? "image/*,application/pdf,.skp,application/vnd.sketchup.skp"
                  : "image/*,application/pdf"}
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

      {floorPlanViewer && (
        <FileViewerModal
          isOpen={!!floorPlanViewer}
          onClose={() => setFloorPlanViewer(null)}
          fileUrl={floorPlanViewer.url}
          fileName={floorPlanViewer.name}
        />
      )}

      <DeleteConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={confirmDelete}
        isDeleting={deleteMutation.isPending}
      />

      <DeleteConfirmDialog
        isOpen={!!deletingFpId}
        onClose={() => setDeletingFpId(null)}
        onConfirm={confirmDeleteFp}
        isDeleting={deleteFloorPlanMutation.isPending}
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

      {/* Edit Render — name + room type */}
      <Dialog open={!!editingRender} onOpenChange={(open) => { if (!open) setEditingRender(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Render</DialogTitle>
            <DialogDescription>Update the name and room type for this render.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-render-name">Name</Label>
              <Input
                id="edit-render-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Render name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-render-room">Room Type</Label>
              <Select value={editRoomType} onValueChange={setEditRoomType}>
                <SelectTrigger id="edit-render-room">
                  <SelectValue placeholder="Select room type" />
                </SelectTrigger>
                <SelectContent>
                  {["Living Room", "Foyer", "Bedroom", "Kitchen", "Dining Room", "Bathroom", "Study", "Kids Room", "Guest Room", "Puja Room", "Hallway", "Walk-in Closet", "Balcony", "General"].map((room) => (
                    <SelectItem key={room} value={room}>{room}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingRender(null)} disabled={updateRenderMutation.isPending}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!editingRender || !editName.trim()) return;
                  updateRenderMutation.mutate({ id: editingRender.id, name: editName, roomType: editRoomType || "General" });
                }}
                disabled={!editName.trim() || updateRenderMutation.isPending}
              >
                {updateRenderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}