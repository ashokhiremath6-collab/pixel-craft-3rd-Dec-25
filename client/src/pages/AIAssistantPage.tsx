import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Send, RotateCcw, Copy, Check, BrainCircuit, ChevronRight, Paperclip, X, FileText, ImageIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface Attachment {
  name: string;
  mimeType: string;
  data: string;       // base64
  previewUrl?: string; // for images only
  size: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
}

const SUGGESTED_PROMPTS = [
  "What depth should bookshelves be for A4 ring binders?",
  "How many wine bottles fit in a 900mm wide wine rack with 3 rows?",
  "Design a bar storage unit 1200mm wide × 900mm tall for mixed glassware and spirits",
  "Standard dimensions for a home bar counter with seating",
  "How many files can I fit on a 2400mm tall shelving unit?",
  "What shelf spacing do I need for whiskey bottles and tumblers together?",
  "Recommended cupboard depth for a walk-in wardrobe",
  "Standard kitchen worktop height and overhang dimensions",
];

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/gif,image/heic,application/pdf";
const MAX_FILE_MB = 10;

function MarkdownRenderer({ text }: { text: string }) {
  const renderMarkdown = (md: string) => {
    if (!md) return [];
    const lines = md.split("\n");
    const elements: JSX.Element[] = [];
    let i = 0;

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
          <div key={i} className="overflow-x-auto my-3">
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
        elements.push(<h3 key={i} className="font-semibold text-base mt-4 mb-1 text-foreground">{line.slice(4)}</h3>);
      } else if (line.startsWith("## ")) {
        elements.push(<h2 key={i} className="font-bold text-lg mt-5 mb-2 text-foreground">{line.slice(3)}</h2>);
      } else if (line.startsWith("# ")) {
        elements.push(<h1 key={i} className="font-bold text-xl mt-5 mb-2 text-foreground">{line.slice(2)}</h1>);
      } else if (line.match(/^[\-\*] /)) {
        elements.push(
          <li key={i} className="ml-4 text-foreground/90" style={{ listStyleType: "disc" }}>
            {renderInline(line.slice(2))}
          </li>
        );
      } else if (line.match(/^\d+\. /)) {
        elements.push(
          <li key={i} className="ml-4 text-foreground/90" style={{ listStyleType: "decimal" }}>
            {renderInline(line.replace(/^\d+\. /, ""))}
          </li>
        );
      } else if (line.trim() === "---" || line.trim() === "***") {
        elements.push(<hr key={i} className="my-3 border-border" />);
      } else if (line.trim() === "") {
        elements.push(<div key={i} className="h-2" />);
      } else {
        elements.push(
          <p key={i} className="text-foreground/90 leading-relaxed">
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

function AttachmentChip({ att, onRemove }: { att: Attachment; onRemove?: () => void }) {
  const isImage = att.mimeType.startsWith("image/");
  return (
    <div className="flex items-center gap-2 bg-muted border border-border rounded-xl px-2 py-1.5 max-w-[180px]">
      {isImage && att.previewUrl ? (
        <img src={att.previewUrl} alt={att.name} className="w-8 h-8 object-cover rounded-lg shrink-0" />
      ) : (
        <div className="w-8 h-8 flex items-center justify-center bg-primary/10 rounded-lg shrink-0">
          <FileText className="w-4 h-4 text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate text-foreground">{att.name}</p>
        <p className="text-[10px] text-muted-foreground">{(att.size / 1024).toFixed(0)} KB</p>
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
      {docs.map((att, i) => (
        <div key={i} className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
          <FileText className="w-4 h-4" />
          <span className="text-sm">{att.name}</span>
        </div>
      ))}
    </div>
  );
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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

  const canSend = (input.trim().length > 0 || attachments.length > 0) && !isLoading;
  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10">
            <BrainCircuit className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Design Intelligence</h1>
            <p className="text-xs text-muted-foreground">Your interior design consultant · attach images, floor plans, or PDFs</p>
          </div>
        </div>
        {!isEmpty && (
          <Button variant="ghost" size="sm" onClick={clearConversation} className="gap-1.5 text-muted-foreground">
            <RotateCcw className="w-3.5 h-3.5" />
            New conversation
          </Button>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center min-h-full px-6 py-10 gap-8">
            <div className="text-center max-w-md">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mx-auto mb-4">
                <BrainCircuit className="w-9 h-9 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Design Intelligence</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Your expert interior design consultant — from space planning and material selection to lighting, colour schemes, furniture layouts, and project specifications. Upload a floor plan, product sheet, or sketch, or just ask anything.
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
            {messages.map((msg, i) => (
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
            ))}

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
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
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
            Enter to send · Shift+Enter for new line · Attach images &amp; PDFs up to {MAX_FILE_MB}MB
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
    </div>
  );
}
