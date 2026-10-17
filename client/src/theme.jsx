// Theme system: OS preference on first visit, persisted override, smooth cross-fade.
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const KEY = "whispr-theme";
const Ctx = createContext(null);
export const useTheme = () => useContext(Ctx);

function initialDark() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(initialDark);

  // keep <html> class in sync (the inline no-flash script in index.html sets it first)
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const setMode = useCallback((next) => {
    // smooth cross-fade: enable transitions briefly, then remove the helper class
    document.documentElement.classList.add("theming");
    setDark(next);
    try { localStorage.setItem(KEY, next ? "dark" : "light"); } catch {}
    window.setTimeout(() => document.documentElement.classList.remove("theming"), 320);
  }, []);

  const toggle = useCallback(() => setMode(!dark), [dark, setMode]);

  // follow OS changes only until the user picks explicitly
  useEffect(() => {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch {}
    if (saved) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return <Ctx.Provider value={{ dark, toggle, setMode }}>{children}</Ctx.Provider>;
}
