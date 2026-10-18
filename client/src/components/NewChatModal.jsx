// New circle / join-by-code / start-DM dialog.
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, KeyRound, MessageCircle, Copy, Check, Search, TriangleAlert, PartyPopper, Share2 } from "lucide-react";
import { useWhispr } from "../store";
import { api } from "../api";
import { toast } from "../toast";
import { Avatar } from "./Logo";
import { Dialog, Button, TextInput, EmptyState } from "./ui";

const TABS = [
  { id: "create", label: "New circle", icon: <Plus size={15} /> },
  { id: "join", label: "Join", icon: <KeyRound size={15} /> },
  { id: "dm", label: "Direct", icon: <MessageCircle size={15} /> },
];

const ACCENTS = ["#8B5CF6", "#EC4899", "#10B981", "#F59E0B", "#06B6D4", "#EF4444"];

export default function NewChatModal({ open, onClose, initialTab = "create" }) {
  const w = useWhispr();
  const [tab, setTab] = useState(initialTab);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [code, setCode] = useState("");
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [q, setQ] = useState("");
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (open) { setTab(initialTab); } }, [open, initialTab]);

  const reset = () => {
    setTab(initialTab); setName(""); setDescription(""); setAccent(ACCENTS[0]);
    setCode(""); setCreated(null); setQ(""); setUsers([]); setError(""); setCopied(false);
  };
  const close = () => { reset(); onClose(); };

  const doCreate = async () => {
    if (!name.trim()) return;
    setBusy(true); setError("");
    try {
      const circle = await w.createCircle(name.trim(), {
        description: description.trim() || undefined,
        color: accent,
      });
      setCreated(circle);
      toast.success(`“${circle.name}” is live`, "Share the invite code so friends can join.");
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const doJoin = async () => {
    if (code.trim().length < 4) { setError("Enter the 6-character invite code."); return; }
    setBusy(true); setError("");
    try {
      const circle = await w.joinCircle(code.trim());
      toast.success(`Joined “${circle.name}”`, "Say hi — everyone's waiting.");
      close();
      w.selectChat(`circle:${circle.id}`);
    } catch (e) {
      setError(e.message === "No circle found with that code"
        ? "That code doesn't match any circle. Check for typos and try again."
        : e.message);
    }
    setBusy(false);
  };

  const search = async (v) => {
    setQ(v);
    if (v.trim().length < 2) { setUsers([]); return; }
    try { const { users } = await api.searchUsers(v.trim()); setUsers(users); } catch { /* ignore */ }
  };

  const startDm = async (u) => {
    setBusy(true);
    try {
      const key = await w.startDm(u.id);
      close();
      w.selectChat(key);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(created.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast.success("Invite code copied", "Share it with your friends.");
    } catch { setError("Couldn't copy — long-press the code to copy it manually."); }
  };

  const shareCode = async () => {
    const text = `Join my Whispr circle “${created.name}” with invite code ${created.code}`;
    try {
      if (navigator.share) await navigator.share({ title: "Whispr invite", text });
      else await copyCode();
    } catch { /* user cancelled the share sheet */ }
  };

  return (
    <Dialog open={open} onClose={close} title="Start something">
      <div className="flex gap-1 p-1 rounded-md2 bg-base-hover mb-5" role="tablist" aria-label="New chat options">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            onClick={() => { setTab(t.id); setError(""); setCreated(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 text-[13px] font-semibold py-2.5 rounded-lg transition relative
              ${tab === t.id ? "text-ink-1" : "text-ink-3 hover:text-ink-2"}`}>
            {tab === t.id && (
              <motion.span layoutId="newchat-tab" className="absolute inset-0 bg-base-elev rounded-lg shadow-soft border border-line"
                transition={{ type: "spring", stiffness: 500, damping: 38 }} />
            )}
            <span className="relative flex items-center gap-1.5">{t.icon}{t.label}</span>
          </button>
        ))}
      </div>

      {error && (
        <p className="flex items-start gap-2 text-sm text-danger bg-danger-soft border border-danger-soft rounded-md2 px-3.5 py-2.5 mb-4" role="alert">
          <TriangleAlert size={16} className="shrink-0 mt-0.5" /> {error}
        </p>
      )}

      {tab === "create" && !created && (
        <div>
          <TextInput label="Circle name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
            placeholder="e.g. Hostel gang" onKeyDown={(e) => e.key === "Enter" && doCreate()}
            hint="Circles are invite-only. You'll get a 6-character code to share." />
          <div className="mt-4">
            <label htmlFor="circle-desc" className="block text-[13px] font-semibold text-ink-2 mb-1.5">
              Description <span className="text-ink-3 font-medium">(optional)</span>
            </label>
            <textarea id="circle-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={140}
              rows={2} placeholder="What's this circle for?"
              className="w-full rounded-md2 bg-base-elev border border-line px-3.5 py-2.5 text-[15px] resize-none
                hover:border-ink-3 focus:border-brand focus:ring-2 focus:ring-brand-soft transition" />
          </div>
          <div className="mt-4">
            <p className="text-[13px] font-semibold text-ink-2 mb-2" id="accent-label">Accent colour</p>
            <div className="flex gap-2" role="radiogroup" aria-labelledby="accent-label">
              {ACCENTS.map((c) => (
                <button key={c} role="radio" aria-checked={accent === c} aria-label={`Accent ${c}`}
                  onClick={() => setAccent(c)}
                  className={`pressable w-9 h-9 rounded-full border-2 transition
                    ${accent === c ? "border-ink-1 scale-110 shadow-lift" : "border-transparent hover:scale-105"}`}
                  style={{ background: `linear-gradient(135deg, ${c}, ${c}AA)` }}
                >
                  {accent === c && <Check size={16} className="text-white mx-auto" aria-hidden />}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={doCreate} loading={busy} disabled={!name.trim()} className="w-full mt-6">
            Create circle
          </Button>
        </div>
      )}

      {tab === "create" && created && (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-2">
          <div className="celebrate w-14 h-14 mx-auto rounded-2xl border border-line
            flex items-center justify-center text-brand mb-3"
            style={{ background: `linear-gradient(135deg, ${created.color || "#8B5CF6"}26, ${created.color || "#8B5CF6"}0D)` }}>
            <PartyPopper size={26} style={{ color: created.color || "#8B5CF6" }} />
          </div>
          <p className="font-bold text-[17px] tracking-tight">“{created.name}” is live</p>
          <p className="text-sm text-ink-3 mt-1">Share this code so friends can join:</p>
          <button onClick={copyCode} data-tip="Copy code" aria-label="Copy invite code"
            className="pressable mt-4 font-mono font-bold tracking-[0.3em] text-2xl bg-base-hover border border-line
              rounded-md2 px-8 py-3.5 hover:border-brand transition inline-flex items-center gap-3">
            {created.code}
            {copied
              ? <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path className="check-draw" d="M4 10.5l4 4 8-9" stroke="var(--success)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              : <Copy size={18} className="text-ink-3" />}
          </button>
          <p className="text-xs text-ink-3 mt-2">{copied ? "Copied!" : "tap to copy"}</p>
          <div className="flex gap-2.5 mt-5">
            <Button variant="secondary" className="flex-1" onClick={shareCode}>
              <Share2 size={16} /> Share
            </Button>
            <Button className="flex-[2]" onClick={() => { close(); w.selectChat(`circle:${created.id}`); }}>
              Open circle
            </Button>
          </div>
        </motion.div>
      )}

      {tab === "join" && (
        <div>
          <TextInput label="Invite code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6}
            placeholder="KX7Q2M" onKeyDown={(e) => e.key === "Enter" && doJoin()}
            inputClassName="font-mono tracking-[0.3em] text-center text-xl uppercase font-bold" />
          <Button onClick={doJoin} loading={busy} className="w-full mt-5">
            Join circle
          </Button>
        </div>
      )}

      {tab === "dm" && (
        <div>
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
            <input value={q} onChange={(e) => search(e.target.value)} placeholder="Search people by name or username…"
              aria-label="Search people"
              className="w-full rounded-md2 bg-base-elev border border-line pl-10 pr-3 py-2.5 text-sm
                hover:border-ink-3 focus:border-brand focus:ring-2 focus:ring-brand-soft transition" />
          </div>
          <div className="mt-2 max-h-64 overflow-y-auto -mx-1 px-1">
            {users.map((u) => (
              <button key={u.id} onClick={() => startDm(u)} disabled={busy}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-md2 hover:bg-base-hover text-left transition disabled:opacity-50">
                <Avatar name={u.displayName} color={u.color} size={38} />
                <span className="min-w-0">
                  <span className="block font-semibold truncate text-[15px]">{u.displayName}</span>
                  <span className="block text-xs text-ink-3 truncate">@{u.username}</span>
                </span>
              </button>
            ))}
            {q.trim().length >= 2 && users.length === 0 && (
              <EmptyState icon={<Search size={22} />} title="No one found"
                body="Ask them to create a Whispr account first." />
            )}
            {q.trim().length < 2 && (
              <p className="text-[13px] text-ink-3 text-center py-5">Type at least 2 characters to search.</p>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
