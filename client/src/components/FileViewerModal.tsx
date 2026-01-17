import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ExternalLink, Download } from "lucide-react";

interface FileViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName?: string;
}

export function FileViewerModal({ isOpen, onClose, fileUrl, fileName }: FileViewerModalProps) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'download';
    link.click();
  };

  const handleOpenExternal = () => {
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  const isPdf = fileName?.toLowerCase().endsWith('.pdf') || fileUrl.includes('.pdf');
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName || '') || 
                  /(jpg|jpeg|png|gif|webp|svg|bmp)/i.test(fileUrl);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0">
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-sm truncate flex-1" data-testid="viewer-file-name">
              {fileName || 'File Viewer'}
            </DialogTitle>
            <div className="flex items-center gap-1">
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
                onClick={onClose}
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
            <object
              data={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
              type="application/pdf"
              className="w-full h-full"
              title={fileName || 'File viewer'}
              data-testid="file-viewer-object"
            >
              <embed
                src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                type="application/pdf"
                className="w-full h-full"
              />
            </object>
          ) : isImage ? (
            <div className="min-h-full flex items-center justify-center p-4">
              <img
                src={fileUrl}
                alt={fileName || 'Image viewer'}
                className="max-w-full max-h-full object-contain"
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
