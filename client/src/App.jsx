import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Timer, Zap, Palette, KeyRound } from "lucide-react";
import { useWhispr } from "./store";
import { ThemeProvider } from "./theme";
import AuthPage from "./pages/AuthPage";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import Logo from "./components/Logo";

function BootScreen() {
  return (
    <div className="h-full ambient flex flex-col items-center justify-center gap-4">
      <motion.div animate={{ scale: [1, 1.06, 1], opacity: [1, 0.85, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
        <Logo size={60} />
      </motion.div>
      <p className="text-sm text-ink-3 font-medium">waking up whispr…</p>
    </div>
  );
}

const HIGHLIGHTS = [
  { icon: <Timer size={17} />, title: "Whisper mode", desc: "messages that self-destruct" },
  { icon: <Zap size={17} />, title: "Nudge", desc: "buzz a friend's screen" },
  { icon: <Palette size={17} />, title: "Mood bubbles", desc: "a vibe for every chat" },
  { icon: <KeyRound size={17} />, title: "Invite codes", desc: "private circles only" },
];

function WelcomePane({ name }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
      className="hidden md:flex flex-1 flex-col items-center justify-center text-center px-8 ambient"
    >
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.35 }}>
        <Logo size={88} />
      </motion.div>
      <h2 className="text-[26px] font-extrabold mt-5 tracking-tight">
        Welcome to Whispr, <span className="bg-gradient-to-r from-brand-lav to-brand-pink bg-clip-text text-transparent">{name}</span>
      </h2>
      <p className="text-ink-3 mt-2 max-w-sm text-[15px] leading-relaxed">
        Pick a circle or a friend to start chatting — real-time, private, and yours.
      </p>
      <div className="grid grid-cols-2 gap-2.5 mt-7 max-w-md w-full">
        {HIGHLIGHTS.map((h, i) => (
          <motion.div
            key={h.title}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07, duration: 0.3 }}
            className="card !rounded-md2 p-3.5 text-left flex items-start gap-2.5"
          >
            <span className="text-brand shrink-0 mt-0.5">{h.icon}</span>
            <span>
              <span className="block text-[13px] font-bold">{h.title}</span>
              <span className="block text-[11px] text-ink-3 mt-0.5 leading-snug">{h.desc}</span>
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function Shell() {
  const { user, authLoading, activeKey, deselectChat } = useWhispr();

  if (authLoading) return <BootScreen />;

  return (
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
                  <WelcomePane key="welcome" name={user.displayName} />
                )}
              </AnimatePresence>
            </main>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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
