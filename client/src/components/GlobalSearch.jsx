// Global message search — searches every chat the user belongs to, jumps to
// the message on pick. Uses the existing /api/search endpoint (real data).
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search, X, MessageCircle } from "lucide-react";
import { useWhispr } from "../store";
import { api } from "../api";
import { chatKey } from "../store";
import { Dialog, EmptyState } from "./ui";
import { Avatar } from "./Logo";

export default function GlobalSearch({ open, onClose }) {
  const w = useWhispr();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setQ(""); setResults([]); setSearching(false); }
  }, [open ]);

  useEffect(() => {
    if (!open || q.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    let live = true;
    const t = setTimeout(async () => {
      try {
        const { results } = await api.searchMessages(q.trim());
        if (live) setResults(results || []);
      } catch { if (live) setResults([]); }
      if (live) setSearching(false);
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [q, open]);

  const chatName = useMemo(() => {
    const map = {};
    for (const c of w.chats) map[c.key] = c;
    return map;
  }, [w.chats]);

  const pick = (r) => {
    const key = chatKey(r.chatType, r.chatId);
    onClose();
    w.selectChat(key).then(() => w.requestJump(key, r.id)).catch(() => {});
  };

  return (
    <Dialog open={open} onClose={onClose} title="Search messages">
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search all your conversations…"
          aria-label="Search all conversations"
          className="w-full rounded-md2 bg-base-elev border border-line pl-10 pr-9 py-2.5 text-sm
            hover:border-ink-3 focus:border-brand focus:ring-2 focus:ring-brand-soft transition"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Clear search"
            className="pressable absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-ink-3 hover:bg-base-hover">
            <X size={15} />
          </button>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto -mx-1 px-1" role="listbox" aria-label="Search results">
        {searching && (
          <div className="space-y-2 py-1" aria-hidden>
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-12 !rounded-md2" />)}
          </div>
        )}
        {!searching && q.trim().length >= 2 && results.length === 0 && (
          <EmptyState icon={<Search size={22} />} title="No matches"
            body={`Nothing anywhere matches “${q.trim()}”.`} />
        )}
        {!searching && q.trim().length < 2 && (
          <p className="text-[13px] text-ink-3 text-center py-6">Type at least 2 characters to search every chat.</p>
        )}
        {results.map((r) => {
          const c = chatName[chatKey(r.chatType, r.chatId)];
          return (
            <motion.button
              key={r.id}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.14 }}
              onClick={() => pick(r)}
              role="option" aria-selected="false"
              className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-md2 hover:bg-base-hover text-left transition"
            >
              <Avatar name={c?.name || "?"} color={c?.kind === "dm" ? c.partner?.color : c?.color || "#8B5CF6"} size={36} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-sm truncate">{c?.name || (r.chatType === "circle" ? "Circle" : "Direct")}</span>
                  <span className="text-[11px] text-ink-3 shrink-0 inline-flex items-center gap-1">
                    <MessageCircle size={11} /> jump
                  </span>
                </span>
                <span className="block text-[13px] text-ink-3 truncate">
                  <b className="text-ink-2 font-semibold">{r.sender.displayName}:</b> {r.body || "Attachment"}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </Dialog>
  );
}
