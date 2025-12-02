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
  Search
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
  type: 'catalogue' | 'uploaded';
}

interface CatalogueItemForReference {
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

export default function AIRendersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceFileInputRef = useRef<HTMLInputElement>(null);
  
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
  const [editRegion, setEditRegion] = useState<string | null>(null);
  const imagePreviewRef = useRef<HTMLImageElement>(null);

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

  const { data: catalogueItems = [] } = useQuery<CatalogueItemForReference[]>({
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

  const addCatalogueItemAsReference = async (item: CatalogueItemForReference) => {
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
      type: 'catalogue',
    };

    setReferenceItems(prev => [...prev, newReference]);
    toast({
      title: "Item Added",
      description: `${newReference.name} added to references`
    });
  };

  const handleReferenceImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (referenceItems.length >= 3) {
      toast({
        title: "Limit Reached",
        description: "Maximum 3 reference items allowed",
        variant: "destructive"
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file (JPG, PNG, WebP)",
        variant: "destructive"
      });
      return;
    }

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        const previewUrl = URL.createObjectURL(file);
        
        const newReference: ReferenceItem = {
          id: `upload-${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          category: 'Uploaded Reference',
          subcategory: 'Custom Upload',
          placementInstruction: "",
          imageData: base64,
          imageMimeType: file.type,
          imagePath: previewUrl,
          type: 'uploaded',
        };

        setReferenceItems(prev => [...prev, newReference]);
        toast({
          title: "Image Added",
          description: `${newReference.name} added as reference`
        });
      };
      reader.readAsDataURL(file);
    } catch {
      toast({
        title: "Upload Failed",
        description: "Could not process the image",
        variant: "destructive"
      });
    }

    // Reset the input
    if (referenceFileInputRef.current) {
      referenceFileInputRef.current.value = '';
    }
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

  const generateFromImageMutation = useMutation({
    mutationFn: async (data: { file: File; styleId: string; customPrompt?: string; referenceItems?: ReferenceItem[]; editRegion?: string | null }) => {
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
      if (data.editRegion) {
        formData.append('editRegion', data.editRegion);
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
      referenceItems?: { id: string; name: string; type: string; placementInstruction: string; }[];
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
      editRegion: customPrompt?.trim() ? editRegion : undefined,
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
        type: item.type,
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getCatalogueItemImageUrl = (item: CatalogueItemForReference) => {
    return item.aiImagePath || item.filePath;
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
                    <div className="mt-3 space-y-2">
                      <div className="relative inline-block">
                        <img 
                          ref={imagePreviewRef}
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
                        {customPrompt.trim() && (
                          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-[1px] rounded-lg overflow-hidden">
                            {['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'].map((region) => (
                              <button
                                key={region}
                                onClick={() => setEditRegion(editRegion === region ? null : region)}
                                className={`transition-all ${
                                  editRegion === region 
                                    ? 'bg-primary/40 border-2 border-primary' 
                                    : 'bg-transparent hover:bg-primary/20 border border-white/30'
                                }`}
                                title={`Edit ${region.replace('-', ' ')}`}
                                data-testid={`region-${region}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      {customPrompt.trim() && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Edit region:</span>
                          {editRegion ? (
                            <Badge variant="default" className="capitalize">
                              {editRegion.replace('-', ' ')}
                              <button onClick={() => setEditRegion(null)} className="ml-1 hover:text-destructive">
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground italic">Click image to select area to edit (recommended)</span>
                          )}
                        </div>
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
                  <input
                    type="file"
                    ref={referenceFileInputRef}
                    onChange={handleReferenceImageUpload}
                    accept="image/*"
                    className="hidden"
                    data-testid="input-reference-file"
                  />
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Palette className="h-4 w-4 text-primary" />
                      <Label className="text-sm font-medium">Reference Materials</Label>
                      <Badge variant="outline" className="text-xs">{referenceItems.length}/3</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => referenceFileInputRef.current?.click()}
                        disabled={referenceItems.length >= 3}
                        data-testid="button-upload-reference"
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Photo
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCatalogueBrowser(true)}
                        disabled={referenceItems.length >= 3}
                        data-testid="button-add-reference"
                      >
                        <FolderOpen className="h-4 w-4 mr-1" />
                        Catalogue
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Upload a photo or select from your catalogue to use as reference for the AI render
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
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1 min-w-0">
                                  <span className="text-sm font-medium truncate">{item.name}</span>
                                  <Badge variant={item.type === 'uploaded' ? 'secondary' : 'outline'} className="text-[10px] px-1 shrink-0">
                                    {item.type === 'uploaded' ? 'Photo' : 'Catalogue'}
                                  </Badge>
                                </div>
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
              <Button 
                variant="outline" 
                onClick={handleClearAll}
                data-testid="button-clear"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
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
                <p className="text-xs text-muted-foreground text-center">Click image to view full size</p>

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
