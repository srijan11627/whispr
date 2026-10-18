// One chat bubble: ticks, reactions, reply quotes, whisper countdown, attachments.
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check, CheckCheck, SmilePlus, Reply, Pencil, Trash2, MoreHorizontal,
  Timer, FileText, Download, TriangleAlert, RotateCcw,
} from "lucide-react";
import { fileUrl } from "../api";
import { Avatar } from "./Logo";
import EmojiPicker, { QUICK } from "./EmojiPicker";

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function useCountdown(expiresAt) {
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil(((expiresAt || 0) - Date.now()) / 1000)));
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return left;
}

function fmtLeft(s) {
  if (s <= 0) return "gone";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.ceil(s / 60)}m`;
  return `${Math.ceil(s / 3600)}h`;
}

// delivery/read state from per-recipient receipts
function Ticks({ msg }) {
  const receipts = msg.receipts || [];
  if (!receipts.length) return <Check size={13} className="opacity-60" aria-label="sent" />;
  const delivered = receipts.every((r) => r.deliveredAt);
  const read = receipts.every((r) => r.readAt);
  if (read) return <CheckCheck size={15} className="text-sky-400" aria-label="read" />;
  if (delivered) return <CheckCheck size={14} className="opacity-70" aria-label="delivered" />;
  return <Check size={13} className="opacity-60" aria-label="sent" />;
}

export default function MessageBubble({ msg, mine, meId, showSender, actionsBelow, onReact, onReply, onEdit, onDelete, onRetry, scrollTo }) {
  const [menu, setMenu] = useState(false);
  const [picker, setPicker] = useState(false);
  const [barPinned, setBarPinned] = useState(false);
  const menuRef = useRef(null);
  const left = useCountdown(msg.expiresAt);

  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) { setMenu(false); setPicker(false); } };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const grouped = {};
  for (const r of msg.reactions || []) (grouped[r.emoji] ||= []).push(r);

  const closeMenu = () => { setMenu(false); setPicker(false); setBarPinned(false); };

  return (
    <div id={`msg-${msg.id}`} className={`${mine ? "msg-in-mine" : "msg-in"} flex ${mine ? "justify-end" : "justify-start"} px-3 sm:px-4 py-[3px] group/msg`}>
      {!mine && (
        <div className="mr-2 mt-0.5 self-start"><Avatar name={msg.sender.displayName} color={msg.sender.color} size={30} /></div>
      )}
      <div className={`relative max-w-[80%] sm:max-w-[68%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
        {showSender && !mine && (
          <span className="text-[11px] font-bold mb-0.5 ml-1 tracking-tight" style={{ color: msg.sender.color }}>
            {msg.sender.displayName}
          </span>
        )}

        {msg.replyTo && (
          <button
            onClick={() => scrollTo && scrollTo(msg.replyTo.id)}
            className={`text-left text-xs mb-1.5 px-3 py-2 rounded-md2 border-l-[3px] max-w-full w-full
              ${mine
                ? "bg-black/15 border-white/70 text-white/95"
                : "bg-base-hover border-brand text-ink-2"}`}
          >
            <span className="font-semibold block truncate">{msg.replyTo.senderName || "Message"}</span>
            <span className="truncate block opacity-75">{msg.replyTo.deleted ? "Message deleted" : msg.replyTo.body || "Attachment"}</span>
          </button>
        )}

        <div className="relative">
          <div
            onClick={() => { if (msg.tempFailed && onRetry) onRetry(msg); }}
            className={`relative px-3.5 py-2 rounded-lg2 ${mine ? "rounded-br-sm2 bubble-mine" : "rounded-bl-sm2 bubble-theirs"}
              ${msg.tempFailed ? "opacity-80 cursor-pointer" : ""} ${msg.tempId && !msg.tempFailed ? "msg-sending" : ""}`}
          >
            {msg.expiresAt && (
              <span className="whisper-pill mb-1.5"><Timer size={11} /> whisper · {fmtLeft(left)}</span>
            )}
            {msg.attachment?.kind === "image" && (
              <a href={fileUrl(msg.attachment.url)} target="_blank" rel="noreferrer" className="block mb-1.5 -mx-1.5 -mt-0.5">
                <img src={fileUrl(msg.attachment.url)} alt={msg.attachment.name}
                  className="rounded-lg max-h-64 w-auto object-cover" loading="lazy" />
              </a>
            )}
            {msg.attachment?.kind === "file" && (
              <a href={fileUrl(msg.attachment.url)} target="_blank" rel="noreferrer" download
                className={`flex items-center gap-2.5 mb-1.5 pl-2.5 pr-3 py-2 rounded-md2 ${mine ? "bg-black/20" : "bg-base-hover"}`}>
                <span className={`w-9 h-9 rounded-md2 flex items-center justify-center shrink-0 ${mine ? "bg-white/20" : "bg-brand-soft text-brand"}`}>
                  <FileText size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold truncate max-w-[190px]">{msg.attachment.name}</span>
                  <span className="block text-[11px] opacity-70">{fmtSize(msg.attachment.size)}</span>
                </span>
                <Download size={15} className="opacity-60 shrink-0" />
              </a>
            )}
            {msg.body && <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.45]">{msg.body}</p>}

            <div className={`flex items-center gap-1.5 mt-1 justify-end text-[11px] ${mine ? "text-white/75" : "text-ink-3"}`}>
              {msg.editedAt && <span className="italic">edited</span>}
              {msg.tempFailed ? (
                <span className="inline-flex items-center gap-1 text-danger font-semibold">
                  <TriangleAlert size={12} /> failed — tap to retry
                </span>
              ) : (
                <span className="tabular-nums">{msg.createdAt ? format(new Date(msg.createdAt), "HH:mm") : "…"}</span>
              )}
              {mine && !msg.tempId && <Ticks msg={msg} />}
            </div>
          </div>

          {/* touch affordance: subtle chevron toggles the action bar (hover reveals it on desktop) */}
          {!msg.tempId && (
            <button
              onClick={(e) => { e.stopPropagation(); setBarPinned((p) => !p); setMenu(false); }}
              aria-label="Message actions" aria-expanded={barPinned}
              className="touch-chevron pressable absolute top-1.5 right-2 z-10 w-6 h-6 items-center justify-center rounded-full opacity-50"
            >
              <MoreHorizontal size={14} />
            </button>
          )}

          {/* hover action bar — flips below the bubble for the first message so it never clips */}
          {!msg.tempId && (
            <div
              className={`bubble-actions absolute ${actionsBelow ? "top-full mt-1.5" : "-top-9"} ${mine ? "right-0" : "left-0"} z-20
                flex items-center gap-0.5 p-1 rounded-full border border-line bg-base-elev shadow-lift
                opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 transition-opacity duration-150
                ${barPinned ? "!opacity-100" : ""}`}
              role="toolbar" aria-label="Message actions"
            >
              <button onClick={() => onReact(msg.id, "❤️")} data-tip="Quick react" aria-label="Quick react with heart"
                className="pressable w-8 h-8 rounded-full inline-flex items-center justify-center text-ink-2 hover:text-danger hover:bg-base-hover text-base leading-none">❤️</button>
              <button onClick={() => { setPicker(true); setMenu(true); setBarPinned(true); }} data-tip="React" aria-label="React with emoji"
                className="pressable w-8 h-8 rounded-full inline-flex items-center justify-center text-ink-2 hover:text-ink-1 hover:bg-base-hover">
                <SmilePlus size={16} /></button>
              <button onClick={() => onReply(msg)} data-tip="Reply" aria-label="Reply"
                className="pressable w-8 h-8 rounded-full inline-flex items-center justify-center text-ink-2 hover:text-ink-1 hover:bg-base-hover">
                <Reply size={16} /></button>
              <button onClick={() => { setMenu((m) => !m); setBarPinned((p) => !p); }} data-tip="More" aria-label="More actions" aria-expanded={menu}
                className="pressable w-8 h-8 rounded-full inline-flex items-center justify-center text-ink-2 hover:text-ink-1 hover:bg-base-hover">
                <MoreHorizontal size={16} /></button>
            </div>
          )}

          {/* full action menu */}
          <AnimatePresence>
            {menu && (
              <div ref={menuRef} className={`absolute z-30 ${mine ? "right-0" : "left-0"} ${actionsBelow ? "top-full mt-12" : "top-10"}`}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -3 }}
                  transition={{ duration: 0.14 }}
                  className="w-52 rounded-md2 border border-line bg-base-elev shadow-lift py-1.5 origin-top"
                  role="menu"
                >
                  {picker ? (
                    <div className="p-1.5">
                      <div className="flex flex-wrap gap-0.5 justify-center mb-1">
                        {QUICK.map((e) => (
                          <button key={e} aria-label={`React ${e}`}
                            className="pressable text-xl p-1.5 rounded-lg hover:bg-base-hover" onClick={() => { onReact(msg.id, e); closeMenu(); }}>{e}</button>
                        ))}
                      </div>
                      <EmojiPicker onPick={(e) => { onReact(msg.id, e); closeMenu(); }} onClose={() => setPicker(false)} inline />
                    </div>
                  ) : (
                    <>
                      <button role="menuitem" className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium hover:bg-base-hover text-left"
                        onClick={() => { setPicker(true); }}><SmilePlus size={16} className="opacity-70" /> React…</button>
                      <button role="menuitem" className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium hover:bg-base-hover text-left"
                        onClick={() => { onReply(msg); closeMenu(); }}><Reply size={16} className="opacity-70" /> Reply</button>
                      {mine && (
                        <button role="menuitem" className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium hover:bg-base-hover text-left"
                          onClick={() => { onEdit(msg); closeMenu(); }}><Pencil size={16} className="opacity-70" /> Edit</button>
                      )}
                      {mine && (
                        <button role="menuitem" className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-danger hover:bg-danger-soft text-left"
                          onClick={() => { onDelete(msg); closeMenu(); }}><Trash2 size={16} className="opacity-80" /> Delete</button>
                      )}
                    </>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* reactions */}
        {Object.keys(grouped).length > 0 && (
          <div key={Object.values(grouped).reduce((n, rs) => n + rs.length, 0)} className="pop-in flex flex-wrap gap-1 mt-1">
            {Object.entries(grouped).map(([emoji, rs]) => {
              const reacted = rs.some((r) => r.userId === meId);
              return (
                <button key={emoji} onClick={() => onReact(msg.id, emoji)} title={rs.map((r) => r.userName).join(", ")}
                  aria-pressed={reacted}
                  className={`pressable text-[13px] pl-1.5 pr-2 py-[3px] rounded-full border inline-flex items-center gap-1 shadow-soft
                    ${reacted ? "border-brand bg-brand-soft text-ink-1" : "border-line bg-base-elev text-ink-2 hover:border-ink-3"}`}>
                  <span className="leading-none">{emoji}</span>
                  <span className="font-bold text-[11px] tabular-nums">{rs.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
