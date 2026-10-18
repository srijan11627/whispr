// Tiny toast bus — no React context needed. Any module can fire a toast;
// <Toaster/> (mounted once in App) renders them.
const subs = new Set();
let seq = 0;
const recent = new Map(); // burst-dedupe: same toast within 2.5s is swallowed

function emit(t) {
  const key = `${t.kind}|${t.title}|${t.body || ""}`;
  const now = Date.now();
  if (recent.has(key) && now - recent.get(key) < 2500) return;
  recent.set(key, now);
  // keep the map small
  if (recent.size > 40) for (const k of recent.keys()) { recent.delete(k); break; }
  for (const fn of subs) fn(t);
}

function show(kind, title, body, opts = {}) {
  emit({ id: ++seq, kind, title, body: body || "", sticky: !!opts.sticky });
}

export const toast = {
  show,
  success: (title, body, opts) => show("success", title, body, opts),
  error: (title, body, opts) => show("error", title, body, opts),
  info: (title, body, opts) => show("info", title, body, opts),
};

export function subscribeToasts(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
