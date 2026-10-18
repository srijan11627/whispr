// Branded welcome experience — cinematic but quick. Overlays the app on every
// fresh load (not on internal navigation), then reveals the real UI.
//  - first visit: ~1.4s, rotating greetings
//  - returning: ~0.8s, single greeting
// Never blocks socket init or data fetching; never gets stuck (hard cap 3.5s).
// Reduced-motion: static logo + wordmark, no sequencing.
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AnimatedLogo } from "./Logo";

const GREETINGS = [
  "A quieter space for your people.",
  "Your little corner of the world.",
  "Some conversations feel like home.",
];

const VISITED_KEY = "whispr-visited";

export default function WelcomeSplash({ ready, onDone }) {
  const [returning] = useState(() => {
    try { return !!localStorage.getItem(VISITED_KEY); } catch { return true; }
  });
  const [greetIdx, setGreetIdx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);

  const minMs = returning ? 800 : 1450;

  useEffect(() => {
    try { localStorage.setItem(VISITED_KEY, "1"); } catch {}
  }, []);

  // rotate greetings on first visit
  useEffect(() => {
    if (returning) return;
    const id = setInterval(() => setGreetIdx((i) => (i + 1) % GREETINGS.length), 1100);
    return () => clearInterval(id);
  }, [returning]);

  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      if (doneRef.current || cancelled) return;
      doneRef.current = true;
      setLeaving(true);
      setTimeout(onDone, 320); // let the fade play
    };
    // reveal when the app is ready AND the minimum cinematic time has passed
    const t0 = Date.now();
    const check = () => {
      if (cancelled) return;
      if (ready || Date.now() - t0 > 2200) finish();
      else timer = setTimeout(check, 120);
    };
    let timer = setTimeout(check, minMs);
    // absolute cap: never stuck, even if the API hangs
    const cap = setTimeout(finish, 3500);
    return () => { cancelled = true; clearTimeout(timer); clearTimeout(cap); };
  }, [ready, minMs, onDone]);

  return (
    <motion.div
      className="splash"
      initial={false}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      aria-hidden
    >
      <div className="splash-glow" />
      <motion.div
        initial={{ scale: 0.82, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <AnimatedLogo size={84} />
      </motion.div>
      <div className="splash-wordmark">Whispr</div>
      <p className="splash-sub">private circles</p>
      <motion.p
        key={greetIdx}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="splash-greeting"
      >
        {GREETINGS[returning ? 0 : greetIdx]}
      </motion.p>
    </motion.div>
  );
}
