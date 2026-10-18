// Sidebar: brand, conversation list, search, presence, profile menu, collapse.
import { useMemo, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { motion } from "framer-motion";
import {
  Plus, Search, Sun, Moon, LogOut, RefreshCw, ChevronsLeft, ChevronsRight,
  Hash, MessageCircle, Paperclip, Zap, Pencil,
} from "lucide-react";
import { useWhispr } from "../store";
import { useTheme } from "../theme";
import { toast } from "../toast";
import Logo, { Avatar } from "./Logo";
import NewChatModal from "./NewChatModal";
import GlobalSearch from "./GlobalSearch";
import { Badge, Dropdown, MenuItem, SectionLabel, IconButton, ConnectionBanner, Dialog, Button, TextInput } from "./ui";

function timeAgo(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "d MMM");
}

function Preview({ chat, meId }) {
  if (chat.nudgedBy) {
    return (
      <span className="flex items-center gap-1 text-warning font-medium">
        <Zap size={12} /> {chat.nudgedBy} nudged you
      </span>
    );
  }
  if (!chat.lastMessage) {
    return <span>{chat.kind === "circle" ? `code ${chat.code}` : `@${chat.username}`}</span>;
  }
  const isAttach = chat.lastMessage.startsWith("📎");
  return (
    <span className="flex items-center gap-1 min-w-0">
      {isAttach && <Paperclip size={12} className="shrink-0" />}
      <span className="truncate">
        {chat.lastSenderId === meId ? "You: " : ""}
        {isAttach ? chat.lastMessage.replace(/^📎\s*/, "") : chat.lastMessage}
      </span>
    </span>
  );
}

function ChatRow({ chat, active, online, meId, onSelect }) {
  return (
    <button
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-md2 text-left transition-colors duration-150
        ${active ? "bg-base-active" : "hover:bg-base-hover"}`}
    >
      {active && (
        <motion.span
          layoutId="active-chat-pill"
          className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-gradient-to-b from-brand-lav to-brand-accent"
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
      <Avatar
        name={chat.name}
        color={chat.kind === "dm" ? chat.partner.color : (chat.color || "#8B5CF6")}
        size={44}
        online={online}
      />
      <span className="flex-1 min-w-0">
        <span className="flex items-baseline justify-between gap-2">
          <span className="font-semibold truncate text-[15px] tracking-tight">{chat.name}</span>
          {chat.lastAt > 0 && (
            <span className={`text-[11px] shrink-0 tabular-nums ${active ? "text-brand font-semibold" : "text-ink-3"}`}>
              {timeAgo(chat.lastAt)}
            </span>
          )}
        </span>
        <span className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-[13px] text-ink-3 truncate flex-1 min-w-0">
            <Preview chat={chat} meId={meId} />
          </span>
          <Badge count={chat.unread} />
        </span>
      </span>
    </button>
  );
}

export default function Sidebar({ mobileHidden }) {
  const w = useWhispr();
  const { dark, toggle } = useTheme();
  const [modal, setModal] = useState(null); // "create" | "join" | "dm" — null = closed
  const [filter, setFilter] = useState("");
  const [menu, setMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const q = filter.trim().toLowerCase();
  const circles = useMemo(() => w.chats.filter((c) => c.kind === "circle" && c.name.toLowerCase().includes(q)), [w.chats, q]);
  const dms = useMemo(() => w.chats.filter((c) => c.kind === "dm" && c.name.toLowerCase().includes(q)), [w.chats, q]);
  const totalUnread = w.chats.reduce((n, c) => n + (c.unread || 0), 0);

  const openEdit = () => { setNewName(w.user.displayName); setEditOpen(true); setMenu(false); };
  const saveProfile = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await w.updateProfile(newName.trim());
      toast.success("Profile updated", "Your display name is live everywhere.");
      setEditOpen(false);
    } catch (e) { toast.error("Couldn't save", e.message); }
    setSaving(false);
  };

  return (
    <aside
      className={`flex-col h-full shrink-0 bg-base-sidebar border-r border-line transition-[width] duration-200 ease-out
        ${mobileHidden ? "hidden md:flex" : "flex"} ${collapsed ? "w-[76px]" : "w-full md:w-[324px]"}`}
      aria-label="Conversations"
    >
      <ConnectionBanner />

      {/* brand header */}
      <div className={`flex items-center gap-2.5 px-4 pt-4 pb-3 ${collapsed ? "flex-col px-2" : ""}`}>
        <Logo size={36} />
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="font-extrabold text-[19px] leading-none tracking-tight bg-gradient-to-r from-brand-lav via-brand to-brand-pink bg-clip-text text-transparent">
              Whispr
            </h1>
            <p className="text-[11px] text-ink-3 mt-0.5 font-medium">private circles</p>
          </div>
        )}
        {!collapsed && (
          <IconButton tip="New chat" label="New chat" size={36}
            className="bg-gradient-to-br from-brand-accent to-brand-deep !text-white shadow-glow hover:brightness-110"
            onClick={() => setModal("create")}>
            <Plus size={18} strokeWidth={2.5} />
          </IconButton>
        )}
        {!collapsed && (
          <IconButton tip="Search messages" label="Search messages" size={36} onClick={() => setSearchOpen(true)}>
            <Search size={17} />
          </IconButton>
        )}
        <div className={`relative ${collapsed ? "mt-1" : ""}`}>
          <button
            onClick={() => setMenu((m) => !m)}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label="Account menu" aria-haspopup="menu" aria-expanded={menu}
            className="pressable rounded-full block"
          >
            <Avatar name={w.user.displayName} color={w.user.color} size={36} />
          </button>
          <Dropdown open={menu} onClose={() => setMenu(false)}>
            <div className="px-3.5 py-2.5 border-b border-line mb-1">
              <p className="font-semibold truncate text-[15px]">{w.user.displayName}</p>
              <p className="text-xs text-ink-3 truncate">@{w.user.username}</p>
            </div>
            <MenuItem icon={dark ? <Sun size={16} /> : <Moon size={16} />}
              onClick={() => { toggle(); setMenu(false); }}>
              {dark ? "Light mode" : "Dark mode"}
            </MenuItem>
            <MenuItem icon={<Pencil size={16} />} onClick={openEdit}>
              Edit profile
            </MenuItem>
            <MenuItem icon={<RefreshCw size={16} />} onClick={() => { w.refreshChats(); setMenu(false); }}>
              Refresh chats
            </MenuItem>
            <div className="divider my-1.5 mx-3" />
            <MenuItem icon={<LogOut size={16} />} danger
              onClick={() => { setMenu(false); if (window.confirm("Log out of Whispr?")) w.logout(); }}>
              Log out
            </MenuItem>
          </Dropdown>
        </div>
      </div>

      {collapsed ? (
        /* icon rail */
        <div className="flex-1 flex flex-col items-center gap-2 py-2">
          <IconButton tip="New chat" label="New chat" size={44}
            className="bg-gradient-to-br from-brand-accent to-brand-deep !text-white shadow-glow"
            onClick={() => setModal("create")}>
            <Plus size={20} strokeWidth={2.5} />
          </IconButton>
          <IconButton tip={dark ? "Light mode" : "Dark mode"} label="Toggle theme" size={44} onClick={toggle}>
            {dark ? <Sun size={19} /> : <Moon size={19} />}
          </IconButton>
          <div className="flex-1" />
          <IconButton tip="Expand sidebar" label="Expand sidebar" size={44} onClick={() => setCollapsed(false)}>
            <ChevronsRight size={19} />
          </IconButton>
        </div>
      ) : (
        <>
          {/* search */}
          <div className="px-3 pb-1">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search conversations"
                aria-label="Search conversations"
                className="w-full rounded-md2 bg-base-elev border border-line pl-10 pr-3 py-2.5 text-sm
                  hover:border-ink-3 focus:border-brand focus:ring-2 focus:ring-brand-soft transition"
              />
            </div>
          </div>

          {/* lists */}
          <nav className="flex-1 overflow-y-auto px-2 pb-2" aria-label="Chat list">
            <SectionLabel right={<span className="text-[11px] text-ink-3 font-semibold">{circles.length}</span>}>
              <span className="inline-flex items-center gap-1.5"><Hash size={12} /> Circles</span>
            </SectionLabel>
            {circles.map((c) => (
              <ChatRow key={c.key} chat={c} meId={w.user.id}
                active={w.activeKey === c.key}
                online={undefined}
                onSelect={() => w.selectChat(c.key)} />
            ))}
            {circles.length === 0 && (
              <p className="text-[13px] text-ink-3 px-3 py-2 leading-relaxed">
                No circles yet — create one or join with an invite code.
              </p>
            )}

            <SectionLabel right={<span className="text-[11px] text-ink-3 font-semibold">{dms.length}</span>}>
              <span className="inline-flex items-center gap-1.5"><MessageCircle size={12} /> Direct</span>
            </SectionLabel>
            {dms.map((c) => (
              <ChatRow key={c.key} chat={c} meId={w.user.id}
                active={w.activeKey === c.key}
                online={w.presence[c.partner.id]?.online}
                onSelect={() => w.selectChat(c.key)} />
            ))}
            {dms.length === 0 && (
              <p className="text-[13px] text-ink-3 px-3 py-2 leading-relaxed">
                No direct chats yet — tap + to message someone.
              </p>
            )}
          </nav>

          {/* footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-line">
            <p className="text-[11px] text-ink-3 font-medium">Whispr v4 · invite-only</p>
            <div className="flex items-center gap-2">
              {totalUnread > 0 && <Badge count={totalUnread} />}
              <IconButton tip="Collapse sidebar" label="Collapse sidebar" size={30} onClick={() => setCollapsed(true)}
                className="hidden md:inline-flex">
                <ChevronsLeft size={16} />
              </IconButton>
            </div>
          </div>
        </>
      )}

      <NewChatModal open={!!modal} initialTab={modal || "create"} onClose={() => setModal(null)} />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* edit profile dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Edit profile">
        <TextInput label="Display name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={30}
          placeholder="What should friends call you?"
          onKeyDown={(e) => e.key === "Enter" && saveProfile()} />
        <p className="text-xs text-ink-3 mt-2">Your username @{w.user.username} stays the same.</p>
        <div className="flex gap-2.5 mt-5 justify-end">
          <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button loading={saving} disabled={!newName.trim()} onClick={saveProfile}>Save</Button>
        </div>
      </Dialog>
    </aside>
  );
}
