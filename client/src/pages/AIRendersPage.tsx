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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Project } from "@shared/schema";
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
  Maximize2
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

  const { data: user, isLoading: userLoading, isError: userError, refetch: refetchUser } = useQuery<{ role: string }>({
    queryKey: ['/api/auth/user'],
  });

  const { data: styles = [] } = useQuery<RenderStyle[]>({
    queryKey: ['/api/ai-renders/styles'],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const isDesignerOrAdmin = user?.role === 'admin' || user?.role === 'designer';

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

  const generateFromImageMutation = useMutation({
    mutationFn: async (data: { file: File; styleId: string; customPrompt?: string }) => {
      const formData = new FormData();
      formData.append('image', data.file);
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
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate render');
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
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
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
      description: generateRenderTitle(),
    });
  };

  const handleDownload = () => {
    if (!generatedRender) return;
    
    const link = document.createElement('a');
    link.href = `data:${generatedRender.mimeType};base64,${generatedRender.imageData}`;
    link.download = `AI-Render-${generatedRender.styleId}-${Date.now()}.png`;
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
                  <Label htmlFor="image-upload">Upload Room Photo</Label>
                  <div className="mt-2">
                    <Input
                      id="image-upload"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="cursor-pointer"
                      data-testid="input-image-upload"
                    />
                  </div>
                  {previewUrl && (
                    <div className="mt-3">
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="max-h-48 rounded-lg border object-contain"
                        data-testid="image-preview"
                      />
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
