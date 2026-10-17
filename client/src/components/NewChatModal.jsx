// New circle / join-by-code / start-DM dialog.
import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, KeyRound, MessageCircle, Copy, Check, Search, TriangleAlert, PartyPopper } from "lucide-react";
import { useWhispr } from "../store";
import { api } from "../api";
import { Avatar } from "./Logo";
import { Dialog, Button, TextInput, EmptyState } from "./ui";

const TABS = [
  { id: "create", label: "New circle", icon: <Plus size={15} /> },
  { id: "join", label: "Join", icon: <KeyRound size={15} /> },
  { id: "dm", label: "Direct", icon: <MessageCircle size={15} /> },
];

export default function NewChatModal({ open, onClose }) {
  const w = useWhispr();
  const [tab, setTab] = useState("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [q, setQ] = useState("");
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reset = () => { setTab("create"); setName(""); setCode(""); setCreated(null); setQ(""); setUsers([]); setError(""); setCopied(false); };
  const close = () => { reset(); onClose(); };

  const doCreate = async () => {
    if (!name.trim()) return;
    setBusy(true); setError("");
    try {
      const circle = await w.createCircle(name.trim());
      setCreated(circle);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const doJoin = async () => {
    if (code.trim().length < 4) { setError("Enter the 6-character invite code."); return; }
    setBusy(true); setError("");
    try {
      const circle = await w.joinCircle(code.trim());
      close();
      w.selectChat(`circle:${circle.id}`);
    } catch (e) { setError(e.message); }
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
    try { await navigator.clipboard.writeText(created.code); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
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
          <Button onClick={doCreate} loading={busy} disabled={!name.trim()} className="w-full mt-5">
            Create circle
          </Button>
        </div>
      )}

      {tab === "create" && created && (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-brand-accent/15 to-brand-pink/10 border border-line
            flex items-center justify-center text-brand mb-3">
            <PartyPopper size={26} />
          </div>
          <p className="font-bold text-[17px] tracking-tight">“{created.name}” is live</p>
          <p className="text-sm text-ink-3 mt-1">Share this code so friends can join:</p>
          <button onClick={copyCode} data-tip="Copy code" aria-label="Copy invite code"
            className="pressable mt-4 font-mono font-bold tracking-[0.3em] text-2xl bg-base-hover border border-line
              rounded-md2 px-8 py-3.5 hover:border-brand transition inline-flex items-center gap-3">
            {created.code}
            {copied ? <Check size={18} className="text-success" /> : <Copy size={18} className="text-ink-3" />}
          </button>
          <p className="text-xs text-ink-3 mt-2">{copied ? "Copied!" : "tap to copy"}</p>
          <Button className="w-full mt-5" onClick={() => { close(); w.selectChat(`circle:${created.id}`); }}>
            Open circle
          </Button>
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
