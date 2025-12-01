import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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
  Columns,
  SlidersHorizontal,
  Layers,
  Grid3X3,
  Heart,
  X
} from "lucide-react";

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

const ROOM_PRESETS = [
  { id: "living-room", name: "Living Room", prompt: "Focus on comfortable seating arrangement, accent lighting, and a cohesive color palette for the living area" },
  { id: "bedroom", name: "Bedroom", prompt: "Create a restful atmosphere with soft lighting, comfortable bedding, and calming colors for the bedroom" },
  { id: "kitchen", name: "Kitchen", prompt: "Enhance with modern appliances, efficient storage, pendant lighting, and a functional island or breakfast bar" },
  { id: "bathroom", name: "Bathroom", prompt: "Add luxury fixtures, ambient lighting, natural stone textures, and spa-like elements" },
  { id: "dining-room", name: "Dining Room", prompt: "Feature an elegant dining table, statement chandelier, and sophisticated table setting" },
  { id: "home-office", name: "Home Office", prompt: "Include ergonomic furniture, good task lighting, organized storage, and a productive work environment" },
  { id: "kids-room", name: "Kids Room", prompt: "Add playful colors, creative storage solutions, and age-appropriate furniture and decor" },
  { id: "outdoor", name: "Outdoor/Patio", prompt: "Create an inviting outdoor living space with comfortable seating, greenery, and ambient lighting" },
  { id: "entryway", name: "Entryway/Foyer", prompt: "Make a welcoming first impression with console table, mirror, lighting fixture, and organized storage" },
  { id: "walk-in-closet", name: "Walk-in Closet", prompt: "Design with efficient organization, good lighting, and luxurious finishes for wardrobe storage" },
];

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
  const [showComparison, setShowComparison] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedBatchStyles, setSelectedBatchStyles] = useState<string[]>([]);
  const [batchResults, setBatchResults] = useState<GeneratedRender[]>([]);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [showFavoritesDialog, setShowFavoritesDialog] = useState(false);
  const [newFavoriteName, setNewFavoriteName] = useState("");

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

  // Fetch favorite styles from the database
  const { data: favoriteStyles = [] } = useQuery<Array<{ id: string; name: string; styleId: string; prompt: string | null; createdAt: string }>>({
    queryKey: ['/api/ai-renders/favorites'],
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

  const compressImageOnClient = async (file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.7): Promise<Blob> => {
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

  const generateFromImageMutation = useMutation({
    mutationFn: async (data: { file: File; styleId: string; customPrompt?: string }) => {
      const compressedBlob = await compressImageOnClient(data.file);
      const compressedFile = new File([compressedBlob], 'compressed.jpg', { type: 'image/jpeg' });
      
      const formData = new FormData();
      formData.append('image', compressedFile);
      formData.append('styleId', data.styleId);
      if (data.customPrompt) {
        formData.append('customPrompt', data.customPrompt);
      }
      
      const response = await fetch('/api/ai-renders/generate', {
        method: 'POST',
        body: formData,
        credentials: 'include',
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
      toast({ 
        title: "Generation Failed", 
        description: error.message || "Failed to generate render",
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
      toast({ 
        title: "Generation Failed", 
        description: error.message || "Failed to generate render",
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

  // Favorite styles mutations
  const addFavoriteMutation = useMutation({
    mutationFn: async (data: { name: string; styleId: string; prompt: string | null }) => {
      return apiRequest('POST', '/api/ai-renders/favorites', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-renders/favorites'] });
      setNewFavoriteName("");
      setShowFavoritesDialog(false);
      toast({ title: "Favorite Saved", description: "Style combination saved to your favorites" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to Save", 
        description: error.message || "Could not save favorite",
        variant: "destructive" 
      });
    },
  });

  const deleteFavoriteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/ai-renders/favorites/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-renders/favorites'] });
      toast({ title: "Favorite Removed", description: "Style removed from favorites" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to Remove", 
        description: error.message || "Could not remove favorite",
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
    
    generateFromImageMutation.mutate({
      file: selectedFile,
      styleId: selectedStyle,
      customPrompt: customPrompt || undefined,
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

  const toggleBatchStyle = (styleId: string) => {
    setSelectedBatchStyles(prev => 
      prev.includes(styleId) 
        ? prev.filter(s => s !== styleId)
        : [...prev, styleId]
    );
  };

  const handleBatchGenerate = async () => {
    if (!selectedFile || selectedBatchStyles.length === 0) {
      toast({ 
        title: "Missing Information", 
        description: "Please select an image and at least one style",
        variant: "destructive" 
      });
      return;
    }

    setBatchGenerating(true);
    setBatchResults([]);
    setBatchProgress({ current: 0, total: selectedBatchStyles.length });

    const results: GeneratedRender[] = [];

    for (let i = 0; i < selectedBatchStyles.length; i++) {
      const styleId = selectedBatchStyles[i];
      const style = styles.find(s => s.id === styleId);
      
      setBatchProgress({ current: i + 1, total: selectedBatchStyles.length });

      try {
        const compressedBlob = await compressImageOnClient(selectedFile);
        const compressedFile = new File([compressedBlob], 'compressed.jpg', { type: 'image/jpeg' });
        
        const formData = new FormData();
        formData.append('image', compressedFile);
        formData.append('styleId', styleId);
        if (customPrompt) {
          formData.append('customPrompt', customPrompt);
        }
        
        const response = await fetch('/api/ai-renders/generate', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          results.push({
            imageData: data.imageData,
            mimeType: data.mimeType,
            styleId: styleId,
            styleName: style?.name || styleId
          });
          setBatchResults([...results]);
        }
      } catch (error) {
        console.error(`Error generating ${styleId}:`, error);
      }
    }

    setBatchGenerating(false);
    toast({ 
      title: "Batch Complete", 
      description: `Generated ${results.length} of ${selectedBatchStyles.length} renders` 
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
    setSelectedSavedRenderUrl(null);
    setBatchResults([]);
    setSelectedBatchStyles([]);
    setShowComparison(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownloadBatchRender = (render: GeneratedRender) => {
    let roomName = "Render";
    if (selectedFile?.name) {
      roomName = selectedFile.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[\s_-]*\d+\s*$/, "")
        .replace(/[-_]+/g, " ")
        .trim()
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join("-")
        .replace(/'/g, "");
    }
    
    const link = document.createElement('a');
    link.href = `data:${render.mimeType};base64,${render.imageData}`;
    link.download = `${roomName}-${render.styleName}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveBatchRender = (render: GeneratedRender) => {
    saveRenderMutation.mutate({
      imageData: render.imageData,
      mimeType: render.mimeType,
      projectId: selectedProject,
      styleId: render.styleId,
      description: customPrompt || `${render.styleName} render`,
      originalFilename: selectedFile?.name || render.styleName,
    });
  };

  const isGenerating = generateFromImageMutation.isPending || generateFromDescriptionMutation.isPending;

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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="custom-prompt">Custom Instructions (Optional)</Label>
                    <Select 
                      value="" 
                      onValueChange={(presetId) => {
                        const preset = ROOM_PRESETS.find(p => p.id === presetId);
                        if (preset) {
                          setCustomPrompt(prev => prev ? `${prev}\n${preset.prompt}` : preset.prompt);
                        }
                      }}
                    >
                      <SelectTrigger className="w-40 h-8" data-testid="select-room-preset">
                        <SelectValue placeholder="Room presets" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROOM_PRESETS.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    id="custom-prompt"
                    placeholder="Add specific instructions like 'add more plants' or 'change the sofa to leather'"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="mt-2"
                    data-testid="input-custom-prompt"
                  />
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
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="style-select">Design Style</Label>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="batch-mode" 
                    checked={batchMode}
                    onCheckedChange={(checked) => {
                      setBatchMode(!!checked);
                      if (!checked) setSelectedBatchStyles([]);
                    }}
                    data-testid="checkbox-batch-mode"
                  />
                  <Label htmlFor="batch-mode" className="text-sm cursor-pointer">
                    <Layers className="h-4 w-4 inline mr-1" />
                    Batch Mode
                  </Label>
                </div>
              </div>
              
              {batchMode ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Select multiple styles to generate at once:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {styles.map((style) => (
                      <div
                        key={style.id}
                        className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                          selectedBatchStyles.includes(style.id) 
                            ? 'bg-primary/10 border-primary' 
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => toggleBatchStyle(style.id)}
                        data-testid={`batch-style-${style.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            checked={selectedBatchStyles.includes(style.id)}
                            onCheckedChange={() => toggleBatchStyle(style.id)}
                          />
                          <span className="text-sm font-medium">{style.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedBatchStyles.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {selectedBatchStyles.length} style{selectedBatchStyles.length > 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>
              ) : (
                <>
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
                  
                  {/* Favorite Styles Section */}
                  {favoriteStyles.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium flex items-center gap-1">
                          <Heart className="h-4 w-4 text-rose-500" />
                          Favorite Styles
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {favoriteStyles.map((fav) => (
                          <Badge
                            key={fav.id}
                            variant="outline"
                            className="cursor-pointer hover:bg-muted group"
                            onClick={() => {
                              setSelectedStyle(fav.styleId);
                              if (fav.prompt) setCustomPrompt(fav.prompt);
                            }}
                            data-testid={`favorite-${fav.id}`}
                          >
                            <Heart className="h-3 w-3 mr-1 text-rose-500 fill-rose-500" />
                            {fav.name}
                            <button
                              className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteFavoriteMutation.mutate(fav.id);
                              }}
                              data-testid={`delete-favorite-${fav.id}`}
                            >
                              <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Save Current as Favorite Button */}
                  {selectedStyle && (
                    <div className="mt-3">
                      <Dialog open={showFavoritesDialog} onOpenChange={setShowFavoritesDialog}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" data-testid="button-save-favorite">
                            <Heart className="h-4 w-4 mr-1" />
                            Save as Favorite
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Save Favorite Style</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <p className="text-sm text-muted-foreground">
                              Save this style{customPrompt ? " and prompt" : ""} combination for quick access:
                            </p>
                            <div className="space-y-2">
                              <p className="text-sm">
                                <strong>Style:</strong> {styles.find(s => s.id === selectedStyle)?.name}
                              </p>
                              {customPrompt && (
                                <p className="text-sm">
                                  <strong>Prompt:</strong> {customPrompt.slice(0, 100)}{customPrompt.length > 100 ? '...' : ''}
                                </p>
                              )}
                            </div>
                            <Input
                              placeholder="Enter a name for this favorite"
                              value={newFavoriteName}
                              onChange={(e) => setNewFavoriteName(e.target.value)}
                              data-testid="input-favorite-name"
                            />
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setShowFavoritesDialog(false)}>
                                Cancel
                              </Button>
                              <Button 
                                onClick={() => {
                                  if (newFavoriteName.trim()) {
                                    addFavoriteMutation.mutate({
                                      name: newFavoriteName.trim(),
                                      styleId: selectedStyle,
                                      prompt: customPrompt || null,
                                    });
                                  }
                                }}
                                disabled={!newFavoriteName.trim() || addFavoriteMutation.isPending}
                                data-testid="button-confirm-save-favorite"
                              >
                                {addFavoriteMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Heart className="h-4 w-4 mr-1" />
                                    Save
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-2">
              {batchMode ? (
                <Button 
                  onClick={handleBatchGenerate}
                  disabled={batchGenerating || selectedBatchStyles.length === 0 || !selectedFile}
                  className="flex-1"
                  data-testid="button-batch-generate"
                >
                  {batchGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating {batchProgress.current}/{batchProgress.total}...
                    </>
                  ) : (
                    <>
                      <Grid3X3 className="h-4 w-4 mr-2" />
                      Generate {selectedBatchStyles.length} Renders
                    </>
                  )}
                </Button>
              ) : (
                <Button 
                  onClick={handleGenerateFromImage}
                  disabled={isGenerating || !selectedStyle}
                  className="flex-1"
                  data-testid="button-generate"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate Render
                    </>
                  )}
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={handleClearAll}
                data-testid="button-clear"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            
            {batchGenerating && (
              <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-2" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                Generated Result
              </div>
              {generatedRender && previewUrl && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={showComparison ? "default" : "outline"}
                    onClick={() => setShowComparison(!showComparison)}
                    data-testid="button-toggle-comparison"
                  >
                    <Columns className="h-4 w-4 mr-1" />
                    Compare
                  </Button>
                </div>
              )}
            </CardTitle>
            <CardDescription>
              Preview your AI-generated render and save it to your project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {batchResults.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{batchResults.length} render{batchResults.length > 1 ? 's' : ''} generated</p>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger className="w-48" data-testid="select-batch-project">
                      <SelectValue placeholder="Save to project" />
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
                <div className="grid grid-cols-2 gap-3">
                  {batchResults.map((result, index) => (
                    <div key={index} className="relative group rounded-lg border overflow-hidden">
                      <img 
                        src={`data:${result.mimeType};base64,${result.imageData}`}
                        alt={`${result.styleName} render`}
                        className="w-full aspect-square object-cover"
                      />
                      <Badge className="absolute top-2 left-2">{result.styleName}</Badge>
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8"
                            onClick={() => handleSaveBatchRender(result)}
                            data-testid={`button-save-batch-${index}`}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8"
                            onClick={() => handleDownloadBatchRender(result)}
                            data-testid={`button-download-batch-${index}`}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : generatedRender ? (
              <>
                {showComparison && previewUrl ? (
                  <div className="space-y-4">
                    <div className="flex gap-1 justify-center">
                      <Button
                        size="sm"
                        variant={sliderPosition === -1 ? "default" : "outline"}
                        onClick={() => setSliderPosition(-1)}
                        data-testid="button-side-by-side"
                      >
                        <Columns className="h-4 w-4 mr-1" />
                        Side by Side
                      </Button>
                      <Button
                        size="sm"
                        variant={sliderPosition >= 0 ? "default" : "outline"}
                        onClick={() => setSliderPosition(50)}
                        data-testid="button-slider-view"
                      >
                        <SlidersHorizontal className="h-4 w-4 mr-1" />
                        Slider
                      </Button>
                    </div>
                    
                    {sliderPosition === -1 ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <img 
                            src={previewUrl} 
                            alt="Original" 
                            className="w-full rounded-lg border"
                          />
                          <Badge className="absolute top-2 left-2" variant="secondary">Original</Badge>
                        </div>
                        <div className="relative">
                          <img 
                            src={`data:${generatedRender.mimeType};base64,${generatedRender.imageData}`}
                            alt="Generated"
                            className="w-full rounded-lg border"
                          />
                          <Badge className="absolute top-2 right-2">{generatedRender.styleName}</Badge>
                        </div>
                      </div>
                    ) : (
                      <div className="relative overflow-hidden rounded-lg border" style={{ aspectRatio: '4/3' }}>
                        <img 
                          src={`data:${generatedRender.mimeType};base64,${generatedRender.imageData}`}
                          alt="Generated"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div 
                          className="absolute inset-0 overflow-hidden"
                          style={{ width: `${sliderPosition}%` }}
                        >
                          <img 
                            src={previewUrl} 
                            alt="Original" 
                            className="absolute inset-0 w-full h-full object-cover"
                            style={{ width: `${100 / (sliderPosition / 100)}%`, maxWidth: 'none' }}
                          />
                        </div>
                        <div 
                          className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize flex items-center justify-center"
                          style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
                        >
                          <div className="w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                        <Badge className="absolute top-2 left-2" variant="secondary">Original</Badge>
                        <Badge className="absolute top-2 right-2">{generatedRender.styleName}</Badge>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={sliderPosition}
                          onChange={(e) => setSliderPosition(Number(e.target.value))}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
                          data-testid="slider-comparison"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative group">
                    <img 
                      src={`data:${generatedRender.mimeType};base64,${generatedRender.imageData}`}
                      alt="Generated Render"
                      className="w-full rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                      data-testid="image-generated-render"
                      onClick={() => setShowFullSize(true)}
                    />
                    <Badge className="absolute top-2 right-2">
                      {generatedRender.styleName}
                    </Badge>
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
                )}
                <p className="text-xs text-muted-foreground text-center">
                  {showComparison ? "Compare original with generated render" : "Click image to view full size"}
                </p>

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
              <img 
                src={`data:${generatedRender.mimeType};base64,${generatedRender.imageData}`}
                alt="Generated Render Full Size"
                className="max-w-full max-h-[75vh] mx-auto rounded-lg"
                data-testid="image-generated-render-fullsize"
              />
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
    </div>
  );
}
