// Login / register screen — premium ambient design, staggered entrance.
import { useState } from "react";
import { motion } from "framer-motion";
import { User, AtSign, Lock, ArrowRight, Timer, Zap, Palette, KeyRound, TriangleAlert } from "lucide-react";
import { useWhispr } from "../store";
import Logo from "../components/Logo";
import { Button, TextInput } from "../components/ui";

const FEATURES = [
  { icon: <Timer size={17} />, title: "Whisper mode", desc: "Messages that self-destruct" },
  { icon: <Zap size={17} />, title: "Nudge", desc: "Buzz a friend's screen" },
  { icon: <Palette size={17} />, title: "Mood bubbles", desc: "A vibe for every chat" },
  { icon: <KeyRound size={17} />, title: "Invite codes", desc: "Private circles only" },
];

export default function AuthPage() {
  const { login, register } = useWhispr();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      if (mode === "login") await login(username.trim(), password);
      else await register(username.trim(), password, displayName.trim() || username.trim());
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  return (
    <div className="min-h-full ambient flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-md py-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}
          className="text-center mb-7"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.05 }}
            className="inline-block"
          >
            <Logo size={76} />
          </motion.div>
          <h1 className="text-[40px] font-extrabold mt-3 tracking-tight bg-gradient-to-r from-brand-lav via-brand to-brand-pink bg-clip-text text-transparent">
            Whispr
          </h1>
          <p className="text-ink-3 mt-1 text-[15px]">private circles · whisper what matters</p>
        </motion.div>

        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
          className="card p-6 sm:p-8 shadow-lift"
        >
          <div className="flex gap-1 p-1 rounded-md2 bg-base-hover mb-6" role="tablist" aria-label="Authentication mode">
            {[["login", "Log in"], ["register", "Sign up"]].map(([m, label]) => (
              <button type="button" key={m} role="tab" aria-selected={mode === m}
                onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition relative ${mode === m ? "text-ink-1" : "text-ink-3 hover:text-ink-2"}`}>
                {mode === m && (
                  <motion.span layoutId="auth-tab" className="absolute inset-0 bg-base-elev rounded-lg shadow-soft border border-line"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }} />
                )}
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>

          {error && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 text-sm text-danger bg-danger-soft border border-danger-soft rounded-md2 px-3.5 py-2.5 mb-5"
              role="alert">
              <TriangleAlert size={16} className="shrink-0 mt-0.5" /> {error}
            </motion.p>
          )}

          {mode === "register" && (
            <div className="mb-4">
              <TextInput
                label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={30}
                placeholder="What should friends call you?"
                leftIcon={<User size={16} />} autoComplete="name" />
            </div>
          )}
          <div className="mb-4">
            <TextInput
              label="Username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} required
              placeholder="e.g. srijan" autoComplete="username"
              hint="3–20 characters · letters, numbers, _ and ."
              leftIcon={<AtSign size={16} />} />
          </div>
          <div className="mb-6">
            <TextInput
              label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"}
              leftIcon={<Lock size={16} />} />
          </div>

          <Button type="submit" size="lg" loading={busy} className="w-full group">
            {mode === "login" ? "Log in to Whispr" : "Create my account"}
            {!busy && <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />}
          </Button>

          <p className="text-xs text-ink-3 text-center mt-5 leading-relaxed">
            Friends join from anywhere — deploy once, then share your invite codes.
          </p>
        </motion.form>

        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
          className="grid grid-cols-2 gap-2.5 mt-5"
        >
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 + i * 0.06, duration: 0.3 }}
              className="card !rounded-md2 p-3.5 flex items-start gap-2.5"
            >
              <span className="text-brand shrink-0 mt-0.5">{f.icon}</span>
              <span>
                <span className="block text-[13px] font-bold">{f.title}</span>
                <span className="block text-[11px] text-ink-3 mt-0.5 leading-snug">{f.desc}</span>
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
