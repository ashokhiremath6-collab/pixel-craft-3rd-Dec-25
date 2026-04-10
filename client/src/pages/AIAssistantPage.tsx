import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Send, RotateCcw, Copy, Check, BrainCircuit, ChevronRight, Paperclip, X, FileText, ImageIcon, Wand2, ArrowRight, Sparkles, PenLine, Download, Loader2, BookOpen, MessageSquare, Map, Layers, Package, Lightbulb, FolderDown, Box } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface Attachment {
  name: string;
  mimeType: string;
  data: string;       // base64
  previewUrl?: string; // for images only
  size: number;
}

interface RenderBrief {
  styleId: string;
  description: string;
  customPrompt: string;
}

const STYLE_LABELS: Record<string, string> = {
  modern: "Modern", minimalist: "Minimalist", industrial: "Industrial",
  scandinavian: "Scandinavian", bohemian: "Bohemian", "mid-century": "Mid-Century Modern",
  luxury: "Luxury", coastal: "Coastal", traditional: "Traditional", rustic: "Rustic",
};

interface Message {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  type?: "text" | "render-brief" | "floor-plan" | "elevation";
  briefData?: RenderBrief;
  svgContent?: string;
}

const SUGGESTED_PROMPTS = [
  "Design a master bedroom 4m × 5m with ensuite and walk-in wardrobe",
  "Layout a studio apartment 8m × 6m — open-plan living, kitchen, sleeping area",
  "What depth should bookshelves be for A4 ring binders?",
  "How many wine bottles fit in a 900mm wide wine rack with 3 rows?",
  "Design a bar storage unit 1200mm wide × 900mm tall for mixed glassware and spirits",
  "Standard dimensions for a home bar counter with seating",
  "Recommended cupboard depth for a walk-in wardrobe",
  "Standard kitchen worktop height and overhang dimensions",
];

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/gif,image/heic,application/pdf,.dxf,.obj,.skp";
const MAX_FILE_MB = 20;

function MarkdownRenderer({ text }: { text: string }) {
  const renderMarkdown = (md: string) => {
    if (!md) return [];
    const lines = md.split("\n");
    const elements: JSX.Element[] = [];
    let i = 0;
    let k = 0; // dedicated key counter — always unique

    while (i < lines.length) {
      const line = lines[i];

      if (line.trim().startsWith("|") && lines[i + 1]?.trim().startsWith("|")) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          tableLines.push(lines[i]);
          i++;
        }
        const headers = tableLines[0]
          .split("|")
          .filter((c) => c.trim())
          .map((c) => c.trim());
        const rows = tableLines
          .slice(2)
          .map((row) => row.split("|").filter((c) => c.trim()).map((c) => c.trim()))
          .filter((row) => row.length > 0);

        elements.push(
          <div key={k++} className="overflow-x-auto my-3">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/60">
                  {headers.map((h, hi) => (
                    <th key={hi} className="px-3 py-2 text-left font-semibold border border-border text-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 border border-border text-foreground/90">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      if (line.startsWith("### ")) {
        elements.push(<h3 key={k++} className="font-semibold text-base mt-4 mb-1 text-foreground">{line.slice(4)}</h3>);
      } else if (line.startsWith("## ")) {
        elements.push(<h2 key={k++} className="font-bold text-lg mt-5 mb-2 text-foreground">{line.slice(3)}</h2>);
      } else if (line.startsWith("# ")) {
        elements.push(<h1 key={k++} className="font-bold text-xl mt-5 mb-2 text-foreground">{line.slice(2)}</h1>);
      } else if (line.match(/^[\-\*] /)) {
        elements.push(
          <li key={k++} className="ml-4 text-foreground/90" style={{ listStyleType: "disc" }}>
            {renderInline(line.slice(2))}
          </li>
        );
      } else if (line.match(/^\d+\. /)) {
        elements.push(
          <li key={k++} className="ml-4 text-foreground/90" style={{ listStyleType: "decimal" }}>
            {renderInline(line.replace(/^\d+\. /, ""))}
          </li>
        );
      } else if (line.trim() === "---" || line.trim() === "***") {
        elements.push(<hr key={k++} className="my-3 border-border" />);
      } else if (line.trim() === "") {
        elements.push(<div key={k++} className="h-2" />);
      } else {
        elements.push(
          <p key={k++} className="text-foreground/90 leading-relaxed">
            {renderInline(line)}
          </p>
        );
      }
      i++;
    }
    return elements;
  };

  const renderInline = (text: string): JSX.Element => {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return (
      <>
        {parts.map((part, i) => {
          if (part.startsWith("**") && part.endsWith("**"))
            return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
          if (part.startsWith("*") && part.endsWith("*"))
            return <em key={i}>{part.slice(1, -1)}</em>;
          if (part.startsWith("`") && part.endsWith("`"))
            return <code key={i} className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">{part.slice(1, -1)}</code>;
          return <span key={i}>{part}</span>;
        })}
      </>
    );
  };

  return <div className="space-y-0.5">{renderMarkdown(text)}</div>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={handleCopy}
      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
      title="Copy response"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function isCadFile(att: { name: string; mimeType: string }) {
  const ext = att.name.split(".").pop()?.toLowerCase();
  return ext === "dxf" || ext === "obj";
}

function AttachmentChip({ att, onRemove }: { att: Attachment; onRemove?: () => void }) {
  const isImage = att.mimeType.startsWith("image/");
  const isCad = isCadFile(att);
  return (
    <div className="flex items-center gap-2 bg-muted border border-border rounded-xl px-2 py-1.5 max-w-[180px]">
      {isImage && att.previewUrl ? (
        <img src={att.previewUrl} alt={att.name} className="w-8 h-8 object-cover rounded-lg shrink-0" />
      ) : (
        <div className={cn("w-8 h-8 flex items-center justify-center rounded-lg shrink-0", isCad ? "bg-orange-500/10" : "bg-primary/10")}>
          {isCad ? <Box className="w-4 h-4 text-orange-500" /> : <FileText className="w-4 h-4 text-primary" />}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate text-foreground">{att.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {isCad ? "CAD / SketchUp · " : ""}{(att.size / 1024).toFixed(0)} KB
        </p>
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="shrink-0 w-4 h-4 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-border transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function MessageAttachments({ attachments }: { attachments: Attachment[] }) {
  const images = attachments.filter((a) => a.mimeType.startsWith("image/"));
  const docs = attachments.filter((a) => !a.mimeType.startsWith("image/"));
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {images.map((att, i) => (
        <img
          key={i}
          src={att.previewUrl || `data:${att.mimeType};base64,${att.data}`}
          alt={att.name}
          className="max-w-[240px] max-h-[180px] object-cover rounded-xl border border-white/20"
        />
      ))}
      {docs.map((att, i) => {
        const isCad = isCadFile(att);
        return (
          <div key={i} className={cn("flex items-center gap-2 rounded-xl px-3 py-2", isCad ? "bg-orange-500/15" : "bg-white/10")}>
            {isCad ? <Box className="w-4 h-4 text-orange-300 shrink-0" /> : <FileText className="w-4 h-4 shrink-0" />}
            <span className="text-sm">{att.name}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBriefLoading, setIsBriefLoading] = useState(false);
  const [isFloorPlanLoading, setIsFloorPlanLoading] = useState(false);
  const [isElevationLoading, setIsElevationLoading] = useState(false);
  const [isFloorPlanDXFLoading, setIsFloorPlanDXFLoading] = useState(false);
  const [isElevationDXFLoading, setIsElevationDXFLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "guide">("chat");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      const newAttachments: Attachment[] = [];
      for (const file of files) {
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds the ${MAX_FILE_MB}MB limit.`,
            variant: "destructive",
          });
          continue;
        }
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // Strip the data URL prefix to get raw base64
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const previewUrl = file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined;

        newAttachments.push({
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          data: base64,
          previewUrl,
          size: file.size,
        });
      }

      setAttachments((prev) => [...prev, ...newAttachments]);
      // Reset so same file can be re-selected
      e.target.value = "";
    },
    [toast]
  );

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => {
      const updated = [...prev];
      if (updated[index].previewUrl) URL.revokeObjectURL(updated[index].previewUrl!);
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if ((!text.trim() && attachments.length === 0) || isLoading) return;

      const userMessage: Message = {
        role: "user",
        content: text.trim(),
        attachments: attachments.length > 0 ? attachments : undefined,
      };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput("");
      setAttachments([]);
      setIsLoading(true);

      try {
        const payload = {
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
            attachments: m.attachments?.map((a) => ({
              name: a.name,
              mimeType: a.mimeType,
              data: a.data,
            })),
          })),
        };
        const res = await apiRequest("POST", "/api/ai-assistant/chat", payload);
        const data = await res.json() as { reply: string };
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply ?? "" }]);
      } catch {
        toast({
          title: "Error",
          description: "Could not reach the design assistant. Please try again.",
          variant: "destructive",
        });
        setMessages(messages);
      } finally {
        setIsLoading(false);
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    },
    [messages, attachments, isLoading, toast]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setInput("");
    setAttachments([]);
    textareaRef.current?.focus();
  };

  const generateBrief = useCallback(async () => {
    const conversationMessages = messages.filter((m) => m.type !== "render-brief");
    if (conversationMessages.length === 0 || isBriefLoading) return;
    setIsBriefLoading(true);
    try {
      const payload = {
        messages: conversationMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      };
      const res = await apiRequest("POST", "/api/ai-assistant/render-brief", payload);
      const brief = await res.json() as { styleId: string; description: string; customPrompt: string };
      setMessages((prev) => [
        ...prev.filter((m) => m.type !== "render-brief"),
        {
          role: "assistant",
          content: "",
          type: "render-brief",
          briefData: brief,
        },
      ]);
    } catch {
      toast({
        title: "Error",
        description: "Could not generate the render brief. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBriefLoading(false);
    }
  }, [messages, isBriefLoading, toast]);

  const sendBriefToRenders = useCallback((brief: RenderBrief) => {
    sessionStorage.setItem("designBrief", JSON.stringify(brief));
    setLocation("/ai-renders");
  }, [setLocation]);

  const generateFloorPlan = useCallback(async () => {
    const conversationMessages = messages.filter((m) => !["floor-plan"].includes(m.type ?? ""));
    if (conversationMessages.length === 0 || isFloorPlanLoading) return;
    setIsFloorPlanLoading(true);
    try {
      const payload = {
        messages: conversationMessages.map((m) => ({
          role: m.role,
          content: m.content,
          type: m.type,
        })),
      };
      const res = await apiRequest("POST", "/api/ai-assistant/floor-plan", payload);
      const data = await res.json() as { svg: string };
      setMessages((prev) => [
        ...prev.filter((m) => m.type !== "floor-plan"),
        {
          role: "assistant",
          content: "",
          type: "floor-plan",
          svgContent: data.svg,
        },
      ]);
    } catch {
      toast({
        title: "Error",
        description: "Could not generate the floor plan. Try describing the space in more detail first.",
        variant: "destructive",
      });
    } finally {
      setIsFloorPlanLoading(false);
    }
  }, [messages, isFloorPlanLoading, toast]);

  const downloadSVG = useCallback((svg: string, filename = "drawing.svg") => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const downloadDXF = useCallback(async (endpoint: "floor-plan-dxf" | "elevation-dxf") => {
    const setLoading = endpoint === "floor-plan-dxf" ? setIsFloorPlanDXFLoading : setIsElevationDXFLoading;
    setLoading(true);
    try {
      const payload = {
        messages: messages
          .filter((m) => !["floor-plan", "elevation"].includes(m.type ?? ""))
          .map((m) => ({ role: m.role, content: m.content, type: m.type })),
      };
      const res = await apiRequest("POST", `/api/ai-assistant/${endpoint}`, payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Download failed");
      }
      const blob = await res.blob();
      const dispHeader = res.headers.get("Content-Disposition") ?? "";
      const nameMatch = dispHeader.match(/filename="?([^"]+)"?/);
      const filename = nameMatch?.[1] ?? (endpoint === "floor-plan-dxf" ? "FloorPlan.dxf" : "Elevation.dxf");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "DXF Downloaded", description: "Open in SketchUp: File → Import → DXF" });
    } catch (err) {
      toast({ title: "DXF generation failed", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [messages, toast]);

  const generateElevation = useCallback(async () => {
    const conversationMessages = messages.filter((m) => !["elevation"].includes(m.type ?? ""));
    if (conversationMessages.length === 0 || isElevationLoading) return;
    setIsElevationLoading(true);
    try {
      const payload = {
        messages: conversationMessages.map((m) => ({
          role: m.role,
          content: m.content,
          type: m.type,
        })),
      };
      const res = await apiRequest("POST", "/api/ai-assistant/elevation", payload);
      const data = await res.json() as { svg: string };
      setMessages((prev) => [
        ...prev.filter((m) => m.type !== "elevation"),
        {
          role: "assistant",
          content: "",
          type: "elevation",
          svgContent: data.svg,
        },
      ]);
    } catch {
      toast({
        title: "Error",
        description: "Could not generate the elevation. Try describing the wall in more detail.",
        variant: "destructive",
      });
    } finally {
      setIsElevationLoading(false);
    }
  }, [messages, isElevationLoading, toast]);

  const canSend = (input.trim().length > 0 || attachments.length > 0) && !isLoading;
  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10">
            <BrainCircuit className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Design Intelligence</h1>
            <p className="text-xs text-muted-foreground">Your AI assistant · ask anything · attach images, PDFs, or SketchUp files (.dxf, .obj)</p>
          </div>
        </div>
        {!isEmpty && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={generateFloorPlan}
              disabled={isFloorPlanLoading || isElevationLoading || isLoading || isBriefLoading}
              className="gap-1.5"
            >
              {isFloorPlanLoading ? (
                <>
                  <PenLine className="w-3.5 h-3.5 animate-pulse" />
                  Drawing…
                </>
              ) : (
                <>
                  <PenLine className="w-3.5 h-3.5" />
                  Floor Plan
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={generateElevation}
              disabled={isElevationLoading || isFloorPlanLoading || isLoading || isBriefLoading}
              className="gap-1.5"
            >
              {isElevationLoading ? (
                <>
                  <PenLine className="w-3.5 h-3.5 animate-pulse" />
                  Drawing…
                </>
              ) : (
                <>
                  <PenLine className="w-3.5 h-3.5 rotate-90" />
                  Elevation
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={generateBrief}
              disabled={isBriefLoading || isLoading || isFloorPlanLoading || isElevationLoading}
              className="gap-1.5"
            >
              {isBriefLoading ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  Building…
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5" />
                  Render Brief
                </>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={clearConversation} className="gap-1.5 text-muted-foreground">
              <RotateCcw className="w-3.5 h-3.5" />
              New
            </Button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="shrink-0 border-b px-6 flex gap-1">
        <button
          onClick={() => setActiveTab("chat")}
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium px-1 py-3 border-b-2 transition-colors",
            activeTab === "chat"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Chat
        </button>
        <button
          onClick={() => setActiveTab("guide")}
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium px-1 py-3 border-b-2 transition-colors ml-4",
            activeTab === "guide"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <BookOpen className="w-3.5 h-3.5" />
          How to Use
        </button>
      </div>

      {/* Guide tab */}
      {activeTab === "guide" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

            {/* Intro */}
            <div className="flex items-start gap-4 p-5 rounded-2xl bg-primary/5 border border-primary/15">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 shrink-0">
                <BrainCircuit className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">What is Design Intelligence?</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  An AI design consultant built into PixelCraft. Describe any space or design challenge and it
                  responds with expert-level guidance. From that same conversation you can generate scaled floor
                  plans, wall elevations, and CAD files ready to open in SketchUp — all without leaving the app.
                </p>
              </div>
            </div>

            {/* Feature 1 — Chat */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/10">
                  <MessageSquare className="w-4 h-4 text-blue-500" />
                </div>
                <h2 className="font-bold text-base text-foreground">Asking design questions</h2>
              </div>
              <div className="space-y-3 pl-9">
                {[
                  { n: 1, text: "Type any interior design question into the chat bar at the bottom and press Enter." },
                  { n: 2, text: "The AI responds with professional-level guidance — dimensions, layouts, materials, finishes, colour palettes, or specifications." },
                  { n: 3, text: "Keep the conversation going. Every follow-up builds on the context already discussed — no need to repeat yourself." },
                  { n: 4, text: "Attach files using the paperclip icon: photos of the existing space, rough sketches, product data sheets, PDF floor plans, or exported DXF/OBJ files from SketchUp. The AI reads and incorporates them." },
                ].map(({ n, text }) => (
                  <div key={n} className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 text-xs font-bold shrink-0 mt-0.5">{n}</span>
                    <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
                  </div>
                ))}
                <div className="flex items-start gap-2 mt-2 p-3 rounded-xl bg-muted/50 border border-border">
                  <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">Use the suggested prompts on the Chat tab to see example responses and get started quickly.</p>
                </div>
              </div>
            </section>

            <div className="border-t border-border" />

            {/* Feature 2 — Floor Plan */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10">
                  <Map className="w-4 h-4 text-emerald-600" />
                </div>
                <h2 className="font-bold text-base text-foreground">Generating a Floor Plan</h2>
                <Badge variant="secondary" className="text-xs">1:50 scale</Badge>
              </div>
              <div className="space-y-3 pl-9">
                {[
                  { n: 1, text: "Describe the space in chat first — room names, dimensions (e.g. 4m × 5m), door and window positions, furniture, and any specific layout requirements." },
                  { n: 2, text: "Click the Floor Plan button in the header (it appears once the conversation has started)." },
                  { n: 3, text: "A scaled 1:50 floor plan appears in the chat: walls, doors with swing arcs, windows, furniture outlines, room labels, and dimension lines." },
                  { n: 4, text: "If anything is incorrect, type a correction in chat and click Floor Plan again to regenerate with the updated context." },
                  { n: 5, text: "Two download buttons appear below the drawing: SVG (visual image for presentations) and DXF for SketchUp (CAD file — see below)." },
                ].map(({ n, text }) => (
                  <div key={n} className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold shrink-0 mt-0.5">{n}</span>
                    <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="border-t border-border" />

            {/* Feature 3 — Elevation */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-500/10">
                  <Layers className="w-4 h-4 text-violet-600" />
                </div>
                <h2 className="font-bold text-base text-foreground">Generating an Elevation</h2>
                <Badge variant="secondary" className="text-xs">1:50 scale</Badge>
              </div>
              <div className="space-y-3 pl-9">
                {[
                  { n: 1, text: "In the same conversation, describe the specific wall face you want drawn — what is on it, joinery, window sill and head heights, materials and finishes." },
                  { n: 2, text: "Click the Elevation button in the header." },
                  { n: 3, text: "A scaled elevation appears: floor line, ceiling line, doors with frames and panels, windows with glazing and sills, joinery outlines, material hatching, and full dimension annotations." },
                  { n: 4, text: "Download as SVG (visual) or DXF for SketchUp (CAD) using the buttons below the drawing." },
                ].map(({ n, text }) => (
                  <div key={n} className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-500/10 text-violet-600 text-xs font-bold shrink-0 mt-0.5">{n}</span>
                    <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="border-t border-border" />

            {/* Feature 4 — DXF / SketchUp */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-orange-500/10">
                  <FolderDown className="w-4 h-4 text-orange-500" />
                </div>
                <h2 className="font-bold text-base text-foreground">Exporting to SketchUp via DXF</h2>
              </div>
              <div className="space-y-3 pl-9">
                {[
                  { n: 1, text: "After generating a floor plan or elevation, click DXF for SketchUp below the drawing. It takes 15–30 seconds to compute real-world millimetre coordinates." },
                  { n: 2, text: "The file downloads automatically, named after the space." },
                  { n: 3, text: "In SketchUp: File → Import → AutoCAD Files (.dxf) → select the file → set units to Millimetres → click Import." },
                  { n: 4, text: "The geometry lands at real-world scale with walls, doors, windows, and furniture on separate named layers. Push/Pull the walls to ceiling height immediately." },
                ].map(({ n, text }) => (
                  <div key={n} className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold shrink-0 mt-0.5">{n}</span>
                    <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
                  </div>
                ))}

                {/* Layer table */}
                <div className="mt-3 rounded-xl border border-border overflow-hidden">
                  <div className="bg-muted/60 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Layers available in SketchUp after import</div>
                  <div className="divide-y divide-border">
                    {[
                      { layer: "Walls", desc: "External wall outlines" },
                      { layer: "InternalWalls", desc: "Partition walls" },
                      { layer: "Doors", desc: "Door leaf lines and swing arcs" },
                      { layer: "Windows", desc: "Frames and glazing" },
                      { layer: "Furniture", desc: "Outlines of fixed and loose furniture" },
                      { layer: "Dimensions", desc: "Dimension lines and measurements" },
                      { layer: "Labels", desc: "Room names and area callouts" },
                      { layer: "Title", desc: "Title block" },
                    ].map(({ layer, desc }) => (
                      <div key={layer} className="flex items-center gap-4 px-4 py-2.5">
                        <span className="text-xs font-mono text-foreground w-36 shrink-0">{layer}</span>
                        <span className="text-xs text-muted-foreground">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <div className="border-t border-border" />

            {/* Feature 5 — Import from SketchUp */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-orange-500/10">
                  <Box className="w-4 h-4 text-orange-500" />
                </div>
                <h2 className="font-bold text-base text-foreground">Importing files from SketchUp</h2>
                <Badge variant="secondary" className="text-xs">DXF · OBJ</Badge>
              </div>
              <div className="space-y-3 pl-9">
                {[
                  { n: 1, text: "In SketchUp, export your model: File → Export → 2D Graphic (for floor plans/elevations as DXF) or File → Export → 3D Model (for OBJ). Save the exported file to your computer." },
                  { n: 2, text: "In Design Intelligence, click the paperclip icon in the chat bar and select the exported .dxf or .obj file." },
                  { n: 3, text: "The file chip appears in orange to indicate it is a CAD file. Type your question — for example: \"Review this floor plan layout and suggest improvements\" — and send." },
                  { n: 4, text: "The AI reads the full geometry — room names, wall positions and lengths, door and window openings, furniture outlines, layer names, and overall dimensions — and responds with design analysis and recommendations." },
                  { n: 5, text: "You can then continue the conversation: ask about specific rooms, request layout alternatives, or use the Floor Plan or Elevation buttons to generate new drawings based on the imported geometry." },
                ].map(({ n, text }) => (
                  <div key={n} className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold shrink-0 mt-0.5">{n}</span>
                    <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
                  </div>
                ))}
                <div className="flex items-start gap-2 mt-2 p-3 rounded-xl bg-muted/50 border border-border">
                  <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">The DXF files that Design Intelligence exports are also the same format SketchUp can re-import — so you can generate a floor plan here, refine it in SketchUp, export it back as DXF, and return it here for further review.</p>
                </div>
              </div>
            </section>

            <div className="border-t border-border" />

            {/* Feature 6 — Render Brief */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-pink-500/10">
                  <Wand2 className="w-4 h-4 text-pink-500" />
                </div>
                <h2 className="font-bold text-base text-foreground">Creating a Render Brief</h2>
              </div>
              <div className="space-y-3 pl-9">
                {[
                  { n: 1, text: "After discussing the design concept and style in chat, click Render Brief in the header." },
                  { n: 2, text: "A brief card appears with a detected style preset (Modern, Luxury, Scandinavian, etc.), a room description, and a suggested AI image prompt." },
                  { n: 3, text: "Click Open in AI Renders — the brief transfers to the AI Renders page with everything pre-filled, ready to generate a photorealistic render." },
                ].map(({ n, text }) => (
                  <div key={n} className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-pink-500/10 text-pink-600 text-xs font-bold shrink-0 mt-0.5">{n}</span>
                    <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="border-t border-border" />

            {/* Tips */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                </div>
                <h2 className="font-bold text-base text-foreground">Tips for best results</h2>
              </div>
              <div className="space-y-2 pl-9">
                {[
                  "Build the conversation before generating drawings — the more context the AI has, the more accurate the output.",
                  "You can generate multiple drawings in one session — a floor plan and several elevations from the same conversation.",
                  "Regenerate freely. Each click re-reads the full conversation, so corrections you type will always be reflected.",
                  "Attach a SketchUp screenshot or existing floor plan PDF if you want design feedback on work already in progress.",
                  "Treat the DXF as a starting geometry in SketchUp, not a finished drawing — it is designed to be refined.",
                ].map((tip, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-2" />
                    <p className="text-sm text-muted-foreground leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="pb-6" />
          </div>
        </div>
      )}

      {/* Chat tab */}
      {activeTab === "chat" && (
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center min-h-full px-6 py-10 gap-8">
            <div className="text-center max-w-md">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mx-auto mb-4">
                <BrainCircuit className="w-9 h-9 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Design Intelligence</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Your AI assistant — ask anything across any topic. Specialised in interior design, space planning, materials, lighting, colour schemes, furniture, procurement, and project specifications. Upload a floor plan, product sheet, sketch, or any file to get started.
              </p>
            </div>

            <div className="w-full max-w-2xl">
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Try asking...</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="flex items-start gap-2 text-left px-4 py-3 rounded-xl border border-border bg-card hover-elevate transition-all text-sm text-foreground/80 hover:text-foreground"
                  >
                    <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">
            {messages.map((msg, i) => {
              // Elevation card
              if (msg.type === "elevation" && msg.svgContent) {
                return (
                  <div key={i} className="flex gap-3 justify-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0 mt-0.5">
                      <PenLine className="w-4 h-4 text-primary rotate-90" />
                    </div>
                    <div className="max-w-[92%] w-full rounded-2xl border border-border bg-card overflow-hidden">
                      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                        <PenLine className="w-4 h-4 text-primary rotate-90" />
                        <span className="font-semibold text-sm text-foreground">Interior Elevation</span>
                        <Badge variant="secondary" className="ml-auto text-xs">SVG · 1:50</Badge>
                      </div>
                      <div className="p-4 bg-white overflow-x-auto">
                        <div
                          className="min-w-[700px]"
                          dangerouslySetInnerHTML={{ __html: msg.svgContent }}
                          style={{ lineHeight: 0 }}
                        />
                      </div>
                      <div className="px-4 py-3 border-t border-border flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-muted-foreground flex-1">For reference only — not a construction drawing.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 shrink-0"
                          onClick={() => downloadSVG(msg.svgContent!, "elevation.svg")}
                        >
                          <Download className="w-3.5 h-3.5" />
                          SVG
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 shrink-0"
                          onClick={() => downloadDXF("elevation-dxf")}
                          disabled={isElevationDXFLoading}
                          title="Download DXF for import into SketchUp or AutoCAD"
                        >
                          {isElevationDXFLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          {isElevationDXFLoading ? "Generating…" : "DXF for SketchUp"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 shrink-0 text-muted-foreground"
                          onClick={() => generateElevation()}
                          disabled={isElevationLoading}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Regenerate
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }

              // Floor plan card
              if (msg.type === "floor-plan" && msg.svgContent) {
                return (
                  <div key={i} className="flex gap-3 justify-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0 mt-0.5">
                      <PenLine className="w-4 h-4 text-primary" />
                    </div>
                    <div className="max-w-[90%] w-full rounded-2xl border border-border bg-card overflow-hidden">
                      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                        <PenLine className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm text-foreground">Floor Plan</span>
                        <Badge variant="secondary" className="ml-auto text-xs">SVG · 1:50</Badge>
                      </div>
                      <div className="p-4 bg-white overflow-x-auto">
                        <div
                          className="min-w-[600px]"
                          dangerouslySetInnerHTML={{ __html: msg.svgContent }}
                          style={{ lineHeight: 0 }}
                        />
                      </div>
                      <div className="px-4 py-3 border-t border-border flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-muted-foreground flex-1">For reference only — not a construction drawing.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 shrink-0"
                          onClick={() => downloadSVG(msg.svgContent!)}
                        >
                          <Download className="w-3.5 h-3.5" />
                          SVG
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 shrink-0"
                          onClick={() => downloadDXF("floor-plan-dxf")}
                          disabled={isFloorPlanDXFLoading}
                          title="Download DXF for import into SketchUp or AutoCAD"
                        >
                          {isFloorPlanDXFLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          {isFloorPlanDXFLoading ? "Generating…" : "DXF for SketchUp"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 shrink-0 text-muted-foreground"
                          onClick={() => generateFloorPlan()}
                          disabled={isFloorPlanLoading}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Regenerate
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }

              // Render brief card
              if (msg.type === "render-brief" && msg.briefData) {
                const brief = msg.briefData;
                return (
                  <div key={i} className="flex gap-3 justify-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0 mt-0.5">
                      <Wand2 className="w-4 h-4 text-primary" />
                    </div>
                    <div className="max-w-[85%] rounded-2xl border border-primary/30 bg-primary/5 overflow-hidden">
                      <div className="px-4 py-3 border-b border-primary/20 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm text-foreground">Render Brief Ready</span>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {STYLE_LABELS[brief.styleId] ?? brief.styleId}
                        </Badge>
                      </div>
                      <div className="px-4 py-3 space-y-2">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Space Description</p>
                          <p className="text-sm text-foreground/90 leading-relaxed">{brief.description}</p>
                        </div>
                        {brief.customPrompt && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Specific Details</p>
                            <p className="text-sm text-foreground/90 leading-relaxed">{brief.customPrompt}</p>
                          </div>
                        )}
                      </div>
                      <div className="px-4 py-3 border-t border-primary/20 flex items-center gap-2">
                        <p className="text-xs text-muted-foreground flex-1">This brief is optimised for the AI Render generator.</p>
                        <Button
                          size="sm"
                          onClick={() => sendBriefToRenders(brief)}
                          className="gap-1.5 shrink-0"
                        >
                          Go to AI Renders
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }

              // Normal message
              return (
                <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "assistant" && (
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0 mt-0.5">
                      <BrainCircuit className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "relative group max-w-[85%] rounded-2xl px-4 py-3",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border"
                    )}
                  >
                    {msg.role === "user" ? (
                      <>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <MessageAttachments attachments={msg.attachments} />
                        )}
                        {msg.content && (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </>
                    ) : (
                      <>
                        <MarkdownRenderer text={msg.content} />
                        <div className="flex justify-end mt-2">
                          <CopyButton text={msg.content} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
                  <BrainCircuit className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-card border border-border rounded-2xl px-4 py-3.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            {/* Elevation loading indicator */}
            {isElevationLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
                  <PenLine className="w-4 h-4 text-primary rotate-90" />
                </div>
                <div className="bg-card border border-border rounded-2xl px-4 py-3.5 flex items-center gap-3">
                  <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:300ms]" />
                  <span className="text-xs text-muted-foreground">Drawing elevation…</span>
                </div>
              </div>
            )}

            {/* Floor plan loading indicator */}
            {isFloorPlanLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
                  <PenLine className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-card border border-border rounded-2xl px-4 py-3.5 flex items-center gap-3">
                  <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:300ms]" />
                  <span className="text-xs text-muted-foreground">Drafting floor plan…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
      )}

      {/* Input area — chat tab only */}
      {activeTab === "chat" && (<>
      <div className="shrink-0 border-t bg-background px-4 py-4">
        <div className="max-w-3xl mx-auto">
          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 px-1">
              {attachments.map((att, i) => (
                <AttachmentChip key={i} att={att} onRemove={() => removeAttachment(i)} />
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end bg-card border border-border rounded-2xl px-3 py-3 focus-within:border-primary/50 transition-colors">
            {/* Attach button */}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="shrink-0 h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
              title="Attach image or PDF"
            >
              <Paperclip className="w-4 h-4" />
            </Button>

            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about interior design — materials, layouts, lighting, colours, dimensions, specifications…"
              className="flex-1 resize-none border-0 bg-transparent p-0 min-h-[24px] max-h-[160px] text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
              rows={1}
              style={{ fieldSizing: "content" } as React.CSSProperties}
              disabled={isLoading}
            />

            <Button
              size="icon"
              onClick={() => sendMessage(input)}
              disabled={!canSend}
              className="shrink-0 h-8 w-8 rounded-xl"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground/60 text-center mt-2">
            Enter to send · Shift+Enter for new line · Attach images, PDFs, DXF, OBJ, or SketchUp files (.skp) up to {MAX_FILE_MB}MB
          </p>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      </>)}
    </div>
  );
}
