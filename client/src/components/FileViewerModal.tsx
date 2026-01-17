import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ExternalLink, Download, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from "lucide-react";

interface FileViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName?: string;
}

export function FileViewerModal({ isOpen, onClose, fileUrl, fileName }: FileViewerModalProps) {
  const [zoom, setZoom] = useState(100);
  
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'download';
    link.click();
  };

  const handleOpenExternal = () => {
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 300));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 25));
  };

  const handleResetZoom = () => {
    setZoom(100);
  };

  const handleFitToWidth = () => {
    setZoom(100);
  };

  const isPdf = fileName?.toLowerCase().endsWith('.pdf') || fileUrl.includes('.pdf');
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName || '') || 
                  /(jpg|jpeg|png|gif|webp|svg|bmp)/i.test(fileUrl);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { setZoom(100); onClose(); } }}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0">
        <DialogHeader className="p-4 border-b">
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
                    disabled={zoom <= 25}
                    data-testid="button-zoom-out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
                    {zoom}%
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomIn}
                    title="Zoom in"
                    disabled={zoom >= 300}
                    data-testid="button-zoom-in"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleResetZoom}
                    title="Reset zoom"
                    data-testid="button-reset-zoom"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleFitToWidth}
                    title="Fit to width"
                    data-testid="button-fit-width"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                  <div className="w-px h-6 bg-border mx-1" />
                </>
              )}
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
                onClick={() => { setZoom(100); onClose(); }}
                data-testid="button-close-viewer"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div 
          className="flex-1 overflow-auto bg-muted/30" 
          style={{ height: 'calc(95vh - 60px)' }}
        >
          {isPdf ? (
            <div 
              className="min-h-full flex items-start justify-center p-4"
              style={{ 
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
                width: `${10000 / zoom}%`,
                marginLeft: zoom > 100 ? `${(zoom - 100) / 2}%` : 0,
              }}
            >
              <object
                data={`${fileUrl}#toolbar=1&navpanes=1&scrollbar=1&zoom=${zoom}`}
                type="application/pdf"
                className="w-full"
                style={{ height: 'calc(95vh - 100px)', minHeight: '600px' }}
                title={fileName || 'File viewer'}
                data-testid="file-viewer-object"
              >
                <embed
                  src={`${fileUrl}#toolbar=1&navpanes=1&scrollbar=1&zoom=${zoom}`}
                  type="application/pdf"
                  className="w-full"
                  style={{ height: 'calc(95vh - 100px)', minHeight: '600px' }}
                />
              </object>
            </div>
          ) : isImage ? (
            <div 
              className="min-h-full flex items-center justify-center p-4"
            >
              <img
                src={fileUrl}
                alt={fileName || 'Image viewer'}
                className="max-w-none"
                style={{ 
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'center center',
                }}
                data-testid="file-viewer-image"
              />
            </div>
          ) : (
            <iframe
              src={fileUrl}
              className="w-full h-full border-0"
              title={fileName || 'File viewer'}
              data-testid="file-viewer-iframe"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
