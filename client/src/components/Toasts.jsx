// In-app toast notifications — icon, title, supporting text, accent border,
// auto-dismiss, dedupe (handled in toast.js), live-region announcements.
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info, X, WifiOff } from "lucide-react";
import { subscribeToasts } from "../toast";

const ICONS = {
  success: <CheckCircle2 size={19} className="text-success shrink-0" aria-hidden />,
  error: <XCircle size={19} className="text-danger shrink-0" aria-hidden />,
  info: <Info size={19} className="text-brand shrink-0" aria-hidden />,
  offline: <WifiOff size={19} className="text-warning shrink-0" aria-hidden />,
};

const ACCENT = {
  success: "border-l-success",
  error: "border-l-danger",
  info: "border-l-brand",
  offline: "border-l-warning",
};

const DURATION = { success: 3600, info: 4000, error: 5200, offline: 6000 };

function ToastCard({ t, onClose }) {
  useEffect(() => {
    if (t.sticky) return;
    const id = setTimeout(onClose, DURATION[t.kind] || 4000);
    return () => clearTimeout(id);
  }, [t, onClose]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      role="status"
      className={`pointer-events-auto w-[calc(100vw-2rem)] max-w-sm rounded-md2 border border-line border-l-4 ${ACCENT[t.kind] || ACCENT.info}
        bg-base-elev/95 backdrop-blur shadow-lift px-3.5 py-3 flex items-start gap-2.5`}
    >
      {ICONS[t.kind] || ICONS.info}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold leading-snug">{t.title}</p>
        {t.body && <p className="text-xs text-ink-3 mt-0.5 leading-relaxed break-words">{t.body}</p>}
      </div>
      <button
        onClick={onClose}
        aria-label="Dismiss notification"
        className="pressable p-1 -m-0.5 rounded-full text-ink-3 hover:text-ink-1 hover:bg-base-hover shrink-0"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

export default function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => subscribeToasts((t) => {
    setItems((prev) => [...prev.slice(-3), t]); // cap the stack at 4
  }), []);

  const close = (id) => setItems((prev) => prev.filter((t) => t.id !== id));

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed z-[90] pointer-events-none flex flex-col gap-2 items-end
        top-3 left-1/2 -translate-x-1/2
        sm:top-auto sm:left-auto sm:translate-x-0 sm:bottom-5 sm:right-5 sm:items-end"
    >
      <AnimatePresence>
        {items.map((t) => <ToastCard key={t.id} t={t} onClose={() => close(t.id)} />)}
      </AnimatePresence>
    </div>
  );
}
