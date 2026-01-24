import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ExternalLink, Download, ZoomIn, ZoomOut, RotateCcw, Maximize2, Loader2 } from "lucide-react";

interface FileViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName?: string;
}

export function FileViewerModal({ isOpen, onClose, fileUrl, fileName }: FileViewerModalProps) {
  const [zoom, setZoom] = useState(100);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);
  
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

  const handleClose = () => {
    setZoom(100);
    onClose();
  };

  const isPdf = fileName?.toLowerCase().endsWith('.pdf') || fileUrl.includes('.pdf');
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName || '') || 
                  /(jpg|jpeg|png|gif|webp|svg|bmp)/i.test(fileUrl);
  const isText = fileName?.toLowerCase().endsWith('.txt') || fileUrl.includes('.txt');
  const isOfficeDoc = /\.(docx?|xlsx?|pptx?)$/i.test(fileName || '') || 
                      /(docx?|xlsx?|pptx?)/i.test(fileUrl);
  
  // Build full URL for Google Docs Viewer
  const getFullUrl = () => {
    if (fileUrl.startsWith('http')) return fileUrl;
    return `${window.location.origin}${fileUrl}`;
  };
  
  const googleViewerUrl = isOfficeDoc 
    ? `https://docs.google.com/gview?url=${encodeURIComponent(getFullUrl())}&embedded=true`
    : null;

  useEffect(() => {
    if (isOpen && isText && fileUrl) {
      setIsLoadingText(true);
      setTextContent(null);
      fetch(fileUrl)
        .then(res => res.text())
        .then(text => {
          setTextContent(text);
          setIsLoadingText(false);
        })
        .catch(() => {
          setTextContent('Unable to load file content');
          setIsLoadingText(false);
        });
    }
  }, [isOpen, isText, fileUrl]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0">
        <DialogHeader className="p-3 border-b bg-background">
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
                variant="destructive"
                size="sm"
                onClick={handleClose}
                className="ml-2"
                data-testid="button-close-viewer"
              >
                <X className="w-4 h-4 mr-1" />
                Close
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div 
          className="flex-1 overflow-auto bg-muted/30" 
          style={{ height: 'calc(95vh - 56px)' }}
        >
          {isPdf ? (
            <iframe
              src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH&zoom=${zoom}`}
              className="w-full h-full border-0"
              style={{ 
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top left',
                width: `${10000 / zoom}%`,
                height: `${10000 / zoom}%`,
              }}
              title={fileName || 'PDF viewer'}
              data-testid="file-viewer-pdf"
            />
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
          ) : isText ? (
            <div className="p-4 h-full overflow-auto">
              {isLoadingText ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-words text-sm font-mono bg-background p-4 rounded-md" data-testid="file-viewer-text">
                  {textContent}
                </pre>
              )}
            </div>
          ) : isOfficeDoc && googleViewerUrl ? (
            <iframe
              src={googleViewerUrl}
              className="w-full h-full border-0"
              title={fileName || 'Document viewer'}
              data-testid="file-viewer-office"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
              <div className="text-center">
                <p className="text-muted-foreground mb-2">
                  This file type cannot be previewed in the browser.
                </p>
                <p className="text-sm text-muted-foreground">
                  Use the download button to save the file to your device.
                </p>
              </div>
              <Button onClick={handleDownload} data-testid="button-download-fallback">
                <Download className="w-4 h-4 mr-2" />
                Download File
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
