import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Upload, 
  Image as ImageIcon, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Trash2,
  BookOpen,
  Eye,
  Palette,
  Sofa,
  Lamp,
  Flower2,
  Shirt,
  Package,
  Save,
  Clock
} from "lucide-react";
import type { ObjectAsset } from "@shared/schema";

const OBJECT_TYPES = [
  { value: "art", label: "Art & Wall Decor", icon: Palette, description: "Paintings, prints, sculptures, wall art" },
  { value: "furniture", label: "Furniture", icon: Sofa, description: "Sofas, chairs, tables, cabinets" },
  { value: "lighting", label: "Lighting", icon: Lamp, description: "Lamps, chandeliers, pendants" },
  { value: "decor", label: "Decor Objects", icon: Flower2, description: "Vases, plants, mirrors, decorative items" },
  { value: "textile", label: "Textiles", icon: Shirt, description: "Rugs, curtains, cushions, throws" },
  { value: "accessory", label: "Accessories", icon: Package, description: "Small items, candles, clocks" },
];

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
    case 'processing':
      return <Badge variant="default" className="gap-1 bg-blue-500"><Loader2 className="w-3 h-3 animate-spin" /> Processing</Badge>;
    case 'completed':
      return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="w-3 h-3" /> Completed</Badge>;
    case 'failed':
      return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getObjectTypeIcon(type: string) {
  const typeConfig = OBJECT_TYPES.find(t => t.value === type);
  if (typeConfig) {
    const Icon = typeConfig.icon;
    return <Icon className="w-4 h-4" />;
  }
  return <Package className="w-4 h-4" />;
}

export default function AssetIngestionPage() {
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<ObjectAsset | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [saveToCatalogueDialogOpen, setSaveToCatalogueDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [selectedObjectType, setSelectedObjectType] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: assets, isLoading } = useQuery<ObjectAsset[]>({
    queryKey: ['/api/object-assets'],
    refetchInterval: 5000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/object-assets/upload', {
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
      toast({ title: "Upload complete", description: "Click 'Analyze' to detect object type and get AI descriptions. Original image is preserved." });
      setUploadDialogOpen(false);
      setUploadFile(null);
      setUploadPreview(null);
      setSelectedObjectType("");
      queryClient.invalidateQueries({ queryKey: ['/api/object-assets'] });
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    }
  });

  const processMutation = useMutation({
    mutationFn: async ({ id, processingInstructions }: { id: string; processingInstructions?: string }) => {
      return apiRequest('POST', `/api/object-assets/${id}/process`, { processingInstructions });
    },
    onSuccess: (_, variables) => {
      const hasInstructions = !!variables.processingInstructions;
      toast({ 
        title: hasInstructions ? "AI Processing started" : "Analysis started", 
        description: hasInstructions ? "AI is editing your image based on instructions..." : "Analyzing image metadata (original preserved)..." 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/object-assets'] });
    },
    onError: () => {
      toast({ title: "Failed to start processing", variant: "destructive" });
    }
  });

  const reprocessMutation = useMutation({
    mutationFn: async ({ id, processingInstructions }: { id: string; processingInstructions?: string }) => {
      return apiRequest('POST', `/api/object-assets/${id}/reprocess`, { processingInstructions });
    },
    onSuccess: (_, variables) => {
      const hasInstructions = !!variables.processingInstructions;
      toast({ 
        title: hasInstructions ? "AI Reprocessing started" : "Reanalysis started",
        description: hasInstructions ? "AI is editing your image based on instructions..." : "Reanalyzing image metadata (original preserved)..."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/object-assets'] });
    },
    onError: () => {
      toast({ title: "Failed to reprocess", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/object-assets/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Asset deleted" });
      setDetailDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/object-assets'] });
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  });

  const saveToCatalogueMutation = useMutation({
    mutationFn: async (data: { id: string; mainCategory: string; subcategory: string; vendorBrand?: string; description?: string }) => {
      return apiRequest('POST', `/api/object-assets/${data.id}/save-to-catalogue`, {
        mainCategory: data.mainCategory,
        subcategory: data.subcategory,
        vendorBrand: data.vendorBrand,
        description: data.description
      });
    },
    onSuccess: () => {
      toast({ title: "Saved to catalogue", description: "Asset has been added to your catalogue" });
      setSaveToCatalogueDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/object-assets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/catalogue'] });
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  });

  const [saveToSavedAssetsDialogOpen, setSaveToSavedAssetsDialogOpen] = useState(false);
  const [savedAssetForm, setSavedAssetForm] = useState({
    displayName: '',
    description: '',
    tags: ''
  });

  const saveToSavedAssetsMutation = useMutation({
    mutationFn: async (data: { displayName: string; description?: string; tags?: string; filePath: string; thumbnailPath?: string; objectAssetId: string; aiPromptHints?: string }) => {
      return apiRequest('POST', `/api/saved-assets`, {
        displayName: data.displayName,
        description: data.description,
        tags: data.tags,
        filePath: data.filePath,
        thumbnailPath: data.thumbnailPath,
        sourceType: 'object_asset',
        objectAssetId: data.objectAssetId,
        aiPromptHints: data.aiPromptHints
      });
    },
    onSuccess: () => {
      toast({ title: "Saved to Saved Assets", description: "Asset has been added to your saved assets collection" });
      setSaveToSavedAssetsDialogOpen(false);
      setSavedAssetForm({ displayName: '', description: '', tags: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/saved-assets'] });
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  });

  // New: Process with AI and save directly to saved assets
  const [processAndSaveDialogOpen, setProcessAndSaveDialogOpen] = useState(false);
  const [processAndSaveForm, setProcessAndSaveForm] = useState({
    processingInstructions: '',
    displayName: '',
    description: '',
    tags: ''
  });

  const processAndSaveMutation = useMutation({
    mutationFn: async (data: { id: string; processingInstructions: string; displayName: string; description?: string; tags?: string }) => {
      return apiRequest('POST', `/api/object-assets/${data.id}/process-and-save`, {
        processingInstructions: data.processingInstructions,
        displayName: data.displayName,
        description: data.description,
        tags: data.tags
      });
    },
    onSuccess: () => {
      toast({ title: "Processed & Saved", description: "AI-processed version saved to your assets collection. Original unchanged." });
      setProcessAndSaveDialogOpen(false);
      setProcessAndSaveForm({ processingInstructions: '', displayName: '', description: '', tags: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/saved-assets'] });
    },
    onError: (error: Error) => {
      toast({ title: "Processing failed", description: error.message, variant: "destructive" });
    }
  });

  const updateAssetMutation = useMutation({
    mutationFn: async (data: { id: string; aiPromptHints?: string; userDescription?: string; objectType?: string; processingInstructions?: string }) => {
      return apiRequest('PUT', `/api/object-assets/${data.id}`, data);
    },
    onSuccess: (updatedAsset: ObjectAsset, variables) => {
      toast({ title: "Asset updated" });
      // Update the selected asset with new hints so dialog shows correct value
      if (selectedAsset && selectedAsset.id === variables.id) {
        setSelectedAsset({ ...selectedAsset, ...variables });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/object-assets'] });
    },
    onError: () => {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  });

  const [editingPromptHints, setEditingPromptHints] = useState<string | null>(null);
  const [editingProcessingInstructions, setEditingProcessingInstructions] = useState<string | null>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: "Invalid file", description: "Please select an image file", variant: "destructive" });
        return;
      }
      setUploadFile(file);
      const reader = new FileReader();
      reader.onload = () => setUploadPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, [toast]);

  const handleUpload = () => {
    if (!uploadFile) return;
    const formData = new FormData();
    formData.append('file', uploadFile);
    if (selectedObjectType) {
      formData.append('objectType', selectedObjectType);
    }
    uploadMutation.mutate(formData);
  };

  const filteredAssets = assets?.filter(asset => {
    if (filterType !== 'all' && asset.objectType !== filterType) return false;
    if (filterStatus !== 'all' && asset.processingStatus !== filterStatus) return false;
    return true;
  }) || [];

  const [catalogueForm, setCatalogueForm] = useState({
    mainCategory: '',
    subcategory: '',
    vendorBrand: '',
    description: ''
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b">
        <div>
          <h1 className="text-2xl font-bold">Asset Ingestion</h1>
          <p className="text-muted-foreground">Upload photos of art, furniture, and objects to process for use in renders</p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)} data-testid="button-upload-asset">
          <Upload className="w-4 h-4 mr-2" />
          Upload Photo
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 p-4 border-b">
        <div className="flex-1">
          <Label className="text-sm mb-1 block">Filter by Type</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger data-testid="select-filter-type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {OBJECT_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label className="text-sm mb-1 block">Filter by Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger data-testid="select-filter-status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="aspect-square w-full rounded-lg mb-3" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <ImageIcon className="w-12 h-12 mb-4" />
            <p className="text-lg font-medium">No assets yet</p>
            <p className="text-sm">Upload a photo to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAssets.map(asset => (
              <Card 
                key={asset.id} 
                className="cursor-pointer hover-elevate transition-all"
                onClick={() => {
                  setSelectedAsset(asset);
                  setDetailDialogOpen(true);
                }}
                data-testid={`card-asset-${asset.id}`}
              >
                <CardContent className="p-4">
                  <div className="aspect-square w-full rounded-lg mb-3 bg-muted overflow-hidden">
                    {asset.originalFilePath ? (
                      <img 
                        src={asset.originalFilePath}
                        alt={asset.originalFileName}
                        className="w-full h-full object-cover"
                      />
                    ) : asset.thumbnailPath || asset.processedFilePath ? (
                      <img 
                        src={asset.thumbnailPath || asset.processedFilePath || ''}
                        alt={asset.originalFileName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    {getObjectTypeIcon(asset.objectType)}
                    <span className="text-sm font-medium truncate">{asset.originalFileName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    {getStatusBadge(asset.processingStatus)}
                    {asset.catalogueItemId && (
                      <Badge variant="outline" className="gap-1">
                        <BookOpen className="w-3 h-3" />
                        In Catalogue
                      </Badge>
                    )}
                  </div>
                  {asset.processingStatus === 'pending' && (
                    <Button
                      size="sm"
                      className="w-full mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        processMutation.mutate({ id: asset.id });
                      }}
                      disabled={processMutation.isPending}
                      data-testid={`button-process-${asset.id}`}
                    >
                      {processMutation.isPending ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3 mr-1" />
                          Analyze
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Photo</DialogTitle>
            <DialogDescription>
              Upload a photo of art, furniture, or any object. After uploading, click "Analyze" to detect the object type and get AI-generated descriptions. The original image is always preserved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              {uploadPreview ? (
                <div className="space-y-4">
                  <img 
                    src={uploadPreview} 
                    alt="Preview" 
                    className="max-h-48 mx-auto rounded-lg object-contain"
                  />
                  <p className="text-sm text-muted-foreground">{uploadFile?.name}</p>
                  <Button variant="outline" size="sm" onClick={() => {
                    setUploadFile(null);
                    setUploadPreview(null);
                  }}>
                    Remove
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">Click to select or drag and drop</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG up to 50MB</p>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                    data-testid="input-file-upload"
                  />
                </label>
              )}
            </div>

            <div>
              <Label htmlFor="objectType">Object Type (Optional)</Label>
              <Select value={selectedObjectType || "auto"} onValueChange={(v) => setSelectedObjectType(v === "auto" ? "" : v)}>
                <SelectTrigger id="objectType" data-testid="select-object-type">
                  <SelectValue placeholder="Auto-detect" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  {OBJECT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="w-4 h-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to let AI detect the object type automatically
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={!uploadFile || uploadMutation.isPending}
              data-testid="button-confirm-upload"
            >
              {uploadMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAsset && getObjectTypeIcon(selectedAsset.objectType)}
              {selectedAsset?.originalFileName}
            </DialogTitle>
            <DialogDescription>
              {selectedAsset && getStatusBadge(selectedAsset.processingStatus)}
            </DialogDescription>
          </DialogHeader>

          {selectedAsset && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm mb-1 block">Original Image</Label>
                  <div className="aspect-square w-full rounded-lg bg-muted overflow-hidden">
                    <img 
                      src={selectedAsset.originalFilePath}
                      alt="Original"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  {selectedAsset.processingStatus === 'completed' && !selectedAsset.processedFilePath && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Analyzed only - original preserved. Add processing instructions and click "Apply AI Instructions" to modify.
                    </p>
                  )}
                </div>
                {selectedAsset.processedFilePath ? (
                  <div>
                    <Label className="text-sm mb-1 block">AI Processed</Label>
                    {selectedAsset.reprocessCount > 0 && (
                      <Badge variant="secondary" className="text-xs mb-2 inline-flex">
                        <RefreshCw className={`w-3 h-3 mr-1 ${selectedAsset.processingStatus === 'processing' ? 'animate-spin' : ''}`} />
                        Reprocessed {selectedAsset.reprocessCount}x
                      </Badge>
                    )}
                    {selectedAsset.processingStatus === 'processing' && selectedAsset.reprocessCount === 0 && (
                      <Badge variant="default" className="text-xs mb-2 inline-flex bg-blue-500">
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        Processing...
                      </Badge>
                    )}
                    <div className="aspect-square w-full rounded-lg bg-muted overflow-hidden">
                      <img 
                        src={selectedAsset.processedFilePath}
                        alt="Processed"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                ) : selectedAsset.processingStatus === 'processing' && (
                  <div>
                    <Label className="text-sm mb-1 block">Processing...</Label>
                    <div className="aspect-square w-full rounded-lg bg-muted overflow-hidden flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>

              {selectedAsset.transparentPath && (
                <div>
                  <Label className="text-sm mb-1 block">Transparent (Background Removed)</Label>
                  <div className="h-32 rounded-lg overflow-hidden" style={{ background: 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 20px 20px' }}>
                    <img 
                      src={selectedAsset.transparentPath}
                      alt="Transparent"
                      className="h-full object-contain mx-auto"
                    />
                  </div>
                </div>
              )}

              {selectedAsset.aiDescription && (
                <div>
                  <Label className="text-sm mb-1 block">AI Description</Label>
                  <p className="text-sm text-muted-foreground">{selectedAsset.aiDescription}</p>
                </div>
              )}

              <div>
                <Label className="text-sm mb-1 block">AI Processing Instructions (Optional)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Add instructions for AI to modify the image (e.g., "remove background", "center the object", "increase brightness"). 
                  <strong> Leave empty to keep the original image unchanged.</strong> Click "Apply AI Instructions" to process.
                </p>
                {editingProcessingInstructions !== null ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editingProcessingInstructions}
                      onChange={(e) => setEditingProcessingInstructions(e.target.value)}
                      className="text-sm font-mono min-h-[80px]"
                      placeholder="e.g., Center the artwork in frame, increase brightness, make proportions symmetrical"
                      data-testid="textarea-processing-instructions"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          updateAssetMutation.mutate({ 
                            id: selectedAsset.id, 
                            processingInstructions: editingProcessingInstructions 
                          });
                          setEditingProcessingInstructions(null);
                        }}
                        disabled={updateAssetMutation.isPending}
                        data-testid="button-save-processing-instructions"
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingProcessingInstructions(null)}
                        data-testid="button-cancel-processing-instructions"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="text-sm font-mono bg-muted px-2 py-1 rounded cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => setEditingProcessingInstructions((selectedAsset as any).processingInstructions || '')}
                    title="Click to edit"
                    data-testid="text-processing-instructions"
                  >
                    {(selectedAsset as any).processingInstructions || <span className="text-muted-foreground italic">Click to add processing instructions...</span>}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-sm mb-1 block">AI Prompt Hints (for renders)</Label>
                {editingPromptHints !== null ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editingPromptHints}
                      onChange={(e) => setEditingPromptHints(e.target.value)}
                      className="text-sm font-mono min-h-[80px]"
                      placeholder="e.g., vintage wooden coffee table with marble top"
                      data-testid="textarea-ai-prompt-hints"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          updateAssetMutation.mutate({ 
                            id: selectedAsset.id, 
                            aiPromptHints: editingPromptHints 
                          });
                          setEditingPromptHints(null);
                        }}
                        disabled={updateAssetMutation.isPending}
                        data-testid="button-save-prompt-hints"
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingPromptHints(null)}
                        data-testid="button-cancel-prompt-hints"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="text-sm font-mono bg-muted px-2 py-1 rounded cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => setEditingPromptHints(selectedAsset.aiPromptHints || '')}
                    title="Click to edit"
                    data-testid="text-ai-prompt-hints"
                  >
                    {selectedAsset.aiPromptHints || <span className="text-muted-foreground italic">Click to add prompt hints...</span>}
                  </div>
                )}
              </div>

              {selectedAsset.processingError && (
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <Label className="text-sm text-destructive">Processing Error</Label>
                  <p className="text-sm text-destructive">{selectedAsset.processingError}</p>
                </div>
              )}

              {selectedAsset.dimensions && (
                <div>
                  <Label className="text-sm mb-1 block">Dimensions</Label>
                  <p className="text-sm text-muted-foreground">
                    {(selectedAsset.dimensions as any).width} x {(selectedAsset.dimensions as any).height} px
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="destructive" 
              onClick={() => selectedAsset && deleteMutation.mutate(selectedAsset.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-delete-asset"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            {selectedAsset?.processingStatus === 'pending' && (
              <Button 
                onClick={() => processMutation.mutate({ id: selectedAsset.id })}
                disabled={processMutation.isPending}
                data-testid="button-process-asset"
              >
                <Eye className={`w-4 h-4 mr-2 ${processMutation.isPending ? 'animate-spin' : ''}`} />
                {processMutation.isPending ? 'Starting...' : 'Analyze (Keep Original)'}
              </Button>
            )}
            {selectedAsset && (selectedAsset.processingStatus === 'failed' || selectedAsset.processingStatus === 'completed' || selectedAsset.processingStatus === 'processing') && (
              <>
                <Button 
                  variant="outline"
                  onClick={() => reprocessMutation.mutate({ id: selectedAsset.id })}
                  disabled={reprocessMutation.isPending || selectedAsset.processingStatus === 'processing'}
                  data-testid="button-reanalyze-asset"
                >
                  <Eye className={`w-4 h-4 mr-2 ${reprocessMutation.isPending || selectedAsset.processingStatus === 'processing' ? 'animate-spin' : ''}`} />
                  {selectedAsset.processingStatus === 'processing' ? 'Processing...' : 'Reanalyze'}
                </Button>
                {(selectedAsset as any).processingInstructions && (
                  <Button 
                    onClick={() => reprocessMutation.mutate({ 
                      id: selectedAsset.id, 
                      processingInstructions: (selectedAsset as any).processingInstructions 
                    })}
                    disabled={reprocessMutation.isPending || selectedAsset.processingStatus === 'processing'}
                    data-testid="button-reprocess-asset"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${reprocessMutation.isPending || selectedAsset.processingStatus === 'processing' ? 'animate-spin' : ''}`} />
                    {selectedAsset.processingStatus === 'processing' ? 'Processing...' : 'Apply AI Instructions'}
                  </Button>
                )}
              </>
            )}
            {selectedAsset?.processingStatus === 'completed' && !selectedAsset.catalogueItemId && (
              <Button 
                onClick={() => {
                  setSaveToCatalogueDialogOpen(true);
                  setCatalogueForm({
                    mainCategory: '',
                    subcategory: '',
                    vendorBrand: '',
                    description: selectedAsset.aiDescription || ''
                  });
                }}
                data-testid="button-save-to-catalogue"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Save to Catalogue
              </Button>
            )}
            {selectedAsset?.processingStatus === 'completed' && selectedAsset.processedFilePath && (
              <Button 
                variant="secondary"
                onClick={() => {
                  setSaveToSavedAssetsDialogOpen(true);
                  setSavedAssetForm({
                    displayName: selectedAsset.aiDescription?.split('.')[0]?.substring(0, 50) || 'Untitled Asset',
                    description: selectedAsset.aiDescription || '',
                    tags: selectedAsset.objectType || ''
                  });
                }}
                data-testid="button-save-to-saved-assets"
              >
                <Save className="w-4 h-4 mr-2" />
                Save to Saved Assets
              </Button>
            )}
            {selectedAsset?.processingStatus === 'completed' && (
              <Button 
                variant="default"
                onClick={() => {
                  setProcessAndSaveDialogOpen(true);
                  setProcessAndSaveForm({
                    processingInstructions: '',
                    displayName: selectedAsset.aiDescription?.split('.')[0]?.substring(0, 50) || 'Processed Asset',
                    description: selectedAsset.aiDescription || '',
                    tags: selectedAsset.objectType || ''
                  });
                }}
                data-testid="button-process-and-save"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Apply AI & Save New
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveToCatalogueDialogOpen} onOpenChange={setSaveToCatalogueDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Save to Catalogue</DialogTitle>
            <DialogDescription>
              Add this processed asset to your catalogue for use in renders
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="mainCategory">Main Category *</Label>
              <Input
                id="mainCategory"
                value={catalogueForm.mainCategory}
                onChange={(e) => setCatalogueForm(f => ({ ...f, mainCategory: e.target.value }))}
                placeholder="e.g., Furniture, Art, Lighting"
                data-testid="input-main-category"
              />
            </div>
            <div>
              <Label htmlFor="subcategory">Subcategory *</Label>
              <Input
                id="subcategory"
                value={catalogueForm.subcategory}
                onChange={(e) => setCatalogueForm(f => ({ ...f, subcategory: e.target.value }))}
                placeholder="e.g., Sofas, Wall Art, Ceiling Lights"
                data-testid="input-subcategory"
              />
            </div>
            <div>
              <Label htmlFor="vendorBrand">Vendor / Brand</Label>
              <Input
                id="vendorBrand"
                value={catalogueForm.vendorBrand}
                onChange={(e) => setCatalogueForm(f => ({ ...f, vendorBrand: e.target.value }))}
                placeholder="Optional"
                data-testid="input-vendor-brand"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={catalogueForm.description}
                onChange={(e) => setCatalogueForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                data-testid="input-description"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setSaveToCatalogueDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedAsset && catalogueForm.mainCategory && catalogueForm.subcategory) {
                  saveToCatalogueMutation.mutate({
                    id: selectedAsset.id,
                    ...catalogueForm
                  });
                }
              }}
              disabled={!catalogueForm.mainCategory || !catalogueForm.subcategory || saveToCatalogueMutation.isPending}
              data-testid="button-confirm-save-catalogue"
            >
              {saveToCatalogueMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save to Catalogue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveToSavedAssetsDialogOpen} onOpenChange={setSaveToSavedAssetsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Save to Saved Assets</DialogTitle>
            <DialogDescription>
              Save this processed image to your Saved Assets collection for use in AI renders
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="savedAssetName">Display Name *</Label>
              <Input
                id="savedAssetName"
                value={savedAssetForm.displayName}
                onChange={(e) => setSavedAssetForm(f => ({ ...f, displayName: e.target.value }))}
                placeholder="e.g., Blue Velvet Armchair"
                data-testid="input-saved-asset-name"
              />
            </div>
            <div>
              <Label htmlFor="savedAssetDescription">Description</Label>
              <Textarea
                id="savedAssetDescription"
                value={savedAssetForm.description}
                onChange={(e) => setSavedAssetForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description of the asset"
                data-testid="input-saved-asset-description"
              />
            </div>
            <div>
              <Label htmlFor="savedAssetTags">Tags</Label>
              <Input
                id="savedAssetTags"
                value={savedAssetForm.tags}
                onChange={(e) => setSavedAssetForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="e.g., furniture, blue, velvet"
                data-testid="input-saved-asset-tags"
              />
              <p className="text-xs text-muted-foreground mt-1">Comma-separated tags to help find this asset</p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setSaveToSavedAssetsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedAsset && savedAssetForm.displayName && selectedAsset.processedFilePath) {
                  saveToSavedAssetsMutation.mutate({
                    displayName: savedAssetForm.displayName,
                    description: savedAssetForm.description || undefined,
                    tags: savedAssetForm.tags || undefined,
                    filePath: selectedAsset.processedFilePath,
                    thumbnailPath: selectedAsset.thumbnailPath || undefined,
                    objectAssetId: selectedAsset.id,
                    aiPromptHints: selectedAsset.aiPromptHints || undefined
                  });
                }
              }}
              disabled={!savedAssetForm.displayName || saveToSavedAssetsMutation.isPending}
              data-testid="button-confirm-save-saved-assets"
            >
              {saveToSavedAssetsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save to Saved Assets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={processAndSaveDialogOpen} onOpenChange={setProcessAndSaveDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apply AI Processing & Save</DialogTitle>
            <DialogDescription>
              Process this image with AI instructions and save the result as a new asset. The original image will remain unchanged.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="processInstructions">AI Processing Instructions *</Label>
              <Textarea
                id="processInstructions"
                value={processAndSaveForm.processingInstructions}
                onChange={(e) => setProcessAndSaveForm(f => ({ ...f, processingInstructions: e.target.value }))}
                placeholder="e.g., Remove background, center the object, make it brighter, add a subtle shadow"
                className="min-h-[100px]"
                data-testid="input-process-instructions"
              />
              <p className="text-xs text-muted-foreground mt-1">Tell the AI how to modify this image</p>
            </div>
            <div>
              <Label htmlFor="processDisplayName">Save As (Display Name) *</Label>
              <Input
                id="processDisplayName"
                value={processAndSaveForm.displayName}
                onChange={(e) => setProcessAndSaveForm(f => ({ ...f, displayName: e.target.value }))}
                placeholder="e.g., Artwork - White Background"
                data-testid="input-process-display-name"
              />
            </div>
            <div>
              <Label htmlFor="processDescription">Description</Label>
              <Textarea
                id="processDescription"
                value={processAndSaveForm.description}
                onChange={(e) => setProcessAndSaveForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                data-testid="input-process-description"
              />
            </div>
            <div>
              <Label htmlFor="processTags">Tags</Label>
              <Input
                id="processTags"
                value={processAndSaveForm.tags}
                onChange={(e) => setProcessAndSaveForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="e.g., processed, white-bg, artwork"
                data-testid="input-process-tags"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setProcessAndSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedAsset && processAndSaveForm.processingInstructions && processAndSaveForm.displayName) {
                  processAndSaveMutation.mutate({
                    id: selectedAsset.id,
                    processingInstructions: processAndSaveForm.processingInstructions,
                    displayName: processAndSaveForm.displayName,
                    description: processAndSaveForm.description || undefined,
                    tags: processAndSaveForm.tags || undefined
                  });
                }
              }}
              disabled={!processAndSaveForm.processingInstructions || !processAndSaveForm.displayName || processAndSaveMutation.isPending}
              data-testid="button-confirm-process-and-save"
            >
              {processAndSaveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {processAndSaveMutation.isPending ? 'Processing...' : 'Apply AI & Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
