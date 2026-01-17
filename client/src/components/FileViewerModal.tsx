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
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setZoomPercent(100);
    setCleanView(false);
    setInitialZoom(100);
    setDimensions({ width: 0, height: 0 });
  };

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Load image and calculate fit zoom
  useEffect(() => {
    if (!isOpen || !fileUrl) return;
    
    const isImg = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName || '') || 
                  /(jpg|jpeg|png|gif|webp|svg|bmp)/i.test(fileUrl);
    if (!isImg) return;

    const img = new Image();
    img.onload = () => {
      const container = containerRef.current;
      if (!container) return;
      
      const cw = container.clientWidth - 64;
      const ch = container.clientHeight - 64;
      const fit = Math.min(cw / img.naturalWidth, ch / img.naturalHeight, 1) * 100;
      const roundedFit = Math.round(fit);
      
      setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      setInitialZoom(roundedFit);
      setZoomPercent(roundedFit);
    };
    img.src = fileUrl;
  }, [isOpen, fileUrl, fileName]);

  if (!isOpen) return null;

  const isPdf = fileName?.toLowerCase().endsWith('.pdf') || fileUrl.includes('.pdf');
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName || '') || 
                  /(jpg|jpeg|png|gif|webp|svg|bmp)/i.test(fileUrl);

  const scaledWidth = Math.round(dimensions.width * zoomPercent / 100);
  const scaledHeight = Math.round(dimensions.height * zoomPercent / 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative bg-background rounded-lg shadow-lg flex flex-col" style={{ width: '95vw', height: '95vh' }}>
        {!cleanView ? (
          <div className="p-4 border-b shrink-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold truncate flex-1">{fileName || 'File Viewer'}</h2>
              <div className="flex items-center gap-1">
                {(isPdf || isImage) && (
                  <>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setZoomPercent(z => Math.max(z - 25, 25))} disabled={zoomPercent <= 25}>
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground min-w-[3rem] text-center">{zoomPercent}%</span>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setZoomPercent(z => Math.min(z + 25, 300))} disabled={zoomPercent >= 300}>
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setZoomPercent(initialZoom)} title="Fit to screen">
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <div className="w-px h-6 bg-border mx-1" />
                  </>
                )}
                <Button type="button" variant="ghost" size="icon" onClick={() => setCleanView(true)} title="Clean view">
                  <Maximize2 className="w-4 h-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => window.open(fileUrl, '_blank')} title="Open in new tab">
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => { const a = document.createElement('a'); a.href = fileUrl; a.download = fileName || 'download'; a.click(); }} title="Download">
                  <Download className="w-4 h-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute top-2 right-2 z-50 flex gap-1 bg-background/80 backdrop-blur-sm rounded-md p-1">
            <Button type="button" variant="ghost" size="icon" onClick={() => setCleanView(false)}><Minimize2 className="w-4 h-4" /></Button>
            <Button type="button" variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        )}
        
        <div ref={containerRef} className="flex-1 overflow-auto bg-muted/30">
          {isPdf ? (
            <div className="w-full h-full p-4">
              <iframe src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=1`} className="w-full border-0 rounded bg-white" style={{ minHeight: '600px', height: 'calc(95vh - 100px)' }} title={fileName || 'PDF'} />
            </div>
          ) : isImage ? (
            <div className="p-4">
              {dimensions.width === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
              ) : (
                <div style={{ width: scaledWidth, height: scaledHeight }}>
                  <img
                    src={fileUrl}
                    alt={fileName || 'Image'}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              )}
            </div>
          ) : (
            <iframe src={fileUrl} className="w-full h-full border-0" style={{ minHeight: '600px' }} title={fileName || 'File'} />
          )}
        </div>
      </div>
    </div>
  );
}
