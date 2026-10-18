import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { MessageCircle, Plus, Link2 } from "lucide-react";
import { useWhispr } from "./store";
import { ThemeProvider } from "./theme";
import AuthPage from "./pages/AuthPage";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import WelcomeSplash from "./components/WelcomeSplash";
import Toaster from "./components/Toasts";
import NewChatModal from "./components/NewChatModal";
import { AnimatedLogo } from "./components/Logo";

const EMPTY_LINES = [
  "Good conversations start somewhere.",
  "Your people are one message away.",
  "A little space for the conversations that matter.",
];

// Expressive empty state (matches the reference: floating mark, pulsing dots,
// constellation field, rotating line, three clear actions).
function EmptyWorkspace() {
  const [line, setLine] = useState(0);
  const [modal, setModal] = useState(null); // "create" | "join" | "dm"
  useEffect(() => {
    const id = setInterval(() => setLine((i) => (i + 1) % EMPTY_LINES.length), 4200);
    return () => clearInterval(id);
  }, []);

  const actions = [
    { id: "dm", icon: <MessageCircle size={17} />, label: "Start a chat" },
    { id: "create", icon: <Plus size={17} />, label: "Create circle" },
    { id: "join", icon: <Link2 size={17} />, label: "Join circle" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
      className="hidden md:flex flex-1 flex-col items-center justify-center text-center px-8 relative overflow-hidden"
    >
      {/* constellation field */}
      <svg className="absolute inset-0 w-full h-full opacity-40" aria-hidden>
        <defs>
          <radialGradient id="star" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="var(--violet)" stopOpacity="0.8" />
            <stop offset="1" stopColor="var(--violet)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {[[12, 22], [24, 68], [38, 30], [55, 74], [68, 26], [80, 58], [90, 34], [8, 80], [46, 88], [72, 86]].map(([x, y], i) => (
          <circle key={i} cx={`${x}%`} cy={`${y}%`} r={2.4} fill="url(#star)">
            <animate attributeName="opacity" values="0.25;0.9;0.25" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" />
          </circle>
        ))}
        <line x1="12%" y1="22%" x2="24%" y2="68%" stroke="var(--violet)" strokeOpacity="0.18" />
        <line x1="38%" y1="30%" x2="55%" y2="74%" stroke="var(--violet)" strokeOpacity="0.14" />
        <line x1="68%" y1="26%" x2="80%" y2="58%" stroke="var(--violet)" strokeOpacity="0.16" />
      </svg>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative"
      >
        <div className="absolute inset-0 -m-8 rounded-full opacity-60"
          style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--violet) 18%, transparent), transparent)" }} />
        <AnimatedLogo size={92} />
      </motion.div>

      <div className="h-8 mt-6 relative w-full max-w-md">
        <AnimatePresence mode="wait">
          <motion.h2
            key={line}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="text-[24px] font-extrabold tracking-tight absolute inset-0"
          >
            {EMPTY_LINES[line]}
          </motion.h2>
        </AnimatePresence>
      </div>
      <p className="text-ink-3 mt-2 max-w-sm text-[15px] leading-relaxed">
        Pick a circle or a friend to start chatting — real-time, private, and yours.
      </p>

      <div className="flex gap-2.5 mt-7">
        {actions.map((a, i) => (
          <motion.button
            key={a.id}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.08, duration: 0.3 }}
            onClick={() => setModal(a.id)}
            className="pressable inline-flex items-center gap-2 px-5 py-3 rounded-md2 text-sm font-bold
              bg-base-elev border border-line shadow-soft hover:border-brand hover:text-brand transition"
          >
            <span className="text-brand">{a.icon}</span> {a.label}
          </motion.button>
        ))}
      </div>

      <NewChatModal open={!!modal} initialTab={modal || "create"} onClose={() => setModal(null)} />
    </motion.div>
  );
}

function Shell() {
  const { user, authLoading, activeKey, deselectChat } = useWhispr();
  const [splashDone, setSplashDone] = useState(false);
  const appReady = !authLoading;

  return (
    <>
      {!splashDone && <WelcomeSplash ready={appReady} onDone={() => setSplashDone(true)} />}
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div key="auth" className="h-full"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <AuthPage />
          </motion.div>
        ) : (
          <motion.div key="app" className="h-full flex flex-col"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className="h-full flex min-h-0">
              {/* sidebar: hidden on mobile when a chat is open */}
              <Sidebar mobileHidden={!!activeKey} />
              {/* chat pane: hidden on mobile until a chat is picked */}
              <main className={`${activeKey ? "flex" : "hidden"} md:flex flex-1 flex-col min-w-0 min-h-0 relative`}>
                <AnimatePresence mode="wait">
                  {activeKey ? (
                    <motion.div key={activeKey} className="flex-1 flex flex-col min-h-0"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                      <ChatWindow onBack={deselectChat} />
                    </motion.div>
                  ) : (
                    <EmptyWorkspace key="welcome" />
                  )}
                </AnimatePresence>
              </main>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Toaster />
    </>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </MotionConfig>
  );
}
