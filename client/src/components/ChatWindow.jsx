// The active conversation: header (presence, mood, members, search), message list, composer.
import { useEffect, useMemo, useRef, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Search, Palette, Users, ArrowDown, X, Zap, Check, MessageCircle,
} from "lucide-react";
import { useWhispr } from "../store";
import { api } from "../api";
import { Avatar } from "./Logo";
import MessageBubble from "./MessageBubble";
import Composer from "./Composer";
import { Dialog, Button, Dropdown, EmptyState } from "./ui";

const MOODS = [
  { id: "midnight", label: "Midnight", desc: "Signature violet", swatch: "linear-gradient(135deg,#8B5CF6,#6D28D9)" },
  { id: "sunset", label: "Sunset", desc: "Warm ember", swatch: "linear-gradient(135deg,#F97316,#C2410C)" },
  { id: "forest", label: "Forest", desc: "Calm green", swatch: "linear-gradient(135deg,#10B981,#047857)" },
  { id: "candy", label: "Candy", desc: "Playful pink", swatch: "linear-gradient(135deg,#EC4899,#BE185D)" },
];

function lastSeenText(ts) {
  if (!ts) return "last seen recently";
  const d = new Date(ts);
  if (isToday(d)) return `last seen ${format(d, "HH:mm")}`;
  if (isYesterday(d)) return `last seen yesterday ${format(d, "HH:mm")}`;
  return `last seen ${format(d, "d MMM, HH:mm")}`;
}

function dayLabel(ts) {
  const d = new Date(ts);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "d MMMM yyyy");
}

function MembersPopover({ chat, onClose }) {
  const [members, setMembers] = useState(null);
  const { presence } = useWhispr();
  useEffect(() => {
    let live = true;
    api.circleMembers(chat.chatId).then(({ members }) => { if (live) setMembers(members); }).catch(() => live && setMembers([]));
    return () => { live = false; };
  }, [chat.chatId]);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: -3 }}
      transition={{ duration: 0.14 }}
      className="absolute right-0 top-12 z-40 w-64 rounded-md2 border border-line bg-base-elev shadow-lift py-2 origin-top-right"
      role="dialog" aria-label="Circle members"
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3 px-4 pb-1.5">
        Members · {members ? members.length : "…"}
      </p>
      <div className="max-h-64 overflow-y-auto">
        {!members && [0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2"><div className="skeleton w-8 h-8 !rounded-full" /><div className="skeleton h-3 w-24" /></div>
        ))}
        {members?.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-2 hover:bg-base-hover">
            <Avatar name={m.displayName} color={m.color} size={32} online={presence[m.id]?.online} />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{m.displayName}</p>
              <p className="text-[11px] text-ink-3 truncate">@{m.username}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-line mt-1 pt-2 px-4 pb-1">
        <p className="text-[11px] text-ink-3">Invite code: <button onClick={() => navigator.clipboard?.writeText(chat.code)}
          className="font-mono font-bold text-brand tracking-[0.2em]" title="Copy invite code">{chat.code}</button></p>
      </div>
    </motion.div>
  );
}

export default function ChatWindow({ onBack }) {
  const w = useWhispr();
  const { activeChat: chat, messages, typingFor, presence, user, themes, nudgeTick, nudgeFrom } = w;
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showMoods, setShowMoods] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [shake, setShake] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const listRef = useRef(null);
  const bottomRef = useRef(null);
  const prevLen = useRef(0);
  const membersRef = useRef(null);
  const mood = themes[chat.key] || "midnight";

  // nudge shake
  useEffect(() => {
    if (nudgeTick === 0) return;
    setShake(true);
    const t = setTimeout(() => setShake(false), 550);
    return () => clearTimeout(t);
  }, [nudgeTick]);

  // close members popover on outside click
  useEffect(() => {
    if (!showMembers) return;
    const fn = (e) => { if (membersRef.current && !membersRef.current.contains(e.target)) setShowMembers(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [showMembers]);

  // auto-scroll on new messages only if already at bottom
  useEffect(() => {
    if (messages.length > prevLen.current) {
      if (atBottom) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      else setPendingCount((c) => c + (messages.length - prevLen.current));
    }
    prevLen.current = messages.length;
  }, [messages.length]); // eslint-disable-line

  useEffect(() => { setPendingCount(0); prevLen.current = messages.length; setAtBottom(true); setReplyTo(null); setEditing(null); }, [chat.key]);

  const handleScroll = async (e) => {
    const el = e.target;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setAtBottom(nearBottom);
    if (nearBottom) setPendingCount(0);
    if (el.scrollTop < 80 && !loadingOlder && messages.length) {
      setLoadingOlder(true);
      const oldH = el.scrollHeight;
      const more = await w.loadOlder(chat.key);
      if (more) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - oldH; });
      setLoadingOlder(false);
    }
  };

  const scrollToBottom = () => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); setPendingCount(0); };

  const scrollToMessage = (id) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(id);
      setTimeout(() => setHighlightId(null), 2000);
    }
  };

  // in-chat search (debounced)
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { results } = await api.searchMessages(query.trim(), chat.chatType, chat.chatId);
        setResults(results);
      } catch { setResults([]); }
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [query, chat]);

  const retrySend = async (temp) => {
    const res = await w.sendMessage({
      chatType: chat.chatType, chatId: chat.chatId, body: temp.body,
      replyTo: temp.replyTo?.id || null, attachment: temp.attachment || null,
      expiresIn: temp.expiresAt ? Math.max(1, Math.round((temp.expiresAt - Date.now()) / 1000)) : null,
      tempId: temp.tempId,
    });
    if (res && res.error) alert("Still failing: " + res.error);
  };

  // group messages with date dividers
  const blocks = useMemo(() => {
    const out = [];
    let lastDay = "";
    let firstMsg = true;
    for (const m of messages) {
      const day = new Date(m.createdAt).toDateString();
      if (day !== lastDay) { out.push({ type: "day", key: `day-${m.id}`, label: dayLabel(m.createdAt) }); lastDay = day; }
      out.push({ type: "msg", key: m.id, msg: m, first: firstMsg });
      firstMsg = false;
    }
    return out;
  }, [messages]);

  const typingNames = typingFor.filter((t) => t.userId !== user.id);
  const partnerPresence = chat.kind === "dm" ? presence[chat.partner.id] : null;

  const headerSub = chat.kind === "dm"
    ? partnerPresence?.online
      ? <span className="text-success font-semibold">online now</span>
      : lastSeenText(partnerPresence?.lastSeen)
    : `${chat.memberCount || ""} ${chat.memberCount === 1 ? "member" : "members"}`;

  return (
    <motion.div
      key={chat.key}
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={`flex flex-col h-full mood mood-${mood} ${shake ? "nudge-shake" : ""}`}
    >
      {/* header */}
      <header className="glass flex items-center gap-2.5 px-2.5 sm:px-4 py-2.5 border-b border-line z-10 !rounded-none !border-x-0 !border-t-0">
        <button onClick={onBack} aria-label="Back to conversations"
          className="pressable md:hidden p-2 -ml-1 rounded-full text-ink-2 hover:bg-base-hover">
          <ArrowLeft size={20} />
        </button>
        <Avatar name={chat.name} color={chat.kind === "dm" ? chat.partner.color : "#8B5CF6"} size={42}
          online={chat.kind === "dm" ? partnerPresence?.online : undefined} />
        <div className="flex-1 min-w-0">
          <h2 className="font-bold truncate leading-tight tracking-tight text-[16px]">{chat.name}</h2>
          <p className="text-xs text-ink-3 truncate" aria-live="polite">
            {typingNames.length
              ? <span className="text-brand font-semibold">{typingNames.map((t) => t.name).join(", ")} typing…</span>
              : headerSub}
          </p>
        </div>

        <AnimatePresence>
          {nudgeTick > 0 && shake && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold bg-warning-soft text-warning border border-warning-soft px-2.5 py-1.5 rounded-full"
            >
              <Zap size={13} /> {nudgeFrom} nudged you
            </motion.span>
          )}
        </AnimatePresence>

        {/* members (circles) */}
        {chat.kind === "circle" && (
          <div className="relative" ref={membersRef}>
            <button onClick={() => setShowMembers((s) => !s)} data-tip="Members & invite code" aria-label="Members and invite code" aria-expanded={showMembers}
              className={`pressable p-2.5 rounded-full ${showMembers ? "text-brand bg-brand-soft" : "text-ink-3 hover:text-ink-1 hover:bg-base-hover"}`}>
              <Users size={19} />
            </button>
            <AnimatePresence>{showMembers && <MembersPopover chat={chat} onClose={() => setShowMembers(false)} />}</AnimatePresence>
          </div>
        )}

        {/* mood picker */}
        <div className="relative">
          <button onClick={() => setShowMoods((s) => !s)} onMouseDown={(e) => e.stopPropagation()}
            data-tip="Mood theme" aria-label="Mood theme" aria-expanded={showMoods}
            className={`pressable p-2.5 rounded-full ${showMoods ? "text-brand bg-brand-soft" : "text-ink-3 hover:text-ink-1 hover:bg-base-hover"}`}>
            <Palette size={19} />
          </button>
          <Dropdown open={showMoods} onClose={() => setShowMoods(false)} className="w-52 !p-2 top-12">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3 px-2.5 pt-1 pb-1.5">Mood bubble</p>
            {MOODS.map((m) => (
              <button key={m.id} onClick={() => { w.setMood(chat.key, m.id); setShowMoods(false); }}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-md2 hover:bg-base-hover text-left transition">
                <span className="w-7 h-7 rounded-full border border-line shrink-0 shadow-soft" style={{ background: m.swatch }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold">{m.label}</span>
                  <span className="block text-[11px] text-ink-3">{m.desc}</span>
                </span>
                {mood === m.id && <Check size={16} className="text-brand shrink-0" />}
              </button>
            ))}
          </Dropdown>
        </div>

        <button onClick={() => setShowSearch((s) => !s)} data-tip="Search in chat" aria-label="Search in chat" aria-expanded={showSearch}
          className={`pressable p-2.5 rounded-full ${showSearch ? "text-brand bg-brand-soft" : "text-ink-3 hover:text-ink-1 hover:bg-base-hover"}`}>
          <Search size={19} />
        </button>
      </header>

      {/* search bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-b border-line glass !rounded-none !border-x-0 !border-t-0 z-10"
          >
            <div className="px-3 py-2.5">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
                <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search messages in this chat…"
                  aria-label="Search messages in this chat"
                  className="w-full rounded-md2 bg-base-elev border border-line pl-10 pr-9 py-2.5 text-sm
                    hover:border-ink-3 focus:border-brand focus:ring-2 focus:ring-brand-soft transition" />
                <button onClick={() => { setShowSearch(false); setQuery(""); }} aria-label="Close search"
                  className="pressable absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-ink-3 hover:bg-base-hover">
                  <X size={15} />
                </button>
              </div>
              <div className="max-h-44 overflow-y-auto mt-1.5">
                {searching && <p className="text-xs text-ink-3 p-2">Searching…</p>}
                {!searching && query.trim().length >= 2 && results.length === 0 && (
                  <EmptyState icon={<Search size={22} />} title="No matches"
                    body={`Nothing in this chat matches “${query.trim()}”.`} />
                )}
                {results.map((r) => (
                  <button key={r.id} onClick={() => scrollToMessage(r.id)}
                    className="w-full text-left text-sm px-3 py-2 hover:bg-base-hover rounded-md2 truncate transition">
                    <b className="font-semibold">{r.sender.displayName}:</b>{" "}
                    <span className="text-ink-2">{r.body || "Attachment"}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* messages */}
      <div ref={listRef} onScroll={handleScroll} className="flex-1 overflow-y-auto py-3" role="log" aria-label="Messages" aria-live="off">
        {loadingOlder && (
          <div className="flex justify-center py-2" aria-hidden>
            <div className="skeleton h-6 w-40 !rounded-full" />
          </div>
        )}
        {messages.length === 0 && (
          <EmptyState
            icon={<MessageCircle size={26} />}
            title="No messages yet"
            body={`Say hi to ${chat.name} — it delivers instantly, like magic but real.`}
          />
        )}
        {blocks.map((b) => b.type === "day" ? (
          <div key={b.key} className="flex justify-center my-3 px-4">
            <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-base-elev border border-line text-ink-3 shadow-soft">
              {b.label}
            </span>
          </div>
        ) : (
          <div key={b.key} className={highlightId === b.msg.id ? "msg-highlight" : ""}>
            <MessageBubble
              msg={b.msg} mine={b.msg.sender.id === user.id} meId={user.id}
              showSender={chat.kind === "circle"} actionsBelow={b.first}
              onReact={(id, emoji) => w.react(id, emoji)}
              onReply={(m) => { setEditing(null); setReplyTo(m); }}
              onEdit={(m) => setEditing(m)}
              onDelete={(m) => setDeleteTarget(m)}
              onRetry={retrySend}
              scrollTo={scrollToMessage}
            />
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* typing indicator */}
      <div className="px-4 h-6 flex items-center" aria-live="polite">
        <AnimatePresence>
          {typingNames.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
              className="flex items-center gap-2 text-xs text-ink-3 font-medium"
            >
              <span className="flex gap-1" aria-hidden><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></span>
              {typingNames.map((t) => t.name).join(", ")} typing…
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* new messages pill + scroll-to-bottom */}
      <div className="relative">
        <AnimatePresence>
          {pendingCount > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 8, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 8, x: "-50%" }}
              onClick={scrollToBottom}
              className="absolute -top-12 left-1/2 text-xs font-bold px-3.5 py-2 rounded-full text-white shadow-glow
                bg-gradient-to-br from-brand-accent to-brand-deep hover:brightness-110 pressable whitespace-nowrap"
            >
              <ArrowDown size={13} className="inline mr-1 -mt-0.5" />
              {pendingCount} new message{pendingCount > 1 ? "s" : ""}
            </motion.button>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {!atBottom && pendingCount === 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
              onClick={scrollToBottom} data-tip="Scroll to bottom" aria-label="Scroll to bottom"
              className="pressable absolute -top-[52px] right-4 w-10 h-10 rounded-full bg-base-elev border border-line shadow-lift
                text-ink-2 hover:text-ink-1 inline-flex items-center justify-center"
            >
              <ArrowDown size={18} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <Composer
        chat={chat} user={user}
        replyTo={replyTo} setReplyTo={setReplyTo}
        editing={editing} setEditing={setEditing}
        actions={{
          send: (p) => w.sendMessage(p),
          edit: (id, body) => w.editMessage(id, body),
          temp: (key, temp) => w.addTempMessage(key, temp),
          fail: (key, tempId) => w.failTempMessage(key, tempId),
          nudge: (c) => w.nudge(c.chatType, c.chatId),
          typing: (c, on) => w.sendTyping(c.chatType, c.chatId, on),
        }}
      />

      {/* delete confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete message?">
        <p className="text-sm text-ink-2 leading-relaxed">
          This message will be deleted for <b className="text-ink-1">everyone</b> in this chat. This can't be undone.
        </p>
        {deleteTarget?.body && (
          <p className="mt-3 text-sm bg-base-hover border border-line rounded-md2 px-3 py-2 truncate text-ink-3">
            “{deleteTarget.body}”
          </p>
        )}
        <div className="flex gap-2.5 mt-5 justify-end">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="destructive" onClick={() => {
            w.deleteMessage(deleteTarget.id).catch((e) => alert(e.message));
            setDeleteTarget(null);
          }}>Delete for everyone</Button>
        </div>
      </Dialog>
    </motion.div>
  );
}
