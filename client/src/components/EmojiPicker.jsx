// Native emoji grid — no external API, works offline.
import { useState } from "react";

const GROUPS = {
  Smileys: ["😀","😁","😂","🤣","😊","😍","😘","😎","🤔","😐","🙄","😴","😷","🤯","🥳","😢","😭","😡","👍","👎","👏","🙏","💪","✌️","🤝","👋"],
  Hearts: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","💯","✨","🔥","🎉","🎊","💡","⭐","🌟","💤"],
  Gestures: ["👋","🤚","✋","👌","🤏","✌️","🤞","🤟","🤘","👊","✊","🤛","🤜","🙌","👏","💅","💃","🕺"],
  Nature: ["🌞","🌙","⭐","🌈","🔥","💧","🌊","🌴","🌵","🌷","🌹","🍀","🐶","🐱","🦊","🐼","🦁","🐸"],
  Food: ["🍎","🍕","🍔","🍟","🌮","🍩","🍪","🎂","🍫","☕","🧋","🍺","🍷","🥤","🍇","🍓"],
  Objects: ["⚽","🏀","🎮","🎧","📱","💻","📷","🎸","🚗","✈️","🚀","⏰","💡","🔑","🎁","💰","📚","✏️"],
};

export const QUICK = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

export default function EmojiPicker({ onPick, onClose, inline = false }) {
  const [tab, setTab] = useState("Smileys");
  return (
    <div
      role="dialog" aria-label="Emoji picker"
      className={inline
        ? "w-64 rounded-md2 border border-line bg-base-elev shadow-lift p-2"
        : "w-72 rounded-lg2 border border-line bg-base-elev shadow-lift p-2"}
    >
      <div className="flex gap-1 overflow-x-auto pb-2 border-b border-line" role="tablist" aria-label="Emoji categories">
        {Object.keys(GROUPS).map((g) => (
          <button
            key={g} role="tab" aria-selected={tab === g}
            onClick={() => setTab(g)}
            className={`text-xs font-semibold px-2.5 py-1.5 rounded-full whitespace-nowrap transition
              ${tab === g ? "bg-gradient-to-br from-brand-accent to-brand-deep text-white" : "text-ink-3 hover:bg-base-hover hover:text-ink-1"}`}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-0.5 max-h-52 overflow-y-auto pt-2" role="tabpanel">
        {GROUPS[tab].map((e) => (
          <button key={e} aria-label={`emoji ${e}`}
            onClick={() => { onPick(e); onClose && onClose(); }}
            className="pressable text-[22px] p-1 rounded-lg hover:bg-base-hover leading-none">
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
