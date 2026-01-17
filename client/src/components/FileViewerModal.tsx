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
  const [scale, setScale] = useState(1);
  const [cleanView, setCleanView] = useState(false);
  const [baseScale, setBaseScale] = useState(1);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  
  function download(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = fileName || 'download';
    a.click();
  }

  function openNew(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  }

  function zoomIn(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setScale(s => {
      const newScale = Math.min(s + 0.25, 3);
      console.log('Zoom in:', s, '->', newScale);
      return newScale;
    });
  }

  function zoomOut(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setScale(s => {
      const newScale = Math.max(s - 0.25, 0.25);
      console.log('Zoom out:', s, '->', newScale);
      return newScale;
    });
  }

  function resetZoom(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setScale(baseScale);
  }

  function close() {
    setScale(1);
    setCleanView(false);
    setReady(false);
    setBaseScale(1);
    setImgSize({ w: 0, h: 0 });
    onClose();
  }

  function onImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    const box = boxRef.current;
    if (!box || !img.naturalWidth || !img.naturalHeight) return;
    
    const boxW = box.clientWidth - 64;
    const boxH = box.clientHeight - 64;
    const fitScale = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight, 1);
    
    setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    setBaseScale(fitScale);
    setScale(fitScale);
    setReady(true);
  }

  useEffect(() => {
    if (!isOpen) {
      setScale(1);
      setCleanView(false);
      setReady(false);
      setBaseScale(1);
      setImgSize({ w: 0, h: 0 });
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
  const isImg = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName || '') || 
                /(jpg|jpeg|png|gif|webp|svg|bmp)/i.test(fileUrl);

  const pct = Math.round(scale * 100);
  const w = imgSize.w * scale;
  const h = imgSize.h * scale;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={close} />
      <div className="relative bg-background rounded-lg shadow-lg flex flex-col" style={{ width: '95vw', height: '95vh', maxWidth: '95vw', maxHeight: '95vh' }}>
        {!cleanView ? (
          <div className="p-4 border-b shrink-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold truncate flex-1">
                {fileName || 'File Viewer'}
              </h2>
              <div className="flex items-center gap-1">
                {(isPdf || isImg) && (
                  <>
                    <Button type="button" variant="ghost" size="icon" onClick={zoomOut} disabled={scale <= 0.25}>
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground min-w-[3rem] text-center">{pct}%</span>
                    <Button type="button" variant="ghost" size="icon" onClick={zoomIn} disabled={scale >= 3}>
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={resetZoom} title="Fit to screen">
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <div className="w-px h-6 bg-border mx-1" />
                  </>
                )}
                <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setCleanView(true); }} title="Clean view">
                  <Maximize2 className="w-4 h-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={openNew} title="Open in new tab">
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={download} title="Download">
                  <Download className="w-4 h-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); close(); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute top-2 right-2 z-50 flex gap-1 bg-background/80 backdrop-blur-sm rounded-md p-1">
            <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setCleanView(false); }}>
              <Minimize2 className="w-4 h-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); close(); }}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        <div ref={boxRef} className="flex-1 overflow-auto bg-muted/30">
          {isPdf ? (
            <div className="w-full h-full p-4">
              <iframe
                src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                className="w-full border-0 rounded bg-white"
                style={{ minHeight: '600px', height: 'calc(95vh - 100px)' }}
                title={fileName || 'PDF'}
              />
            </div>
          ) : isImg ? (
            <div className="p-4 min-h-full">
              {!ready && <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>}
              <img
                key={fileUrl}
                src={fileUrl}
                alt={fileName || 'Image'}
                onLoad={onImgLoad}
                style={{
                  width: ready ? `${w}px` : undefined,
                  height: ready ? `${h}px` : undefined,
                  maxWidth: ready ? 'none' : '100%',
                  display: ready ? 'block' : 'none',
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
