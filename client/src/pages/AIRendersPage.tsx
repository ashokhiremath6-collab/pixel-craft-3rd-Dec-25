import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Project, Moodboard } from "@shared/schema";
import { 
  Upload, 
  Wand2, 
  Download, 
  Save, 
  Image as ImageIcon, 
  Sparkles,
  Loader2,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Maximize2,
  FolderOpen,
  Check,
  Plus,
  X,
  Palette,
  Search,
  Camera,
  ImagePlus,
  Grid3X3,
  Settings2,
  Edit3,
  Paintbrush,
  Trash2,
  Sofa,
  TreeDeciduous,
  Sun,
  Eraser,
  RotateCcw
} from "lucide-react";

interface ReferenceItem {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  vendorBrand?: string;
  description?: string;
  aiPromptHints?: string;
  placementInstruction: string;
  imageData?: string;
  imageMimeType?: string;
  imagePath?: string;
}

interface CatalogueItem {
  id: string;
  mainCategory: string;
  subcategory: string;
  vendorBrand: string | null;
  description: string | null;
  filePath: string | null;
  aiImagePath: string | null;
  aiPromptHints: string | null;
}

interface RenderStyle {
  id: string;
  name: string;
  prompt: string;
}

interface GeneratedRender {
  imageData: string;
  mimeType: string;
  styleId: string;
  styleName: string;
}

interface ReferencePhoto {
  id: string;
  file: File;
  previewUrl: string;
  type: 'inspiration' | 'existing_space';
  description: string;
}

export default function AIRendersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [textDescription, setTextDescription] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("general");
  const [generatedRender, setGeneratedRender] = useState<GeneratedRender | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showFullSize, setShowFullSize] = useState(false);
  const [showSavedRendersDialog, setShowSavedRendersDialog] = useState(false);
  const [selectedSavedRenderUrl, setSelectedSavedRenderUrl] = useState<string | null>(null);
  
  const [showCatalogueBrowser, setShowCatalogueBrowser] = useState(false);
  const [referenceItems, setReferenceItems] = useState<ReferenceItem[]>([]);
  const [catalogueSearch, setCatalogueSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  const [referencePhotos, setReferencePhotos] = useState<ReferencePhoto[]>([]);
  const referencePhotoInputRef = useRef<HTMLInputElement>(null);
  
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(50);
  const [gridOpacity, setGridOpacity] = useState(0.3);
  const [showGridSettings, setShowGridSettings] = useState(false);
  const [selectedGridCell, setSelectedGridCell] = useState<{ col: number; row: number } | null>(null);
  const [gridInteractive, setGridInteractive] = useState(false);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  
  const [showModifyTools, setShowModifyTools] = useState(false);
  const [modificationPrompt, setModificationPrompt] = useState("");
  
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const cancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setGenerationStartTime(null);
      setElapsedTime(0);
      toast({
        title: "Generation Cancelled",
        description: "You can try again whenever you're ready."
      });
    }
  };
  
  // Helper function to convert column index to letter (0=A, 1=B, etc.)
  const columnToLetter = (col: number): string => {
    let result = '';
    let n = col;
    while (n >= 0) {
      result = String.fromCharCode(65 + (n % 26)) + result;
      n = Math.floor(n / 26) - 1;
    }
    return result;
  };
  
  // Get grid cell coordinate label (e.g., "A1", "B3")
  const getCellLabel = (col: number, row: number): string => {
    return `${columnToLetter(col)}${row + 1}`;
  };
  
  // Calculate grid dimensions based on container size
  const getGridDimensions = () => {
    if (!gridContainerRef.current) return { cols: 0, rows: 0 };
    const width = gridContainerRef.current.offsetWidth;
    const height = gridContainerRef.current.offsetHeight;
    return {
      cols: Math.ceil(width / gridSize),
      rows: Math.ceil(height / gridSize)
    };
  };
  const modifyRenderMutation = useMutation({
    mutationFn: async (params: { prompt: string; gridCell?: { col: number; row: number } | null }) => {
      if (!generatedRender) throw new Error("No render to modify");
      
      abortControllerRef.current = new AbortController();
      
      // Convert base64 to blob, then compress for API
      const base64Response = await fetch(`data:${generatedRender.mimeType};base64,${generatedRender.imageData}`);
      const blob = await base64Response.blob();
      const file = new File([blob], 'render-to-modify.png', { type: generatedRender.mimeType });
      
      // Compress the image before sending
      const compressedBlob = await compressImageOnClient(file);
      const compressedFile = new File([compressedBlob], 'compressed.jpg', { type: 'image/jpeg' });
      
      // Build prompt with grid context if a cell is selected
      let finalPrompt = params.prompt;
      if (params.gridCell) {
        const cellLabel = getCellLabel(params.gridCell.col, params.gridCell.row);
        const { cols, rows } = getGridDimensions();
        const colPosition = params.gridCell.col < cols / 3 ? 'left' : params.gridCell.col > (2 * cols) / 3 ? 'right' : 'center';
        const rowPosition = params.gridCell.row < rows / 3 ? 'top' : params.gridCell.row > (2 * rows) / 3 ? 'bottom' : 'middle';
        finalPrompt = `Focus specifically on grid cell ${cellLabel} (located at the ${rowPosition}-${colPosition} area of the image). ${params.prompt}`;
      }
      
      const formData = new FormData();
      formData.append('image', compressedFile);
      formData.append('styleId', 'custom');
      formData.append('customPrompt', finalPrompt);
      
      const response = await fetch('/api/ai-renders/generate', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        signal: abortControllerRef.current.signal,
      });
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to modify render');
        }
        throw new Error(`Server error (${response.status}). Please try again.`);
      }
      
      return response.json();
    },
    onSuccess: (data: any) => {
      setGeneratedRender({
        imageData: data.imageData,
        mimeType: data.mimeType,
        styleId: generatedRender?.styleId || "modified",
        styleName: `Modified - ${generatedRender?.styleName || "Custom"}`
      });
      setModificationPrompt("");
      setShowModifyTools(false);
      setSelectedGridCell(null);
      toast({
        title: "Modification Complete",
        description: "Your render has been modified successfully."
      });
    },
    onError: (error: Error) => {
      if (error.name === 'AbortError') {
        return;
      }
      const isTimeout = error.message.includes('timed out') || error.message.includes('90 seconds');
      toast({
        title: isTimeout ? "Generation Timed Out" : "Modification Failed",
        description: isTimeout 
          ? "The AI took too long to respond. This can happen with complex images. Please try again." 
          : error.message,
        variant: "destructive"
      });
    }
  });
  
  const quickModifications = [
    { icon: Paintbrush, label: "Change Colors", prompt: "Change the color scheme to be warmer and more inviting with earth tones" },
    { icon: TreeDeciduous, label: "Add Plants", prompt: "Add indoor plants and greenery to make the space feel more natural and lively" },
    { icon: Sofa, label: "Swap Furniture", prompt: "Replace the main furniture with a more modern, minimalist style" },
    { icon: Sun, label: "Brighten Up", prompt: "Make the lighting brighter and add more natural light to the space" },
    { icon: Eraser, label: "Declutter", prompt: "Remove unnecessary items and make the space cleaner and more minimal" },
    { icon: RotateCcw, label: "Undo Changes", prompt: "Revert to a more classic, traditional style similar to the original" }
  ];

  const { data: user, isLoading: userLoading, isError: userError, refetch: refetchUser } = useQuery<{ role: string }>({
    queryKey: ['/api/auth/user'],
  });

  const { data: styles = [] } = useQuery<RenderStyle[]>({
    queryKey: ['/api/ai-renders/styles'],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const { data: savedRenders = [] } = useQuery<Moodboard[]>({
    queryKey: ['/api/moodboards', { assetType: 'render' }],
    queryFn: async () => {
      const response = await fetch('/api/moodboards?assetType=render', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch saved renders');
      return response.json();
    },
  });

  const { data: catalogueItems = [] } = useQuery<CatalogueItem[]>({
    queryKey: ['/api/ai-renders/catalogue-references', selectedCategory, catalogueSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'all') {
        params.append('mainCategory', selectedCategory);
      }
      if (catalogueSearch) {
        params.append('search', catalogueSearch);
      }
      const response = await fetch(`/api/ai-renders/catalogue-references?${params.toString()}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch catalogue items');
      return response.json();
    },
    enabled: showCatalogueBrowser,
  });

  const { data: catalogueCategories = [] } = useQuery<string[]>({
    queryKey: ['/api/catalogue/categories'],
    enabled: showCatalogueBrowser,
  });

  const isDesignerOrAdmin = user?.role === 'admin' || user?.role === 'designer';

  const getPreviewUrl = (render: Moodboard) => {
    if (render.filePath?.startsWith('/objects/')) {
      return render.filePath;
    }
    return `/uploads/${render.filePath}`;
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (userError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Unable to Verify Access</h2>
        <p className="text-muted-foreground mb-4">
          There was a problem checking your permissions. Please try again.
        </p>
        <Button onClick={() => refetchUser()} data-testid="button-retry-auth">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!isDesignerOrAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
        <p className="text-muted-foreground mb-4">
          This page is only available to designers and admins.
        </p>
        <Button onClick={() => setLocation("/renders")} data-testid="button-go-to-renders">
          View Client Renders
        </Button>
      </div>
    );
  }

  const compressImageOnClient = async (file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.8): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log(`Image compressed: ${file.size} -> ${blob.size} bytes`);
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const fetchImageAsBase64 = async (imagePath: string): Promise<{ data: string; mimeType: string } | null> => {
    try {
      const response = await fetch(imagePath, { credentials: 'include' });
      if (!response.ok) return null;
      
      const blob = await response.blob();
      const mimeType = blob.type || 'image/jpeg';
      
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({ data: base64, mimeType });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const addCatalogueItemAsReference = async (item: CatalogueItem) => {
    if (referenceItems.length >= 3) {
      toast({
        title: "Limit Reached",
        description: "Maximum 3 reference items allowed",
        variant: "destructive"
      });
      return;
    }

    if (referenceItems.find(r => r.id === item.id)) {
      toast({
        title: "Already Added",
        description: "This item is already in your references",
        variant: "destructive"
      });
      return;
    }

    const imagePath = item.aiImagePath || item.filePath;
    let imageData: string | undefined;
    let imageMimeType: string | undefined;

    if (imagePath) {
      const imageResult = await fetchImageAsBase64(imagePath);
      if (imageResult) {
        imageData = imageResult.data;
        imageMimeType = imageResult.mimeType;
      }
    }

    const newReference: ReferenceItem = {
      id: item.id,
      name: `${item.subcategory}${item.vendorBrand ? ` - ${item.vendorBrand}` : ''}`,
      category: item.mainCategory,
      subcategory: item.subcategory,
      vendorBrand: item.vendorBrand || undefined,
      description: item.description || undefined,
      aiPromptHints: item.aiPromptHints || undefined,
      placementInstruction: "",
      imageData,
      imageMimeType,
      imagePath: imagePath || undefined,
    };

    setReferenceItems(prev => [...prev, newReference]);
    toast({
      title: "Item Added",
      description: `${newReference.name} added to references`
    });
  };

  const removeReferenceItem = (id: string) => {
    setReferenceItems(prev => prev.filter(item => item.id !== id));
  };

  const updateReferenceInstruction = (id: string, instruction: string) => {
    setReferenceItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, placementInstruction: instruction } : item
      )
    );
  };

  const handleReferencePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, photoType: 'inspiration' | 'existing_space') => {
    const files = e.target.files;
    if (!files) return;

    if (referencePhotos.length + files.length > 5) {
      toast({
        title: "Limit Reached",
        description: "Maximum 5 reference photos allowed",
        variant: "destructive"
      });
      return;
    }

    const newPhotos: ReferencePhoto[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File",
          description: `${file.name} is not an image`,
          variant: "destructive"
        });
        return;
      }

      const id = `ref-photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const previewUrl = URL.createObjectURL(file);
      
      newPhotos.push({
        id,
        file,
        previewUrl,
        type: photoType,
        description: ''
      });
    });

    if (newPhotos.length > 0) {
      setReferencePhotos(prev => [...prev, ...newPhotos]);
      toast({
        title: "Photos Added",
        description: `${newPhotos.length} reference photo(s) added`
      });
    }

    if (referencePhotoInputRef.current) {
      referencePhotoInputRef.current.value = '';
    }
  };

  const removeReferencePhoto = (id: string) => {
    setReferencePhotos(prev => {
      const photo = prev.find(p => p.id === id);
      if (photo) {
        URL.revokeObjectURL(photo.previewUrl);
      }
      return prev.filter(p => p.id !== id);
    });
  };

  const updateReferencePhotoDescription = (id: string, description: string) => {
    setReferencePhotos(prev =>
      prev.map(photo =>
        photo.id === id ? { ...photo, description } : photo
      )
    );
  };

  const generateFromImageMutation = useMutation({
    mutationFn: async (data: { file: File; styleId: string; customPrompt?: string; referenceItems?: ReferenceItem[]; referencePhotos?: ReferencePhoto[] }) => {
      abortControllerRef.current = new AbortController();
      
      const compressedBlob = await compressImageOnClient(data.file);
      const compressedFile = new File([compressedBlob], 'compressed.jpg', { type: 'image/jpeg' });
      
      const formData = new FormData();
      formData.append('image', compressedFile);
      formData.append('styleId', data.styleId);
      if (data.customPrompt) {
        formData.append('customPrompt', data.customPrompt);
      }
      if (data.referenceItems && data.referenceItems.length > 0) {
        formData.append('referenceItems', JSON.stringify(data.referenceItems));
      }
      
      if (data.referencePhotos && data.referencePhotos.length > 0) {
        const compressedRefPhotos = await Promise.all(
          data.referencePhotos.map(async (photo, index) => {
            const compressed = await compressImageOnClient(photo.file, 512, 512, 0.7);
            return new File([compressed], `ref-photo-${index}.jpg`, { type: 'image/jpeg' });
          })
        );
        
        compressedRefPhotos.forEach((photo, index) => {
          formData.append(`referencePhotos`, photo);
        });
        
        const refPhotoMeta = data.referencePhotos.map(p => ({
          type: p.type,
          description: p.description
        }));
        formData.append('referencePhotosMeta', JSON.stringify(refPhotoMeta));
      }
      
      const response = await fetch('/api/ai-renders/generate', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        signal: abortControllerRef.current.signal,
      });
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to generate render');
        } else {
          if (response.status === 413) {
            throw new Error('Image is too large. Please use a smaller image (under 2MB).');
          }
          if (response.status === 504 || response.status === 502) {
            throw new Error('Request timed out. The AI generation is taking longer than expected. Please try again with a smaller image.');
          }
          throw new Error(`Server error (${response.status}). Please try again.`);
        }
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Unexpected server response. Please try again.');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      const style = styles.find(s => s.id === selectedStyle);
      setGeneratedRender({
        imageData: data.imageData,
        mimeType: data.mimeType,
        styleId: selectedStyle,
        styleName: style?.name || selectedStyle
      });
      toast({ title: "Render Generated", description: "Your AI render is ready!" });
    },
    onError: (error: any) => {
      if (error.name === 'AbortError') {
        return;
      }
      const message = error.message || "Failed to generate render";
      const isTimeout = message.includes('timed out') || message.includes('90 seconds') || message.includes('timeout');
      toast({ 
        title: isTimeout ? "Generation Timed Out" : "Generation Failed", 
        description: isTimeout 
          ? "The AI took too long. Try with a smaller image or fewer reference items." 
          : message,
        variant: "destructive" 
      });
    },
  });

  const generateFromDescriptionMutation = useMutation({
    mutationFn: async (data: { description: string; styleId: string }) => {
      return apiRequest('POST', '/api/ai-renders/generate-from-description', data);
    },
    onSuccess: (data: any) => {
      const style = styles.find(s => s.id === selectedStyle);
      setGeneratedRender({
        imageData: data.imageData,
        mimeType: data.mimeType,
        styleId: selectedStyle,
        styleName: style?.name || selectedStyle
      });
      toast({ title: "Render Generated", description: "Your concept render is ready!" });
    },
    onError: (error: any) => {
      const message = error.message || "Failed to generate render";
      const isTimeout = message.includes('timed out') || message.includes('90 seconds') || message.includes('timeout');
      toast({ 
        title: isTimeout ? "Generation Timed Out" : "Generation Failed", 
        description: isTimeout 
          ? "The AI took too long. Try a simpler description." 
          : message,
        variant: "destructive" 
      });
    },
  });

  const saveRenderMutation = useMutation({
    mutationFn: async (data: { 
      imageData: string; 
      mimeType: string; 
      projectId: string; 
      styleId: string;
      description?: string;
      originalFilename?: string;
      referenceItems?: Array<{
        id: string;
        name: string;
        category: string;
        subcategory: string;
        vendorBrand?: string;
        description?: string;
        aiPromptHints?: string;
        imagePath?: string;
        placementInstruction?: string;
      }>;
    }) => {
      return apiRequest('POST', '/api/ai-renders/save', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/moodboards'] });
      toast({ title: "Render Saved", description: "Render saved to project renders" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Save Failed", 
        description: error.message || "Failed to save render",
        variant: "destructive" 
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setSelectedSavedRenderUrl(null);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSelectSavedRender = async (render: Moodboard) => {
    try {
      const url = getPreviewUrl(render);
      
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch render image');
      
      const blob = await response.blob();
      const fileName = render.name || render.fileName || 'saved-render.jpg';
      const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
      
      setSelectedFile(file);
      setSelectedSavedRenderUrl(url);
      setPreviewUrl(url);
      setShowSavedRendersDialog(false);
      
      toast({ 
        title: "Render Selected", 
        description: `"${render.name || 'Saved render'}" loaded for modification` 
      });
    } catch (error) {
      console.error('Error loading saved render:', error);
      toast({ 
        title: "Error", 
        description: "Failed to load the saved render",
        variant: "destructive" 
      });
    }
  };

  const handleGenerateFromImage = () => {
    if (!selectedFile || !selectedStyle) {
      toast({ 
        title: "Missing Information", 
        description: "Please select an image and a style",
        variant: "destructive" 
      });
      return;
    }

    const validReferenceItems = referenceItems.filter(item => 
      item.placementInstruction && item.placementInstruction.trim()
    );

    if (referenceItems.length > 0 && validReferenceItems.length < referenceItems.length) {
      toast({ 
        title: "Missing Instructions", 
        description: "Please add placement instructions for all reference items",
        variant: "destructive" 
      });
      return;
    }
    
    generateFromImageMutation.mutate({
      file: selectedFile,
      styleId: selectedStyle,
      customPrompt: customPrompt || undefined,
      referenceItems: validReferenceItems.length > 0 ? validReferenceItems : undefined,
      referencePhotos: referencePhotos.length > 0 ? referencePhotos : undefined,
    });
  };

  const handleGenerateFromDescription = () => {
    if (!textDescription || !selectedStyle) {
      toast({ 
        title: "Missing Information", 
        description: "Please enter a description and select a style",
        variant: "destructive" 
      });
      return;
    }
    
    generateFromDescriptionMutation.mutate({
      description: textDescription,
      styleId: selectedStyle,
    });
  };

  const generateRenderTitle = () => {
    const style = generatedRender?.styleName || "Custom";
    const brief = customPrompt.trim() || textDescription.trim();
    
    if (brief) {
      const truncatedBrief = brief.length > 50 ? brief.substring(0, 47) + "..." : brief;
      return `Render - ${style} - ${truncatedBrief}`;
    }
    return `Render - ${style}`;
  };

  const handleSaveRender = () => {
    if (!generatedRender) return;
    
    saveRenderMutation.mutate({
      imageData: generatedRender.imageData,
      mimeType: generatedRender.mimeType,
      projectId: selectedProject,
      styleId: generatedRender.styleId,
      description: customPrompt || textDescription || "",
      originalFilename: selectedFile?.name || textDescription || "",
      referenceItems: referenceItems.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        subcategory: item.subcategory,
        vendorBrand: item.vendorBrand,
        description: item.description,
        aiPromptHints: item.aiPromptHints,
        imagePath: item.imagePath,
        placementInstruction: item.placementInstruction,
      })),
    });
  };

  const handleDownload = () => {
    if (!generatedRender) return;
    
    // Extract room name from filename or use description
    let roomName = "Render";
    if (selectedFile?.name) {
      // Remove extension and trailing numbers, clean up
      roomName = selectedFile.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[\s_-]*\d+\s*$/, "")
        .replace(/[-_]+/g, " ")
        .trim()
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join("-")
        .replace(/'/g, "");
    } else if (textDescription) {
      roomName = textDescription.substring(0, 30).replace(/\s+/g, "-");
    }
    
    const styleName = generatedRender.styleName || generatedRender.styleId;
    
    const link = document.createElement('a');
    link.href = `data:${generatedRender.mimeType};base64,${generatedRender.imageData}`;
    link.download = `${roomName}-${styleName}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearAll = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setGeneratedRender(null);
    setCustomPrompt("");
    setTextDescription("");
    setReferenceItems([]);
    referencePhotos.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
    setReferencePhotos([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (referencePhotoInputRef.current) {
      referencePhotoInputRef.current.value = "";
    }
  };

  const getCatalogueItemImageUrl = (item: CatalogueItem) => {
    return item.aiImagePath || item.filePath;
  };

  const isGenerating = generateFromImageMutation.isPending || generateFromDescriptionMutation.isPending;
  const isModifying = modifyRenderMutation.isPending;
  const isAnyAIWorking = isGenerating || isModifying;

  useEffect(() => {
    if (isAnyAIWorking && !generationStartTime) {
      setGenerationStartTime(Date.now());
      setElapsedTime(0);
    } else if (!isAnyAIWorking && generationStartTime) {
      setGenerationStartTime(null);
    }
  }, [isAnyAIWorking, generationStartTime]);

  useEffect(() => {
    if (!generationStartTime) return;
    
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - generationStartTime) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [generationStartTime]);

  const formatElapsedTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-ai-renders">AI Render Playground</h1>
          <p className="text-muted-foreground mt-1">
            Generate concept renders using AI to complement your Foyr Neo designs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://neo.foyr.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <Button variant="outline" data-testid="button-open-foyr-neo">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Foyr Neo
            </Button>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Generate Render
            </CardTitle>
            <CardDescription>
              Upload a room photo or describe your space to generate styled renders
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="image" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="image" data-testid="tab-image-upload">
                  <ImageIcon className="h-4 w-4 mr-2" />
                  From Image
                </TabsTrigger>
                <TabsTrigger value="description" data-testid="tab-description">
                  <Sparkles className="h-4 w-4 mr-2" />
                  From Description
                </TabsTrigger>
              </TabsList>

              <TabsContent value="image" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="image-upload">Source Image</Label>
                  <div className="mt-2 flex gap-2">
                    <Input
                      id="image-upload"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="cursor-pointer flex-1"
                      data-testid="input-image-upload"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => setShowSavedRendersDialog(true)}
                      disabled={savedRenders.length === 0}
                      data-testid="button-select-saved-render"
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Saved
                    </Button>
                  </div>
                  {previewUrl && (
                    <div className="mt-3 relative">
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="max-h-48 rounded-lg border object-contain"
                        data-testid="image-preview"
                      />
                      {selectedSavedRenderUrl && (
                        <Badge className="absolute top-2 left-2" variant="secondary">
                          From Saved
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="custom-prompt">Custom Instructions (Optional)</Label>
                  <Textarea
                    id="custom-prompt"
                    placeholder="Add specific instructions like 'add more plants' or 'change the sofa to leather'"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="mt-2"
                    data-testid="input-custom-prompt"
                  />
                </div>

                <div className="border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Palette className="h-4 w-4 text-primary" />
                      <Label className="text-sm font-medium">Reference Materials</Label>
                      <Badge variant="outline" className="text-xs">{referenceItems.length}/3</Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCatalogueBrowser(true)}
                      disabled={referenceItems.length >= 3}
                      data-testid="button-add-reference"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Select furniture, finishes, or materials from your catalogue to insert into the render
                  </p>
                  
                  {referenceItems.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No reference items added
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {referenceItems.map((item) => (
                        <div key={item.id} className="bg-background rounded-md border p-2">
                          <div className="flex items-start gap-2">
                            {item.imagePath && (
                              <img
                                src={item.imagePath}
                                alt={item.name}
                                className="w-12 h-12 object-cover rounded"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium truncate">{item.name}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0"
                                  onClick={() => removeReferenceItem(item.id)}
                                  data-testid={`button-remove-reference-${item.id}`}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                              <span className="text-xs text-muted-foreground">{item.category}</span>
                              <Input
                                placeholder="Placement instruction (e.g., 'on the main floor area')"
                                value={item.placementInstruction}
                                onChange={(e) => updateReferenceInstruction(item.id, e.target.value)}
                                className="mt-1 h-7 text-xs"
                                data-testid={`input-placement-${item.id}`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4 text-primary" />
                      <Label className="text-sm font-medium">Reference Photos</Label>
                      <Badge variant="outline" className="text-xs">{referencePhotos.length}/5</Badge>
                    </div>
                    <div className="flex gap-1">
                      <input
                        type="file"
                        ref={referencePhotoInputRef}
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleReferencePhotoUpload(e, 'inspiration')}
                        data-testid="input-reference-photos"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => referencePhotoInputRef.current?.click()}
                        disabled={referencePhotos.length >= 5}
                        data-testid="button-add-inspiration-photo"
                      >
                        <ImagePlus className="h-4 w-4 mr-1" />
                        Inspiration
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.multiple = true;
                          input.onchange = (e) => handleReferencePhotoUpload(e as any, 'existing_space');
                          input.click();
                        }}
                        disabled={referencePhotos.length >= 5}
                        data-testid="button-add-existing-photo"
                      >
                        <Camera className="h-4 w-4 mr-1" />
                        Existing
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Add inspiration photos or existing space photos to guide the AI
                  </p>
                  
                  {referencePhotos.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No reference photos added
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {referencePhotos.map((photo) => (
                        <div key={photo.id} className="relative group">
                          <img
                            src={photo.previewUrl}
                            alt={`Reference ${photo.type}`}
                            className="w-full h-20 object-cover rounded border"
                          />
                          <Badge 
                            className="absolute top-1 left-1 text-[10px] px-1 py-0"
                            variant={photo.type === 'inspiration' ? 'default' : 'secondary'}
                          >
                            {photo.type === 'inspiration' ? 'Insp' : 'Exist'}
                          </Badge>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeReferencePhoto(photo.id)}
                            data-testid={`button-remove-photo-${photo.id}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          <Input
                            placeholder="Brief note..."
                            value={photo.description}
                            onChange={(e) => updateReferencePhotoDescription(photo.id, e.target.value)}
                            className="mt-1 h-6 text-xs"
                            data-testid={`input-photo-desc-${photo.id}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="description" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="description">Describe Your Space</Label>
                  <Textarea
                    id="description"
                    placeholder="E.g., A spacious living room with large windows facing a garden, high ceilings, and an open floor plan connecting to the dining area..."
                    value={textDescription}
                    onChange={(e) => setTextDescription(e.target.value)}
                    className="mt-2 min-h-[120px]"
                    data-testid="input-space-description"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div>
              <Label htmlFor="style-select">Design Style</Label>
              <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                <SelectTrigger className="mt-2" data-testid="select-style">
                  <SelectValue placeholder="Select a style" />
                </SelectTrigger>
                <SelectContent>
                  {styles.map((style) => (
                    <SelectItem key={style.id} value={style.id}>
                      {style.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStyle && (
                <p className="text-sm text-muted-foreground mt-2">
                  {styles.find(s => s.id === selectedStyle)?.prompt}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              {isGenerating ? (
                <>
                  <Button 
                    disabled
                    className="flex-1"
                    data-testid="button-generate"
                  >
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating... {elapsedTime > 0 && `(${formatElapsedTime(elapsedTime)})`}
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={cancelGeneration}
                    data-testid="button-cancel-generation"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    onClick={handleGenerateFromImage}
                    disabled={!selectedStyle}
                    className="flex-1"
                    data-testid="button-generate"
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    Generate Render
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleClearAll}
                    data-testid="button-clear"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            
            {isGenerating && elapsedTime > 30 && (
              <p className="text-xs text-muted-foreground text-center">
                AI generation can take up to 90 seconds. Click Cancel to stop and try again.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              Generated Result
            </CardTitle>
            <CardDescription>
              Preview your AI-generated render and save it to your project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {generatedRender ? (
              <>
                <div className="relative group" ref={gridContainerRef}>
                  <img 
                    src={`data:${generatedRender.mimeType};base64,${generatedRender.imageData}`}
                    alt="Generated Render"
                    className="w-full rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                    data-testid="image-generated-render"
                    onClick={() => !gridInteractive && setShowFullSize(true)}
                  />
                  
                  {showGrid && (
                    <div 
                      className={`absolute inset-0 rounded-lg overflow-hidden ${gridInteractive ? '' : 'pointer-events-none'}`}
                      data-testid="grid-overlay"
                    >
                      {/* Base grid lines */}
                      <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          backgroundImage: `
                            linear-gradient(to right, rgba(100, 100, 255, ${gridOpacity}) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(100, 100, 255, ${gridOpacity}) 1px, transparent 1px)
                          `,
                          backgroundSize: `${gridSize}px ${gridSize}px`,
                        }}
                      />
                      
                      {/* Interactive cells overlay */}
                      {gridInteractive && gridContainerRef.current && (() => {
                        const width = gridContainerRef.current.offsetWidth;
                        const height = gridContainerRef.current.offsetHeight;
                        const cols = Math.ceil(width / gridSize);
                        const rows = Math.ceil(height / gridSize);
                        const cells = [];
                        
                        for (let row = 0; row < rows; row++) {
                          for (let col = 0; col < cols; col++) {
                            const isSelected = selectedGridCell?.col === col && selectedGridCell?.row === row;
                            cells.push(
                              <div
                                key={`${col}-${row}`}
                                className={`absolute cursor-pointer transition-colors border ${
                                  isSelected 
                                    ? 'bg-primary/30 border-primary' 
                                    : 'hover:bg-primary/20 border-transparent hover:border-primary/50'
                                }`}
                                style={{
                                  left: col * gridSize,
                                  top: row * gridSize,
                                  width: gridSize,
                                  height: gridSize,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedGridCell(isSelected ? null : { col, row });
                                  if (!showModifyTools) setShowModifyTools(true);
                                }}
                                title={getCellLabel(col, row)}
                                data-testid={`grid-cell-${col}-${row}`}
                              >
                                {isSelected && (
                                  <span className="absolute top-1 left-1 text-xs font-bold text-primary bg-background/80 px-1 rounded">
                                    {getCellLabel(col, row)}
                                  </span>
                                )}
                              </div>
                            );
                          }
                        }
                        return cells;
                      })()}
                    </div>
                  )}
                  
                  <Badge className="absolute top-2 right-2">
                    {generatedRender.styleName}
                  </Badge>
                  
                  <div className="absolute top-2 left-2 flex gap-1">
                    <Button
                      size="icon"
                      variant={showGrid ? "default" : "secondary"}
                      className="h-8 w-8"
                      onClick={() => {
                        setShowGrid(!showGrid);
                        if (showGrid) {
                          setGridInteractive(false);
                          setSelectedGridCell(null);
                        }
                      }}
                      data-testid="button-toggle-grid"
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    
                    {showGrid && (
                      <>
                        <Button
                          size="icon"
                          variant={gridInteractive ? "default" : "secondary"}
                          className="h-8 w-8"
                          onClick={() => setGridInteractive(!gridInteractive)}
                          title={gridInteractive ? "Exit cell selection mode" : "Select a cell to target"}
                          data-testid="button-toggle-grid-interactive"
                        >
                          <Search className="h-4 w-4" />
                        </Button>
                        
                        <Popover open={showGridSettings} onOpenChange={setShowGridSettings}>
                          <PopoverTrigger asChild>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-8 w-8"
                              data-testid="button-grid-settings"
                            >
                              <Settings2 className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64" align="start">
                            <div className="space-y-4">
                              <div>
                                <Label className="text-xs">Grid Size: {gridSize}px</Label>
                                <Slider
                                  value={[gridSize]}
                                  onValueChange={(v) => setGridSize(Math.max(10, v[0]))}
                                  min={10}
                                  max={100}
                                  step={5}
                                  className="mt-2"
                                  data-testid="slider-grid-size"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Opacity: {Math.round(gridOpacity * 100)}%</Label>
                                <Slider
                                  value={[gridOpacity * 100]}
                                  onValueChange={(v) => setGridOpacity(Math.max(0.05, v[0] / 100))}
                                  min={5}
                                  max={80}
                                  step={5}
                                  className="mt-2"
                                  data-testid="slider-grid-opacity"
                                />
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </>
                    )}
                  </div>
                  
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setShowFullSize(true)}
                    data-testid="button-view-fullsize"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {gridInteractive 
                    ? "Click on a grid cell to select it for targeted AI modifications"
                    : "Click image to view full size. Enable grid and click magnifying glass to select cells."}
                </p>
                
                <div className="border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Edit3 className="h-4 w-4 text-primary" />
                      <Label className="text-sm font-medium">Smart Modification</Label>
                    </div>
                    <Button
                      variant={showModifyTools ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowModifyTools(!showModifyTools)}
                      data-testid="button-toggle-modify-tools"
                    >
                      {showModifyTools ? "Hide" : "Edit Render"}
                    </Button>
                  </div>
                  
                  {showModifyTools && (
                    <div className="space-y-3 mt-3">
                      {selectedGridCell && (
                        <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-md border border-primary/20">
                          <Grid3X3 className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Target: Cell {getCellLabel(selectedGridCell.col, selectedGridCell.row)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 ml-auto"
                            onClick={() => setSelectedGridCell(null)}
                            data-testid="button-clear-grid-selection"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-3 gap-2">
                        {quickModifications.map((mod, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            className="flex flex-col h-auto py-2 px-2"
                            onClick={() => modifyRenderMutation.mutate({ prompt: mod.prompt, gridCell: selectedGridCell })}
                            disabled={modifyRenderMutation.isPending}
                            data-testid={`button-quick-mod-${index}`}
                          >
                            <mod.icon className="h-4 w-4 mb-1" />
                            <span className="text-xs">{mod.label}</span>
                          </Button>
                        ))}
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <Label className="text-xs">Custom Modification {selectedGridCell ? `(targeting cell ${getCellLabel(selectedGridCell.col, selectedGridCell.row)})` : ''}</Label>
                        <Textarea
                          placeholder={selectedGridCell 
                            ? `Describe what to change in cell ${getCellLabel(selectedGridCell.col, selectedGridCell.row)} (e.g., 'add a potted plant here')`
                            : "Describe your modification (e.g., 'replace the blue sofa with a grey sectional')"}
                          value={modificationPrompt}
                          onChange={(e) => setModificationPrompt(e.target.value)}
                          className="mt-1 min-h-[60px]"
                          data-testid="input-modification-prompt"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        {modifyRenderMutation.isPending ? (
                          <>
                            <Button
                              disabled
                              className="flex-1"
                              data-testid="button-apply-modification"
                            >
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Modifying... {elapsedTime > 0 && `(${formatElapsedTime(elapsedTime)})`}
                            </Button>
                            <Button 
                              variant="destructive" 
                              onClick={cancelGeneration}
                              data-testid="button-cancel-modification"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            onClick={() => modifyRenderMutation.mutate({ prompt: modificationPrompt, gridCell: selectedGridCell })}
                            disabled={!modificationPrompt.trim()}
                            className="w-full"
                            data-testid="button-apply-modification"
                          >
                            <Wand2 className="h-4 w-4 mr-2" />
                            Apply Modification
                          </Button>
                        )}
                      </div>
                      
                      {modifyRenderMutation.isPending && elapsedTime > 30 && (
                        <p className="text-xs text-muted-foreground text-center">
                          AI modification can take up to 90 seconds. Click X to cancel.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="save-project">Save to Project</Label>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger className="mt-2" data-testid="select-save-project">
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General (No Project)</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.projectName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleSaveRender}
                    disabled={saveRenderMutation.isPending}
                    className="flex-1"
                    data-testid="button-save-render"
                  >
                    {saveRenderMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save to Renders
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleDownload}
                    data-testid="button-download-render"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed rounded-lg">
                <Sparkles className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-center">
                  Your generated render will appear here
                </p>
                <p className="text-sm text-center mt-2">
                  Upload an image or describe a space and select a style to begin
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">1. Upload or Describe</h3>
              <p className="text-sm text-muted-foreground">
                Upload a room photo or describe your space in detail
              </p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                <Wand2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">2. Choose a Style</h3>
              <p className="text-sm text-muted-foreground">
                Select from 10+ design styles like Modern, Scandinavian, or Luxury
              </p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">3. Generate & Save</h3>
              <p className="text-sm text-muted-foreground">
                AI transforms your input into a styled concept render
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-semibold mb-2">Complementing Foyr Neo</h4>
            <p className="text-sm text-muted-foreground">
              AI renders are great for quick concept exploration and client discussions. 
              For precise 3D modeling, furniture placement, and final presentations, 
              continue using <a href="https://neo.foyr.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Foyr Neo</a>.
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showSavedRendersDialog} onOpenChange={setShowSavedRendersDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Select a Saved Render
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            {savedRenders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
                <p>No saved renders found</p>
                <p className="text-sm mt-1">Generate and save some renders first</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {savedRenders.map((render) => {
                  const projectName = projects.find(p => p.id.toString() === render.projectId?.toString())?.projectName || "General";
                  return (
                    <div
                      key={render.id}
                      className="group relative rounded-lg border overflow-hidden cursor-pointer hover-elevate"
                      onClick={() => handleSelectSavedRender(render)}
                      data-testid={`saved-render-${render.id}`}
                    >
                      <img
                        src={getPreviewUrl(render)}
                        alt={render.name || "Saved render"}
                        className="w-full h-32 object-cover"
                      />
                      <div className="p-2 bg-background">
                        <p className="text-sm font-medium truncate">
                          {render.name || render.roomType || "Untitled"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {projectName}
                        </p>
                      </div>
                      <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="bg-primary text-primary-foreground rounded-full p-2">
                          <Check className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={showFullSize} onOpenChange={setShowFullSize}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center justify-between">
              <span>AI Generated Render - {generatedRender?.styleName}</span>
            </DialogTitle>
          </DialogHeader>
          {generatedRender && (
            <div className="p-4 pt-2 overflow-auto">
              <div className="relative inline-block mx-auto">
                <img 
                  src={`data:${generatedRender.mimeType};base64,${generatedRender.imageData}`}
                  alt="Generated Render Full Size"
                  className="max-w-full max-h-[70vh] rounded-lg"
                  data-testid="image-generated-render-fullsize"
                />
                
                {showGrid && (
                  <div 
                    className="absolute inset-0 rounded-lg pointer-events-none overflow-hidden"
                    style={{
                      backgroundImage: `
                        linear-gradient(to right, rgba(100, 100, 255, ${gridOpacity}) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(100, 100, 255, ${gridOpacity}) 1px, transparent 1px)
                      `,
                      backgroundSize: `${gridSize}px ${gridSize}px`,
                    }}
                    data-testid="grid-overlay-fullsize"
                  />
                )}
                
                <div className="absolute top-2 left-2 flex gap-1">
                  <Button
                    size="icon"
                    variant={showGrid ? "default" : "secondary"}
                    className="h-8 w-8"
                    onClick={() => setShowGrid(!showGrid)}
                    data-testid="button-toggle-grid-fullsize"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  
                  {showGrid && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-8 w-8"
                          data-testid="button-grid-settings-fullsize"
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64" align="start">
                        <div className="space-y-4">
                          <div>
                            <Label className="text-xs">Grid Size: {gridSize}px</Label>
                            <Slider
                              value={[gridSize]}
                              onValueChange={(v) => setGridSize(Math.max(10, v[0]))}
                              min={10}
                              max={100}
                              step={5}
                              className="mt-2"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Opacity: {Math.round(gridOpacity * 100)}%</Label>
                            <Slider
                              value={[gridOpacity * 100]}
                              onValueChange={(v) => setGridOpacity(Math.max(0.05, v[0] / 100))}
                              min={5}
                              max={80}
                              step={5}
                              className="mt-2"
                            />
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
              
              <div className="flex justify-center gap-2 mt-4">
                <Button onClick={handleDownload} data-testid="button-download-fullsize">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" onClick={() => setShowFullSize(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Sheet open={showCatalogueBrowser} onOpenChange={setShowCatalogueBrowser}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Catalogue Browser
            </SheetTitle>
            <SheetDescription>
              Select items with images to use as AI references
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-4 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={catalogueSearch}
                  onChange={(e) => setCatalogueSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-catalogue-search"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]" data-testid="select-catalogue-category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {catalogueCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <ScrollArea className="h-[calc(100vh-280px)]">
              {catalogueItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">No catalogue items with images found</p>
                  <p className="text-xs mt-1">Add images to catalogue items to use them as references</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pr-4">
                  {catalogueItems.map((item) => {
                    const imageUrl = getCatalogueItemImageUrl(item);
                    const isSelected = referenceItems.some(r => r.id === item.id);
                    
                    return (
                      <div
                        key={item.id}
                        className={`relative rounded-lg border overflow-hidden cursor-pointer transition-all ${
                          isSelected 
                            ? 'ring-2 ring-primary opacity-60' 
                            : 'hover-elevate'
                        }`}
                        onClick={() => !isSelected && addCatalogueItemAsReference(item)}
                        data-testid={`catalogue-item-${item.id}`}
                      >
                        {imageUrl && (
                          <img
                            src={imageUrl}
                            alt={item.subcategory}
                            className="w-full h-24 object-cover"
                          />
                        )}
                        <div className="p-2 bg-background">
                          <p className="text-sm font-medium truncate">
                            {item.subcategory}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.vendorBrand || item.mainCategory}
                          </p>
                          {item.aiPromptHints && (
                            <p className="text-xs text-primary truncate mt-1">
                              {item.aiPromptHints}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Selected: {referenceItems.length}/3 items. Click an item to add it as a reference.
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
