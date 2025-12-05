import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Paintbrush, 
  Eraser, 
  RotateCcw, 
  Download, 
  Upload,
  ZoomIn,
  ZoomOut,
  Undo2,
  Eye,
  EyeOff
} from "lucide-react";

interface MaskingCanvasProps {
  sourceImage: string;
  onMaskChange: (maskDataUrl: string | null) => void;
  width?: number;
  height?: number;
}

interface HistoryEntry {
  imageData: ImageData;
}

export function MaskingCanvas({ 
  sourceImage, 
  onMaskChange,
  width = 512,
  height = 512
}: MaskingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [showMask, setShowMask] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const [canvasSize, setCanvasSize] = useState({ width, height });
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!sourceImage) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = canvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      if (!canvas || !maskCanvas) return;

      const containerWidth = containerRef.current?.offsetWidth || 512;
      const containerHeight = 400;

      const imgAspect = img.width / img.height;
      const containerAspect = containerWidth / containerHeight;

      let drawWidth, drawHeight;
      if (imgAspect > containerAspect) {
        drawWidth = containerWidth;
        drawHeight = containerWidth / imgAspect;
      } else {
        drawHeight = containerHeight;
        drawWidth = containerHeight * imgAspect;
      }

      const offsetX = (containerWidth - drawWidth) / 2;
      const offsetY = (containerHeight - drawHeight) / 2;

      canvas.width = containerWidth;
      canvas.height = containerHeight;
      maskCanvas.width = containerWidth;
      maskCanvas.height = containerHeight;

      setCanvasSize({ width: containerWidth, height: containerHeight });
      setImageOffset({ x: offsetX, y: offsetY });
      setScale(drawWidth / img.width);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, containerWidth, containerHeight);
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      }

      const maskCtx = maskCanvas.getContext('2d');
      if (maskCtx) {
        maskCtx.clearRect(0, 0, containerWidth, containerHeight);
      }

      setImageLoaded(true);
      setHistory([]);
      setHistoryIndex(-1);
    };
    img.src = sourceImage;
  }, [sourceImage]);

  const saveToHistory = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ imageData });
    
    if (newHistory.length > 20) {
      newHistory.shift();
    }
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) {
      const maskCanvas = maskCanvasRef.current;
      if (maskCanvas) {
        const ctx = maskCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
          exportMask();
        }
      }
      setHistoryIndex(-1);
      return;
    }

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;

    const prevIndex = historyIndex - 1;
    if (prevIndex >= 0 && history[prevIndex]) {
      ctx.putImageData(history[prevIndex].imageData, 0, 0);
      setHistoryIndex(prevIndex);
      exportMask();
    }
  }, [history, historyIndex]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const draw = useCallback((x: number, y: number) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = tool === 'brush' ? 'source-over' : 'destination-out';
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }, [tool, brushSize]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const { x, y } = getCanvasCoordinates(e);
    draw(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const { x, y } = getCanvasCoordinates(e);
    draw(x, y);
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveToHistory();
      exportMask();
    }
  };

  const handleMouseLeave = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveToHistory();
      exportMask();
    }
  };

  const exportMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) {
      onMaskChange(null);
      return;
    }

    const ctx = maskCanvas.getContext('2d');
    if (!ctx) {
      onMaskChange(null);
      return;
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = maskCanvas.width;
    exportCanvas.height = maskCanvas.height;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) {
      onMaskChange(null);
      return;
    }

    exportCtx.fillStyle = 'white';
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const exportData = exportCtx.getImageData(0, 0, exportCanvas.width, exportCanvas.height);
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i + 3] > 0) {
        exportData.data[i] = 0;
        exportData.data[i + 1] = 0;
        exportData.data[i + 2] = 0;
        exportData.data[i + 3] = 255;
      }
    }
    
    exportCtx.putImageData(exportData, 0, 0);

    const hasContent = imageData.data.some((val, idx) => idx % 4 === 3 && val > 0);
    
    if (hasContent) {
      onMaskChange(exportCanvas.toDataURL('image/png'));
    } else {
      onMaskChange(null);
    }
  }, [onMaskChange]);

  const clearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const ctx = maskCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      setHistory([]);
      setHistoryIndex(-1);
      onMaskChange(null);
    }
  };

  const downloadMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const link = document.createElement('a');
    link.download = 'mask.png';
    link.href = maskCanvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={tool === 'brush' ? 'default' : 'outline'}
            onClick={() => setTool('brush')}
            data-testid="button-brush-tool"
          >
            <Paintbrush className="h-4 w-4 mr-1" />
            Brush
          </Button>
          <Button
            size="sm"
            variant={tool === 'eraser' ? 'default' : 'outline'}
            onClick={() => setTool('eraser')}
            data-testid="button-eraser-tool"
          >
            <Eraser className="h-4 w-4 mr-1" />
            Eraser
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={undo}
            disabled={historyIndex < 0}
            data-testid="button-undo-mask"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={clearMask}
            data-testid="button-clear-mask"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Clear
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowMask(!showMask)}
            data-testid="button-toggle-mask-visibility"
          >
            {showMask ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-xs whitespace-nowrap">Brush Size:</Label>
        <Slider
          value={[brushSize]}
          onValueChange={(val) => setBrushSize(val[0])}
          min={5}
          max={100}
          step={5}
          className="flex-1"
          data-testid="slider-brush-size"
        />
        <Badge variant="secondary" className="min-w-[40px] justify-center">
          {brushSize}px
        </Badge>
      </div>

      <div 
        ref={containerRef}
        className="relative border rounded-lg overflow-hidden bg-muted"
        style={{ height: '400px' }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: tool === 'brush' ? 'crosshair' : 'cell' }}
        />
        <canvas
          ref={maskCanvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ 
            cursor: tool === 'brush' ? 'crosshair' : 'cell',
            opacity: showMask ? 1 : 0,
            pointerEvents: imageLoaded ? 'auto' : 'none'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          data-testid="canvas-mask-drawing"
        />
        
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            Loading image...
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        <span className="font-medium">Instructions:</span> Paint over the area you want to edit (shown in red). 
        The AI will only modify the painted region while keeping everything else exactly the same.
      </div>
    </div>
  );
}