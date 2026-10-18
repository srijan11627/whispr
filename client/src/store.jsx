// Whispr global store: auth, chat list, messages, and all Socket.io wiring.
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, setToken, getToken } from "./api";
import { connectSocket, disconnectSocket, getSocket } from "./socket";
import { toast } from "./toast";

const Ctx = createContext(null);
export const useWhispr = () => useContext(Ctx);

export const chatKey = (chatType, chatId) => `${chatType}:${chatId}`;
const readKey = (key) => `whispr-lastread-${key}`;

function nudgeBuzz() {
  // playful buzz using WebAudio — no audio assets needed
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    [0, 0.12, 0.24].forEach((t, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = i === 1 ? 520 : 660;
      g.gain.setValueAtTime(0.001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.1);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.12);
    });
  } catch { /* audio not available — visual shake still plays */ }
}

export function WhisprProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [chats, setChats] = useState([]);          // [{key, chatType, chatId, name, ...}]
  const [activeKey, setActiveKey] = useState(null);
  const [messages, setMessages] = useState({});     // key -> Message[]
  const [typing, setTyping] = useState({});        // key -> [{userId, name}]
  const [presence, setPresence] = useState({});    // userId -> {online, lastSeen}
  const [themes, setThemes] = useState({});        // chatKey -> theme name
  const [nudgeTick, setNudgeTick] = useState(0);   // increments to trigger shake
  const [nudgeFrom, setNudgeFrom] = useState("");
  const [jumpTarget, setJumpTarget] = useState(null); // {key, messageId} — scroll-to from global search
  const activeKeyRef = useRef(null);
  activeKeyRef.current = activeKey;
  const userRef = useRef(null);
  userRef.current = user;

  // ---------- auth ----------
  useEffect(() => {
    (async () => {
      if (!getToken()) { setAuthLoading(false); return; }
      try {
        const { user } = await api.me();
        setUser(user);
      } catch { setToken(null); }
      setAuthLoading(false);
    })();
  }, []);

  const login = async (username, password) => {
    const { token, user } = await api.login(username, password);
    setToken(token); setUser(user);
  };
  const register = async (username, password, displayName) => {
    const { token, user } = await api.register(username, password, displayName);
    setToken(token); setUser(user);
  };
  const logout = () => { disconnectSocket(); setToken(null); setUser(null); setChats([]); setMessages({}); setActiveKey(null); setJumpTarget(null); };

  // ---------- chat list ----------
  const refreshChats = async () => {
    if (!userRef.current) return;
    const [{ circles }, { dms }] = await Promise.all([api.myCircles(), api.myDms()]);
    const list = [];
    for (const c of circles) list.push({ key: chatKey("circle", c.id), chatType: "circle", chatId: c.id, name: c.name, code: c.code, description: c.description, color: c.color, memberCount: c.memberCount, kind: "circle" });
    for (const d of dms) list.push({ key: chatKey("dm", d.id), chatType: "dm", chatId: d.id, name: d.partner.displayName, username: d.partner.username, partner: d.partner, kind: "dm" });
    // last-message preview per chat (friends-scale: fine)
    await Promise.all(list.map(async (ch) => {
      try {
        const { messages: ms } = await api.messages(ch.chatType, ch.chatId, { limit: 1 });
        const last = ms[0];
        ch.lastMessage = last ? (last.deleted ? "Message deleted" : last.attachment && !last.body ? `📎 ${last.attachment.name}` : last.body) : "";
        ch.lastAt = last ? last.createdAt : 0;
        ch.lastSenderId = last ? last.sender.id : null;
        // unread = newer than my last-read marker and not mine
        const seen = Number(localStorage.getItem(readKey(ch.key)) || 0);
        ch.unread = last && last.id > seen && last.sender.id !== userRef.current.id ? 1 : 0; // refined on open
      } catch { ch.lastMessage = ""; ch.lastAt = 0; ch.unread = 0; }
    }));
    list.sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
    setChats(list);
  };

  useEffect(() => { if (user) { refreshChats(); api.getThemes().then(({ themes }) => setThemes(themes)).catch(() => {}); } }, [user]);

  // ---------- socket wiring ----------
  useEffect(() => {
    if (!user) return;
    const socket = connectSocket();

    const upsertMessage = (msg) => {
      const key = chatKey(msg.chatType, msg.chatId);
      setMessages((prev) => {
        const arr = prev[key] || [];
        // replace optimistic temp message if it matches
        const idx = arr.findIndex((m) => m.tempId && msg.clientTempId && m.tempId === msg.clientTempId);
        let next;
        if (idx >= 0) { next = [...arr]; next[idx] = msg; }
        else if (arr.some((m) => m.id === msg.id)) next = arr.map((m) => (m.id === msg.id ? msg : m));
        else next = [...arr, msg];
        return { ...prev, [key]: next };
      });
      setChats((prev) => prev.map((c) => c.key === key
        ? { ...c, lastMessage: msg.attachment && !msg.body ? `📎 ${msg.attachment.name}` : msg.body, lastAt: msg.createdAt, lastSenderId: msg.sender.id,
            unread: key === activeKeyRef.current ? 0 : (c.unread || 0) + (msg.sender.id === userRef.current.id ? 0 : 1) }
        : c));
      // auto mark-read if I'm looking at this chat
      if (key === activeKeyRef.current && msg.sender.id !== userRef.current.id) {
        socket.emit("mark-read", { chatType: msg.chatType, chatId: msg.chatId, upTo: msg.id });
        localStorage.setItem(readKey(key), String(msg.id));
        setChats((prev) => prev.map((c) => (c.key === key ? { ...c, unread: 0 } : c)));
      }
    };

    socket.on("new-message", upsertMessage);

    socket.on("typing", ({ chatType, chatId, userId, name, typing: isTyping }) => {
      const key = chatKey(chatType, chatId);
      setTyping((prev) => {
        const cur = (prev[key] || []).filter((t) => t.userId !== userId);
        return { ...prev, [key]: isTyping ? [...cur, { userId, name }] : cur };
      });
      if (isTyping) {
        clearTimeout(socket[`_tt_${key}_${userId}`]);
        socket[`_tt_${key}_${userId}`] = setTimeout(() => {
          setTyping((prev) => ({ ...prev, [key]: (prev[key] || []).filter((t) => t.userId !== userId) }));
        }, 3500);
      }
    });

    socket.on("presence", ({ userId, online, lastSeen }) =>
      setPresence((prev) => ({ ...prev, [userId]: { online, lastSeen } })));

    const patchReceipts = (items, field) => {
      const byChat = {};
      for (const it of items) {
        const key = chatKey(it.chatType, it.chatId);
        (byChat[key] ||= []).push(it);
      }
      setMessages((prev) => {
        const next = { ...prev };
        for (const [key, its] of Object.entries(byChat)) {
          next[key] = (next[key] || []).map((m) => {
            const mine = its.find((it) => it.messageId === m.id);
            if (!mine) return m;
            // set the field only on the matching recipient's receipt row
            const receipts = (m.receipts || []).map((r) =>
              r.userId === mine.userId && !r[field] ? { ...r, [field]: Date.now() } : r);
            // row may be absent if message was just created; add it
            if (!receipts.some((r) => r.userId === mine.userId)) receipts.push({ userId: mine.userId, [field]: Date.now() });
            return { ...m, receipts };
          });
        }
        return next;
      });
    };
    socket.on("delivered", ({ items }) => patchReceipts(items, "deliveredAt"));
    socket.on("read-update", ({ chatType, chatId, userId, upTo }) => {
      const key = chatKey(chatType, chatId);
      setMessages((prev) => ({
        ...prev,
        [key]: (prev[key] || []).map((m) => (m.id <= upTo
          ? { ...m, receipts: (m.receipts || []).map((r) => (r.userId === userId && !r.readAt ? { ...r, readAt: Date.now() } : r)) }
          : m)),
      }));
    });

    socket.on("reaction-update", ({ chatType, chatId, messageId, emoji, userId, userName, added }) => {
      const key = chatKey(chatType, chatId);
      setMessages((prev) => ({
        ...prev,
        [key]: (prev[key] || []).map((m) => {
          if (m.id !== messageId) return m;
          const reactions = [...(m.reactions || [])];
          const i = reactions.findIndex((r) => r.emoji === emoji && r.userId === userId);
          if (added && i < 0) reactions.push({ emoji, userId, userName });
          if (!added && i >= 0) reactions.splice(i, 1);
          return { ...m, reactions };
        }),
      }));
    });

    socket.on("message-edited", ({ messageId, body, editedAt }) => {
      setMessages((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) next[k] = next[k].map((m) => (m.id === messageId ? { ...m, body, editedAt } : m));
        return next;
      });
    });

    socket.on("message-deleted", ({ chatType, chatId, messageId }) => {
      const key = chatKey(chatType, chatId);
      setMessages((prev) => ({
        ...prev,
        [key]: (prev[key] || []).filter((m) => m.id !== messageId),
      }));
    });

    // whisper self-destruct: same removal, plus a discreet notification
    socket.on("whisper-expired", ({ chatType, chatId, messageId }) => {
      const key = chatKey(chatType, chatId);
      setMessages((prev) => ({
        ...prev,
        [key]: (prev[key] || []).filter((m) => m.id !== messageId),
      }));
      if (key === activeKeyRef.current) toast.info("A whisper message self-destructed");
    });

    socket.on("nudged", ({ chatType, chatId, fromName }) => {
      const key = chatKey(chatType, chatId);
      if (key === activeKeyRef.current) {
        setNudgeFrom(fromName);
        setNudgeTick((t) => t + 1);
        nudgeBuzz();
      } else {
        // nudge on a background chat: bump it to top with unread
        setChats((prev) => prev.map((c) => (c.key === key ? { ...c, unread: (c.unread || 0) + 1, nudgedBy: fromName } : c)));
        nudgeBuzz();
      }
    });

    return () => { socket.removeAllListeners(); };
  }, [user]);

  // ---------- chat actions ----------
  const selectChat = async (key) => {
    const ch = chats.find((c) => c.key === key);
    if (!ch) return;
    const socket = connectSocket();
    if (activeKeyRef.current) {
      const [t, id] = activeKeyRef.current.split(":");
      socket.emit("leave-chat", { chatType: t, chatId: Number(id) });
    }
    setActiveKey(key);
    socket.emit("join-chat", { chatType: ch.chatType, chatId: ch.chatId });
    try {
      const { messages: ms } = await api.messages(ch.chatType, ch.chatId);
      setMessages((prev) => ({ ...prev, [key]: ms }));
      const last = ms[ms.length - 1];
      if (last) {
        socket.emit("mark-read", { chatType: ch.chatType, chatId: ch.chatId, upTo: last.id });
        localStorage.setItem(readKey(key), String(last.id));
      }
      setChats((prev) => prev.map((c) => (c.key === key ? { ...c, unread: 0, nudgedBy: undefined } : c)));
      // presence snapshot for header
      socket.emit("get-presence", { chatType: ch.chatType, chatId: ch.chatId }, ({ members } = {}) => {
        if (members) setPresence((prev) => {
          const next = { ...prev };
          for (const m of members) next[m.id] = { online: m.online, lastSeen: m.lastSeen };
          return next;
        });
      });
    } catch (e) { console.error(e); }
  };

  const loadOlder = async (key) => {
    const ch = chats.find((c) => c.key === key);
    const arr = messages[key] || [];
    if (!ch || !arr.length) return false;
    const { messages: older } = await api.messages(ch.chatType, ch.chatId, { before: arr[0].id });
    if (!older.length) return false;
    setMessages((prev) => ({ ...prev, [key]: [...older, ...(prev[key] || [])] }));
    return true;
  };

  const sendMessage = ({ chatType, chatId, body, replyTo, attachment, expiresIn, tempId }) => {
    const socket = connectSocket();
    return new Promise((resolve) => {
      socket.emit("send-message",
        { chatType, chatId, body, replyTo, attachment, expiresIn, clientTempId: tempId },
        (res) => resolve(res));
    });
  };

  const react = (messageId, emoji) => getSocket()?.emit("react", { messageId, emoji });

  // optimistic UI: show the bubble instantly, swap it when the real message broadcasts back
  const addTempMessage = (key, temp) =>
    setMessages((prev) => ({ ...prev, [key]: [...(prev[key] || []), temp] }));
  const failTempMessage = (key, tempId) =>
    setMessages((prev) => ({ ...prev, [key]: (prev[key] || []).map((m) => (m.tempId === tempId ? { ...m, tempFailed: true } : m)) })); const editMessage = (messageId, body) => new Promise((res) => getSocket()?.emit("edit-message", { messageId, body }, res));
  const deleteMessage = async (id) => { await api.deleteMessage(id); };
  const nudge = (chatType, chatId) => getSocket()?.emit("nudge", { chatType, chatId });
  const sendTyping = (chatType, chatId, on) => getSocket()?.emit(on ? "typing-start" : "typing-stop", { chatType, chatId });
  const markRead = (chatType, chatId, upTo) => getSocket()?.emit("mark-read", { chatType, chatId, upTo });

  const createCircle = async (name, opts = {}) => { const { circle } = await api.createCircle(name, opts); await refreshChats(); return circle; };
  const joinCircle = async (code) => { const { circle } = await api.joinCircle(code); await refreshChats(); return circle; };
  const startDm = async (userId) => { const { dmId } = await api.getOrCreateDm(userId); await refreshChats(); return chatKey("dm", dmId); };
  const updateProfile = async (displayName) => { const { user } = await api.updateProfile(displayName); setUser(user); return user; };

  const requestJump = (key, messageId) => setJumpTarget({ key, messageId });
  const clearJump = () => setJumpTarget(null);

  const setMood = async (key, theme) => {
    setThemes((prev) => ({ ...prev, [key]: theme }));
    try { await api.setTheme(key, theme); } catch { /* offline-safe */ }
  };

  const deselectChat = () => {
    if (activeKeyRef.current) {
      const [t, id] = activeKeyRef.current.split(":");
      getSocket()?.emit("leave-chat", { chatType: t, chatId: Number(id) });
    }
    setActiveKey(null);
  };

  const value = useMemo(() => ({
    user, authLoading, login, register, logout, updateProfile,
    chats, activeKey, activeChat: chats.find((c) => c.key === activeKey) || null,
    messages: activeKey ? messages[activeKey] || [] : [],
    typingFor: activeKey ? typing[activeKey] || [] : [],
    presence, themes, nudgeTick, nudgeFrom,
    jumpTarget, requestJump, clearJump,
    selectChat, loadOlder, sendMessage, react, editMessage, deleteMessage,
    nudge, sendTyping, markRead, createCircle, joinCircle, startDm, setMood, refreshChats,
    addTempMessage, failTempMessage, deselectChat,
  }), [user, authLoading, chats, activeKey, messages, typing, presence, themes, nudgeTick, nudgeFrom, jumpTarget]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
