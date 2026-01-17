import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, ExternalLink, Download, ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2 } from "lucide-react";

interface FileViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName?: string;
}

export function FileViewerModal({ isOpen, onClose, fileUrl, fileName }: FileViewerModalProps) {
  const [zoomPercent, setZoomPercent] = useState(100);
  const [cleanView, setCleanView] = useState(false);
  const [initialZoom, setInitialZoom] = useState(100);
  const [imageLoaded, setImageLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleZoomIn = () => {
    setZoomPercent(prev => Math.min(prev + 25, 300));
  };

  const handleZoomOut = () => {
    setZoomPercent(prev => Math.max(prev - 25, 25));
  };

  const handleResetZoom = () => {
    setZoomPercent(initialZoom);
  };

  const handleClose = () => {
    setZoomPercent(100);
    setCleanView(false);
    setImageLoaded(false);
    setInitialZoom(100);
    onClose();
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = fileName || 'download';
    a.click();
  };

  const handleOpenExternal = () => {
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  const handleImageLoad = () => {
    const img = imageRef.current;
    const container = containerRef.current;
    
    if (img && container) {
      const containerWidth = container.clientWidth - 64;
      const containerHeight = container.clientHeight - 64;
      
      const widthRatio = containerWidth / img.naturalWidth;
      const heightRatio = containerHeight / img.naturalHeight;
      const fitZoom = Math.min(widthRatio, heightRatio, 1) * 100;
      
      const roundedFitZoom = Math.round(fitZoom);
      setInitialZoom(roundedFitZoom);
      setZoomPercent(roundedFitZoom);
      setImageLoaded(true);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setZoomPercent(100);
      setCleanView(false);
      setImageLoaded(false);
      setInitialZoom(100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isPdf = fileName?.toLowerCase().endsWith('.pdf') || fileUrl.includes('.pdf');
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName || '') || 
                  /(jpg|jpeg|png|gif|webp|svg|bmp)/i.test(fileUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={handleClose} />
      <div 
        className="relative bg-background rounded-lg shadow-lg flex flex-col"
        style={{ width: '95vw', height: '95vh' }}
      >
        {!cleanView ? (
          <div className="p-4 border-b shrink-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold truncate flex-1">
                {fileName || 'File Viewer'}
              </h2>
              <div className="flex items-center gap-1">
                {(isPdf || isImage) && (
                  <>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={handleZoomOut} 
                      disabled={zoomPercent <= 25}
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
                      {zoomPercent}%
                    </span>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={handleZoomIn} 
                      disabled={zoomPercent >= 300}
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={handleResetZoom} 
                      title="Fit to screen"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <div className="w-px h-6 bg-border mx-1" />
                  </>
                )}
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setCleanView(true)} 
                  title="Clean view"
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleOpenExternal} 
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleDownload} 
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleClose}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute top-2 right-2 z-50 flex gap-1 bg-background/80 backdrop-blur-sm rounded-md p-1">
            <Button type="button" variant="ghost" size="icon" onClick={() => setCleanView(false)}>
              <Minimize2 className="w-4 h-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={handleClose}>
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
                style={{ minHeight: '600px', height: 'calc(95vh - 100px)' }}
                title={fileName || 'PDF'}
              />
            </div>
          ) : isImage ? (
            <div className="p-4">
              {!imageLoaded && (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  Loading...
                </div>
              )}
              <img
                ref={imageRef}
                src={fileUrl}
                alt={fileName || 'Image'}
                onLoad={handleImageLoad}
                style={{
                  transform: `scale(${zoomPercent / 100})`,
                  transformOrigin: 'top left',
                  visibility: imageLoaded ? 'visible' : 'hidden',
                }}
              />
            </div>
          ) : (
            <iframe
              src={fileUrl}
              className="w-full h-full border-0"
              style={{ minHeight: '600px' }}
              title={fileName || 'File'}
            />
          )}
        </div>
      </div>
    </div>
  );
}
