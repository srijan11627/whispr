// Message composer: text, emoji, attachments, whisper timer, nudge, reply/edit modes.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Smile, Paperclip, Send, Timer, Zap, X, Loader2, Pencil } from "lucide-react";
import EmojiPicker from "./EmojiPicker";
import { api } from "../api";

const WHISPERS = [
  { label: "Off", value: 0 },
  { label: "10 seconds", value: 10 },
  { label: "1 minute", value: 60 },
  { label: "1 hour", value: 3600 },
];

export default function Composer({ chat, user, replyTo, setReplyTo, editing, setEditing, actions }) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showWhisper, setShowWhisper] = useState(false);
  const [whisper, setWhisper] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef(null);
  const taRef = useRef(null);
  const typingTimer = useRef(null);
  const whisperRef = useRef(null);

  // focus + prefill when entering edit mode
  useEffect(() => {
    if (editing) { setText(editing.body); setReplyTo(null); taRef.current?.focus(); }
  }, [editing]);

  useEffect(() => { setText(""); setReplyTo(null); setEditing(null); setWhisper(0); }, [chat.key]);

  // close whisper menu on outside click
  useEffect(() => {
    if (!showWhisper) return;
    const fn = (e) => { if (whisperRef.current && !whisperRef.current.contains(e.target)) setShowWhisper(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [showWhisper]);

  const autoGrow = () => {
    const ta = taRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 140) + "px"; }
  };

  const pokeTyping = (on) => actions.typing && actions.typing(chat, on);
  const handleChange = (v) => {
    setText(v); autoGrow();
    pokeTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => pokeTyping(false), 1500);
  };

  const doSend = async () => {
    const body = text.trim();
    if ((!body && !editing) || sending) return;
    if (editing) {
      const res = await actions.edit(editing.id, body);
      if (res && res.ok) { setEditing(null); setText(""); autoGrow(); }
      return;
    }
    setSending(true);
    pokeTyping(false);
    clearTimeout(typingTimer.current);
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const temp = {
      id: tempId, tempId, chatType: chat.chatType, chatId: chat.chatId,
      sender: { id: user.id, username: user.username, displayName: user.displayName, color: user.color },
      body, replyTo: replyTo ? { id: replyTo.id, body: replyTo.body, senderName: replyTo.sender.displayName } : null,
      attachment: null, expiresAt: whisper ? Date.now() + whisper * 1000 : null,
      createdAt: Date.now(), reactions: [], receipts: [],
    };
    actions.temp(chat.key, temp);
    setText(""); setReplyTo(null); setWhisper(0); autoGrow();
    const res = await actions.send({ chatType: chat.chatType, chatId: chat.chatId, body, replyTo: replyTo?.id || null, attachment: null, expiresIn: whisper || null, tempId });
    setSending(false);
    if (res && res.error) actions.fail(chat.key, tempId);
  };

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("File is bigger than 10 MB — pick a smaller one."); return; }
    setUploading(true);
    try {
      const { file: meta } = await api.upload(file);
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const temp = {
        id: tempId, tempId, chatType: chat.chatType, chatId: chat.chatId,
        sender: { id: user.id, username: user.username, displayName: user.displayName, color: user.color },
        body: "", attachment: meta, expiresAt: whisper ? Date.now() + whisper * 1000 : null,
        createdAt: Date.now(), reactions: [], receipts: [],
      };
      actions.temp(chat.key, temp);
      const res = await actions.send({ chatType: chat.chatType, chatId: chat.chatId, body: "", replyTo: replyTo?.id || null, attachment: meta, expiresIn: whisper || null, tempId });
      if (res && res.error) actions.fail(chat.key, tempId);
      setReplyTo(null); setWhisper(0);
    } catch (err) { alert(err.message || "Upload failed"); }
    setUploading(false);
  };

  const canSend = (text.trim() || editing) && !sending;

  return (
    <div className="relative border-t border-line bg-base-sidebar/90 backdrop-blur px-2 sm:px-4 pt-2 composer-safe">
      {/* reply / edit banners */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-between text-xs bg-brand-soft border-l-[3px] border-brand rounded-md2 px-3 py-2 mb-2"
          >
            <span className="truncate text-ink-2">
              <b className="text-ink-1">Replying to {replyTo.sender.displayName}:</b> {replyTo.body || "Attachment"}
            </span>
            <button onClick={() => setReplyTo(null)} aria-label="Cancel reply"
              className="pressable ml-2 p-1 rounded-full hover:bg-base-hover text-ink-3"><X size={14} /></button>
          </motion.div>
        )}
        {editing && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-between text-xs bg-warning-soft border-l-[3px] border-warning rounded-md2 px-3 py-2 mb-2"
          >
            <span className="text-ink-2"><Pencil size={12} className="inline mr-1 -mt-0.5" />
              <b className="text-ink-1">Editing message</b> — Enter to save, Esc to cancel</span>
            <button onClick={() => { setEditing(null); setText(""); }} aria-label="Cancel edit"
              className="pressable ml-2 p-1 rounded-full hover:bg-base-hover text-ink-3"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-1">
        {/* emoji */}
        <div className="relative">
          <button onClick={() => setShowEmoji((s) => !s)} data-tip="Emoji" aria-label="Emoji" aria-expanded={showEmoji}
            className={`pressable p-2.5 rounded-full ${showEmoji ? "text-brand bg-brand-soft" : "text-ink-3 hover:text-ink-1 hover:bg-base-hover"}`}>
            <Smile size={21} />
          </button>
          <AnimatePresence>
            {showEmoji && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 4 }}
                transition={{ duration: 0.15 }} className="absolute bottom-12 left-0 z-40 origin-bottom-left"
              >
                <EmojiPicker onPick={(e) => { setText((t) => t + e); autoGrow(); taRef.current?.focus(); }} onClose={() => setShowEmoji(false)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* attach */}
        <button onClick={() => fileRef.current?.click()} data-tip="Attach image or file" aria-label="Attach image or file"
          disabled={uploading}
          className="pressable p-2.5 rounded-full text-ink-3 hover:text-ink-1 hover:bg-base-hover disabled:opacity-50">
          {uploading ? <Loader2 size={21} className="animate-spin" /> : <Paperclip size={21} />}
        </button>
        <input ref={fileRef} type="file" className="hidden" onChange={pickFile} aria-hidden tabIndex={-1} />

        {/* whisper timer */}
        <div className="relative" ref={whisperRef}>
          <button onClick={() => setShowWhisper((s) => !s)} data-tip="Whisper mode — self-destruct timer" aria-label="Whisper mode" aria-expanded={showWhisper}
            className={`pressable p-2.5 rounded-full ${whisper > 0 ? "text-warning bg-warning-soft" : "text-ink-3 hover:text-ink-1 hover:bg-base-hover"}`}>
            <Timer size={21} />
          </button>
          <AnimatePresence>
            {showWhisper && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 4 }}
                transition={{ duration: 0.14 }}
                className="absolute bottom-12 left-0 z-40 w-48 rounded-md2 border border-line bg-base-elev shadow-lift py-1.5 origin-bottom-left"
                role="menu" aria-label="Whisper timer"
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3 px-3.5 pt-1 pb-1.5">Self-destruct</p>
                {WHISPERS.map((w) => (
                  <button key={w.value} role="menuitemradio" aria-checked={whisper === w.value}
                    onClick={() => { setWhisper(w.value); setShowWhisper(false); taRef.current?.focus(); }}
                    className="w-full flex items-center justify-between px-3.5 py-2 text-sm font-medium hover:bg-base-hover text-left">
                    {w.label}
                    {whisper === w.value && <span className="text-brand font-bold">✓</span>}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* input */}
        <div className={`flex-1 rounded-lg2 border bg-base-elev transition focus-within:ring-2
          ${editing ? "border-warning focus-within:ring-warning-soft" : "border-line focus-within:border-brand focus-within:ring-brand-soft"}`}>
          <textarea
            ref={taRef} rows={1} value={text}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
              if (e.key === "Escape" && editing) { setEditing(null); setText(""); }
            }}
            placeholder={editing ? "Edit message…" : `Message ${chat.name}…`}
            aria-label={editing ? "Edit message" : `Message ${chat.name}`}
            className="w-full bg-transparent resize-none px-4 py-2.5 text-[15px] leading-[1.45] max-h-[140px] block"
          />
        </div>

        {/* nudge */}
        <button onClick={() => actions.nudge(chat)} data-tip={`Nudge ${chat.name}`} aria-label={`Nudge ${chat.name}`}
          className="pressable p-2.5 rounded-full text-ink-3 hover:text-warning hover:bg-warning-soft">
          <Zap size={21} />
        </button>

        {/* send */}
        <button
          onClick={doSend} disabled={!canSend}
          data-tip="Send" aria-label="Send message"
          className="pressable p-2.5 rounded-full text-white shadow-glow disabled:shadow-none
            bg-gradient-to-br from-brand-accent to-brand-deep hover:brightness-110 disabled:opacity-40"
        >
          {sending ? <Loader2 size={21} className="animate-spin" /> : <Send size={20} className={editing ? "hidden" : ""} />}
          {editing && !sending && <span className="text-sm font-bold px-0.5">✓</span>}
        </button>
      </div>

      <AnimatePresence>
        {whisper > 0 && !editing && (
          <motion.p
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden text-[12px] text-warning font-medium mt-1.5 ml-1 flex items-center gap-1.5"
          >
            <Timer size={12} /> Whisper mode: this message self-destructs {whisper >= 3600 ? "in 1 hour" : whisper >= 60 ? "in 1 minute" : "in 10 seconds"} after sending.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
