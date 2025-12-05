import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Upload, 
  Image as ImageIcon, 
  Search,
  FolderOpen,
  Save,
  CheckCircle,
  Loader2,
  X
} from "lucide-react";
import type { CatalogueItem, SavedAsset, ObjectAsset } from "@shared/schema";

export interface SelectedAsset {
  type: 'external' | 'catalogue' | 'saved_asset' | 'ingestion';
  id?: string;
  file?: File;
  filePath?: string;
  thumbnailPath?: string;
  displayName: string;
  description?: string;
  aiPromptHints?: string;
  previewUrl?: string;
}

interface AssetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: SelectedAsset) => void;
  title?: string;
  description?: string;
  allowMultiple?: boolean;
}

export function AssetPicker({ 
  open, 
  onOpenChange, 
  onSelect, 
  title = "Select Asset",
  description = "Choose an asset from your collection or upload a new file"
}: AssetPickerProps) {
  const [activeTab, setActiveTab] = useState<string>("saved");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  const { data: catalogueItems, isLoading: catalogueLoading } = useQuery<CatalogueItem[]>({
    queryKey: ['/api/catalogue'],
    enabled: activeTab === 'catalogue'
  });

  const { data: savedAssets, isLoading: savedAssetsLoading } = useQuery<SavedAsset[]>({
    queryKey: ['/api/saved-assets'],
    enabled: activeTab === 'saved'
  });

  const { data: objectAssets, isLoading: objectAssetsLoading } = useQuery<ObjectAsset[]>({
    queryKey: ['/api/object-assets'],
    enabled: activeTab === 'ingestion'
  });

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        return;
      }
      setUploadFile(file);
      const reader = new FileReader();
      reader.onload = () => setUploadPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, []);

  const handleExternalSelect = () => {
    if (uploadFile && uploadPreview) {
      onSelect({
        type: 'external',
        file: uploadFile,
        displayName: uploadFile.name,
        previewUrl: uploadPreview
      });
      setUploadFile(null);
      setUploadPreview(null);
      onOpenChange(false);
    }
  };

  const handleCatalogueSelect = (item: CatalogueItem) => {
    onSelect({
      type: 'catalogue',
      id: item.id,
      filePath: item.filePath || undefined,
      displayName: item.description || `${item.mainCategory} - ${item.subcategory}`,
      description: item.description || undefined,
      aiPromptHints: item.aiPromptHints || undefined,
      previewUrl: item.filePath ? `/objects/${item.filePath.replace('/objects/', '')}` : undefined
    });
    onOpenChange(false);
  };

  const handleSavedAssetSelect = (asset: SavedAsset) => {
    onSelect({
      type: 'saved_asset',
      id: asset.id,
      filePath: asset.filePath,
      thumbnailPath: asset.thumbnailPath || undefined,
      displayName: asset.displayName,
      description: asset.description || undefined,
      aiPromptHints: asset.aiPromptHints || undefined,
      previewUrl: asset.thumbnailPath ? `/objects/${asset.thumbnailPath.replace('/objects/', '')}` 
        : asset.filePath ? `/objects/${asset.filePath.replace('/objects/', '')}` : undefined
    });
    onOpenChange(false);
  };

  const handleIngestionAssetSelect = (asset: ObjectAsset) => {
    const imagePath = asset.processedFilePath || asset.originalFilePath;
    onSelect({
      type: 'ingestion',
      id: asset.id,
      filePath: imagePath,
      thumbnailPath: asset.thumbnailPath || undefined,
      displayName: asset.aiDescription?.split('.')[0]?.substring(0, 50) || asset.originalFileName,
      description: asset.aiDescription || undefined,
      aiPromptHints: asset.aiPromptHints || undefined,
      previewUrl: asset.thumbnailPath ? `/objects/${asset.thumbnailPath.replace('/objects/', '')}` 
        : imagePath ? `/objects/${imagePath.replace('/objects/', '')}` : undefined
    });
    onOpenChange(false);
  };

  const filteredCatalogueItems = catalogueItems?.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.mainCategory?.toLowerCase().includes(query) ||
      item.subcategory?.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      item.vendorBrand?.toLowerCase().includes(query)
    );
  }) || [];

  const filteredSavedAssets = savedAssets?.filter(asset => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      asset.displayName.toLowerCase().includes(query) ||
      asset.description?.toLowerCase().includes(query) ||
      asset.tags?.toLowerCase().includes(query)
    );
  }) || [];

  // Show completed assets (both analyze-only and AI-processed)
  // Assets are usable once they have been analyzed, even without AI processing
  const filteredIngestionAssets = objectAssets?.filter(asset => {
    // Include completed assets (analyzed or processed)
    if (asset.processingStatus !== 'completed') return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      asset.originalFileName.toLowerCase().includes(query) ||
      asset.aiDescription?.toLowerCase().includes(query) ||
      asset.objectType?.toLowerCase().includes(query)
    );
  }) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="ingestion" className="gap-2" data-testid="tab-ingestion">
              <ImageIcon className="w-4 h-4" />
              Ingestion
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-2" data-testid="tab-saved-assets">
              <Save className="w-4 h-4" />
              Saved
            </TabsTrigger>
            <TabsTrigger value="catalogue" className="gap-2" data-testid="tab-catalogue">
              <FolderOpen className="w-4 h-4" />
              Catalogue
            </TabsTrigger>
            <TabsTrigger value="external" className="gap-2" data-testid="tab-external">
              <Upload className="w-4 h-4" />
              Upload
            </TabsTrigger>
          </TabsList>

          <div className="py-3">
            {(activeTab === 'saved' || activeTab === 'catalogue' || activeTab === 'ingestion') && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-asset-search"
                />
              </div>
            )}
          </div>

          <TabsContent value="ingestion" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-[400px]">
              {objectAssetsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-1">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <Card key={i}>
                      <CardContent className="p-3">
                        <Skeleton className="aspect-square w-full rounded-lg mb-2" />
                        <Skeleton className="h-4 w-3/4" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredIngestionAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No processed assets</p>
                  <p className="text-sm">Upload and process images in Asset Ingestion</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-1">
                  {filteredIngestionAssets.map(asset => (
                    <Card 
                      key={asset.id} 
                      className="cursor-pointer hover-elevate transition-all"
                      onClick={() => handleIngestionAssetSelect(asset)}
                      data-testid={`card-ingestion-asset-${asset.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="aspect-square relative rounded-lg overflow-hidden bg-muted mb-2">
                          {asset.thumbnailPath || asset.processedFilePath || asset.originalFilePath ? (
                            <img
                              src={`/objects/${(asset.thumbnailPath || asset.processedFilePath || asset.originalFilePath).replace('/objects/', '')}`}
                              alt={asset.originalFileName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                          <Badge 
                            variant="default" 
                            className={`absolute top-1 right-1 text-xs ${asset.processedFilePath ? 'bg-green-600' : 'bg-blue-600'}`}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {asset.processedFilePath ? 'Processed' : 'Analyzed'}
                          </Badge>
                        </div>
                        <p className="font-medium text-sm truncate">{asset.originalFileName}</p>
                        <p className="text-xs text-muted-foreground truncate">{asset.objectType}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="saved" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-[400px]">
              {savedAssetsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-1">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <Card key={i}>
                      <CardContent className="p-3">
                        <Skeleton className="aspect-square w-full rounded-lg mb-2" />
                        <Skeleton className="h-4 w-3/4" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredSavedAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Save className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No saved assets</p>
                  <p className="text-sm">Process images in Asset Ingestion and save them here</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-1">
                  {filteredSavedAssets.map(asset => (
                    <Card 
                      key={asset.id} 
                      className="cursor-pointer hover-elevate transition-all"
                      onClick={() => handleSavedAssetSelect(asset)}
                      data-testid={`card-saved-asset-${asset.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="aspect-square relative rounded-lg overflow-hidden bg-muted mb-2">
                          {asset.thumbnailPath || asset.filePath ? (
                            <img
                              src={`/objects/${(asset.thumbnailPath || asset.filePath).replace('/objects/', '')}`}
                              alt={asset.displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <p className="font-medium text-sm truncate">{asset.displayName}</p>
                        {asset.tags && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {asset.tags.split(',').slice(0, 2).map((tag, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{tag.trim()}</Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="catalogue" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-[400px]">
              {catalogueLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-1">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <Card key={i}>
                      <CardContent className="p-3">
                        <Skeleton className="aspect-square w-full rounded-lg mb-2" />
                        <Skeleton className="h-4 w-3/4" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredCatalogueItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <FolderOpen className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No catalogue items</p>
                  <p className="text-sm">Add items to your catalogue first</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-1">
                  {filteredCatalogueItems.filter(item => item.filePath).map(item => (
                    <Card 
                      key={item.id} 
                      className="cursor-pointer hover-elevate transition-all"
                      onClick={() => handleCatalogueSelect(item)}
                      data-testid={`card-catalogue-item-${item.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="aspect-square relative rounded-lg overflow-hidden bg-muted mb-2">
                          {item.filePath ? (
                            <img
                              src={`/objects/${item.filePath.replace('/objects/', '')}`}
                              alt={item.description || ''}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <p className="font-medium text-sm truncate">{item.description || `${item.mainCategory}`}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.subcategory}</p>
                        {item.vendorBrand && (
                          <Badge variant="outline" className="text-xs mt-1">{item.vendorBrand}</Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="external" className="flex-1 min-h-0 mt-0">
            <div className="space-y-4">
              {uploadPreview ? (
                <div className="relative">
                  <div className="aspect-video relative rounded-lg overflow-hidden bg-muted">
                    <img
                      src={uploadPreview}
                      alt="Upload preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setUploadFile(null);
                      setUploadPreview(null);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{uploadFile?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {uploadFile && (uploadFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button onClick={handleExternalSelect} data-testid="button-use-external-file">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Use This Image
                    </Button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="w-12 h-12 mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium">Drop an image here or click to upload</p>
                  <p className="text-sm text-muted-foreground">Supports PNG, JPG, WEBP</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="input-external-file"
                  />
                </label>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default AssetPicker;
