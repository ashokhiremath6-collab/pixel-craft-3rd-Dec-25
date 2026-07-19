import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, MessageSquare, Trash2, Paperclip, X, FileText, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Project } from "@shared/schema";

interface EnrichedMessage {
  id: string;
  projectId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  attachmentPath?: string | null;
  attachmentName?: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  designer: "Designer",
  project_manager: "Project Manager",
  client: "Client",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-primary text-primary-foreground",
  designer: "bg-blue-500 text-white",
  project_manager: "bg-amber-500 text-white",
  client: "bg-emerald-500 text-white",
};

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"]);

function isImage(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(ext);
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function markChatRead(userId: string) {
  localStorage.setItem(`chatLastReadAt_${userId}`, new Date().toISOString());
  window.dispatchEvent(new Event("chatRead"));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProjectChatPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("__none__");
  const [draft, setDraft] = useState("");
  const [fileAttachment, setFileAttachment] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const role = (user as any)?.role as string;
  const orgId = (user as any)?.orgId as string;
  const userId = (user as any)?.id as string;

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const activeProjectId = selectedProjectId === "__none__" ? "" : selectedProjectId;

  const { data: messages = [], isLoading } = useQuery<EnrichedMessage[]>({
    queryKey: ["/api/projects", activeProjectId, "messages"],
    queryFn: () => fetch(`/api/projects/${activeProjectId}/messages`).then(r => r.json()),
    enabled: !!activeProjectId,
    refetchInterval: 30_000,
  });

  const sendMutation = useMutation({
    mutationFn: async ({ content, file }: { content: string; file: File | null }) => {
      let attachmentPath: string | null = null;
      let attachmentName: string | null = null;

      if (file) {
        // Step 1: get presigned PUT URL
        const urlRes = await fetch(`/api/projects/${activeProjectId}/messages/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ fileName: file.name }),
        });
        if (!urlRes.ok) throw new Error("Failed to get upload URL");
        const { uploadUrl, objectPath } = await urlRes.json();

        // Step 2: upload directly to GCS
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });
        if (!putRes.ok) throw new Error("File upload failed");

        attachmentPath = objectPath;
        attachmentName = file.name;
      }

      // Step 3: send message as JSON
      const res = await fetch(`/api/projects/${activeProjectId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content, attachmentPath, attachmentName }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setDraft("");
      clearAttachment();
      queryClient.invalidateQueries({ queryKey: ["/api/projects", activeProjectId, "messages"] });
      setTimeout(() => textareaRef.current?.focus(), 50);
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Failed to send", description: err?.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) =>
      fetch(`/api/projects/${activeProjectId}/messages/${messageId}`, {
        method: "DELETE",
        credentials: "include",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", activeProjectId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread"] });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to delete message" });
    },
  });

  useEffect(() => {
    if (!activeProjectId || !userId) return;
    markChatRead(userId);
    fetch(`/api/projects/${activeProjectId}/messages/read`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  }, [activeProjectId, userId, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (projects.length > 0 && selectedProjectId === "__none__") {
      setSelectedProjectId((projects[0] as any).id);
    }
  }, [projects, selectedProjectId]);

  function clearAttachment() {
    setFileAttachment(null);
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Maximum size is 20 MB." });
      return;
    }
    setFileAttachment(file);
    if (isImage(file.name)) {
      setLocalPreview(URL.createObjectURL(file));
    } else {
      setLocalPreview(null);
    }
  }

  function handleSend() {
    const content = draft.trim();
    if ((!content && !fileAttachment) || sendMutation.isPending) return;
    sendMutation.mutate({ content, file: fileAttachment });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const canSend = (draft.trim().length > 0 || !!fileAttachment) && !sendMutation.isPending;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b shrink-0">
        <MessageSquare className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold leading-none">Project Chat</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Remarks and comments shared with your team and client
          </p>
        </div>
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select project…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__" disabled>Select project…</SelectItem>
            {(projects as any[]).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.projectName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {!activeProjectId ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-2">
            <MessageSquare className="h-10 w-10 opacity-30" />
            <p className="text-sm">Select a project to view its chat thread.</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-muted-foreground">Loading messages…</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-2">
            <MessageSquare className="h-10 w-10 opacity-30" />
            <p className="text-sm">No messages yet. Be the first to add a remark.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.authorId === (user as any)?.id;
            const canDelete = role === "admin";
            const hasAttachment = !!msg.attachmentPath && !!msg.attachmentName;
            const attachIsImage = hasAttachment && isImage(msg.attachmentName!);
            const attachUrl = hasAttachment
              ? `/api/projects/${msg.projectId}/messages/${msg.id}/attachment`
              : null;

            return (
              <div key={msg.id} className={`group flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
                <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                  <AvatarFallback className="text-xs bg-muted">
                    {getInitials(msg.authorName)}
                  </AvatarFallback>
                </Avatar>
                <div className={`flex flex-col gap-1 max-w-[70%] ${isMe ? "items-end" : "items-start"}`}>
                  <div className={`flex items-center gap-2 flex-wrap ${isMe ? "flex-row-reverse" : ""}`}>
                    <span className="text-sm font-medium">{isMe ? "You" : msg.authorName}</span>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] px-1.5 py-0 ${ROLE_COLORS[msg.authorRole] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {ROLE_LABELS[msg.authorRole] ?? msg.authorRole}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                    </span>
                    {canDelete && (
                      <button
                        onClick={() => deleteMutation.mutate(msg.id)}
                        disabled={deleteMutation.isPending}
                        className="text-muted-foreground/40 hover:text-destructive focus:outline-none transition-colors"
                        aria-label="Delete message"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Message bubble */}
                  <div
                    className={`rounded-md text-sm ${
                      hasAttachment && !msg.content ? "" : "px-3 py-2"
                    } ${
                      isMe
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {/* Text content */}
                    {msg.content && (
                      <p className={`whitespace-pre-wrap break-words ${hasAttachment ? "px-3 pt-2" : ""}`}>
                        {msg.content}
                      </p>
                    )}

                    {/* Attachment */}
                    {hasAttachment && attachIsImage && (
                      <a href={attachUrl!} target="_blank" rel="noopener noreferrer">
                        <img
                          src={attachUrl!}
                          alt={msg.attachmentName!}
                          className={`max-w-xs max-h-64 rounded object-cover cursor-pointer ${msg.content ? "mt-2 mx-3 mb-2" : "rounded-md"}`}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </a>
                    )}

                    {hasAttachment && !attachIsImage && (
                      <a
                        href={attachUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 px-3 py-2 rounded ${msg.content ? "mt-1 mx-0" : ""} ${
                          isMe
                            ? "text-primary-foreground/90 hover:text-primary-foreground"
                            : "text-foreground/80 hover:text-foreground"
                        }`}
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="text-sm truncate max-w-[180px]">{msg.attachmentName}</span>
                        <Download className="h-3.5 w-3.5 shrink-0 ml-auto" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {activeProjectId && (
        <div className="px-6 py-4 border-t shrink-0 space-y-2">
          {/* File preview strip */}
          {fileAttachment && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted border text-sm">
              {localPreview ? (
                <img src={localPreview} alt="preview" className="h-12 w-12 object-cover rounded" />
              ) : (
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-foreground">{fileAttachment.name}</p>
                <p className="text-[11px] text-muted-foreground">{formatBytes(fileAttachment.size)}</p>
              </div>
              <button
                onClick={clearAttachment}
                className="text-muted-foreground hover:text-foreground shrink-0"
                aria-label="Remove attachment"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex gap-2 items-end">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.dxf,.obj"
              onChange={handleFileChange}
            />

            {/* Attach button */}
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              title="Attach a file or photo"
              disabled={sendMutation.isPending}
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            <Textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a remark… (Enter to send, Shift+Enter for new line)"
              className="resize-none min-h-[40px] max-h-32"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!canSend}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
