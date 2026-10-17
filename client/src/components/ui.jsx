// Whispr UI kit — buttons, inputs, dialogs, menus, badges, skeletons, empty states.
// One consistent visual language; all colors come from CSS-variable tokens.
import React, { forwardRef, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { getSocket } from "../socket";

/* ---------- click-outside hook ---------- */
export function useClickOutside(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", fn);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fn); document.removeEventListener("keydown", esc); };
  }, [onClose]);
  return ref;
}

/* ---------- buttons ---------- */
const BTN_BASE =
  "pressable inline-flex items-center justify-center gap-2 font-semibold select-none " +
  "disabled:opacity-45 disabled:pointer-events-none focus-visible:outline-none";

const BTN_VARIANTS = {
  primary:
    "text-white shadow-glow " +
    "bg-gradient-to-br from-brand-accent to-brand-deep hover:brightness-110",
  secondary:
    "bg-base-elev text-ink-1 border border-line shadow-soft hover:bg-base-hover",
  ghost: "text-ink-2 hover:bg-base-hover hover:text-ink-1",
  destructive: "bg-danger-soft text-danger border border-danger-soft hover:bg-danger-soft",
};

const BTN_SIZES = {
  sm: "text-[13px] px-3 py-1.5 rounded-md2",
  md: "text-sm px-4 py-2.5 rounded-md2",
  lg: "text-[15px] px-5 py-3 rounded-lg2",
};

export function Button({ variant = "primary", size = "md", loading = false, className = "", children, ...props }) {
  return (
    <button
      className={`${BTN_BASE} ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function IconButton({ tip, label, size = 40, className = "", children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label || tip}
      data-tip={tip}
      className={`pressable inline-flex items-center justify-center rounded-full text-ink-2 hover:text-ink-1 hover:bg-base-hover shrink-0 ${className}`}
      style={{ width: size, height: size }}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------- inputs ---------- */
export const TextInput = forwardRef(function TextInput(
  { label, hint, error, leftIcon, className = "", inputClassName = "", ...props }, ref
) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-[13px] font-semibold text-ink-2 mb-1.5">{label}</label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          className={`w-full rounded-md2 bg-base-elev border px-3.5 py-2.5 text-[15px] text-ink-1 transition
            ${leftIcon ? "!pl-10" : ""}
            ${error ? "border-danger" : "border-line hover:border-ink-3 focus:border-brand"}
            focus:ring-2 focus:ring-brand-soft ${inputClassName}`}
          {...props}
        />
      </div>
      {hint && !error && <p className="text-xs text-ink-3 mt-1.5">{hint}</p>}
      {error && <p className="text-xs text-danger font-medium mt-1.5">{error}</p>}
    </div>
  );
});

/* ---------- unread badge ---------- */
export function Badge({ count, className = "" }) {
  if (!count || count <= 0) return null;
  return (
    <span
      className={`shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-gradient-to-br from-brand-accent to-brand-deep
        text-white text-[11px] font-bold inline-flex items-center justify-center shadow-glow ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/* ---------- section label ---------- */
export function SectionLabel({ children, right }) {
  return (
    <div className="flex items-center justify-between px-3 mt-2 mb-1">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">{children}</p>
      {right}
    </div>
  );
}

/* ---------- dialog (modal) ---------- */
export function Dialog({ open, onClose, title, children, labelledBy }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // focus the dialog on open
    const t = setTimeout(() => dialogRef.current?.focus(), 30);
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      // light focus trap: keep Tab inside the dialog
      if (e.key === "Tab" && dialogRef.current) {
        const items = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const list = [...items].filter((el) => !el.disabled);
        if (!list.length) return;
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => { clearTimeout(t); document.removeEventListener("keydown", onKey, true); };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: "var(--overlay)" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
          role="presentation"
        >
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy || "dialog-title"}
            className="card w-full max-w-md p-5 sm:p-6 shadow-lift max-h-[90dvh] overflow-y-auto"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            {title && (
              <div className="flex items-center justify-between mb-4">
                <h2 id={labelledBy || "dialog-title"} className="text-lg font-bold tracking-tight">{title}</h2>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- dropdown menu ---------- */
export function Dropdown({ open, onClose, children, align = "right", className = "" }) {
  const ref = useClickOutside(onClose);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="menu"
          initial={{ opacity: 0, scale: 0.96, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -3 }}
          transition={{ duration: 0.14, ease: "easeOut" }}
          className={`absolute z-[60] min-w-[200px] rounded-md2 border border-line bg-base-elev shadow-lift py-1.5 origin-top
            ${align === "right" ? "right-0" : "left-0"} ${className}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function MenuItem({ icon, danger = false, children, ...props }) {
  return (
    <button
      role="menuitem"
      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-left transition
        ${danger ? "text-danger hover:bg-danger-soft" : "text-ink-1 hover:bg-base-hover"}`}
      {...props}
    >
      {icon && <span className="shrink-0 opacity-80">{icon}</span>}
      {children}
    </button>
  );
}

/* ---------- empty state ---------- */
export function EmptyState({ icon, title, body, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      className="h-full flex flex-col items-center justify-center text-center px-8 py-10"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-accent/15 to-brand-pink/10 border border-line
        flex items-center justify-center text-brand mb-4">
        {icon}
      </div>
      <p className="font-bold text-[15px]">{title}</p>
      {body && <p className="text-sm text-ink-3 mt-1.5 max-w-[260px] leading-relaxed">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}

/* ---------- skeleton rows (chat list loading) ---------- */
export function ChatSkeleton() {
  return (
    <div className="px-2 py-1 space-y-1" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <div className="skeleton w-11 h-11 !rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-2/3" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- connection status hook + banner ---------- */
export function useConnection() {
  const [state, setState] = useState({ online: navigator.onLine, socket: true });

  useEffect(() => {
    const on = () => setState((s) => ({ ...s, online: true }));
    const off = () => setState((s) => ({ ...s, online: false }));
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    const sock = getSocket();
    const onC = () => setState((s) => ({ ...s, socket: true }));
    const onD = () => setState((s) => ({ ...s, socket: false }));
    sock?.on("connect", onC);
    sock?.on("disconnect", onD);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      sock?.off("connect", onC);
      sock?.off("disconnect", onD);
    };
  }, []);

  return state;
}

export function ConnectionBanner() {
  const { online, socket } = useConnection();
  const bad = !online || !socket;
  return (
    <AnimatePresence>
      {bad && (
        <motion.div
          initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden bg-warning-soft border-b border-warning-soft"
          role="status"
        >
          <p className="text-center text-xs font-semibold text-warning py-1.5 px-3">
            {!online ? "You're offline — messages will send when you reconnect." : "Reconnecting to Whispr…"}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
