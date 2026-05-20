import { useState, useEffect, useRef, useCallback } from "react";
import type { Socket } from "socket.io-client";
import { Send, MessageSquare, Mic, MicOff, Square, Smile, X, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/use-socket";

type Props = {
  requestId: string;
  myEmail: string;
  myName: string;
  socket: Socket | null;
};

// ── Emoji categories (matching mobile) ───────────────────────────────────────

const EMOJI_CATEGORIES = [
  {
    key: "smileys",
    label: "😀",
    emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","😎","🤓","🧐","😕","😟","🙁","☹️","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖"],
  },
  {
    key: "people",
    label: "👋",
    emojis: ["👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💪","🦾","🦵","🦶","👀","👄","👶","🧒","👦","👧","🧑","👱","👨","🧔","👩","🧓","👴","👵","👮","🕵️","💂","🥷","👷","🤴","👸","🧙","🧚","🧛","🎅","🤶","🦸","🦹","💆","💇","🚶","🏃","💃","🕺","👯","🧘","🛀"],
  },
  {
    key: "nature",
    label: "🐶",
    emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🐢","🐍","🦎","🐙","🦑","🦐","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍","🐘","🦛","🦏","🐪","🐫","🦒","🐕","🐈","🐓","🦃","🦚","🦜","🦢","🐇","🦝","🦨","🦦","🦥","🐁","🐀","🐿️","🦔","🌵","🎄","🌲","🌳","🌴","🌱","🌿","☘️","🍀","🍃","🍂","🍁","🍄","🐚","🌾","💐","🌷","🌹","🥀","🌺","🌸","🌼","🌻","⭐","🌟","✨","⚡","🔥","💥","☄️","☀️","🌧️","❄️","☃️","🌊"],
  },
  {
    key: "food",
    label: "🍎",
    emojis: ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🍍","🥝","🥥","🥑","🍆","🥔","🥕","🌽","🌶️","🥒","🥬","🥦","🧄","🧅","🍄","🥜","🍞","🥐","🥖","🥨","🥞","🧇","🧀","🍖","🍗","🥩","🥓","🍔","🍟","🍕","🌭","🥪","🌮","🌯","🥙","🥚","🍳","🥘","🍲","🥗","🍿","🧈","🍱","🍣","🍤","🍙","🍚","🍛","🍜","🍝","🍦","🍧","🍨","🍩","🍪","🎂","🍰","🧁","🍫","🍬","🍭","🍼","🥛","☕","🍵","🍶","🍾","🍷","🍸","🍹","🍺","🍻","🥂","🥃","🥤","🧋","🧃"],
  },
  {
    key: "activity",
    label: "⚽",
    emojis: ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🏑","🥍","🏏","🪃","🥅","⛳","🎣","🤿","🥊","🥋","🎽","🛹","🛷","⛸️","🥌","🎿","🏆","🏅","🥇","🥈","🥉","🎖️","🎭","🎨","🎬","🎤","🎧","🎼","🎹","🥁","🎷","🎺","🎸","🎻","🎲","♟️","🎯","🎳","🎮","🎰","🧩","🚗","🚕","🚙","🏎️","🚓","🚑","🚒","🚜","🚲","🛵","🏍️","✈️","🛫","🛬","🚀","🛸","🚁","⛵","🚢","⚓","🗺️","🗽","🗼","🏰","🏯","🏟️","🎡","⛲","🏖️","🏝️","🌋","⛰️","🏔️","🏕️","⛺","🏠","🏡","🏢","🏦","🏥","⛪","🕌","🛕","🕋"],
  },
  {
    key: "symbols",
    label: "❤️",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","☯️","☦️","⚛️","🆔","☢️","☣️","📴","📳","🆚","💯","💢","♨️","🚫","❌","⭕","🛑","⛔","📛","❗","❕","❓","❔","‼️","⁉️","⚠️","🚸","♻️","✅","❇️","✳️","❎","🌐","💠","Ⓜ️","🌀","💤","🏧","♿","🅿️","🛗","🧭","🕐","🕑","🕒","🕓","🕔","🕕","🕖","🕗","🕘","🕙","🕚","🕛"],
  },
];

// ── Role display ─────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, { label: string; cls: string }> = {
  volunteer: { label: "Volunteer", cls: "text-emerald-500" },
  staff: { label: "Staff", cls: "text-sky-500" },
  admin: { label: "Admin", cls: "text-violet-500" },
  superadmin: { label: "Superadmin", cls: "text-orange-500" },
  civilian: { label: "Civilian", cls: "text-muted-foreground" },
  VOLUNTEER: { label: "Volunteer", cls: "text-emerald-500" },
  STAFF: { label: "Staff", cls: "text-sky-500" },
  ADMIN: { label: "Admin", cls: "text-violet-500" },
  SUPERADMIN: { label: "Superadmin", cls: "text-orange-500" },
  VICTIM: { label: "Civilian", cls: "text-muted-foreground" },
};

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function AudioPlayer({ audioBase64, mimeType, durationSec }: { audioBase64: string; mimeType: string; durationSec?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSec ?? 0);

  const src = `data:${mimeType};base64,${audioBase64}`;

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) { el.pause(); } else { el.play(); }
  };

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => { setIsPlaying(false); setProgress(0); setCurrentTime(0); };
    const onTimeUpdate = () => {
      setCurrentTime(el.currentTime);
      if (el.duration && isFinite(el.duration)) {
        setProgress((el.currentTime / el.duration) * 100);
        setDuration(el.duration);
      }
    };
    const onLoaded = () => {
      if (el.duration && isFinite(el.duration)) setDuration(el.duration);
    };
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("loadedmetadata", onLoaded);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("loadedmetadata", onLoaded);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 min-w-[160px]">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={togglePlay}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
      >
        {isPlaying ? (
          <Square className="h-3 w-3 fill-current" />
        ) : (
          <Play className="h-3 w-3 fill-current" />
        )}
      </button>
      <div className="flex flex-1 flex-col gap-1">
        <div
          className="relative h-1.5 w-full cursor-pointer rounded-full bg-white/20"
          onClick={(e) => {
            const el = audioRef.current;
            if (!el || !el.duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            el.currentTime = ratio * el.duration;
          }}
        >
          <div className="absolute inset-y-0 left-0 rounded-full bg-white/70 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-[9px] opacity-60">{formatDuration(currentTime)} / {formatDuration(duration)}</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TaskChatPanel({ requestId, myEmail, myName, socket }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const joinedRef = useRef(false);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartRef = useRef<number>(0);

  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState("smileys");

  const retryCountRef = useRef(0);
  const MAX_RETRIES = 8;

  const attemptJoin = useCallback(() => {
    if (!socket || joinedRef.current) return;
    socket.emit("join_chat", { requestId });
  }, [socket, requestId]);

  useEffect(() => {
    if (!socket) return;
    joinedRef.current = false;
    retryCountRef.current = 0;
    setJoined(false);
    setError(null);

    const scheduleRetry = (delay = 800) => {
      if (retryRef.current) clearTimeout(retryRef.current);
      if (retryCountRef.current >= MAX_RETRIES) {
        setError("Could not connect to chat. You may not have access to this conversation, or the connection timed out.");
        return;
      }
      retryRef.current = setTimeout(() => {
        if (!joinedRef.current) {
          retryCountRef.current += 1;
          attemptJoin();
          scheduleRetry(2000);
        }
      }, delay);
    };

    // If socket is already authenticated when this panel opens, join immediately.
    // Also listen for the authenticated event in case auth completes after mount.
    const onAuthenticated = () => {
      retryCountRef.current = 0;
      if (!joinedRef.current) attemptJoin();
    };

    const onHistory = (data: { requestId: string; messages: ChatMessage[] }) => {
      if (data.requestId !== requestId) return;
      setMessages(data.messages);
      setJoined(true);
      joinedRef.current = true;
      if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
    };

    const onChatError = (data: { requestId: string; reason: string }) => {
      if (data.requestId !== requestId) return;
      setError(data.reason ?? "Unable to join chat");
      if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
    };

    const onMessage = (msg: ChatMessage) => {
      if (msg.requestId === requestId) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    socket.on("authenticated", onAuthenticated);
    socket.on("chat_history", onHistory);
    socket.on("chat_error", onChatError);
    socket.on("chat_message", onMessage);

    // Attempt immediately — works when socket is already authenticated
    attemptJoin();
    scheduleRetry(800);

    return () => {
      socket.off("authenticated", onAuthenticated);
      socket.off("chat_history", onHistory);
      socket.off("chat_error", onChatError);
      socket.off("chat_message", onMessage);
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [socket, requestId, attemptJoin]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(() => {
    if (!socket || !text.trim()) return;
    socket.emit("send_chat_message", { requestId, text: text.trim() });
    setText("");
  }, [socket, requestId, text]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const insertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
  };

  const startRecording = async () => {
    setMicError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError("Microphone not supported in this browser");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg;codecs=opus";

      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const durationSec = Math.round((Date.now() - recordStartRef.current) / 1000);
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(",")[1];
          if (socket && base64) {
            socket.emit("send_voice_note", { requestId, audioBase64: base64, mimeType: blob.type, durationSec });
          }
        };
        reader.readAsDataURL(blob);
        if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
        setRecordSec(0);
        setIsRecording(false);
      };

      recorder.start(100);
      recordStartRef.current = Date.now();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      recordTimerRef.current = setInterval(() => {
        setRecordSec(Math.round((Date.now() - recordStartRef.current) / 1000));
      }, 1000);
    } catch {
      setMicError("Microphone permission denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
    }
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    setIsRecording(false);
    setRecordSec(0);
    setMicError(null);
  };

  const activeCat = EMOJI_CATEGORIES.find((c) => c.key === emojiCategory);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border/50 bg-background" style={{ height: "320px" }}>
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/40 bg-muted/30 px-3 py-2">
        <MessageSquare className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold">Live Chat</span>
        <span className={cn(
          "ml-auto h-1.5 w-1.5 rounded-full",
          error ? "bg-destructive" : joined ? "bg-emerald-500" : "bg-amber-400 animate-pulse"
        )} />
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
        {error ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-xs text-destructive">{error}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-xs text-muted-foreground">
              {joined ? "No messages yet. Start the conversation!" : "Connecting to chat…"}
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isMe = msg.senderEmail === myEmail;
              const isAudio = msg.type === "audio";
              const roleMeta = ROLE_LABELS[msg.senderRole] ?? null;
              return (
                <div key={msg.id} className={cn("flex flex-col gap-0.5", isMe ? "items-end" : "items-start")}>
                  {/* Sender name + role badge */}
                  <div className={cn("flex items-baseline gap-1.5", isMe ? "flex-row-reverse" : "flex-row")}>
                    <span className="text-[10px] font-semibold text-foreground/80">
                      {isMe ? "You" : msg.senderName}
                    </span>
                    {roleMeta && (
                      <span className={cn("text-[9px] font-medium", roleMeta.cls)}>
                        {roleMeta.label}
                      </span>
                    )}
                  </div>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-xs",
                    isMe
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted text-foreground"
                  )}>
                    {isAudio && msg.audioBase64 ? (
                      <AudioPlayer
                        audioBase64={msg.audioBase64}
                        mimeType={msg.mimeType ?? "audio/webm"}
                        durationSec={msg.durationSec}
                      />
                    ) : (
                      <p className="break-words leading-snug">{msg.text}</p>
                    )}
                    <p className={cn("mt-1 text-[9px] opacity-55", isMe ? "text-right" : "")}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Emoji tray */}
      {showEmoji && (
        <div className="shrink-0 border-t border-border/40 bg-background">
          {/* Category tabs */}
          <div className="flex items-center gap-0 border-b border-border/30 px-2 py-1">
            {EMOJI_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setEmojiCategory(cat.key); }}
                className={cn(
                  "flex h-7 w-8 items-center justify-center rounded-lg text-sm transition-colors",
                  emojiCategory === cat.key ? "bg-primary/15" : "hover:bg-muted/60"
                )}
              >
                {cat.label}
              </button>
            ))}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setShowEmoji(false); }}
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Emoji grid */}
          <div className="grid h-24 grid-cols-[repeat(auto-fill,minmax(28px,1fr))] content-start gap-0.5 overflow-y-auto p-2">
            {activeCat?.emojis.map((e) => (
              <button
                key={e}
                type="button"
                onMouseDown={(ev) => { ev.preventDefault(); insertEmoji(e); }}
                className="flex h-7 w-7 items-center justify-center rounded text-base hover:bg-muted/60"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {micError && (
        <div className="shrink-0 border-t border-destructive/30 bg-destructive/10 px-3 py-1.5 text-[10px] text-destructive">
          {micError}
        </div>
      )}

      {/* Composer */}
      {isRecording ? (
        <div className="flex shrink-0 items-center gap-2 border-t border-border/40 bg-background p-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
            <span className="text-xs font-medium text-destructive">Recording…</span>
            <span className="ml-auto tabular-nums text-xs text-destructive">{formatDuration(recordSec)}</span>
          </div>
          <button
            type="button"
            title="Cancel"
            onClick={cancelRecording}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/50 text-muted-foreground hover:bg-muted/60"
          >
            <MicOff className="h-3.5 w-3.5" />
          </button>
          <Button
            type="button"
            size="sm"
            className="h-8 w-8 shrink-0 bg-destructive p-0 hover:bg-destructive/80"
            onClick={stopRecording}
            title="Stop & send"
          >
            <Square className="h-3 w-3 fill-current" />
          </Button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1.5 border-t border-border/40 bg-background p-2">
          <button
            type="button"
            title="Emoji picker"
            onMouseDown={(e) => { e.preventDefault(); setShowEmoji((v) => !v); }}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
              showEmoji
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border/50 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            )}
          >
            <Smile className="h-3.5 w-3.5" />
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowEmoji(false)}
            placeholder={joined ? "Type a message…" : "Connecting…"}
            className="h-8 flex-1 rounded-lg border border-border/50 bg-muted/40 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            maxLength={1000}
            disabled={!socket || !joined}
          />
          <button
            type="button"
            title="Record voice note"
            onClick={startRecording}
            disabled={!socket || !joined}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
              !socket || !joined
                ? "cursor-not-allowed border-border/30 text-muted-foreground/40"
                : "border-border/50 text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
            )}
          >
            <Mic className="h-3.5 w-3.5" />
          </button>
          <Button
            type="button"
            size="sm"
            className="h-8 w-8 shrink-0 p-0"
            onClick={sendMessage}
            disabled={!text.trim() || !socket || !joined}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
