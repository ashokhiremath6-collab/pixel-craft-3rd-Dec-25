import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ExternalLink, Download, ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2 } from "lucide-react";

interface FileViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName?: string;
}

export function FileViewerModal({ isOpen, onClose, fileUrl, fileName }: FileViewerModalProps) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [cleanView, setCleanView] = useState(false);
  const [fitScale, setFitScale] = useState(1);
  const [imageReady, setImageReady] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'download';
    link.click();
  };

  const handleOpenExternal = () => {
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.25));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomLevel(fitScale);
  }, [fitScale]);

  const handleClose = () => {
    setZoomLevel(1);
    setCleanView(false);
    setImageReady(false);
    setFitScale(1);
    setNaturalSize({ width: 0, height: 0 });
    onClose();
  };

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const container = containerRef.current;
    
    if (container && img.naturalWidth && img.naturalHeight) {
      const containerWidth = container.clientWidth - 64;
      const containerHeight = container.clientHeight - 64;
      
      const widthRatio = containerWidth / img.naturalWidth;
      const heightRatio = containerHeight / img.naturalHeight;
      const scale = Math.min(widthRatio, heightRatio, 1);
      
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      setFitScale(scale);
      setZoomLevel(scale);
      setImageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setZoomLevel(1);
      setCleanView(false);
      setImageReady(false);
      setFitScale(1);
      setNaturalSize({ width: 0, height: 0 });
    }
  }, [isOpen]);

  const isPdf = fileName?.toLowerCase().endsWith('.pdf') || fileUrl.includes('.pdf');
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName || '') || 
                  /(jpg|jpeg|png|gif|webp|svg|bmp)/i.test(fileUrl);

  const displayZoom = Math.round(zoomLevel * 100);
  
  const imageWidth = naturalSize.width * zoomLevel;
  const imageHeight = naturalSize.height * zoomLevel;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 flex flex-col">
        {!cleanView ? (
          <DialogHeader className="p-4 border-b shrink-0">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-sm truncate flex-1" data-testid="viewer-file-name">
                {fileName || 'File Viewer'}
              </DialogTitle>
              <div className="flex items-center gap-1">
                {(isPdf || isImage) && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleZoomOut}
                      title="Zoom out"
                      disabled={zoomLevel <= 0.25}
                      data-testid="button-zoom-out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
                      {displayZoom}%
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleZoomIn}
                      title="Zoom in"
                      disabled={zoomLevel >= 3}
                      data-testid="button-zoom-in"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleResetZoom}
                      title="Fit to screen"
                      data-testid="button-reset-zoom"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <div className="w-px h-6 bg-border mx-1" />
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCleanView(true)}
                  title="Clean view (hide controls)"
                  data-testid="button-clean-view"
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleOpenExternal}
                  title="Open in new tab"
                  data-testid="button-open-external"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDownload}
                  title="Download file"
                  data-testid="button-download-file"
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  data-testid="button-close-viewer"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
        ) : (
          <div className="absolute top-2 right-2 z-50 flex gap-1 bg-background/80 backdrop-blur-sm rounded-md p-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCleanView(false)}
              title="Show controls"
              data-testid="button-exit-clean-view"
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              data-testid="button-close-clean-view"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        <div ref={containerRef} className="flex-1 overflow-auto bg-muted/30">
          {isPdf ? (
            <div className="w-full h-full p-4">
              <iframe
                src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                className="w-full border-0 rounded bg-white"
                style={{ 
                  minHeight: '600px',
                  height: 'calc(95vh - 100px)',
                }}
                title={fileName || 'File viewer'}
                data-testid="file-viewer-pdf"
              />
            </div>
          ) : isImage ? (
            <div className="p-4 flex justify-start items-start min-h-full">
              <img
                key={fileUrl}
                src={fileUrl}
                alt={fileName || 'Image viewer'}
                onLoad={handleImageLoad}
                style={{
                  width: imageReady ? `${imageWidth}px` : 'auto',
                  height: imageReady ? `${imageHeight}px` : 'auto',
                  maxWidth: imageReady ? 'none' : '100%',
                  visibility: imageReady ? 'visible' : 'hidden',
                }}
                data-testid="file-viewer-image"
              />
              {!imageReady && (
                <div className="flex items-center justify-center w-full h-64">
                  <span className="text-muted-foreground">Loading...</span>
                </div>
              )}
            </div>
          ) : (
            <iframe
              src={fileUrl}
              className="w-full h-full border-0"
              style={{ minHeight: '600px' }}
              title={fileName || 'File viewer'}
              data-testid="file-viewer-iframe"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
